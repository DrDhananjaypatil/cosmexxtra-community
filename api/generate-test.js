// /api/generate-test.js — 15-question test series generator for SKINARIO Study page
// Accepts { topic, difficulty } in POST body. Returns a 15-question MCQ test with explanations.
// Frontend writes it to Firestore testSeries collection using client SDK.

// Fisher-Yates shuffle for options (avoids AI's tendency to always place correct answer first)
function shuffleOptions(options, correctIndex) {
  const tagged = options.map((opt, i) => ({ opt, wasCorrect: i === correctIndex }));
  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  const newOptions = tagged.map(t => t.opt);
  const newCorrectIndex = tagged.findIndex(t => t.wasCorrect);
  return { options: newOptions, correctIndex: newCorrectIndex };
}

function buildPrompt(topic, difficulty) {
  return `You are creating a 15-question test series for SKINARIO — a community of AESTHETIC and COSMETOLOGY doctors in India.

This is a KNOWLEDGE TEST that a doctor will complete in 10 minutes. Every question must be about aesthetic/cosmetology practice — procedures, decisions, complications, and clinical judgment that an aesthetic doctor faces in their cosmetic clinic. This is NOT general dermatology.

Topic: ${topic}
Difficulty: ${difficulty}

DIFFICULTY GUIDANCE:
- Easy: fundamentals, indications, contraindications, basic technique
- Moderate: real-world clinical decisions, complications management, side-by-side comparisons of options
- Hard: nuanced cases, uncommon complications, evidence-based dosing debates, complex multimorbid patients

CRITICAL RULES:
1. Each question is a short realistic clinical scenario (2-3 sentences) OR a focused knowledge question.
2. Use Indian patient context — Fitzpatrick III–V skin, common South Asian aesthetic concerns.
3. Each question has 4 plausible options (not 3 — this is a longer test format).
4. All 4 options must be clinically reasonable — no obvious junk distractors.
5. VARY the correctIndex across questions — spread the correct answer across positions 0, 1, 2, 3 roughly evenly across the 15 questions. Never put the correct answer at index 0 for all questions.
6. CONSISTENCY: if a scenario states an explicit constraint (non-invasive, pregnant, breastfeeding, budget-conscious, etc.), the correct answer must respect it.
7. Explanation includes why the correct answer is right, why the others aren't, and a brief clinical pearl.
8. Cover DIFFERENT sub-areas within the topic across the 15 questions — do not cluster all questions on one narrow aspect.

Return ONLY this exact JSON (no markdown, no extra text):
{
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "scenario": "Optional short scenario, or empty string",
      "question": "The question being asked",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "<p>Why the correct answer is right.</p><p>Why the others aren't.</p><p><b>Clinical pearl:</b> A practical takeaway.</p>",
      "subArea": "A short label for the sub-area this question covers (e.g. 'Complications', 'Technique', 'Dosing', 'Indications')"
    }
    // ... 15 total question objects
  ]
}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "GEMINI_API_KEY not configured" });

    const { topic, difficulty } = req.body || {};
    if (!topic || !difficulty) return res.status(400).json({ ok: false, error: "topic and difficulty required" });

    const prompt = buildPrompt(topic, difficulty);
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8000, // 15 questions needs a lot more room than single quiz
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      return res.status(500).json({ ok: false, error: "Gemini API error", details: errText.slice(0, 300) });
    }

    const geminiData = await geminiResp.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return res.status(500).json({ ok: false, error: "No content from Gemini" });

    let parsed;
    try {
      const cleanText = rawText.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Failed to parse JSON", rawText: rawText.slice(0, 300) });
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length < 10) {
      return res.status(500).json({ ok: false, error: "Invalid test structure — need at least 10 questions", parsed });
    }

    // Validate + shuffle each question's options
    const cleanQuestions = [];
    for (const q of parsed.questions.slice(0, 15)) {
      if (!q.question || !Array.isArray(q.options) || q.options.length < 3 || typeof q.correctIndex !== "number") continue;
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) continue;
      const shuffled = shuffleOptions(q.options, q.correctIndex);
      cleanQuestions.push({
        scenario: q.scenario || "",
        question: q.question,
        options: shuffled.options,
        correctIndex: shuffled.correctIndex,
        explanation: q.explanation || "",
        subArea: q.subArea || "",
      });
    }

    if (cleanQuestions.length < 10) {
      return res.status(500).json({ ok: false, error: "Too few valid questions after cleaning", got: cleanQuestions.length });
    }

    return res.status(200).json({
      ok: true,
      test: {
        topic,
        difficulty,
        questions: cleanQuestions,
      },
    });
  } catch (err) {
    console.error("generate-test error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
}

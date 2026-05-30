// /api/generate.js — daily quiz generator for SKINARIO (simple version)
// Calls Gemini to produce a single clinical-scenario MCQ.
// Returns the quiz data; frontend writes it to Firestore using client SDK.
// Only needs GEMINI_API_KEY — no Firebase Admin setup required.

// ═══ AESTHETIC & COSMETOLOGY CATEGORIES (rotated daily) ═══
const CATEGORIES = [
  "Botox & Neurotoxins",
  "Dermal Fillers",
  "Threads",
  "PDRN & Polynucleotides",
  "Peptides & Skin Boosters",
  "Chemical Peels",
  "Laser & Energy Devices",
  "Hair Restoration",
  "Body Contouring",
  "Anti-Aging & Regenerative",
  "Skincare Science",
  "Pigmentation & Melasma",
  "Acne & Scars",
  "Practice Management",
];

// Pick category by day-of-year so we rotate predictably
function pickCategory() {
  const day = Math.floor((Date.now() / 86400000) % CATEGORIES.length);
  return CATEGORIES[day];
}

function pickDifficulty() {
  // 50% Moderate, 30% Easy, 20% Hard
  const r = Math.random();
  if (r < 0.5) return "Moderate";
  if (r < 0.8) return "Easy";
  return "Hard";
}

// ═══ THE PROMPT — strictly aesthetic/cosmetology, real clinical scenarios ═══
function buildPrompt(category, difficulty) {
  return `You are creating a daily clinical quiz question for SKINARIO — a community of AESTHETIC and COSMETOLOGY doctors in India.

SKINARIO is NOT a general dermatology platform. Every question MUST be about aesthetic/cosmetology practice — procedures and decisions that an aesthetic doctor faces in their cosmetic clinic. Examples of in-scope content:
- Injectables: Botulinum toxin, hyaluronic acid fillers, PDRN, polynucleotides, peptides, exosomes, biostimulators, skin boosters
- Threads: PDO/PLLA mono, cog, screw, lifting techniques
- Energy devices: lasers (CO2, Nd:YAG, Q-switched, picosecond), HIFU, RF microneedling, IPL
- Skin treatments: chemical peels, microneedling, mesotherapy, PRP, GFC
- Hair restoration: PRP, GFC, exosomes, FUE/FUT
- Body: cryolipolysis, RF body contouring, EMS, mesotherapy lipolysis
- Pigmentation, melasma, anti-aging, skin rejuvenation protocols
- Practice issues: complications management, consent, marketing, business of aesthetic practice

OUT OF SCOPE — do NOT generate these:
- General dermatology conditions (psoriasis, eczema, fungal infections) UNLESS directly relevant to an aesthetic procedure decision
- Pediatric dermatology, surgical pathology, dermato-oncology
- General internal medicine

Topic: ${category}
Difficulty: ${difficulty}

CRITICAL RULES:
1. Frame it as a SCENARIO — start with a realistic patient walking into an aesthetic clinic.
2. Include relevant clinical details: age, Fitzpatrick skin type, duration, prior treatments.
3. Test PRACTICAL DECISION-MAKING — what would you do in this situation?
4. Avoid abstract textbook trivia — focus on chair-side decisions.
5. Use Indian patient context — Fitzpatrick III–V skin, common South Asian aesthetic concerns.
6. The 3 options must all be PLAUSIBLE clinical actions.
7. The explanation must include why the correct answer is right, why the others are not, and a "Clinical pearl" takeaway.
8. IMPORTANT — VARY THE CORRECT ANSWER POSITION. The correct option should appear at index 0, 1, or 2 with roughly equal frequency over time. Do NOT default to placing the correct answer first. Decide naturally based on what makes the best question, then ORDER the options so the correct one is sometimes first, sometimes second, sometimes third.

Return ONLY this exact JSON (no markdown, no extra text). Replace ALL values — do not copy the example correctIndex below:
{
  "scenario": "Realistic patient scenario in 2-3 sentences",
  "question": "The actual question being asked",
  "options": ["First plausible action", "Second plausible action", "Third plausible action"],
  "correctIndex": 1,
  "explanation": "<p>Why the correct answer is right.</p><p>Why the others aren't.</p><p><b>Clinical pearl:</b> A practical takeaway.</p>",
  "category": "${category}",
  "difficulty": "${difficulty}"
}`;
}

// ═══ SHUFFLE OPTIONS (bulletproof fix for correctIndex bias) ═══
// Even when the AI consistently outputs correctIndex=0, we shuffle the options
// here so the stored correct position is uniformly distributed across 0/1/2.
// We rebuild the options array AND remap correctIndex to wherever the correct
// option lands after shuffling.
function shuffleOptions(options, correctIndex) {
  // Preserve which option was correct using a tag
  const tagged = options.map((opt, i) => ({ opt, wasCorrect: i === correctIndex }));
  // Fisher-Yates shuffle
  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  const newOptions = tagged.map(t => t.opt);
  const newCorrectIndex = tagged.findIndex(t => t.wasCorrect);
  return { options: newOptions, correctIndex: newCorrectIndex };
}

// ═══ MAIN HANDLER ═══
export default async function handler(req, res) {
  // CORS for browser calls
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ ok: false, error: "GEMINI_API_KEY not configured in Vercel" });
    }

    const category = pickCategory();
    const difficulty = pickDifficulty();
    const prompt = buildPrompt(category, difficulty);

    // ═══ CALL GEMINI ═══
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini API error:", errText);
      return res
        .status(500)
        .json({ ok: false, error: "Gemini API error", details: errText.slice(0, 300) });
    }

    const geminiData = await geminiResp.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res
        .status(500)
        .json({ ok: false, error: "No content from Gemini" });
    }

    // Parse JSON (Gemini sometimes wraps in markdown despite mime type)
    let parsed;
    try {
      const cleanText = rawText
        .replace(/^```json\s*/, "")
        .replace(/```\s*$/, "")
        .trim();
      parsed = JSON.parse(cleanText);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "Failed to parse Gemini JSON",
        rawText: rawText.slice(0, 300),
      });
    }

    // Validate structure
    if (
      !parsed.question ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 3 ||
      typeof parsed.correctIndex !== "number"
    ) {
      return res
        .status(500)
        .json({ ok: false, error: "Invalid quiz structure", parsed });
    }

    // Bounds check on correctIndex (must be 0, 1, or 2)
    if (parsed.correctIndex < 0 || parsed.correctIndex >= parsed.options.length) {
      return res.status(500).json({
        ok: false,
        error: "correctIndex out of bounds",
        parsed,
      });
    }

    // ═══ SHUFFLE OPTIONS ═══
    // Even though the prompt now asks the AI to vary the correct position,
    // we shuffle here to guarantee uniform distribution. Belt and suspenders.
    const shuffled = shuffleOptions(parsed.options, parsed.correctIndex);

    // Return the quiz data — frontend will write it to Firestore
    return res.status(200).json({
      ok: true,
      quiz: {
        cat: parsed.category || category,
        diff: parsed.difficulty || difficulty,
        scen: parsed.scenario || "",
        question: parsed.question,
        opts: shuffled.options,
        ci: shuffled.correctIndex,
        expl: parsed.explanation || "",
      },
    });
  } catch (err) {
    console.error("generate error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "Unknown error" });
  }
}

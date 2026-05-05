// /api/generate.js — daily quiz generator for SKINARIO
// Aesthetic & cosmetology focused. Calls Gemini to produce a single
// real-world clinical-scenario MCQ that aesthetic practitioners encounter daily.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ═══ FIREBASE ADMIN INIT (server-side) ═══
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

// ═══ AESTHETIC & COSMETOLOGY CATEGORIES (rotated daily) ═══
// Matches the TOPICS list in App.jsx exactly so admin and quiz stay in sync.
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
const DIFFICULTIES = ["Easy", "Moderate", "Hard"];

// Returns IST date as YYYY-MM-DD
function todayISTDate() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// Pick category by day-of-year so we rotate predictably across all 14 topics
function pickCategory() {
  const day = Math.floor((Date.now() / 86400000) % CATEGORIES.length);
  return CATEGORIES[day];
}

function pickDifficulty() {
  // 50% Moderate, 30% Easy, 20% Hard — most days are real-world cases
  const r = Math.random();
  if (r < 0.5) return "Moderate";
  if (r < 0.8) return "Easy";
  return "Hard";
}

// ═══ THE PROMPT — strictly aesthetic/cosmetology, real clinical scenarios ═══
function buildPrompt(category, difficulty) {
  return `You are creating a daily clinical quiz question for SKINARIO — a community of AESTHETIC and COSMETOLOGY doctors in India.

SKINARIO is NOT a general dermatology platform. Every question MUST be about aesthetic/cosmetology practice — procedures and decisions that an aesthetic doctor faces in their cosmetic clinic. Examples of in-scope content:
- Injectables: Botulinum toxin (Botox, Dysport, Xeomin), hyaluronic acid fillers, PDRN, polynucleotides, peptides, exosomes, biostimulators (Profhilo, Sculptra, Radiesse), skin boosters
- Threads: PDO/PLLA mono, cog, screw, lifting techniques
- Energy devices: lasers (CO2, Nd:YAG, Q-switched, picosecond, Er:YAG), HIFU, RF microneedling, IPL, MFU
- Skin treatments: chemical peels (TCA, Jessner, glycolic, salicylic, mandelic), microneedling, mesotherapy, PRP, GFC
- Hair restoration: PRP for hair, GFC, exosomes, FUE/FUT, mesotherapy for hair
- Body: cryolipolysis, RF body contouring, EMS, mesotherapy lipolysis, HIFU body
- Pigmentation, melasma, anti-aging, skin rejuvenation protocols
- Practice issues: complications management, consent, marketing, patient communication, business of aesthetic practice

OUT OF SCOPE — do NOT generate these:
- General dermatology conditions (psoriasis, eczema, fungal infections, autoimmune skin disease) UNLESS directly relevant to an aesthetic procedure decision
- Pediatric dermatology, surgical pathology, dermato-oncology
- Trichology beyond what aesthetic doctors treat (no alopecia areata pathology, scarring alopecias deeper than aesthetic management)
- General internal medicine

Topic: ${category}
Difficulty: ${difficulty}

CRITICAL RULES for what makes a good question:
1. Frame it as a SCENARIO — start with a realistic patient walking into an aesthetic clinic, e.g.:
   - "A 32-year-old female presents to your clinic for first-time Botox..."
   - "A patient who received hyaluronic acid filler in the nasolabial fold 5 days ago returns with..."
   - "During a consultation for PDRN injection, a 45-year-old asks about..."
   - "A patient developed Tyndall effect 2 weeks after tear trough filler. The most appropriate next step is..."
2. Include relevant clinical details: age, Fitzpatrick skin type, duration, prior treatments, comorbidities, medications, what was injected/used and how much.
3. Test PRACTICAL DECISION-MAKING in aesthetic practice — what would you do in this situation?
4. Avoid abstract textbook trivia (no molecular weight, no mechanism-of-action chemistry) — focus on what the doctor decides at the chair.
5. Use Indian patient context — Fitzpatrick III–V skin, common South Asian aesthetic concerns (PIH, melasma, post-procedure hyperpigmentation, oily/acne-prone skin, facial volumization preferences).
6. The 3 options must all be PLAUSIBLE clinical actions — not obviously wrong distractors. Differentiating between "good vs. better" is more useful than "right vs. crazy."
7. The explanation must include:
   - Why the correct answer is right (1-2 sentences)
   - Why the other options are inappropriate or suboptimal (1-2 sentences)
   - A "Clinical pearl" — a practical takeaway the doctor can apply tomorrow at their clinic

Return ONLY this exact JSON (no markdown, no extra text):
{
  "scenario": "Realistic patient scenario in 2-3 sentences with specific aesthetic clinical details",
  "question": "The actual question being asked (often starts with 'What is the most appropriate...' or 'How should you proceed...' or 'Which technique is best...')",
  "options": ["Option A — practical aesthetic action", "Option B — alternative practical aesthetic action", "Option C — third practical aesthetic action"],
  "correctIndex": 0,
  "explanation": "<p>Why the correct answer is right (1-2 sentences).</p><p>Why the other options are inappropriate or suboptimal (1-2 sentences).</p><p><b>Clinical pearl:</b> A practical takeaway the doctor can use tomorrow at their aesthetic clinic.</p>",
  "category": "${category}",
  "difficulty": "${difficulty}"
}`;
}

// ═══ MAIN HANDLER ═══
export default async function handler(req, res) {
  // CORS for browser calls from your Vercel domain
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const today = todayISTDate();

    // Skip if already generated today (avoid duplicates from manual + cron overlap)
    const existingSnap = await db
      .collection("quizzes")
      .where("date", "==", today)
      .limit(1)
      .get();
    if (!existingSnap.empty && !req.query.force) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        message: "Quiz already exists for today",
        existingId: existingSnap.docs[0].id,
      });
    }

    const category = pickCategory();
    const difficulty = pickDifficulty();
    const prompt = buildPrompt(category, difficulty);

    // ═══ CALL GEMINI ═══
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ ok: false, error: "GEMINI_API_KEY not configured" });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
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
      return res
        .status(500)
        .json({ ok: false, error: "Gemini API error", details: errText });
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

    // ═══ SAVE TO FIRESTORE ═══
    const quizDoc = {
      date: today,
      cat: parsed.category || category,
      diff: parsed.difficulty || difficulty,
      scen: parsed.scenario || "",
      question: parsed.question,
      opts: parsed.options,
      ci: parsed.correctIndex,
      expl: parsed.explanation || "",
      answers: {},
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("quizzes").add(quizDoc);

    return res.status(200).json({
      ok: true,
      id: ref.id,
      date: today,
      category: quizDoc.cat,
      difficulty: quizDoc.diff,
      preview: parsed.question.slice(0, 80),
    });
  } catch (err) {
    console.error("generate error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "Unknown error" });
  }
}

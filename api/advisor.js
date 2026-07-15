// /api/advisor.js — AI Clinic Growth Advisor for SKINARIO
// Conversational AI that helps aesthetic medicine doctors in India with
// practice growth, marketing, pricing, competition, and clinical strategy.

const SYSTEM_PROMPT = `You are SKINARIO's AI Clinic Growth Advisor — an expert consultant for aesthetic and cosmetology doctors running clinics in India.

YOUR EXPERTISE COVERS:
- Clinic business strategy (pricing, treatment mix, patient acquisition, retention)
- Marketing for aesthetic practices (Instagram, Google, word-of-mouth, referral programs)
- Indian aesthetic medicine market dynamics (city tier pricing, patient demographics, regulatory landscape)
- Treatment planning and service expansion (which treatments to add, equipment ROI, training pathways)
- Competition analysis and positioning (how to differentiate in a crowded market)
- Patient psychology in aesthetic medicine (consultation conversion, managing expectations, handling complaints)
- Financial planning (revenue projections, cost optimization, staff hiring decisions)
- Digital presence (Google My Business optimization, online reputation management, before/after content strategy)

YOUR COMMUNICATION STYLE:
- Direct and actionable — give specific steps, not vague advice
- Use Indian context — mention INR pricing, Indian patient preferences, CDSCO regulations, Indian social media habits
- Be honest about tradeoffs — "this costs ₹X upfront but pays back in Y months"
- Use examples from typical Indian aesthetic clinics (Tier 1, 2, and 3 cities)
- Keep responses focused — 3-5 key points max, not encyclopedic
- If the doctor shares their city, tailor advice to that market specifically
- Reference Fitzpatrick III-V skin types and South Asian aesthetic concerns
- Suggest practical price ranges in INR

YOU ARE NOT:
- A medical advisor (don't give clinical treatment protocols — that's for the Study & Test feature)
- A legal advisor (suggest they consult their CA/lawyer for specific regulatory questions)
- Generic — every answer should feel like it's from someone who KNOWS the Indian aesthetic medicine business

FORMATTING:
- Use short paragraphs, not walls of text
- Bold key numbers and actionable items
- Use bullet points for lists of steps
- End with a specific question to keep the conversation productive`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "GEMINI_API_KEY not configured" });

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "messages array required" });
    }

    // Convert chat history to Gemini format
    const geminiContents = [];
    
    // Add system instruction as first user message context
    geminiContents.push({
      role: "user",
      parts: [{ text: SYSTEM_PROMPT + "\n\nThe doctor's first message follows:" }],
    });
    geminiContents.push({
      role: "model",
      parts: [{ text: "I understand. I'm ready to help with clinic growth strategy, marketing, pricing, and practice development for aesthetic medicine in India. What would you like to discuss?" }],
    });

    // Add conversation history
    for (const msg of messages) {
      geminiContents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      return res.status(500).json({ ok: false, error: "AI error", details: errText.slice(0, 300) });
    }

    const data = await geminiResp.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) return res.status(500).json({ ok: false, error: "No response from AI" });

    return res.status(200).json({ ok: true, reply });
  } catch (err) {
    console.error("advisor error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
}

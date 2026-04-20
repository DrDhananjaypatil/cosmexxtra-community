export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    const { prompt } = req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2000 }
        })
      }
    );

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]) {
      const text = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ text });
    } else {
      return res.status(500).json({ error: 'No response from Gemini', details: data });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Generation failed', message: error.message });
  }
}

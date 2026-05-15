// /api/industry-news.js — fetches aesthetic medicine industry news from NewsData.io
// Requires NEWSDATA_API_KEY env var. Without the key, returns empty + clear message.
//
// To activate: sign up free at https://newsdata.io → get API key → add to Vercel
// env vars as NEWSDATA_API_KEY → redeploy.

const NEWSDATA_BASE = "https://newsdata.io/api/1/latest";

// Aesthetic medicine industry search terms
const QUERIES = [
  "botox OR botulinum",
  "dermal filler OR hyaluronic acid",
  "aesthetic medicine OR cosmetic dermatology",
  "skin rejuvenation OR PDRN",
];

// ═══ MAIN HANDLER ═══
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=43200");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      ok: true,
      items: [],
      configured: false,
      message: "NEWSDATA_API_KEY not set in Vercel. Sign up at https://newsdata.io for a free key.",
    });
  }

  try {
    // Rotate query daily so we get variety
    const dayIndex = Math.floor(Date.now() / 86400000) % QUERIES.length;
    const query = QUERIES[dayIndex];

    const params = new URLSearchParams({
      apikey: apiKey,
      q: query,
      language: "en",
      category: "health,science",
      size: "10",
    });
    const url = `${NEWSDATA_BASE}?${params.toString()}`;
    const r = await fetch(url, { headers: { "User-Agent": "SKINARIO/1.0" } });

    if (!r.ok) {
      const errText = await r.text();
      console.error("NewsData HTTP error:", r.status, errText);
      return res.status(200).json({
        ok: false,
        items: [],
        error: `NewsData API returned ${r.status}`,
        details: errText.slice(0, 200),
      });
    }

    const data = await r.json();
    const results = data?.results || [];

    // Map to a normalized shape; cap at 6
    const items = results.slice(0, 6).map((a) => ({
      icon: "📰",
      title: a.title || "",
      description: (a.description || "").slice(0, 200),
      source: a.source_id || a.source_name || "",
      author: Array.isArray(a.creator) ? a.creator.slice(0, 2).join(", ") : (a.creator || ""),
      image: a.image_url || "",
      url: a.link || "",
      pubdate: formatPubDate(a.pubDate),
      country: Array.isArray(a.country) ? a.country[0] : "",
    }));

    return res.status(200).json({
      ok: true,
      items,
      configured: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("industry-news handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error", items: [] });
  }
}

function formatPubDate(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
  } catch {
    return d;
  }
}

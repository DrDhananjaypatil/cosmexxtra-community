// /api/industry-news.js — fetches aesthetic medicine industry news from NewsData.io
// Requires NEWSDATA_API_KEY env var. Without the key, returns empty + clear message.
//
// Fetches in PARALLEL:
//   1. Global aesthetic medicine news (rotating topic)
//   2. India-specific health/cosmetic/regulatory news
// Then interleaves and dedupes results so users always see India coverage.
//
// To activate: sign up free at https://newsdata.io → get API key → add to Vercel
// env vars as NEWSDATA_API_KEY → redeploy.

const NEWSDATA_BASE = "https://newsdata.io/api/1/latest";

// Global aesthetic medicine search terms (rotated daily)
const GLOBAL_QUERIES = [
  "botox OR botulinum",
  "dermal filler OR hyaluronic acid",
  "aesthetic medicine OR cosmetic dermatology",
  "skin rejuvenation OR PDRN",
];

// India-focused queries — broader catch for regulatory + cosmetic news.
// CDSCO publishes rarely, so we cast a wider net here to catch related coverage.
const INDIA_QUERIES = [
  "cosmetic OR dermatology OR aesthetic India",
  "CDSCO OR DCGI OR drug controller cosmetic",
  "skincare OR botox OR filler India",
  "dermatologist OR cosmetologist India regulation",
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
    // Rotate queries daily so we get variety
    const dayIndex = Math.floor(Date.now() / 86400000);
    const globalQ = GLOBAL_QUERIES[dayIndex % GLOBAL_QUERIES.length];
    const indiaQ = INDIA_QUERIES[dayIndex % INDIA_QUERIES.length];

    // Fetch global and India in parallel
    const [globalRes, indiaRes] = await Promise.all([
      fetchNews(apiKey, { q: globalQ, language: "en", category: "health,science", size: "8" }),
      fetchNews(apiKey, { q: indiaQ, language: "en", country: "in", size: "8" }),
    ]);

    const globalItems = (globalRes?.results || []).map(normalize);
    const indiaItems = (indiaRes?.results || []).map(normalize);

    // Tag India items so frontend can show country badge
    indiaItems.forEach(it => { it.region = "India"; });

    // Dedupe by URL (an article occasionally shows up in both feeds)
    const seenUrls = new Set();
    const dedupe = (arr) => arr.filter((it) => {
      if (!it.url || seenUrls.has(it.url)) return false;
      seenUrls.add(it.url);
      return true;
    });

    // Interleave: 1 India, 1 global, 1 India, 1 global... so India coverage is always visible
    const interleaved = [];
    const indiaQueue = dedupe(indiaItems);
    const globalQueue = dedupe(globalItems);
    const maxLen = Math.max(indiaQueue.length, globalQueue.length);
    for (let i = 0; i < maxLen; i++) {
      if (indiaQueue[i]) interleaved.push(indiaQueue[i]);
      if (globalQueue[i]) interleaved.push(globalQueue[i]);
    }

    // Cap at 8 total (frontend slices to 6)
    const items = interleaved.slice(0, 8);

    return res.status(200).json({
      ok: true,
      items,
      configured: true,
      generatedAt: new Date().toISOString(),
      counts: { india: indiaQueue.length, global: globalQueue.length, total: items.length },
    });
  } catch (err) {
    console.error("industry-news handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error", items: [] });
  }
}

// Fetch news with given params; returns parsed JSON or null on error.
async function fetchNews(apiKey, paramsObj) {
  try {
    const params = new URLSearchParams({ apikey: apiKey, ...paramsObj });
    const url = `${NEWSDATA_BASE}?${params.toString()}`;
    const r = await fetch(url, { headers: { "User-Agent": "SKINARIO/1.0" } });
    if (!r.ok) {
      const errText = await r.text();
      console.error("NewsData HTTP error:", r.status, errText.slice(0, 200));
      return null;
    }
    return await r.json();
  } catch (err) {
    console.error("fetchNews error:", err.message);
    return null;
  }
}

// Normalize NewsData article to our shape
function normalize(a) {
  return {
    icon: "📰",
    title: a.title || "",
    description: (a.description || "").slice(0, 200),
    source: a.source_id || a.source_name || "",
    author: Array.isArray(a.creator) ? a.creator.slice(0, 2).join(", ") : (a.creator || ""),
    image: a.image_url || "",
    url: a.link || "",
    pubdate: formatPubDate(a.pubDate),
    country: Array.isArray(a.country) ? a.country[0] : "",
  };
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

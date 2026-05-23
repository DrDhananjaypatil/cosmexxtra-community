// /api/industry-news.js — fetches aesthetic medicine industry news from NewsData.io
// Requires NEWSDATA_API_KEY env var. Without the key, returns empty + clear message.
//
// Strategy:
//   1. Use TIGHT multi-word phrase queries (not single words) — much higher precision
//   2. Post-fetch FILTER: require at least one medical/aesthetic keyword in title
//   3. BLOCKLIST: drop articles whose title contains off-topic words
//      (celebrity birthdays, weather, gold prices, elections, sports, etc.)
//   4. India regulatory channel kept SEPARATE with very tight query
//
// Result: fewer articles but ~90% on-topic. Empty is better than noisy.

const NEWSDATA_BASE = "https://newsdata.io/api/1/latest";

// TIGHT multi-word queries. Quoted phrases force exact match.
// NewsData.io treats phrases in double quotes as exact match.
const GLOBAL_QUERIES = [
  '"aesthetic medicine" OR "cosmetic dermatology"',
  '"dermal filler" OR "hyaluronic acid" injection',
  '"botulinum toxin" OR "neurotoxin"',
  '"laser treatment" skin OR dermatology',
  '"hair restoration" OR "hair transplant" medical',
  '"chemical peel" OR "skin rejuvenation"',
];

// India regulatory — use exact regulator names (low false-positive rate)
const INDIA_REG_QUERIES = [
  '"CDSCO" cosmetic OR drug',
  '"DCGI" India approval',
  'India dermatology guidelines OR regulation',
];

// MUST-HAVE keywords — at least one must appear in title to keep article.
// Curated to medical/aesthetic vocabulary only.
const REQUIRED_KEYWORDS = [
  // Procedures
  "botox", "filler", "fillers", "dermal", "neurotoxin", "neuromodulator", "botulinum",
  "laser", "ipl", "fraxel", "co2",
  "peel", "peeling", "microneedling", "rf microneedling",
  "thread", "pdo", "pdrn",
  "exosome", "biostimulator",
  "rhinoplasty", "blepharoplasty", "facelift", "liposuction",
  "lip augmentation", "cheek augmentation", "chin filler",
  "skin booster", "hydration treatment",
  // Conditions / specialties
  "dermatolog", "dermatitis", "psoriasis", "eczema", "acne", "rosacea",
  "melasma", "pigmentation", "hyperpigmentation", "vitiligo",
  "alopecia", "hair loss", "hair transplant",
  "cosmetic surgery", "cosmetic dermatology", "aesthetic medicine", "aesthetic clinic",
  "plastic surgery", "plastic surgeon",
  "skin cancer", "melanoma", "basal cell",
  "scar revision", "keloid",
  // Drugs / molecules
  "isotretinoin", "tretinoin", "tazarotene", "minoxidil", "finasteride",
  "hyaluronic", "polynucleotide", "polylactic",
  "tranexamic acid", "kojic", "azelaic",
  // Regulatory / industry
  "fda approv", "fda warn", "fda recall",
  "cdsco", "dcgi", "drug controller",
  "clinical trial",
  "cosmetic regulation", "cosmetic safety",
];

// BLOCKLIST — title contains any of these → drop article.
// Captures the noise patterns I saw in real results.
const BLOCKLIST = [
  // Celebrity / entertainment
  "birthday", "birthday wishes", "born on", "born in",
  "actress", "actor", "comedian", "singer", "rapper", "celebrity",
  "diljit", "shah rukh", "salman", "bollywood", "tollywood",
  "wedding", "married", "divorce", "girlfriend", "boyfriend",
  // Weather / disaster
  "weather", "rain", "thunderstorm", "monsoon", "cyclone", "flood", "earthquake",
  "heat wave", "heatwave", "cold wave", "snowfall",
  // Finance / commodities
  "gold rate", "gold price", "silver rate", "silver price",
  "share price", "stock", "ipo", "sensex", "nifty",
  "bitcoin", "crypto",
  "petrol price", "diesel price", "fuel price",
  // Sports
  "cricket", "ipl match", "world cup", "ipl 20", "wpl",
  "football", "fifa", "olympic", "asian games", "commonwealth games",
  "kabaddi", "hockey match", "chess",
  // Politics / general news
  "election", "rally", "manifesto", "parliament", "lok sabha", "rajya sabha",
  "supreme court", "high court verdict",
  // Mass media noise
  "horoscope", "zodiac", "astrology", "tarot",
  "movie review", "trailer", "teaser launch", "box office",
  "song release", "album release",
  // Recipes / lifestyle non-medical
  "recipe", "kitchen tips", "cooking", "saree", "fashion week",
];

const titleMatches = (title, list) => {
  const t = (title || "").toLowerCase();
  return list.some(k => t.includes(k));
};

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
    const indiaQ = INDIA_REG_QUERIES[dayIndex % INDIA_REG_QUERIES.length];

    // Fetch in parallel
    const [globalRes, indiaRes] = await Promise.all([
      fetchNews(apiKey, { q: globalQ, language: "en", category: "health,science", size: "10" }),
      fetchNews(apiKey, { q: indiaQ, language: "en", country: "in", size: "10" }),
    ]);

    let globalItems = (globalRes?.results || []).map(normalize);
    let indiaItems = (indiaRes?.results || []).map(normalize);

    // Tag India items
    indiaItems.forEach(it => { it.region = "India"; });

    // ═══ AGGRESSIVE FILTERING ═══
    const passes = (item) => {
      const title = item.title || "";
      if (!title) return false;
      // Block if title contains banned word
      if (titleMatches(title, BLOCKLIST)) return false;
      // Require at least one medical/aesthetic keyword
      if (!titleMatches(title, REQUIRED_KEYWORDS)) return false;
      return true;
    };

    globalItems = globalItems.filter(passes);
    indiaItems = indiaItems.filter(passes);

    // Dedupe by URL across both feeds
    const seenUrls = new Set();
    const dedupe = (arr) => arr.filter((it) => {
      if (!it.url || seenUrls.has(it.url)) return false;
      seenUrls.add(it.url);
      return true;
    });

    // Interleave: India first when available, then global
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
      counts: {
        india_raw: (indiaRes?.results || []).length,
        india_filtered: indiaQueue.length,
        global_raw: (globalRes?.results || []).length,
        global_filtered: globalQueue.length,
        total: items.length,
      },
    });
  } catch (err) {
    console.error("industry-news handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error", items: [] });
  }
}

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

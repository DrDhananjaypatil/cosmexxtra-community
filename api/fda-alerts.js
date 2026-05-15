// /api/fda-alerts.js — fetches recent FDA recalls and enforcement actions
// relevant to aesthetic / cosmetic medicine. Free public API, no auth needed.

const OPENFDA_BASE = "https://api.fda.gov";

// Aesthetic-relevant product keywords for filtering
const AESTHETIC_KEYWORDS = [
  "botulinum", "botox", "filler", "hyaluronic", "dermal",
  "cosmetic", "aesthetic", "skin", "dermatology",
  "laser", "thread lift", "rejuvenation", "polynucleotide",
  "PDRN", "PRP", "platelet", "HIFU", "microneedling",
];

// Get a Date object N days ago in YYYY-MM-DD format for openFDA query
function daysAgoYMD(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().split("T")[0].replace(/-/g, "");
}

// Fetch drug enforcement reports (recalls)
async function fetchDrugRecalls() {
  const since = daysAgoYMD(180); // last 6 months
  // Query: drug recalls since N days ago that mention aesthetic-relevant terms
  const keywordQuery = AESTHETIC_KEYWORDS
    .map((kw) => `product_description:"${kw}"`)
    .join("+OR+");
  const url = `${OPENFDA_BASE}/drug/enforcement.json?search=(${keywordQuery})+AND+report_date:[${since}+TO+99991231]&limit=10&sort=report_date:desc`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "SKINARIO/1.0" } });
    if (!r.ok) {
      // 404 is normal when no matches found in date range
      if (r.status === 404) return [];
      console.error("FDA drug recalls HTTP error:", r.status);
      return [];
    }
    const data = await r.json();
    return (data.results || []).map((rec) => ({
      type: "drug_recall",
      icon: "💊",
      severity: rec.classification || "",
      title: `Recall: ${(rec.product_description || "").slice(0, 120)}`,
      reason: rec.reason_for_recall || "",
      firm: rec.recalling_firm || "",
      country: rec.country || "",
      date: rec.report_date || "",
      url: `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts`,
      pubdate: formatFDADate(rec.report_date),
    }));
  } catch (e) {
    console.error("FDA drug recalls error:", e.message);
    return [];
  }
}

// Fetch device enforcement reports (recalls)
async function fetchDeviceRecalls() {
  const since = daysAgoYMD(180);
  const keywordQuery = AESTHETIC_KEYWORDS
    .map((kw) => `product_description:"${kw}"`)
    .join("+OR+");
  const url = `${OPENFDA_BASE}/device/enforcement.json?search=(${keywordQuery})+AND+report_date:[${since}+TO+99991231]&limit=10&sort=report_date:desc`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "SKINARIO/1.0" } });
    if (!r.ok) {
      if (r.status === 404) return [];
      console.error("FDA device recalls HTTP error:", r.status);
      return [];
    }
    const data = await r.json();
    return (data.results || []).map((rec) => ({
      type: "device_recall",
      icon: "⚙️",
      severity: rec.classification || "",
      title: `Device Recall: ${(rec.product_description || "").slice(0, 120)}`,
      reason: rec.reason_for_recall || "",
      firm: rec.recalling_firm || "",
      country: rec.country || "",
      date: rec.report_date || "",
      url: `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts`,
      pubdate: formatFDADate(rec.report_date),
    }));
  } catch (e) {
    console.error("FDA device recalls error:", e.message);
    return [];
  }
}

// FDA dates come in YYYYMMDD format — convert to readable form
function formatFDADate(d) {
  if (!d || d.length !== 8) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(d.slice(4, 6)) - 1]} ${d.slice(0, 4)}`;
}

// ═══ MAIN HANDLER ═══
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=43200");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const [drugRecalls, deviceRecalls] = await Promise.all([
      fetchDrugRecalls(),
      fetchDeviceRecalls(),
    ]);

    // Combine and sort by date descending, limit to 6 most recent
    const items = [...drugRecalls, ...deviceRecalls]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 6);

    return res.status(200).json({
      ok: true,
      items,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("fda-alerts handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error", items: [] });
  }
}

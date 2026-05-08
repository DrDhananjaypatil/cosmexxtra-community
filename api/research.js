// /api/research.js — fetches latest aesthetic medicine research from PubMed
// Free public API, no key needed. Returns 5 most-recent papers across SKINARIO's 14 topics.
// Uses correct PubMed reldate parameter for date filtering.

// ═══ TOPIC → PUBMED SEARCH MAPPING ═══
// Looser queries — single concept terms work better than multi-AND combinations.
// PubMed has way more papers indexed under broad terms, narrower combos return nothing.
const TOPIC_QUERIES = [
  { topic: "Botox & Neurotoxins", icon: "💉", q: "botulinum toxin cosmetic" },
  { topic: "Dermal Fillers", icon: "💧", q: "hyaluronic acid dermal filler" },
  { topic: "Threads", icon: "🧵", q: "thread lift PDO" },
  { topic: "PDRN & Polynucleotides", icon: "🧬", q: "polynucleotide skin rejuvenation" },
  { topic: "Peptides & Skin Boosters", icon: "✨", q: "skin booster injectable" },
  { topic: "Chemical Peels", icon: "🧪", q: "chemical peel cosmetic dermatology" },
  { topic: "Laser & Energy Devices", icon: "🔦", q: "laser skin rejuvenation" },
  { topic: "Hair Restoration", icon: "💇", q: "PRP hair loss alopecia" },
  { topic: "Body Contouring", icon: "💪", q: "cryolipolysis body contouring" },
  { topic: "Anti-Aging & Regenerative", icon: "🌱", q: "exosome skin regeneration" },
  { topic: "Skincare Science", icon: "🧴", q: "retinoid niacinamide cosmeceutical" },
  { topic: "Pigmentation & Melasma", icon: "🎨", q: "melasma treatment" },
  { topic: "Acne & Scars", icon: "🔬", q: "acne scar microneedling" },
  { topic: "Practice Management", icon: "📊", q: "aesthetic medicine complications" },
];

// PubMed E-utilities base URL
const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// Date filter: papers from the last 540 days (~18 months) using PubMed's reldate parameter
const RECENT_DAYS = 540;

// Fetch latest PMIDs for a given query
async function searchPubmed(query) {
  // Use reldate parameter (correct PubMed syntax) for date filtering
  // datetype=pdat means publication date
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmode: "json",
    retmax: "2",
    sort: "pub_date",
    datetype: "pdat",
    reldate: String(RECENT_DAYS),
  });
  const url = `${PUBMED_BASE}/esearch.fcgi?${params.toString()}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "SKINARIO/1.0" } });
    if (!r.ok) {
      console.error("PubMed search HTTP error:", r.status, await r.text());
      return [];
    }
    const data = await r.json();
    return data?.esearchresult?.idlist || [];
  } catch (e) {
    console.error("PubMed search error:", e.message);
    return [];
  }
}

// Fetch document summaries for a list of PMIDs
async function fetchSummaries(pmids) {
  if (!pmids.length) return [];
  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "json",
  });
  const url = `${PUBMED_BASE}/esummary.fcgi?${params.toString()}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "SKINARIO/1.0" } });
    if (!r.ok) {
      console.error("PubMed summary HTTP error:", r.status);
      return [];
    }
    const data = await r.json();
    const results = data?.result || {};
    return pmids
      .map((pmid) => {
        const item = results[pmid];
        if (!item) return null;
        return {
          pmid,
          title: (item.title || "").replace(/\.$/, ""),
          journal: item.fulljournalname || item.source || "",
          pubdate: item.pubdate || "",
          authors: (item.authors || []).slice(0, 2).map((a) => a.name).join(", "),
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        };
      })
      .filter(Boolean);
  } catch (e) {
    console.error("PubMed summary error:", e.message);
    return [];
  }
}

// ═══ MAIN HANDLER ═══
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // Cache for 6 hours — research papers don't change rapidly
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=43200");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Pick 5 topics, rotated by hour-of-day so the feed feels fresh but stays predictable
    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60)) % TOPIC_QUERIES.length;
    const selected = [];
    for (let i = 0; i < 5; i++) {
      const idx = (hourSeed + i * 3) % TOPIC_QUERIES.length;
      selected.push(TOPIC_QUERIES[idx]);
    }

    // Fetch latest PMID for each selected topic in parallel
    const searchResults = await Promise.all(
      selected.map(async (t) => {
        const ids = await searchPubmed(t.q);
        return { topic: t.topic, icon: t.icon, pmid: ids[0] || null, query: t.q };
      })
    );

    // Get unique PMIDs and fetch summaries
    const pmids = searchResults.map((r) => r.pmid).filter(Boolean);
    const summaries = await fetchSummaries(pmids);
    const summaryMap = Object.fromEntries(summaries.map((s) => [s.pmid, s]));

    // Combine topic info with paper details
    const items = searchResults
      .map((r) => {
        if (!r.pmid || !summaryMap[r.pmid]) return null;
        const s = summaryMap[r.pmid];
        return {
          topic: r.topic,
          icon: r.icon,
          pmid: s.pmid,
          title: s.title,
          journal: s.journal,
          pubdate: s.pubdate,
          authors: s.authors,
          url: s.url,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      ok: true,
      items,
      generatedAt: new Date().toISOString(),
      // Diagnostics — helps debug if results are empty
      debug: items.length === 0 ? {
        topicsTried: selected.map(s => s.topic),
        pmidsFound: searchResults.filter(r => r.pmid).length,
        summariesFetched: summaries.length,
      } : undefined,
    });
  } catch (err) {
    console.error("research handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error", items: [] });
  }
}

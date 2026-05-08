// /api/research.js — fetches latest aesthetic medicine research from PubMed
// Free public API, no key needed. Returns 5 most-recent papers across SKINARIO's 14 topics.

// ═══ TOPIC → PUBMED SEARCH MAPPING ═══
// Each topic uses MeSH terms + cosmetic/aesthetic qualifiers to filter to relevant papers.
const TOPIC_QUERIES = [
  { topic: "Botox & Neurotoxins", icon: "💉", q: "(botulinum toxin[Title/Abstract]) AND (cosmetic[Title/Abstract] OR aesthetic[Title/Abstract])" },
  { topic: "Dermal Fillers", icon: "💧", q: "(hyaluronic acid filler[Title/Abstract] OR dermal filler[Title/Abstract]) AND (aesthetic[Title/Abstract] OR cosmetic[Title/Abstract])" },
  { topic: "Threads", icon: "🧵", q: "(thread lift[Title/Abstract] OR PDO threads[Title/Abstract] OR PLLA threads[Title/Abstract])" },
  { topic: "PDRN & Polynucleotides", icon: "🧬", q: "(polynucleotide[Title/Abstract] OR PDRN[Title/Abstract]) AND (skin OR rejuvenation OR aesthetic)" },
  { topic: "Peptides & Skin Boosters", icon: "✨", q: "(skin booster[Title/Abstract] OR profhilo[Title/Abstract] OR injectable peptide[Title/Abstract])" },
  { topic: "Chemical Peels", icon: "🧪", q: "(chemical peel[Title/Abstract]) AND (cosmetic[Title/Abstract] OR aesthetic[Title/Abstract] OR melasma[Title/Abstract])" },
  { topic: "Laser & Energy Devices", icon: "🔦", q: "(laser[Title/Abstract] OR HIFU[Title/Abstract] OR radiofrequency[Title/Abstract]) AND (aesthetic[Title/Abstract] OR cosmetic[Title/Abstract] OR rejuvenation[Title/Abstract])" },
  { topic: "Hair Restoration", icon: "💇", q: "(PRP[Title/Abstract] OR platelet rich plasma[Title/Abstract] OR FUE[Title/Abstract]) AND (hair[Title/Abstract] OR alopecia[Title/Abstract])" },
  { topic: "Body Contouring", icon: "💪", q: "(cryolipolysis[Title/Abstract] OR body contouring[Title/Abstract] OR fat reduction[Title/Abstract]) AND (aesthetic[Title/Abstract] OR cosmetic[Title/Abstract])" },
  { topic: "Anti-Aging & Regenerative", icon: "🌱", q: "(exosome[Title/Abstract] OR regenerative[Title/Abstract]) AND (skin[Title/Abstract] OR aesthetic[Title/Abstract] OR rejuvenation[Title/Abstract])" },
  { topic: "Skincare Science", icon: "🧴", q: "(cosmeceutical[Title/Abstract] OR retinoid[Title/Abstract] OR niacinamide[Title/Abstract])" },
  { topic: "Pigmentation & Melasma", icon: "🎨", q: "(melasma[Title/Abstract] OR hyperpigmentation[Title/Abstract]) AND (treatment[Title/Abstract])" },
  { topic: "Acne & Scars", icon: "🔬", q: "(acne scar[Title/Abstract] OR atrophic scar[Title/Abstract]) AND (treatment[Title/Abstract] OR microneedling[Title/Abstract] OR laser[Title/Abstract])" },
  { topic: "Practice Management", icon: "📊", q: "(aesthetic medicine practice[Title/Abstract] OR cosmetic complications[Title/Abstract] OR informed consent[Title/Abstract])" },
];

// PubMed E-utilities base URL
const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// Fetch latest PMIDs for a given query (most recent first, last 18 months)
async function searchPubmed(query) {
  // pubdate filter: papers from last 18 months only — keeps "fresh" feel
  const dateFilter = ' AND ("last 18 months"[PDat])';
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query + dateFilter)}&retmode=json&retmax=2&sort=pub_date`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return data?.esearchresult?.idlist || [];
  } catch (e) {
    console.error("PubMed search error:", e);
    return [];
  }
}

// Fetch document summaries for a list of PMIDs
async function fetchSummaries(pmids) {
  if (!pmids.length) return [];
  const url = `${PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    const results = data?.result || {};
    return pmids
      .map((pmid) => {
        const item = results[pmid];
        if (!item) return null;
        return {
          pmid,
          title: item.title || "",
          journal: item.fulljournalname || item.source || "",
          pubdate: item.pubdate || "",
          authors: (item.authors || []).slice(0, 2).map((a) => a.name).join(", "),
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        };
      })
      .filter(Boolean);
  } catch (e) {
    console.error("PubMed summary error:", e);
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
    // Pick 5 topics randomly each call so the feed feels fresh
    // (deterministic by hour-of-day so same hour shows same selection — easier on PubMed and predictable for users)
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
        return { topic: t.topic, icon: t.icon, pmid: ids[0] || null };
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

    return res.status(200).json({ ok: true, items, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("research handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error", items: [] });
  }
}

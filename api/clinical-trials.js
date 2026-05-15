// /api/clinical-trials.js — fetches active aesthetic medicine clinical trials
// from ClinicalTrials.gov v2 API. Free, no auth needed.

// Aesthetic-relevant condition keywords
const TRIAL_QUERIES = [
  "botulinum toxin cosmetic",
  "dermal filler",
  "polynucleotide skin",
  "thread lift",
  "skin rejuvenation",
  "hair loss PRP",
  "body contouring",
  "melasma treatment",
  "acne scar laser",
];

const CT_BASE = "https://clinicaltrials.gov/api/v2/studies";

// Fetch active studies for a given query
async function searchTrials(query) {
  // v2 API: query.term for free-text, filter.overallStatus for status
  // Get RECRUITING + NOT_YET_RECRUITING + ACTIVE_NOT_RECRUITING (the "current" trials)
  const params = new URLSearchParams({
    "query.term": query,
    "filter.overallStatus": "RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING",
    pageSize: "2",
    fields: "NCTId,BriefTitle,OverallStatus,Phase,StudyType,Condition,StartDate,LocationCountry,LeadSponsorName",
    sort: "@relevance",
  });
  const url = `${CT_BASE}?${params.toString()}`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "SKINARIO/1.0" } });
    if (!r.ok) {
      console.error("ClinicalTrials HTTP error:", r.status);
      return [];
    }
    const data = await r.json();
    return data?.studies || [];
  } catch (e) {
    console.error("ClinicalTrials error:", e.message);
    return [];
  }
}

// ═══ MAIN HANDLER ═══
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=43200");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Rotate which queries we pick each hour (3 of 9 each call)
    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60)) % TRIAL_QUERIES.length;
    const selected = [];
    for (let i = 0; i < 3; i++) {
      selected.push(TRIAL_QUERIES[(hourSeed + i * 3) % TRIAL_QUERIES.length]);
    }

    // Fetch trials for selected queries in parallel
    const results = await Promise.all(selected.map((q) => searchTrials(q)));
    const allStudies = results.flat();

    // Deduplicate by NCTId and limit to 6
    const seen = new Set();
    const items = [];
    for (const study of allStudies) {
      const protocol = study?.protocolSection || {};
      const id = protocol?.identificationModule?.nctId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const status = protocol?.statusModule?.overallStatus || "";
      const phase = protocol?.designModule?.phases?.[0] || "";
      const condition = protocol?.conditionsModule?.conditions?.[0] || "";
      const country = protocol?.contactsLocationsModule?.locations?.[0]?.country || "";
      const sponsor = protocol?.sponsorCollaboratorsModule?.leadSponsor?.name || "";
      const startDate = protocol?.statusModule?.startDateStruct?.date || "";
      items.push({
        icon: "🧪",
        nctId: id,
        title: protocol?.identificationModule?.briefTitle || "",
        status,
        phase,
        condition,
        country,
        sponsor,
        startDate,
        url: `https://clinicaltrials.gov/study/${id}`,
        pubdate: startDate,
      });
      if (items.length >= 6) break;
    }

    return res.status(200).json({
      ok: true,
      items,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("clinical-trials handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error", items: [] });
  }
}

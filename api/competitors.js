// /api/competitors.js — Scan nearby aesthetic clinics using Google Places API
// Returns competitor data: name, rating, reviews, address, distance

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "GOOGLE_PLACES_API_KEY not configured in Vercel env" });

    const { lat, lng, radius = 15000, city } = req.body || {};

    // If no coordinates but city provided, geocode the city first
    let searchLat = lat;
    let searchLng = lng;

    if (!searchLat && city) {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ", India")}&key=${apiKey}`;
      const geoResp = await fetch(geoUrl);
      const geoData = await geoResp.json();
      if (geoData.results?.[0]) {
        searchLat = geoData.results[0].geometry.location.lat;
        searchLng = geoData.results[0].geometry.location.lng;
      }
    }

    if (!searchLat || !searchLng) {
      return res.status(400).json({ ok: false, error: "Provide lat/lng or city name" });
    }

    // Search for aesthetic/dermatology clinics nearby
    const searchQueries = [
      "aesthetic clinic",
      "skin clinic dermatologist",
      "cosmetology clinic",
      "laser skin clinic",
    ];

    const allPlaces = [];
    const seenIds = new Set();

    for (const query of searchQueries) {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${searchLat},${searchLng}&radius=${radius}&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.results) {
        for (const place of data.results) {
          if (seenIds.has(place.place_id)) continue;
          seenIds.add(place.place_id);

          // Calculate approximate distance
          const dLat = (place.geometry.location.lat - searchLat) * 111;
          const dLng = (place.geometry.location.lng - searchLng) * 111 * Math.cos(searchLat * Math.PI / 180);
          const distKm = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10;

          allPlaces.push({
            id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            rating: place.rating || 0,
            reviewCount: place.user_ratings_total || 0,
            priceLevel: place.price_level,
            types: place.types || [],
            isOpen: place.opening_hours?.open_now,
            distanceKm: distKm,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          });
        }
      }
    }

    // Sort by distance, filter within radius
    const filtered = allPlaces
      .filter(p => p.distanceKm <= radius / 1000)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 25); // max 25 competitors

    // Summary stats
    const summary = {
      totalFound: filtered.length,
      avgRating: filtered.length > 0 ? Math.round(filtered.reduce((s, p) => s + p.rating, 0) / filtered.length * 10) / 10 : 0,
      avgReviews: filtered.length > 0 ? Math.round(filtered.reduce((s, p) => s + p.reviewCount, 0) / filtered.length) : 0,
      topRated: filtered.filter(p => p.rating >= 4.5).length,
      within5km: filtered.filter(p => p.distanceKm <= 5).length,
      within10km: filtered.filter(p => p.distanceKm <= 10).length,
    };

    return res.status(200).json({ ok: true, competitors: filtered, summary, searchCenter: { lat: searchLat, lng: searchLng } });
  } catch (err) {
    console.error("competitors error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
}

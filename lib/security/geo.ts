export interface GeoInfo {
  country: string;
  city?: string;
  lat?: number;
  lon?: number;
  isp?: string;
  org?: string;
  asn?: string;
}

const GEO_CACHE = new Map<string, { data: GeoInfo; expires: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

export async function getGeoInfo(ip: string): Promise<GeoInfo | null> {
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { country: "LOCAL", city: "Localhost" };
  }

  const cached = GEO_CACHE.get(ip);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,lat,lon,isp,org,as`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;

    const geo: GeoInfo = {
      country: data.countryCode ?? "XX",
      city: data.city,
      lat: data.lat,
      lon: data.lon,
      isp: data.isp,
      org: data.org,
      asn: data.as,
    };
    GEO_CACHE.set(ip, { data: geo, expires: Date.now() + CACHE_TTL });
    return geo;
  } catch {
    return null;
  }
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isGeoAnomaly(
  previous: GeoInfo | null,
  current: GeoInfo | null,
  maxHours: number = 2
): { anomaly: boolean; reason?: string; distanceKm?: number } {
  if (!previous || !current) return { anomaly: false };
  if (previous.country !== current.country) {
    const dist = previous.lat && previous.lon && current.lat && current.lon
      ? haversineDistance(previous.lat, previous.lon, current.lat, current.lon)
      : undefined;
    return { anomaly: true, reason: `Country changed: ${previous.country} -> ${current.country}`, distanceKm: dist };
  }
  return { anomaly: false };
}
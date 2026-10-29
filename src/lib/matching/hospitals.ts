import type { Hospital, RankedHospital, SchemeHospital, TreatmentLocation } from "@/lib/types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Rank hospitals linked to a scheme for the selected treatment location.
 * Distance is only calculated when both the browser location and the
 * hospital's coordinates exist; otherwise hospitals are grouped by district
 * and state. Links that are not treatment-specific are kept but flagged.
 */
export function rankHospitals(
  links: SchemeHospital[],
  hospitals: Hospital[],
  needId: string,
  location: TreatmentLocation,
): RankedHospital[] {
  const byId = new Map(hospitals.map((h) => [h.id, h]));
  const grouped = new Map<string, SchemeHospital[]>();
  for (const link of links) {
    if (link.needId !== null && link.needId !== needId) continue;
    const list = grouped.get(link.hospitalId) ?? [];
    list.push(link);
    grouped.set(link.hospitalId, list);
  }

  const ranked: RankedHospital[] = [];
  for (const [hospitalId, hospitalLinks] of grouped) {
    const hospital = byId.get(hospitalId);
    if (!hospital) continue;
    let distanceKm: number | null = null;
    let proximity: RankedHospital["proximity"] = "other";
    if (
      location.latitude !== null &&
      location.longitude !== null &&
      hospital.latitude !== null &&
      hospital.longitude !== null
    ) {
      distanceKm = haversineKm(location.latitude, location.longitude, hospital.latitude, hospital.longitude);
      proximity = "distance";
    } else if (location.state && hospital.state === location.state) {
      proximity =
        location.district && norm(hospital.district) === norm(location.district) ? "same_district" : "same_state";
    }
    ranked.push({
      hospital,
      links: hospitalLinks,
      distanceKm,
      proximity,
      treatmentConfirmed: hospitalLinks.some((l) => l.needId === needId && l.status !== "unverified"),
    });
  }

  const proximityRank = { distance: 0, same_district: 1, same_state: 2, other: 3 } as const;
  return ranked.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    const p = proximityRank[a.proximity] - proximityRank[b.proximity];
    if (p !== 0) return p;
    if (a.treatmentConfirmed !== b.treatmentConfirmed) return a.treatmentConfirmed ? -1 : 1;
    return a.hospital.name.localeCompare(b.hospital.name);
  });
}

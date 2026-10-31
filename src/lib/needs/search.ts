import type { MedicalNeed } from "@/lib/types";

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\bleukemia\b/g, "leukaemia")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function findSupportedNeed(query: string, needs: MedicalNeed[]): MedicalNeed | undefined {
  const entered = normalize(query);
  return needs.find((need) => normalize(need.name) === entered);
}

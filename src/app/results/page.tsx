import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ResultsView } from "@/components/results/results-view";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage() {
  await requireUser("/results");
  return <ResultsView />;
}

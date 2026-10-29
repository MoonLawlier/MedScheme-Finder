import { FileText, Sparkles } from "lucide-react";
import { ExternalLink } from "@/components/ui/button";
import { sourceTypeLabel } from "@/components/results/labels";
import type { Source } from "@/lib/types";
import { safeExternalUrl } from "@/lib/utils/cn";

/** Distinguishes official information from platform-generated explanations. */
export function SourceTag({ sourceId, sources }: { sourceId: string | null; sources: Map<string, Source> }) {
  if (!sourceId) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
        <Sparkles className="size-3" aria-hidden /> Platform guidance, not an official statement
      </span>
    );
  }
  const src = sources.get(sourceId);
  if (!src) return null;
  const url = safeExternalUrl(src.url);
  const label = `${sourceTypeLabel[src.sourceType]}: ${src.publisher}`;
  return url ? (
    <ExternalLink
      href={url}
      className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
      title={src.title}
    >
      <FileText className="size-3" aria-hidden /> {label}
    </ExternalLink>
  ) : (
    <span className="text-xs text-muted">{label}</span>
  );
}

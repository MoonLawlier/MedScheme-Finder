import { AlertTriangle, CheckCircle2, CircleHelp, Info, MinusCircle, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { OverallStatus, RuleDisplayStatus } from "@/lib/types";

type Tone = "info" | "warn" | "error" | "success" | "neutral";

const toneClass: Record<Tone, string> = {
  info: "border-info/25 bg-info-wash text-ink",
  warn: "border-warn/30 bg-warn-wash text-ink",
  error: "border-bad/30 bg-bad-wash text-ink",
  success: "border-ok/30 bg-ok-wash text-ink",
  neutral: "border-line bg-surface text-ink",
};
const toneIcon: Record<Tone, ReactNode> = {
  info: <Info className="size-5 shrink-0 text-info" aria-hidden />,
  warn: <AlertTriangle className="size-5 shrink-0 text-warn" aria-hidden />,
  error: <XCircle className="size-5 shrink-0 text-bad" aria-hidden />,
  success: <CheckCircle2 className="size-5 shrink-0 text-ok" aria-hidden />,
  neutral: <Info className="size-5 shrink-0 text-muted" aria-hidden />,
};

export function Notice({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div role={role} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", toneClass[tone], className)}>
      {toneIcon[tone]}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-soft [&_a]:font-medium [&_a]:text-teal [&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}

const ruleStamp: Record<RuleDisplayStatus, { label: string; cls: string; icon: ReactNode }> = {
  meets: { label: "Meets known criterion", cls: "text-ok bg-ok-wash", icon: <CheckCircle2 className="size-3.5" aria-hidden /> },
  does_not_meet: { label: "Does not meet", cls: "text-bad bg-bad-wash", icon: <XCircle className="size-3.5" aria-hidden /> },
  missing_info: { label: "Information missing", cls: "text-info bg-info-wash", icon: <MinusCircle className="size-3.5" aria-hidden /> },
  requires_verification: { label: "Needs official check", cls: "text-warn bg-warn-wash", icon: <CircleHelp className="size-3.5" aria-hidden /> },
};

export function RuleStamp({ status }: { status: RuleDisplayStatus }) {
  const s = ruleStamp[status];
  return (
    <span className={cn("stamp", s.cls)}>
      {s.icon}
      {s.label}
    </span>
  );
}

export const overallLabel: Record<OverallStatus, string> = {
  potential_match: "Potential match",
  needs_verification: "Needs verification",
  does_not_match: "Does not meet a known criterion",
};

const overallCls: Record<OverallStatus, string> = {
  potential_match: "text-ok bg-ok-wash",
  needs_verification: "text-warn bg-warn-wash",
  does_not_match: "text-bad bg-bad-wash",
};

export function OverallStamp({ status }: { status: OverallStatus }) {
  const icon =
    status === "potential_match" ? (
      <CheckCircle2 className="size-3.5" aria-hidden />
    ) : status === "needs_verification" ? (
      <CircleHelp className="size-3.5" aria-hidden />
    ) : (
      <XCircle className="size-3.5" aria-hidden />
    );
  return (
    <span className={cn("stamp", overallCls[status])}>
      {icon}
      {overallLabel[status]}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-0.5 text-xs font-medium text-ink-soft", className)}>
      {children}
    </span>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-line bg-surface p-5 sm:p-6", className)}>{children}</section>;
}

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export const inputClass =
  "block w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[0.95rem] text-ink placeholder:text-muted/70 focus:border-teal focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-1 aria-[invalid=true]:border-bad";

interface FieldProps {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint + error, with required/optional marked in words. */
export function Field({ id, label, required, hint, error, badge, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}{" "}
          <span className="font-normal text-muted">{required ? "(required)" : "(optional)"}</span>
        </label>
        {badge}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[0.8125rem] font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: unknown) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(inputClass, "appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235e7182' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
}

interface ChoiceOption {
  value: string;
  label: string;
}

/** Radio group rendered as wrapping pills. Native radios keep keyboard behaviour. */
export function ChoicePills({
  name,
  legend,
  options,
  value,
  onChange,
  required,
  hint,
  error,
  badge,
}: {
  name: string;
  legend: ReactNode;
  options: ChoiceOption[];
  value: string | null;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  badge?: ReactNode;
}) {
  return (
    <fieldset className="space-y-2" aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <legend className="text-sm font-semibold text-ink">
          {legend} <span className="font-normal text-muted">{required ? "(required)" : "(optional)"}</span>
        </legend>
        {badge}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
                checked ? "border-teal bg-teal-wash font-medium text-teal-strong" : "border-line-strong bg-surface text-ink-soft hover:border-ink-soft",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {hint && !error && (
        <p id={`${name}-hint`} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} role="alert" className="text-[0.8125rem] font-medium text-bad">
          {error}
        </p>
      )}
    </fieldset>
  );
}

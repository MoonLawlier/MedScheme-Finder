import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Panel className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-ink-soft">The page or medical need you asked for isn&apos;t available.</p>
        <ButtonLink href="/dashboard">Go to Find schemes</ButtonLink>
      </Panel>
    </div>
  );
}

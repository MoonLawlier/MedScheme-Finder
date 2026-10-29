import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { DataUnavailableError, getReferenceData } from "@/lib/data/reference";
import { getUserStore } from "@/lib/data/user-store";
import type { ApplicationStatusRecord, InteractionRecord, SearchRecord } from "@/lib/data/user-types";
import { StatusSelect } from "@/components/history/status-select";
import { ButtonLink } from "@/components/ui/button";
import { Notice, Panel, Tag } from "@/components/ui/feedback";
import { stateName } from "@/lib/reference/india";
import { formatDate } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Scheme history" };

export default async function HistoryPage() {
  const user = await requireUser("/history");
  let searches: SearchRecord[] = [];
  let interactions: InteractionRecord[] = [];
  let statuses: ApplicationStatusRecord[] = [];
  let names = new Map<string, string>();
  let needNames = new Map<string, string>();
  let error: string | null = null;
  try {
    const store = await getUserStore();
    const [data, s, i, st] = await Promise.all([
      getReferenceData(),
      store.listSearches(user.id, 50),
      store.listInteractions(user.id, 200),
      store.listApplicationStatuses(user.id),
    ]);
    searches = s;
    interactions = i;
    statuses = st;
    names = new Map(data.schemes.map((x) => [x.id, x.officialName]));
    needNames = new Map(data.medicalNeeds.map((n) => [n.id, n.name]));
  } catch (e) {
    error = e instanceof DataUnavailableError ? e.userMessage : "Your history couldn't be loaded.";
  }

  const schemeIds = [...new Set([...interactions.map((i) => i.schemeId), ...statuses.map((s) => s.schemeId)])];
  const isEmpty = !error && searches.length === 0 && schemeIds.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Scheme history</h1>
        <p className="max-w-prose text-ink-soft">
          Your searches and the schemes you looked at. Only you can see this. Answers you typed into a search — including
          medical details — aren&apos;t kept here.
        </p>
      </header>

      {error && (
        <Notice tone="error" role="alert" title={error}>
          Refresh to try again.
        </Notice>
      )}

      {isEmpty ? (
        <Panel className="space-y-4 py-12 text-center">
          <Inbox className="mx-auto size-10 text-muted" aria-hidden />
          <p className="font-display text-3xl font-semibold">Nothing Here!</p>
          <p className="text-ink-soft">Run your first search and the schemes you open will show up here.</p>
          <ButtonLink href="/dashboard">Find medical assistance</ButtonLink>
        </Panel>
      ) : (
        !error && (
          <>
            {schemeIds.length > 0 && (
              <Panel className="space-y-4">
                <h2 className="text-xl font-semibold">Schemes you looked at</h2>
                <ul className="divide-y divide-line">
                  {schemeIds.map((id) => {
                    const mine = interactions.filter((i) => i.schemeId === id);
                    const lastOpened = mine.find((i) => i.action === "opened");
                    const linkVisit = mine.find((i) => i.action === "application_link_clicked");
                    const status = statuses.find((s) => s.schemeId === id)?.status ?? null;
                    const name = names.get(id) ?? id;
                    return (
                      <li key={id} className="space-y-2 py-4">
                        <p className="font-semibold">{name}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {lastOpened && <Tag>Details opened {formatDate(lastOpened.createdAt)}</Tag>}
                          {linkVisit && <Tag>Official link opened {formatDate(linkVisit.createdAt)}</Tag>}
                        </div>
                        {linkVisit && !status && (
                          <p className="text-xs text-muted">Opening the official site doesn&apos;t mean an application was made. Record it below if you applied.</p>
                        )}
                        <StatusSelect schemeId={id} schemeName={name} initial={status} />
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}

            <Panel className="space-y-4">
              <h2 className="text-xl font-semibold">Searches</h2>
              {searches.length === 0 ? (
                <p className="text-sm text-ink-soft">No searches recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="text-muted">
                      <tr className="border-b border-line">
                        <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Medical need</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Mode</th>
                        <th scope="col" className="py-2 font-medium">Results</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searches.map((s) => (
                        <tr key={s.id} className="border-b border-line last:border-0">
                          <td className="py-3 pr-4 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                          <td className="py-3 pr-4">{needNames.get(s.needId) ?? s.needId}</td>
                          <td className="py-3 pr-4">
                            {s.mode === "open" ? "For someone else" : `My profile${s.treatmentState ? `, ${stateName(s.treatmentState)}` : ""}`}
                          </td>
                          <td className="py-3">
                            {s.resultCounts.potential_match} potential, {s.resultCounts.needs_verification} to verify
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )
      )}
    </div>
  );
}

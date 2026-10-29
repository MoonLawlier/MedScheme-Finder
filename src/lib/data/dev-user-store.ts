import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ApplicationStatus,
  ApplicationStatusRecord,
  InteractionRecord,
  Profile,
  SearchRecord,
  UserStore,
} from "@/lib/data/user-types";

interface DevDb {
  profiles: Record<string, Profile>;
  searches: SearchRecord[];
  interactions: InteractionRecord[];
  statuses: ApplicationStatusRecord[];
}

const empty = (): DevDb => ({ profiles: {}, searches: [], interactions: [], statuses: [] });

/**
 * DEVELOPMENT FALLBACK ONLY. A JSON-file store that mirrors the private
 * tables. Every method is scoped by the userId passed in from the verified
 * session, mirroring the RLS policies used in Supabase.
 */
export class DevUserStore implements UserStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async read(): Promise<DevDb> {
    try {
      return { ...empty(), ...JSON.parse(await readFile(this.file, "utf8")) };
    } catch {
      return empty();
    }
  }

  private mutate<T>(fn: (db: DevDb) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const result = fn(db);
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
      await rename(tmp, this.file);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getProfile(userId: string) {
    return (await this.read()).profiles[userId] ?? null;
  }

  upsertProfile(userId: string, data: Omit<Profile, "userId" | "updatedAt">) {
    return this.mutate((db) => {
      const profile: Profile = { ...data, userId, updatedAt: new Date().toISOString() };
      db.profiles[userId] = profile;
      return profile;
    });
  }

  createSearch(userId: string, rec: Omit<SearchRecord, "id" | "userId" | "createdAt">) {
    return this.mutate((db) => {
      const search: SearchRecord = { ...rec, id: randomUUID(), userId, createdAt: new Date().toISOString() };
      db.searches.push(search);
      return search;
    });
  }

  async listSearches(userId: string, limit = 50) {
    return (await this.read()).searches
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async recordInteraction(userId: string, rec: Omit<InteractionRecord, "id" | "userId" | "createdAt">) {
    await this.mutate((db) => {
      // A search id must belong to the same user, as the database FK + RLS would enforce.
      const searchId = rec.searchId && db.searches.some((s) => s.id === rec.searchId && s.userId === userId) ? rec.searchId : null;
      db.interactions.push({ ...rec, searchId, id: randomUUID(), userId, createdAt: new Date().toISOString() });
    });
  }

  async listInteractions(userId: string, limit = 100) {
    return (await this.read()).interactions
      .filter((i) => i.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async setApplicationStatus(userId: string, schemeId: string, status: ApplicationStatus | null) {
    await this.mutate((db) => {
      db.statuses = db.statuses.filter((s) => !(s.userId === userId && s.schemeId === schemeId));
      if (status) db.statuses.push({ userId, schemeId, status, updatedAt: new Date().toISOString() });
    });
  }

  async listApplicationStatuses(userId: string) {
    return (await this.read()).statuses.filter((s) => s.userId === userId);
  }
}

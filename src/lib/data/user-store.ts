import "server-only";
import path from "node:path";
import { backendMode } from "@/lib/config";
import { DataUnavailableError } from "@/lib/data/reference";
import { DevUserStore } from "@/lib/data/dev-user-store";
import { SupabaseUserStore } from "@/lib/data/supabase-user-store";
import type { UserStore } from "@/lib/data/user-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

let devStore: DevUserStore | null = null;

export async function getUserStore(): Promise<UserStore> {
  if (backendMode === "supabase") return new SupabaseUserStore(await createSupabaseServerClient());
  if (backendMode === "dev") {
    devStore ??= new DevUserStore(path.join(process.cwd(), ".data", "dev-store.json"));
    return devStore;
  }
  throw new DataUnavailableError("The database is not configured for this deployment.");
}

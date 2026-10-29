"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/config";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser client — publishable key only. Used for sign-in flows. */
export function getSupabaseBrowserClient() {
  if (!client) client = createBrowserClient(supabaseUrl, supabasePublishableKey);
  return client;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "./supabase/client";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient === null) {
    supabaseClient = createSupabaseClient();
  }

  return supabaseClient;
}

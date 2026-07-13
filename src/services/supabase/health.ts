import "server-only";
import { supabaseAdmin } from "./admin";

export type SupabaseHealthResult = {
  connected: boolean;
  storesTableAccessible: boolean;
};

export async function testSupabaseConnection(): Promise<SupabaseHealthResult> {
  const { error } = await supabaseAdmin.from("stores").select("id", {
    count: "exact",
    head: true,
  });

  if (error) {
    throw new Error(`Supabase connection failed: ${error.message}`);
  }

  return {
    connected: true,
    storesTableAccessible: true,
  };
}

import "server-only";
import { createClient } from "@supabase/supabase-js";

function getRequiredServerEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const supabaseUrl = getRequiredServerEnvironmentVariable(
  "NEXT_PUBLIC_SUPABASE_URL"
);

const supabaseServiceRoleKey = getRequiredServerEnvironmentVariable(
  "SUPABASE_SERVICE_ROLE_KEY"
);

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

import { createClient } from "@supabase/supabase-js";

function getRequiredPublicEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const supabaseUrl = getRequiredPublicEnvironmentVariable(
  "NEXT_PUBLIC_SUPABASE_URL"
);

const supabasePublishableKey = getRequiredPublicEnvironmentVariable(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

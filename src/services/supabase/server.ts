import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getRequiredPublicVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getRequiredPublicVariable("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredPublicVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies. proxy.ts refreshes sessions.
          }
        },
      },
    }
  );
}

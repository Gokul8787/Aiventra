import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/services/supabase/server";

export async function requirePageUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

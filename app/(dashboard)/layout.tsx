import type { ReactNode } from "react";

import { requirePageUser } from "@/auth/requirePageUser";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageUser();

  return children;
}

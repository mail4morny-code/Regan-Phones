import { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";
import type { ProfileRole } from "@/lib/auth/requireProfile";

export function ProtectedShell({
  children,
  notificationCount,
  profile,
}: {
  children: ReactNode;
  notificationCount?: number;
  profile: { fullName: string | null; email: string | null; role: ProfileRole };
}) {
  return <AppShell notificationCount={notificationCount} profile={profile}>{children}</AppShell>;
}


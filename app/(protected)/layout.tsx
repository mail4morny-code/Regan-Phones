import type { ReactNode } from "react";

import { ProtectedShell } from "@/components/shell/ProtectedShell";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { getNotifications } from "@/lib/notifications/getNotifications";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Any authenticated & active profile may access /app/(protected)
  const profile = await requireProfileRole();
  const supabase = await createSupabaseOperationalServerClient(profile);
  const notifications = await getNotifications(supabase, { role: profile.role, userId: profile.id });

  return (
    <ProtectedShell
      notificationCount={notifications.alertCount}
      profile={{
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
      }}
    >
      {children}
    </ProtectedShell>
  );
}




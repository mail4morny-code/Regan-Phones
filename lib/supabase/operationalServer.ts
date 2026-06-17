import type { ProfileRole } from "@/lib/auth/requireProfile";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { tryCreateSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

type OperationalProfile = {
  role: ProfileRole;
  is_active?: boolean;
};

export async function createSupabaseOperationalServerClient(profile: OperationalProfile) {
  if (profile.role === "admin" || profile.role === "worker") {
    const serviceClient = tryCreateSupabaseServiceRoleClient();
    if (serviceClient) return serviceClient;
  }

  return createSupabaseAppServerClient();
}

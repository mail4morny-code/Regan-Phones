import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";

export async function logActivity({
  userId,
  action,
  description,
  phoneId,
  dealerId,
}: {
  userId: string;
  action: string;
  description?: string | null;
  phoneId?: string | null;
  dealerId?: string | null;
}) {
  const supabase = await createSupabaseAppServerClient();

  const payload = {
    user_id: userId,
    action,
    description: description ?? null,
    phone_id: phoneId ?? null,
    dealer_id: dealerId ?? null,
  };

  const { error } = await supabase.from("activity_log").insert(payload);

  if (error) {
    if (isMissingColumnError(error)) {
      const legacy = await supabase.from("activity_log").insert({
        user_id: userId,
        action,
        description: description ?? null,
      });
      if (legacy.error) logSupabaseWarning("[Activity] Failed to write legacy log", legacy.error);
      return;
    }
    logSupabaseWarning("[Activity] Failed to write log", error);
  }
}

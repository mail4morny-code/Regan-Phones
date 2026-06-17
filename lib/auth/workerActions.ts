"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity/logActivity";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatPersonName } from "@/lib/format/display";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";

export type WorkerActionState = { ok: true; message?: string } | { ok: false; error: string };

function cleanPhoneNumber(value: FormDataEntryValue | null) {
  const phone = String(value ?? "").trim();
  return phone.length > 0 ? phone : null;
}

export async function createWorkerAction(
  prevState: unknown,
  formData: FormData
): Promise<WorkerActionState> {
  const admin = await requireProfileRole(["admin"]);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneNumber = cleanPhoneNumber(formData.get("phone_number"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const temporaryPassword = String(formData.get("temporary_password") ?? "");

  if (!fullName) return { ok: false, error: "Name is required." };
  if (!email) return { ok: false, error: "Email is required." };
  if (temporaryPassword.length < 8) return { ok: false, error: "Temporary password must be at least 8 characters." };

  let service;
  try {
    service = createSupabaseServiceRoleClient();
  } catch {
    return {
      ok: false,
      error: "Worker setup is not configured on this server. Add the service role key, restart the app, then try again.",
    };
  }

  const { data: createdUser, error: createErr } = await service.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone_number: phoneNumber,
      role: "worker",
      must_change_password: true,
    },
  });

  if (createErr || !createdUser.user) {
    return { ok: false, error: createErr?.message || "Could not add this worker." };
  }

  const profilePayload = {
    id: createdUser.user.id,
    email,
    full_name: fullName,
    phone_number: phoneNumber,
    role: "worker" as const,
    is_active: true,
  };

  let profileResult = await service
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (profileResult.error && isMissingColumnError(profileResult.error)) {
    const { phone_number, ...legacyPayload } = profilePayload;
    void phone_number;
    profileResult = await service
      .from("profiles")
      .upsert(legacyPayload, { onConflict: "id" });
  }

  if (profileResult.error) {
    await service.auth.admin.deleteUser(createdUser.user.id);
    return { ok: false, error: "Could not save this worker. Please try again." };
  }

  await logActivity({
    userId: admin.id,
    action: "WORKER_CREATED",
    description: `${formatPersonName(admin.full_name, admin.email, "Owner")} added ${fullName} (${email})`,
  });

  revalidatePath("/workers");
  revalidatePath("/notifications");

  return { ok: true, message: "Worker account created. Share the email and temporary password with the worker." };
}

export async function toggleWorkerActiveAction(formData: FormData) {
  const admin = await requireProfileRole(["admin"]);
  const workerId = String(formData.get("worker_id") ?? "").trim();
  const nextActive = String(formData.get("next_active") ?? "") === "true";

  if (!workerId) return;

  const supabase = await createSupabaseAppServerClient();
  const { data: worker } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", workerId)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: nextActive })
    .eq("id", workerId)
    .eq("role", "worker");

  if (error) {
    logSupabaseWarning("[Workers] Update worker access failed", error);
    return;
  }

  await logActivity({
    userId: admin.id,
    action: nextActive ? "WORKER_ENABLED" : "WORKER_DISABLED",
    description: `${formatPersonName(admin.full_name, admin.email, "Owner")} ${nextActive ? "enabled" : "disabled"} ${worker?.full_name ?? worker?.email ?? workerId}`,
  });

  revalidatePath("/workers");
  revalidatePath("/notifications");
}

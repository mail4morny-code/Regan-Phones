import { isOverdue24Hours } from "@/lib/format/time";
import type { ProfileRole } from "@/lib/auth/requireProfile";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";

export type DealerAlertPriority = "warning" | "urgent" | "critical";

export type DealerNotification = {
  id: string;
  priority: DealerAlertPriority;
  hours: number;
  agreed_price: number;
  date_given: string;
  dealers: { name: string; phone_number: string } | null;
  phones: { imei: string; brand: string; model: string } | null;
};

export type SoldPhoneNotification = {
  id: string;
  selling_price: number;
  sold_at: string;
  customer_name: string | null;
  phones: { imei: string; brand: string; model: string } | null;
};

export type PendingSaleConfirmation = {
  id: string;
  selling_price: number;
  sold_at: string;
  customer_name: string | null;
  sold_by: string;
  phones: { imei: string; brand: string; model: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export type WorkerActivityNotification = {
  id: string;
  user_id: string;
  action: string;
  description: string | null;
  created_at: string;
};

type NotificationSupabase = Awaited<ReturnType<typeof createSupabaseAppServerClient>>;
type NotificationViewer = { role: ProfileRole; userId: string };

function priorityForHours(hours: number): DealerAlertPriority {
  if (hours >= 72) return "critical";
  if (hours >= 48) return "urgent";
  return "warning";
}

function priorityRank(priority: DealerAlertPriority) {
  if (priority === "critical") return 0;
  if (priority === "urgent") return 1;
  return 2;
}

export async function getNotifications(supabase: NotificationSupabase, viewer?: NotificationViewer) {
  const isWorker = viewer?.role === "worker";

  let activityQuery = supabase
    .from("activity_log")
    .select("id, user_id, action, description, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (isWorker && viewer?.userId) {
    activityQuery = supabase
      .from("activity_log")
      .select("id, user_id, action, description, created_at")
      .eq("user_id", viewer.userId)
      .order("created_at", { ascending: false })
      .limit(12);
  }

  const [dealerResult, salesResult, pendingSalesResult, activityResult] = await Promise.all([
    supabase
      .from("dealer_records")
      .select("id, agreed_price, date_given, dealers:dealer_id(name, phone_number), phones:phone_id(imei, brand, model)")
      .eq("status", "With Dealer")
      .order("date_given", { ascending: true })
      .limit(100),
    isWorker
      ? Promise.resolve({ data: [] as SoldPhoneNotification[], error: null })
      : supabase
          .from("sales")
          .select("id, selling_price, sold_at, customer_name, phones:phone_id(imei, brand, model)")
          .order("sold_at", { ascending: false })
          .limit(8),
    isWorker
      ? Promise.resolve({ data: [] as PendingSaleConfirmation[], error: null })
      : supabase
          .from("sales")
          .select("id, selling_price, sold_at, customer_name, sold_by, phones:phone_id(imei, brand, model), profiles:sold_by(full_name, email)")
          .eq("payment_status", "Pending Admin Confirmation")
          .order("sold_at", { ascending: false })
          .limit(20),
    activityQuery,
  ]);

  const now = Date.now();
  const dealerAlerts = ((dealerResult?.data ?? []) as DealerNotification[])
    .filter((record) => isOverdue24Hours(record.date_given))
    .map((record) => {
      const hours = Math.floor((now - new Date(record.date_given).getTime()) / (60 * 60 * 1000));
      return {
        ...record,
        hours,
        priority: priorityForHours(hours),
      };
    })
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.hours - a.hours);

  const recentlySold = isWorker ? [] : (salesResult?.data ?? []) as SoldPhoneNotification[];
  const pendingSaleConfirmations = isWorker ? [] : (pendingSalesResult?.data ?? []) as PendingSaleConfirmation[];
  const recentActivity = ((activityResult?.data ?? []) as WorkerActivityNotification[]).filter((item) =>
    item.action.includes("WORKER") || item.action.includes("PHONE") || item.action.includes("DEALER")
  );

  const systemAlerts: string[] = [];
  if (dealerResult?.error) systemAlerts.push("Dealer alert query could not be loaded.");
  if (!isWorker && salesResult?.error) systemAlerts.push("Recent sales query could not be loaded.");
  if (!isWorker && pendingSalesResult?.error) systemAlerts.push("Pending sale confirmations could not be loaded.");
  if (activityResult?.error) systemAlerts.push("Recent activity query could not be loaded.");
  if (systemAlerts.length === 0) systemAlerts.push("System checks are normal.");

  const alertCount = dealerAlerts.length + pendingSaleConfirmations.length + systemAlerts.filter((alert) => alert !== "System checks are normal.").length;
  const totalCount = dealerAlerts.length + pendingSaleConfirmations.length + recentlySold.length + recentActivity.length + systemAlerts.length;

  return {
    dealerAlerts,
    pendingSaleConfirmations,
    recentlySold,
    recentActivity,
    systemAlerts,
    alertCount,
    totalCount,
  };
}

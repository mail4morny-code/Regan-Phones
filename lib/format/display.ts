const actionLabels: Record<string, string> = {
  PHONE_ADDED: "Phone Added",
  PHONE_UPDATED: "Phone Updated",
  PHONE_ARCHIVED: "Phone Removed from Active Stock",
  PHONE_DAMAGED: "Phone Marked as Damaged",
  PHONE_SOLD: "Phone Sold",
  PHONE_SOLD_PENDING_CONFIRMATION: "Money Waiting for Confirmation",
  PHONE_GIVEN: "Phone Given to Dealer",
  DEALER_BATCH_GIVEN: "Phones Given to Dealer",
  PHONE_DEALER_SOLD: "Dealer Sold Phone",
  PHONE_RETURNED: "Phone Returned to Shop",
  SALE_PAYMENT_CONFIRMED: "Payment Confirmed",
  WORKER_CREATED: "Worker Added",
  WORKER_ENABLED: "Worker Enabled",
  WORKER_DISABLED: "Worker Disabled",
};

const statusLabels: Record<string, string> = {
  Available: "Available",
  Sold: "Sold",
  "With Dealer": "With Dealer",
  Returned: "Returned by Dealer",
  Damaged: "Damaged",
  Archived: "Removed from Active Stock",
};

const paymentLabels: Record<string, string> = {
  Received: "Money Received",
  "Pending Admin Confirmation": "Waiting for Owner Confirmation",
  Pending: "Waiting for Confirmation",
};

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatActivityAction(action: string | null | undefined) {
  const value = String(action ?? "").trim();
  if (!value) return "Activity";
  return actionLabels[value] ?? titleize(value);
}

export function formatPhoneStatus(status: string | null | undefined) {
  const value = String(status ?? "").trim();
  if (!value) return "Status Not Set";
  return statusLabels[value] ?? titleize(value);
}

export function formatPaymentStatus(status: string | null | undefined) {
  const value = String(status ?? "").trim();
  if (!value) return "Payment Status Not Set";
  return paymentLabels[value] ?? titleize(value);
}

export function formatRole(role: string | null | undefined) {
  if (role === "admin") return "Owner";
  if (role === "worker") return "Worker";
  return titleize(String(role ?? "Staff"));
}

export function formatCondition(condition: string | null | undefined) {
  if (condition === "New") return "Brand New";
  return String(condition ?? "Not set");
}

export function formatPersonName(
  fullName: string | null | undefined,
  email?: string | null,
  fallback = "Staff member"
) {
  const name = String(fullName ?? "").trim();
  if (name) return name;
  const address = String(email ?? "").trim();
  if (address) return address;
  return fallback;
}

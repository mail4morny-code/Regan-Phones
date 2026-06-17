const DAY_MS = 24 * 60 * 60 * 1000;

export function isOverdue24Hours(dateValue: string | Date | null | undefined) {
  if (!dateValue) return false;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > DAY_MS;
}

export function timeSince(dateValue: string | Date | null | undefined) {
  if (!dateValue) return "Unknown";
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const days = Math.floor(diffMs / DAY_MS);
  if (days >= 1) return `${days}d ago`;

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h ago`;

  const minutes = Math.floor(diffMs / (60 * 1000));
  return `${Math.max(minutes, 1)}m ago`;
}

export function formatMoney(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return `GH₵ ${safeAmount.toLocaleString("en-GH", {
    maximumFractionDigits: 0,
  })}`;
}

export function formatMoneyExact(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return `GH₵ ${safeAmount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

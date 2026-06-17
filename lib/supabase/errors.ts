export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST204" || message.includes("could not find") || message.includes("column");
}

export function logSupabaseWarning(label: string, error: { code?: string; message?: string } | null | undefined) {
  if (!error) return;
  if (process.env.NODE_ENV === "production") return;
  console.warn(label, {
    code: error.code ?? "unknown",
    message: error.message ?? "Unknown Supabase error",
  });
}

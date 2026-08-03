"use client";

import { getLeadTimeStatus } from "@/lib/leadTime";

export default function LeadTimeNote({ date }: { date: string }) {
  const { status, message } = getLeadTimeStatus(date);
  if (status === "none") return null;

  const styles: Record<string, string> = {
    past: "bg-red-50 text-red-700 border-red-200",
    rush: "bg-amber-50 text-amber-800 border-amber-200",
    ok: "bg-green-50 text-green-700 border-green-200",
  };
  const icons: Record<string, string> = { past: "⚠️", rush: "⏱️", ok: "✅" };

  return (
    <p className={`mt-2 rounded-lg border px-3 py-2 text-xs font-medium ${styles[status]}`}>
      {icons[status]} {message}
    </p>
  );
}

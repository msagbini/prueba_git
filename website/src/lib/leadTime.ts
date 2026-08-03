export const STANDARD_LEAD_DAYS = 5;
export const RUSH_FEE = 15;

function countBusinessDays(start: Date, end: Date): number {
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endD = new Date(end);
  endD.setHours(0, 0, 0, 0);
  let count = 0;
  while (cur < endD) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export type LeadTimeStatus = "none" | "past" | "rush" | "ok";

export function getLeadTimeStatus(dateStr: string): {
  status: LeadTimeStatus;
  businessDays: number;
  message: string;
} {
  if (!dateStr) return { status: "none", businessDays: 0, message: "" };

  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(target.getTime()) || target <= today) {
    return {
      status: "past",
      businessDays: 0,
      message: `Please choose a date at least ${STANDARD_LEAD_DAYS} business days from today.`,
    };
  }

  const businessDays = countBusinessDays(today, target);

  if (businessDays < STANDARD_LEAD_DAYS) {
    return {
      status: "rush",
      businessDays,
      message: `That's only ${businessDays} business day${businessDays === 1 ? "" : "s"} away - inside our standard ${STANDARD_LEAD_DAYS}-business-day turnaround. Rush production (+$${RUSH_FEE}) keeps it on track.`,
    };
  }

  return {
    status: "ok",
    businessDays,
    message: `You're set - that's ${businessDays} business days out, well within our standard ${STANDARD_LEAD_DAYS}-business-day turnaround.`,
  };
}

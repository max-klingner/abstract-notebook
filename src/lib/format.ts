const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// creation stamp, e.g. "Jul 5 · 14:32"
export const fmtStamp = (epochMs: number): string => {
  const d = new Date(epochMs);
  return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

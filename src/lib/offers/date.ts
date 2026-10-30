/** Date-only evidence uses the user's calendar day, not UTC midnight. */
export function calendarDate(timeZone?: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { ...(timeZone ? { timeZone } : {}), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

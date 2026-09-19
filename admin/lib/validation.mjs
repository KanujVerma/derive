export const REFILL_TRANSITIONS = Object.freeze({
  requested: "ordered",
  ordered: "shipped",
  shipped: "delivered",
});

export function nextRefillStatus(status) {
  return REFILL_TRANSITIONS[status] ?? null;
}

export function parseList(value, maxItems = 150) {
  const seen = new Set();
  const items = String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (items.length > maxItems) throw new Error(`Use no more than ${maxItems} entries.`);
  if (items.some((item) => item.length > 300)) throw new Error("Each entry must be 300 characters or fewer.");
  return items;
}

export function formatMember(member) {
  if (!member) return "Unknown member";
  return member.full_name?.trim() || member.email?.trim() || "Unnamed member";
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function validateHttpsUrl(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Tracking URL must be a valid URL.");
  }
  if (url.protocol !== "https:") throw new Error("Tracking URL must use HTTPS.");
  return url.toString();
}

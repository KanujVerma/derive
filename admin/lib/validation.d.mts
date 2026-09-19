export const REFILL_TRANSITIONS: Readonly<Record<string, string>>;
export function nextRefillStatus(status: string): string | null;
export function parseList(value: unknown, maxItems?: number): string[];
export function formatMember(member: { full_name?: string | null; email?: string | null } | null | undefined): string;
export function formatDate(value: unknown): string;
export function validateHttpsUrl(value: string | null | undefined): string | null;

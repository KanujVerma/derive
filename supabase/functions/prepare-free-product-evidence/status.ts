// Edge bundles cannot import files outside supabase/functions, even type-only.
// This local wire projection is checked against the client contract by tests.
type PrepareFreeProductEvidenceInput = {
  requestId: string;
  role: "front_label" | "ingredients" | "packaging";
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif";
};
type FreeProductEvidenceUpload = Omit<PrepareFreeProductEvidenceInput, "requestId"> & {
  bucket: "customer-product-evidence"; storagePath: string; maxBytes: number;
};

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<FreeProductEvidenceUpload["mimeType"], string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
};

export class FreeEvidenceStatusError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type GrantQuery = {
  eq(column: string, value: string): GrantQuery;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
};
type StatusClient = {
  from(table: string): { select(columns: string): GrantQuery };
  storage: { from(bucket: string): { list(prefix: string, options: { search: string; limit: number }): PromiseLike<{ data: unknown; error: unknown }> } };
};

/** Read only. No grant RPC, quota mutation, object bytes, or signed URL. */
export async function readFreeEvidenceStatus(admin: StatusClient, userId: string, input: PrepareFreeProductEvidenceInput) {
  const { data, error } = await admin.from("free_product_evidence_grants")
    .select("storage_path, role, mime_type").eq("user_id", userId).eq("request_id", input.requestId).maybeSingle();
  if (error) throw new FreeEvidenceStatusError("EVIDENCE_UNAVAILABLE", "Photo status is temporarily unavailable", 503);
  if (!data || typeof data !== "object") throw new FreeEvidenceStatusError("EVIDENCE_NOT_FOUND", "Photo request was not found", 404);
  const grant = data as Record<string, unknown>;
  if (grant.role !== input.role || grant.mime_type !== input.mimeType) {
    throw new FreeEvidenceStatusError("REQUEST_CONFLICT", "This request ID was used for a different photo", 409);
  }
  const parts = typeof grant.storage_path === "string" ? grant.storage_path.split("/") : [];
  const filename = parts[3];
  const extension = EXTENSIONS[input.mimeType];
  if (parts.length !== 4 || parts[0] !== userId || parts[1] !== "free_scan" || parts[2] !== input.role
    || !filename || !new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]${extension}$`, "i").test(filename)) {
    throw new FreeEvidenceStatusError("EVIDENCE_UNAVAILABLE", "Photo status is temporarily unavailable", 503);
  }
  const target: FreeProductEvidenceUpload = {
    bucket: "customer-product-evidence", storagePath: grant.storage_path as string,
    role: input.role, mimeType: input.mimeType, maxBytes: MAX_BYTES,
  };
  const { data: entries, error: storageError } = await admin.storage.from(target.bucket)
    .list(parts.slice(0, 3).join("/"), { search: filename, limit: 2 });
  if (storageError || !Array.isArray(entries)) {
    throw new FreeEvidenceStatusError("EVIDENCE_UNAVAILABLE", "Photo status is temporarily unavailable", 503);
  }
  const object = entries.find((entry) => entry && typeof entry === "object" && entry.name === filename);
  if (!object) return { uploaded: false, target, objectBytes: null };
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object" || metadata.mimetype !== input.mimeType
    || !Number.isSafeInteger(metadata.size) || metadata.size <= 0 || metadata.size > MAX_BYTES) {
    throw new FreeEvidenceStatusError("EVIDENCE_CONFLICT", "Uploaded photo could not be confirmed", 409);
  }
  return { uploaded: true, target, objectBytes: metadata.size as number };
}

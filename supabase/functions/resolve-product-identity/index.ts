import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.8";
import type {
  ProductEvidencePhotoRole,
  ProductResolutionCandidate,
  ProductResolutionResult,
} from "../../../src/contracts/ProductIdentityResolver.ts";
import {
  equivalentGtinRepresentations,
  identityEvidenceText,
  isValidGtin,
  matchesIngredientEvidence,
  normalizeBarcode,
  resolveProductIdentity,
  type CatalogResolutionRecord,
  type IdentifierAuthority,
  type ResolverEvidence,
} from "../_shared/product-identity.ts";
import {
  ServiceError,
  authenticate,
  corsHeaders,
  errorResponse,
  jsonResponse,
  readJsonObject,
  requireMemberEntitlement,
} from "../_shared/runtime.ts";
import { identityKindFromVerifiedUser } from "../_shared/access.ts";
import { parseBarcodeSource } from "../_shared/barcode-provenance.ts";
import {
  exactIngredientEvidence,
  IngredientCandidateLookupError,
  lookupIngredientCandidates,
} from "../_shared/ingredient-candidates.ts";

const PRODUCT_EVIDENCE_BUCKET = "customer-product-evidence";
const CATALOG_PAGE_SIZE = 1_000;
const MAX_CATALOG_ROWS_PER_TABLE = 10_000;
const MAX_BARCODE_IDENTIFIERS = 100;
const MAX_EXACT_PRODUCTS = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_ROLES = new Set<ProductEvidencePhotoRole>(["front_label", "ingredients", "packaging"]);
const ALLOWED_FIELDS = new Set([
  "requestId", "consumer", "barcode", "barcodeSource", "brand", "productName", "variantName",
  "regionCode", "labelText", "packagingText", "ingredientList", "evidencePhotos",
]);

interface ParsedEvidencePhoto {
  storagePath: string;
  role: ProductEvidencePhotoRole;
  extractedText?: string;
}

interface ParsedRequest extends ResolverEvidence {
  requestId: string;
  consumer: "scan" | "shelf";
  evidencePhotos: ParsedEvidencePhoto[];
  barcodeSource?: "member_input";
}

interface IngredientContinuation {
  requestId: string;
  rootCaseId: string;
  parentSnapshotId: string;
  ingredientList?: string[];
  evidencePhotos: ParsedEvidencePhoto[];
}

function parseIngredientContinuation(body: Record<string, unknown>, userId: string): IngredientContinuation {
  if (Object.keys(body).some((key) => ![
    "operation", "requestId", "rootCaseId", "parentSnapshotId", "ingredientList", "evidencePhoto",
  ].includes(key))) throw new ServiceError("INVALID_PAYLOAD", "Unexpected continuation fields", 400);
  const requestId = optionalString(body.requestId, "requestId", 40);
  const rootCaseId = optionalString(body.rootCaseId, "rootCaseId", 40);
  const parentSnapshotId = optionalString(body.parentSnapshotId, "parentSnapshotId", 40);
  if (![requestId, rootCaseId, parentSnapshotId].every((value) => value && UUID_PATTERN.test(value))) {
    throw new ServiceError("INVALID_PAYLOAD", "Continuation IDs must be UUIDs", 400);
  }
  const ingredientList = parseStringArray(body.ingredientList, "ingredientList", 300);
  const photo = body.evidencePhoto;
  let evidencePhotos: ParsedEvidencePhoto[] = [];
  if (photo !== undefined) {
    if (!photo || typeof photo !== "object" || Array.isArray(photo)) {
      throw new ServiceError("INVALID_PAYLOAD", "Ingredient photo is invalid", 400);
    }
    const value = photo as Record<string, unknown>;
    if (Object.keys(value).some((key) => !["storagePath", "role"].includes(key))
      || value.role !== "ingredients") {
      throw new ServiceError("INVALID_PAYLOAD", "Only a private ingredient photo is accepted", 400);
    }
    const storagePath = optionalString(value.storagePath, "evidencePhoto.storagePath", 500);
    if (!storagePath || !isFreePhotoPath(userId, "ingredients", storagePath)) {
      throw new ServiceError("INVALID_EVIDENCE_PATH", "A granted private ingredient photo is required", 400);
    }
    evidencePhotos = [{ role: "ingredients", storagePath }];
  }
  if (!ingredientList && evidencePhotos.length === 0) {
    throw new ServiceError("INSUFFICIENT_EVIDENCE", "Ingredient text or a private photo is required", 400);
  }
  return { requestId: requestId!, rootCaseId: rootCaseId!, parentSnapshotId: parentSnapshotId!, ingredientList, evidencePhotos };
}

interface ResolutionCaseRow {
  id: string;
  consumer: "scan" | "shelf";
  resolution_state: ProductResolutionResult["state"];
  product_id: string | null;
  variant_id: string | null;
  formula_version_id: string | null;
  next_action: ProductResolutionResult["nextAction"];
  requires_founder_review: boolean;
  evidence_snapshot?: { requestFingerprint?: string };
}

interface ProductRow {
  id: string;
  brand: string;
  name: string;
  is_catalog_standard: boolean;
  catalog_verified_at: string | null;
}

interface VariantRow {
  id: string;
  product_id: string;
  variant_name: string;
  region_code: string | null;
  packaging_markers: string[] | null;
}

interface FormulaRow {
  id: string;
  variant_id: string | null;
  normalized_ingredient_fingerprint: string;
  verification_status: "provisional" | "verified" | "rejected" | "superseded";
  source_reference: string;
  catalog_public_source_url: string | null;
  observed_at: string;
  packaging_markers: string[] | null;
  ingredients: string[];
  region_code: string | null;
}

interface IdentifierRow {
  id: string;
  variant_id: string;
  formula_version_id: string | null;
  identifier_type: string;
  identifier_value: string;
  source_authority: IdentifierAuthority;
  observed_at: string;
  verified_at: string | null;
}

async function loadPagedCatalogRows<T>(
  label: string,
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { code?: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from <= MAX_CATALOG_ROWS_PER_TABLE; from += CATALOG_PAGE_SIZE) {
    const pageSize = Math.min(
      CATALOG_PAGE_SIZE,
      MAX_CATALOG_ROWS_PER_TABLE - rows.length + 1,
    );
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) {
      console.error(`product identity ${label} query failed:`, result.error.code);
      throw new ServiceError("CATALOG_UNAVAILABLE", "Product identity catalog is unavailable", 500);
    }
    const page = result.data ?? [];
    rows.push(...page);
    if (rows.length > MAX_CATALOG_ROWS_PER_TABLE) {
      console.error(`product identity ${label} exceeded the resolver safety limit`);
      throw new ServiceError("CATALOG_TOO_LARGE", "Product identity catalog requires indexed resolution", 503);
    }
    if (page.length < pageSize) return rows;
  }
  return rows;
}

async function keepVisibleProducts<T extends { id: string; is_catalog_standard: boolean }>(
  admin: SupabaseClient, userId: string, freeOnly: boolean, rows: T[],
): Promise<T[]> {
  if (freeOnly || rows.every((row) => row.is_catalog_standard)) return rows;
  const privateIds = [...new Set(rows.filter((row) => !row.is_catalog_standard).map((row) => row.id))];
  const ownedIds = new Set<string>();
  for (let offset = 0; offset < privateIds.length; offset += MAX_EXACT_PRODUCTS) {
    const owned = await loadPagedCatalogRows<{ id: string; product_id: string }>("owner product links", (from, to) =>
      admin.from("user_products").select("id, product_id")
        .eq("user_id", userId).in("product_id", privateIds.slice(offset, offset + MAX_EXACT_PRODUCTS))
        .order("id", { ascending: true }).range(from, to));
    for (const row of owned) ownedIds.add(row.product_id);
  }
  return rows.filter((row) => row.is_catalog_standard || ownedIds.has(row.id));
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new ServiceError("INVALID_PAYLOAD", `${field} is invalid`, 400);
  }
  return value.trim();
}

function parseStringArray(value: unknown, field: string, maxItems: number): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) {
    throw new ServiceError("INVALID_PAYLOAD", `${field} is invalid`, 400);
  }
  return value.map((item, index) => {
    const parsed = optionalString(item, `${field}[${index}]`, 300);
    if (!parsed) throw new ServiceError("INVALID_PAYLOAD", `${field}[${index}] is invalid`, 400);
    return parsed;
  });
}

function isFreePhotoPath(userId: string, role: ProductEvidencePhotoRole, path: string): boolean {
  const parts = path.split("/");
  return parts.length === 4 && parts[0] === userId && parts[1] === "free_scan"
    && parts[2] === role && /^[0-9a-f-]{36}\.(jpg|png|webp|heic|heif)$/.test(parts[3]);
}

function validateOwnedPhotoPath(userId: string, role: ProductEvidencePhotoRole, path: string): void {
  if (/^(file|ph|content|https?):\/\//i.test(path)) {
    throw new ServiceError("INVALID_EVIDENCE_PATH", "Product evidence must be uploaded before resolution", 400);
  }
  const parts = path.split("/");
  const legacyManaged = parts.length === 3 && parts[0] === userId && parts[1] === role
    && parts.every((part) => part && part !== "." && part !== "..");
  if (!legacyManaged && !isFreePhotoPath(userId, role, path)) {
    throw new ServiceError("INVALID_EVIDENCE_PATH", "Product evidence path is invalid", 400);
  }
}

function parseRequest(body: Record<string, unknown>, userId: string): ParsedRequest {
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) {
    throw new ServiceError("INVALID_PAYLOAD", "Unexpected product identity fields", 400);
  }
  const requestId = optionalString(body.requestId, "requestId", 40);
  if (!requestId || !UUID_PATTERN.test(requestId)) {
    throw new ServiceError("INVALID_PAYLOAD", "requestId must be a UUID", 400);
  }
  if (body.consumer !== "scan" && body.consumer !== "shelf") {
    throw new ServiceError("INVALID_PAYLOAD", "consumer must be scan or shelf", 400);
  }

  const barcodeInput = optionalString(body.barcode, "barcode", 32);
  const barcode = normalizeBarcode(barcodeInput);
  if (barcodeInput && (!barcode || !isValidGtin(barcode))) {
    throw new ServiceError("INVALID_BARCODE", "Barcode must be a valid GTIN-8, UPC-A, EAN-13, or GTIN-14", 400);
  }
  const barcodeSource = parseBarcodeSource(body.barcodeSource, Boolean(barcode));
  if (!barcodeSource.ok) {
    throw new ServiceError("INVALID_PAYLOAD", "Barcode source requires a barcode and a supported origin", 400);
  }

  const rawPhotos = body.evidencePhotos ?? [];
  if (!Array.isArray(rawPhotos) || rawPhotos.length > 3) {
    throw new ServiceError("INVALID_PAYLOAD", "evidencePhotos must contain at most three photos", 400);
  }
  const evidencePhotos = rawPhotos.map((value, index): ParsedEvidencePhoto => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ServiceError("INVALID_PAYLOAD", `evidencePhotos[${index}] is invalid`, 400);
    }
    const photo = value as Record<string, unknown>;
    if (Object.keys(photo).some((key) => !["storagePath", "role", "extractedText"].includes(key))) {
      throw new ServiceError("INVALID_PAYLOAD", `evidencePhotos[${index}] has unexpected fields`, 400);
    }
    const storagePath = optionalString(photo.storagePath, `evidencePhotos[${index}].storagePath`, 500);
    const role = photo.role;
    if (!storagePath || typeof role !== "string" || !PHOTO_ROLES.has(role as ProductEvidencePhotoRole)) {
      throw new ServiceError("INVALID_PAYLOAD", `evidencePhotos[${index}] is invalid`, 400);
    }
    validateOwnedPhotoPath(userId, role as ProductEvidencePhotoRole, storagePath);
    return {
      storagePath,
      role: role as ProductEvidencePhotoRole,
      extractedText: optionalString(photo.extractedText, `evidencePhotos[${index}].extractedText`, 30_000),
    };
  });

  const request: ParsedRequest = {
    requestId,
    consumer: body.consumer,
    barcode,
    barcodeSource: barcodeSource.source,
    brand: optionalString(body.brand, "brand", 120),
    productName: optionalString(body.productName, "productName", 180),
    variantName: optionalString(body.variantName, "variantName", 180),
    regionCode: optionalString(body.regionCode, "regionCode", 20)?.toUpperCase(),
    labelText: optionalString(body.labelText, "labelText", 10_000),
    packagingText: optionalString(body.packagingText, "packagingText", 10_000),
    ingredientList: parseStringArray(body.ingredientList, "ingredientList", 300),
    evidencePhotos,
  };
  if (
    !request.barcode && !request.brand && !request.productName && !request.labelText
    && !request.packagingText && !request.ingredientList && request.evidencePhotos.length === 0
  ) {
    throw new ServiceError("INSUFFICIENT_EVIDENCE", "At least one product identity signal is required", 400);
  }
  return request;
}

async function verifyEvidencePhotos(admin: SupabaseClient, userId: string,
  photos: ParsedEvidencePhoto[], managedAccess: boolean): Promise<void> {
  for (const photo of photos) {
    const freePath = isFreePhotoPath(userId, photo.role, photo.storagePath);
    if (!freePath && !managedAccess) {
      throw new ServiceError("PHOTO_EVIDENCE_MANAGED_ONLY", "This product photo path requires managed access", 403);
    }
    if (freePath) {
      const { data: grant, error: grantError } = await admin.from("free_product_evidence_grants")
        .select("id").eq("user_id", userId).eq("role", photo.role)
        .eq("storage_path", photo.storagePath).maybeSingle();
      if (grantError) {
        console.error("free evidence grant lookup failed:", grantError.code);
        throw new ServiceError("EVIDENCE_UNAVAILABLE", "Product evidence could not be verified", 500);
      }
      if (!grant) throw new ServiceError("INVALID_EVIDENCE_PATH", "Product evidence path is not authorized", 403);
    }
    const parts = photo.storagePath.split("/");
    const fileName = parts.pop()!;
    const { data, error } = await admin.storage.from(PRODUCT_EVIDENCE_BUCKET)
      .list(parts.join("/"), { search: fileName, limit: 2 });
    if (error) {
      console.error("product evidence storage lookup failed");
      throw new ServiceError("EVIDENCE_UNAVAILABLE", "Product evidence could not be verified", 500);
    }
    if (!(data ?? []).some((entry) => entry.name === fileName)) {
      throw new ServiceError("EVIDENCE_NOT_FOUND", "Uploaded product evidence was not found", 409);
    }
  }
}

// A barcode with no other observations cannot contradict a different catalog
// product. Use the identifier index and only its related rows in that case;
// richer evidence still needs the full catalog for cross-product conflicts.
function isBarcodeOnly(request: ParsedRequest): boolean {
  return Boolean(request.barcode && !request.brand && !request.productName && !request.variantName
    && !request.regionCode && !request.labelText && !request.packagingText
    && !request.ingredientList && request.evidencePhotos.length === 0);
}

async function loadBarcodeCatalog(admin: SupabaseClient, userId: string,
  freeOnly: boolean, barcode: string): Promise<CatalogResolutionRecord[]> {
  const identifierRows = (await Promise.all(equivalentGtinRepresentations(barcode).map(({ type, value }) =>
    loadPagedCatalogRows<IdentifierRow>("barcode identifiers", (from, to) => {
      const query = admin.from("product_identifiers")
        .select("id, variant_id, formula_version_id, identifier_type, identifier_value, source_authority, observed_at, verified_at")
        .eq("identifier_type", type).eq("identifier_value", value);
      if (freeOnly) query.not("verified_at", "is", null);
      return query.order("id", { ascending: true }).range(from, to);
    })))).flat();
  if (identifierRows.length === 0) return [];
  if (identifierRows.length > MAX_BARCODE_IDENTIFIERS) {
    throw new ServiceError("CATALOG_TOO_LARGE", "Barcode identity requires operator review", 503);
  }
  const variantIds = [...new Set(identifierRows.map((row) => row.variant_id))];
  const variantRows = await loadPagedCatalogRows<VariantRow>("barcode variants", (from, to) => {
    const query = admin.from("product_variants")
      .select("id, product_id, variant_name, region_code, packaging_markers")
      .in("id", variantIds).eq("lifecycle_status", "active");
    if (freeOnly) query.eq("catalog_verification_status", "verified");
    return query.order("id", { ascending: true }).range(from, to);
  });
  if (variantRows.length === 0) return [];
  const productIds = [...new Set(variantRows.map((row) => row.product_id))];
  const [productRows, formulaRows] = await Promise.all([
    loadPagedCatalogRows<ProductRow>("barcode products", (from, to) => {
      const query = admin.from("products")
        .select("id, brand, name, is_catalog_standard, catalog_verified_at").in("id", productIds);
      if (freeOnly) query.eq("is_catalog_standard", true).not("catalog_verified_at", "is", null);
      return query.order("id", { ascending: true }).range(from, to);
    }),
    loadPagedCatalogRows<FormulaRow>("barcode formulas", (from, to) => {
      const query = admin.from("product_formula_versions")
        .select("id, variant_id, normalized_ingredient_fingerprint, verification_status, source_reference, catalog_public_source_url, observed_at, packaging_markers, ingredients, region_code")
        .in("variant_id", variantRows.map((row) => row.id));
      if (freeOnly) query.eq("verification_status", "verified").not("catalog_public_source_url", "is", null);
      return query.order("id", { ascending: true }).range(from, to);
    }),
  ]);
  return projectCatalogRows(await keepVisibleProducts(admin, userId, freeOnly, productRows),
    variantRows, formulaRows, identifierRows, freeOnly);
}

async function loadExactTypedCatalog(admin: SupabaseClient, userId: string, freeOnly: boolean,
  brand: string, name: string): Promise<CatalogResolutionRecord[]> {
  const { data: productIds, error } = await admin.rpc("lookup_product_identity_exact_ids", {
    p_brand_key: identityEvidenceText(brand),
    p_name_key: identityEvidenceText(name),
    p_free_only: freeOnly,
    p_user_id: userId,
  });
  if (error || !Array.isArray(productIds)) {
    console.error("exact product identity lookup failed:", error?.code);
    throw new ServiceError("CATALOG_UNAVAILABLE", "Product identity catalog is unavailable", 500);
  }
  if (productIds.length > MAX_EXACT_PRODUCTS) {
    throw new ServiceError("CATALOG_TOO_LARGE", "Product identity requires operator review", 503);
  }
  if (productIds.length === 0) return [];

  const productRows = await loadPagedCatalogRows<ProductRow>("exact products", (from, to) => {
    const query = admin.from("products")
      .select("id, brand, name, is_catalog_standard, catalog_verified_at").in("id", productIds);
    if (freeOnly) query.eq("is_catalog_standard", true).not("catalog_verified_at", "is", null);
    return query.order("id", { ascending: true }).range(from, to);
  });
  if (productRows.length !== productIds.length) {
    throw new ServiceError("CATALOG_UNAVAILABLE", "Product identity catalog changed during resolution", 503);
  }
  const variantRows = await loadPagedCatalogRows<VariantRow>("exact variants", (from, to) => {
    const query = admin.from("product_variants")
      .select("id, product_id, variant_name, region_code, packaging_markers")
      .in("product_id", productRows.map((row) => row.id)).eq("lifecycle_status", "active");
    if (freeOnly) query.eq("catalog_verification_status", "verified");
    return query.order("id", { ascending: true }).range(from, to);
  });
  if (variantRows.length === 0) return projectCatalogRows(
    await keepVisibleProducts(admin, userId, freeOnly, productRows), [], [], [], freeOnly);
  const variantIds = variantRows.map((row) => row.id);
  const [formulaRows, identifierRows] = await Promise.all([
    loadPagedCatalogRows<FormulaRow>("exact formulas", (from, to) => {
      const query = admin.from("product_formula_versions")
        .select("id, variant_id, normalized_ingredient_fingerprint, verification_status, source_reference, catalog_public_source_url, observed_at, packaging_markers, ingredients, region_code")
        .in("variant_id", variantIds);
      if (freeOnly) query.eq("verification_status", "verified").not("catalog_public_source_url", "is", null);
      return query.order("id", { ascending: true }).range(from, to);
    }),
    loadPagedCatalogRows<IdentifierRow>("exact identifiers", (from, to) => {
      const query = admin.from("product_identifiers")
        .select("id, variant_id, formula_version_id, identifier_type, identifier_value, source_authority, observed_at, verified_at")
        .in("variant_id", variantIds);
      if (freeOnly) query.not("verified_at", "is", null);
      return query.order("id", { ascending: true }).range(from, to);
    }),
  ]);
  return projectCatalogRows(await keepVisibleProducts(admin, userId, freeOnly, productRows),
    variantRows, formulaRows, identifierRows, freeOnly);
}

/** Exact ingredients add candidates; they never override identifier evidence. */
async function loadIngredientCatalog(admin: SupabaseClient, userId: string, freeOnly: boolean,
  ingredients: string[]): Promise<CatalogResolutionRecord[]> {
  let candidates;
  try { candidates = await lookupIngredientCandidates(admin, userId, freeOnly, ingredients); }
  catch (error) {
    if (error instanceof IngredientCandidateLookupError) {
      throw new ServiceError(error.code, "Ingredient evidence requires a complete catalog lookup",
        error.code === "CATALOG_TOO_LARGE" ? 503 : 500);
    }
    throw error;
  }
  if (candidates.length === 0) return [];
  const formulaRows = await loadPagedCatalogRows<FormulaRow>("ingredient formulas", (from, to) => {
    const query = admin.from("product_formula_versions")
      .select("id, variant_id, normalized_ingredient_fingerprint, verification_status, source_reference, catalog_public_source_url, observed_at, packaging_markers, ingredients, region_code")
      .in("id", candidates.map((row) => row.id)).eq("verification_status", "verified");
    if (freeOnly) query.not("catalog_public_source_url", "is", null);
    return query.order("id", { ascending: true }).range(from, to);
  });
  const original = new Map(candidates.map((row) => [row.id, row]));
  if (formulaRows.length !== candidates.length || new Set(formulaRows.map((row) => row.id)).size !== candidates.length
    || formulaRows.some((row) => !original.has(row.id) || row.variant_id !== original.get(row.id)!.variant_id
      || row.region_code !== original.get(row.id)!.region_code || !exactIngredientEvidence(ingredients, row.ingredients)
      || (!row.variant_id && !row.catalog_public_source_url))) {
    throw new ServiceError("CATALOG_UNAVAILABLE", "Ingredient evidence changed during resolution", 503);
  }
  const variantIds = [...new Set(formulaRows.flatMap((row) => row.variant_id ? [row.variant_id] : []))];
  const variantRows = variantIds.length === 0 ? [] : await loadPagedCatalogRows<VariantRow>("ingredient variants", (from, to) => {
    const query = admin.from("product_variants")
      .select("id, product_id, variant_name, region_code, packaging_markers")
      .in("id", variantIds).eq("lifecycle_status", "active");
    if (freeOnly) query.eq("catalog_verification_status", "verified");
    return query.order("id", { ascending: true }).range(from, to);
  });
  if (variantRows.length !== variantIds.length) {
    throw new ServiceError("CATALOG_UNAVAILABLE", "Ingredient variant visibility changed during resolution", 503);
  }
  const productIds = [...new Set(variantRows.map((row) => row.product_id))];
  const productRows = productIds.length === 0 ? [] : await loadPagedCatalogRows<ProductRow>("ingredient products", (from, to) => {
    const query = admin.from("products")
      .select("id, brand, name, is_catalog_standard, catalog_verified_at").in("id", productIds);
    if (freeOnly) query.eq("is_catalog_standard", true).not("catalog_verified_at", "is", null);
    return query.order("id", { ascending: true }).range(from, to);
  });
  const visibleProducts = await keepVisibleProducts(admin, userId, freeOnly, productRows);
  if (visibleProducts.length !== productIds.length) {
    // Never discard an invisible/missing member of a previously ambiguous set.
    throw new ServiceError("CATALOG_UNAVAILABLE", "Ingredient product visibility changed during resolution", 503);
  }
  return projectCatalogRows(visibleProducts, variantRows, formulaRows, [], freeOnly);
}

async function loadCatalog(admin: SupabaseClient, userId: string, freeOnly: boolean): Promise<CatalogResolutionRecord[]> {
  const [productRows, variantRows, formulaRows, identifierRows] = await Promise.all([
    loadPagedCatalogRows<ProductRow>("products", (from, to) => {
      const query = admin.from("products").select("id, brand, name, is_catalog_standard, catalog_verified_at");
      if (freeOnly) query.eq("is_catalog_standard", true).not("catalog_verified_at", "is", null);
      return query.order("id", { ascending: true }).range(from, to);
    }),
    loadPagedCatalogRows<VariantRow>("variants", (from, to) => {
      const query = admin.from("product_variants")
        .select("id, product_id, variant_name, region_code, packaging_markers")
        .eq("lifecycle_status", "active");
      if (freeOnly) query.eq("catalog_verification_status", "verified");
      return query.order("id", { ascending: true }).range(from, to);
    }),
    loadPagedCatalogRows<FormulaRow>("formulas", (from, to) => {
      const query = admin.from("product_formula_versions")
        .select("id, variant_id, normalized_ingredient_fingerprint, verification_status, source_reference, catalog_public_source_url, observed_at, packaging_markers, ingredients, region_code");
      if (freeOnly) query.eq("verification_status", "verified").not("catalog_public_source_url", "is", null);
      return query.order("id", { ascending: true }).range(from, to);
    }),
    loadPagedCatalogRows<IdentifierRow>("identifiers", (from, to) => {
      const query = admin.from("product_identifiers")
        .select("id, variant_id, formula_version_id, identifier_type, identifier_value, source_authority, observed_at, verified_at");
      if (freeOnly) query.not("verified_at", "is", null);
      return query.order("id", { ascending: true }).range(from, to);
    }),
  ]);

  return projectCatalogRows(await keepVisibleProducts(admin, userId, freeOnly, productRows),
    variantRows, formulaRows, identifierRows, freeOnly);
}

function projectCatalogRows(productRows: ProductRow[], variantRows: VariantRow[],
  formulaRows: FormulaRow[], identifierRows: IdentifierRow[], freeOnly: boolean): CatalogResolutionRecord[] {
  const products = new Map(productRows.map((row) => [row.id, row]));
  const variants = new Map(variantRows.map((row) => [row.id, row]));
  const formulasByVariant = new Map<string, FormulaRow[]>();
  for (const formula of formulaRows) {
    if (!formula.variant_id) continue;
    formulasByVariant.set(formula.variant_id, [...(formulasByVariant.get(formula.variant_id) ?? []), formula]);
  }
  const records: CatalogResolutionRecord[] = [];

  for (const product of products.values()) {
    records.push({ productId: product.id, brand: product.brand, name: product.name });
  }
  for (const variant of variants.values()) {
    const product = products.get(variant.product_id);
    if (!product) continue;
    const formulas = formulasByVariant.get(variant.id) ?? [];
    if (formulas.length === 0) {
      records.push({
        productId: product.id, variantId: variant.id, brand: product.brand, name: product.name,
        variantName: variant.variant_name, regionCode: variant.region_code ?? undefined,
        packagingMarkers: variant.packaging_markers ?? [],
      });
    }
    for (const formula of formulas) {
      records.push({
        productId: product.id, variantId: variant.id, formulaVersionId: formula.id,
        brand: product.brand, name: product.name, variantName: variant.variant_name,
        regionCode: variant.region_code ?? undefined,
        formulaVerificationStatus: formula.verification_status,
        formulaSourceReference: freeOnly ? formula.catalog_public_source_url ?? undefined : formula.source_reference,
        formulaObservedAt: formula.observed_at,
        ingredientFingerprint: formula.normalized_ingredient_fingerprint,
        formulaIngredients: formula.ingredients,
        formulaRegionCode: formula.region_code ?? undefined,
        packagingMarkers: [...(variant.packaging_markers ?? []), ...(formula.packaging_markers ?? [])],
      });
    }
  }
  for (const identifier of identifierRows) {
    const variant = variants.get(identifier.variant_id);
    const product = variant ? products.get(variant.product_id) : undefined;
    if (!variant || !product) continue;
    const formula = (formulasByVariant.get(variant.id) ?? []).find((row) => row.id === identifier.formula_version_id);
    records.push({
      productId: product.id, variantId: variant.id, formulaVersionId: formula?.id,
      brand: product.brand, name: product.name, variantName: variant.variant_name,
      regionCode: variant.region_code ?? undefined,
      identifierType: identifier.identifier_type,
      identifierValue: identifier.identifier_value,
      identifierAuthority: identifier.source_authority as IdentifierAuthority,
      identifierVerifiedAt: identifier.verified_at ?? undefined,
      identifierFormulaVersionId: identifier.formula_version_id ?? undefined,
      formulaVerificationStatus: formula?.verification_status,
      formulaSourceReference: freeOnly ? formula?.catalog_public_source_url ?? undefined : formula?.source_reference,
      formulaObservedAt: formula?.observed_at,
      ingredientFingerprint: formula?.normalized_ingredient_fingerprint,
      formulaIngredients: formula?.ingredients,
      formulaRegionCode: formula?.region_code ?? undefined,
      packagingMarkers: [...(variant.packaging_markers ?? []), ...(formula?.packaging_markers ?? [])],
    });
  }
  for (const formula of formulaRows) {
    if (!formula.variant_id) {
      records.push({
        formulaVersionId: formula.id,
        formulaVerificationStatus: formula.verification_status,
        formulaSourceReference: freeOnly ? formula.catalog_public_source_url ?? undefined : formula.source_reference,
        formulaObservedAt: formula.observed_at,
        ingredientFingerprint: formula.normalized_ingredient_fingerprint,
        formulaIngredients: formula.ingredients,
        formulaRegionCode: formula.region_code ?? undefined,
        packagingMarkers: formula.packaging_markers ?? [],
      });
    }
  }
  return records;
}

function buildEvidenceRows(request: ParsedRequest): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  if (request.barcode) rows.push({ evidence_type: "barcode", source_type: request.barcodeSource ?? "device_barcode", extracted_text: request.barcode });
  const typedIdentity = [request.brand, request.productName, request.variantName, request.regionCode].filter(Boolean).join(" | ");
  if (typedIdentity) rows.push({ evidence_type: "typed_identity", source_type: "member_input", extracted_text: typedIdentity });
  if (request.labelText) rows.push({ evidence_type: "front_label", source_type: "member_input", extracted_text: request.labelText });
  if (request.packagingText) rows.push({ evidence_type: "packaging", source_type: "member_input", extracted_text: request.packagingText });
  if (request.ingredientList) rows.push({ evidence_type: "ingredients", source_type: "member_input", extracted_text: request.ingredientList.join(", ") });
  for (const photo of request.evidencePhotos) {
    rows.push({
      evidence_type: photo.role,
      source_type: "member_input",
      storage_path: photo.storagePath,
      extracted_text: photo.extractedText,
    });
  }
  return rows;
}

function recordForIds(catalog: CatalogResolutionRecord[], productId: string | null, variantId: string | null, formulaId: string | null): CatalogResolutionRecord | undefined {
  return catalog.find((record) =>
    (!productId || record.productId === productId)
    && (!variantId || record.variantId === variantId)
    && (!formulaId || record.formulaVersionId === formulaId)
  );
}

interface StoredCandidateRow {
  product_id: string | null;
  variant_id: string | null;
  formula_version_id: string | null;
  candidate_basis: ProductResolutionCandidate["basis"];
  match_reasons: string[] | null;
}

async function loadStoredCandidateNames(admin: SupabaseClient, userId: string,
  candidates: StoredCandidateRow[]): Promise<Array<{
  brand?: string; name?: string; variantName?: string;
}>> {
  const queryIds = <T extends string>(values: Array<T | null | undefined>): T[] =>
    [...new Set(values.filter((value): value is T => Boolean(value)))];
  const formulaIds = queryIds(candidates.map((candidate) => candidate.formula_version_id));
  const formulaResult = formulaIds.length
    ? await admin.from("product_formula_versions").select("id, variant_id").in("id", formulaIds)
    : { data: [], error: null };
  if (formulaResult.error) throw new ServiceError("RESOLUTION_UNAVAILABLE", "Product resolution could not be loaded", 500);
  const formulas = new Map((formulaResult.data ?? []).map((row) => [row.id, row]));
  const variantIds = queryIds([
    ...candidates.map((candidate) => candidate.variant_id),
    ...(formulaResult.data ?? []).map((row) => row.variant_id),
  ]);
  const variantResult = variantIds.length
    ? await admin.from("product_variants").select("id, product_id, variant_name").in("id", variantIds)
    : { data: [], error: null };
  if (variantResult.error) throw new ServiceError("RESOLUTION_UNAVAILABLE", "Product resolution could not be loaded", 500);
  const variants = new Map((variantResult.data ?? []).map((row) => [row.id, row]));
  const productIds = queryIds([
    ...candidates.map((candidate) => candidate.product_id),
    ...(variantResult.data ?? []).map((row) => row.product_id),
  ]);
  const productResult = productIds.length
    ? await admin.from("products").select("id, brand, name, is_catalog_standard").in("id", productIds)
    : { data: [], error: null };
  if (productResult.error) throw new ServiceError("RESOLUTION_UNAVAILABLE", "Product resolution could not be loaded", 500);
  const visibleProducts = await keepVisibleProducts(admin, userId, false, productResult.data ?? []);
  const products = new Map(visibleProducts.map((row) => [row.id, row]));
  return candidates.map((candidate) => {
    const formula = candidate.formula_version_id ? formulas.get(candidate.formula_version_id) : undefined;
    if (candidate.formula_version_id && !formula) return {};
    if (candidate.variant_id && formula?.variant_id && formula.variant_id !== candidate.variant_id) return {};
    const variantId = candidate.variant_id ?? formula?.variant_id;
    const variant = variantId ? variants.get(variantId) : undefined;
    if (variantId && !variant) return {};
    if (candidate.product_id && variant && variant.product_id !== candidate.product_id) return {};
    const productId = candidate.product_id ?? variant?.product_id;
    const product = productId ? products.get(productId) : undefined;
    return { brand: product?.brand, name: product?.name, variantName: variant?.variant_name };
  });
}

async function responseForCase(
  admin: SupabaseClient,
  userId: string,
  row: ResolutionCaseRow,
  catalog?: CatalogResolutionRecord[],
  fallbackCandidates: ProductResolutionCandidate[] = [],
): Promise<ProductResolutionResult> {
  // Snapshot creation is serialized per case; retries return the immutable stored revision.
  const { data: truthSnapshot, error: snapshotError } = await admin.rpc('seal_product_truth_snapshot', {
    p_user_id: userId,
    p_case_id: row.id,
  });
  if (snapshotError || !truthSnapshot) {
    throw new ServiceError('PRODUCT_TRUTH_UNAVAILABLE', 'Product evidence could not be confirmed', 503);
  }
  const { data: storedCandidates, error } = await admin.from("product_resolution_candidates")
    .select("product_id, variant_id, formula_version_id, candidate_basis, match_reasons, rank_order")
    .eq("case_id", row.id).eq("user_id", userId).order("rank_order", { ascending: true });
  if (error) {
    console.error("product resolution candidate reload failed:", error.code);
    throw new ServiceError("RESOLUTION_UNAVAILABLE", "Product resolution could not be loaded", 500);
  }
  const replayNames = catalog ? undefined : await loadStoredCandidateNames(admin, userId, storedCandidates ?? []);
  const candidates = (storedCandidates ?? []).map((candidate, index) => {
    const record = catalog
      ? recordForIds(catalog, candidate.product_id, candidate.variant_id, candidate.formula_version_id)
      : replayNames?.[index];
    return {
      productId: candidate.product_id ?? undefined,
      variantId: candidate.variant_id ?? undefined,
      formulaVersionId: candidate.formula_version_id ?? undefined,
      brand: record?.brand,
      name: record?.name,
      variantName: record?.variantName,
      basis: candidate.candidate_basis,
      matchReasons: candidate.match_reasons ?? [],
    } as ProductResolutionCandidate;
  });
  return {
    truthSnapshot,
    caseId: row.id,
    state: truthSnapshot.state,
    product: truthSnapshot.product ?? undefined,
    formula: truthSnapshot.formula?.publicSourceUrl ? {
        formulaVersionId: truthSnapshot.formula.formulaVersionId,
        verificationStatus: "verified",
        sourceReference: truthSnapshot.formula.publicSourceUrl,
        observedAt: truthSnapshot.formula.observedAt,
      } : undefined,
    candidates: candidates.length > 0 ? candidates : fallbackCandidates,
    nextAction: truthSnapshot.nextRequiredEvidence === 'none' ? 'evaluate_product_fit'
      : truthSnapshot.nextRequiredEvidence === 'ingredients' ? 'photograph_ingredients'
      : truthSnapshot.nextRequiredEvidence === 'variant_selection'
        ? (truthSnapshot.state === 'ambiguous_candidates' ? 'choose_candidate' : 'confirm_variant')
        : 'manual_review',
    requiresFounderReview: truthSnapshot.founderReview !== 'not_needed',
  };
}

async function continueIngredients(admin: SupabaseClient, userId: string,
  body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const input = parseIngredientContinuation(body, userId);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data: root, error: rootError } = await admin.from("product_resolution_cases")
    .select("id,consumer,resolution_state,next_action,product_id,variant_id,truth_revision,requires_founder_review,evidence_snapshot")
    .eq("id", input.rootCaseId).eq("user_id", userId).maybeSingle();
  if (rootError) throw new ServiceError("RESOLUTION_UNAVAILABLE", "Check could not be loaded", 503);
  if (!root || root.consumer !== "scan") throw new ServiceError("CHECK_NOT_FOUND", "Your Check was not found", 404);
  const { data: prior, error: priorError } = await admin.from("product_resolution_continuations")
    .select("child_case_id,parent_snapshot_id,request_id,evidence_fingerprint")
    .eq("root_case_id", root.id).eq("user_id", userId).maybeSingle();
  if (priorError) throw new ServiceError("RESOLUTION_UNAVAILABLE", "Check could not be loaded", 503);
  if (prior) {
    if (prior.request_id !== input.requestId || prior.parent_snapshot_id !== input.parentSnapshotId
      || prior.evidence_fingerprint !== fingerprint) {
      throw new ServiceError("CONTINUATION_CONFLICT", "This Check already has ingredient evidence", 409);
    }
    const { data: child, error } = await admin.from("product_resolution_cases")
      .select("id,consumer,resolution_state,product_id,variant_id,formula_version_id,next_action,requires_founder_review,evidence_snapshot")
      .eq("id", prior.child_case_id).eq("user_id", userId).single();
    if (error || !child) throw new ServiceError("RESOLUTION_UNAVAILABLE", "Check could not be loaded", 503);
    return { ...await responseForCase(admin, userId, child as ResolutionCaseRow),
      attemptId: root.id, attemptRevision: 2, parentSnapshotId: input.parentSnapshotId };
  }
  if (root.resolution_state !== "identified_formula_unverified" || root.next_action !== "photograph_ingredients"
    || !root.product_id || !root.variant_id || root.requires_founder_review
    || (Array.isArray(root.evidence_snapshot?.conflicts) && root.evidence_snapshot.conflicts.length > 0)) {
    throw new ServiceError("CHECK_NOT_ELIGIBLE", "This Check is not awaiting ingredients", 409);
  }
  const { data: parent, error: parentError } = await admin.from("product_truth_snapshots")
    .select("id,case_revision").eq("id", input.parentSnapshotId).eq("case_id", root.id)
    .eq("user_id", userId).maybeSingle();
  if (parentError || !parent || parent.case_revision !== root.truth_revision) {
    throw new ServiceError("PARENT_SNAPSHOT_CONFLICT", "Refresh this Check before adding evidence", 409);
  }
  await verifyEvidencePhotos(admin, userId, input.evidencePhotos, false);
  const { data: oldEvidence, error: evidenceError } = await admin.from("product_resolution_evidence")
    .select("evidence_type,source_type,storage_path,extracted_text")
    .eq("case_id", root.id).eq("user_id", userId).order("created_at", { ascending: true }).limit(21);
  if (evidenceError || !oldEvidence || oldEvidence.length > 20) {
    throw new ServiceError("RESOLUTION_UNAVAILABLE", "Check evidence could not be loaded", 503);
  }
  if (oldEvidence.some((item) => item.evidence_type === "ingredients" && item.extracted_text)) {
    throw new ServiceError("CHECK_NOT_ELIGIBLE", "This Check already has ingredient text for review", 409);
  }
  const evidence = [...oldEvidence.map((row) => ({
    evidence_type: row.evidence_type, source_type: row.source_type,
    storage_path: row.storage_path, extracted_text: row.extracted_text,
  })), ...buildEvidenceRows({ requestId: input.requestId, consumer: "scan",
    ingredientList: input.ingredientList, evidencePhotos: input.evidencePhotos })];
  let matched: FormulaRow | undefined;
  let hasFormula = false;
  let hasExactFormulaMatch = false;
  if (input.ingredientList) {
    // Formula selection requires the original Check's reported device barcode
    // plus an authoritative catalog assertion linking the exact formula. Origin
    // is not attested. Pasted/link identity plus transcription
    // alone cannot authenticate a package or silently promote catalog truth.
    const observedBarcodes = oldEvidence.filter((row) => row.evidence_type === "barcode"
      && row.source_type === "device_barcode" && row.extracted_text)
      .flatMap((row) => equivalentGtinRepresentations(row.extracted_text!));
    let linkedFormulaIds = new Set<string>();
    if (observedBarcodes.length) {
      const assertions = await loadPagedCatalogRows<IdentifierRow>("continuation identifiers", (from, to) =>
        admin.from("product_identifiers")
          .select("id,variant_id,formula_version_id,identifier_type,identifier_value,source_authority,observed_at,verified_at")
          .eq("variant_id", root.variant_id).not("verified_at", "is", null)
          .in("identifier_value", [...new Set(observedBarcodes.map((item) => item.value))])
          .order("id", { ascending: true }).range(from, to));
      if (assertions.length > MAX_BARCODE_IDENTIFIERS) {
        throw new ServiceError("CATALOG_TOO_LARGE", "Barcode formula assertions require review", 503);
      }
      linkedFormulaIds = new Set(assertions.filter((assertion) =>
        assertion.formula_version_id && ["manufacturer", "gs1", "founder"].includes(assertion.source_authority)
        && observedBarcodes.some((observed) => observed.type === assertion.identifier_type
          && observed.value === assertion.identifier_value))
        .map((assertion) => assertion.formula_version_id!));
    }
    const { data: variant, error: variantError } = await admin.from("product_variants")
      .select("region_code").eq("id", root.variant_id).eq("product_id", root.product_id).maybeSingle();
    if (variantError || !variant) {
      throw new ServiceError("CATALOG_UNAVAILABLE", "Product variant could not be loaded", 503);
    }
    const formulas = await loadPagedCatalogRows<FormulaRow>("continuation formulas", (from, to) =>
      admin.from("product_formula_versions")
        .select("id,variant_id,normalized_ingredient_fingerprint,verification_status,source_reference,catalog_public_source_url,observed_at,packaging_markers,ingredients,region_code")
        .eq("variant_id", root.variant_id).eq("verification_status", "verified")
        .not("catalog_public_source_url", "is", null)
        .order("id", { ascending: true }).range(from, to));
    hasFormula = formulas.length > 0;
    const exactMatches = formulas.filter((formula) => matchesIngredientEvidence(input.ingredientList!, {
      formulaIngredients: formula.ingredients, ingredientFingerprint: formula.normalized_ingredient_fingerprint,
    }) && (!formula.region_code || !variant.region_code || formula.region_code === variant.region_code));
    hasExactFormulaMatch = exactMatches.length > 0;
    const matches = exactMatches.filter((formula) => linkedFormulaIds.has(formula.id));
    // Multiple matching versions are still ambiguous; a photo with no text
    // never supplies formula identity, even when a catalog formula exists.
    if (matches.length === 1) matched = matches[0];
  }
  const conflicts = input.ingredientList && hasFormula && !hasExactFormulaMatch ? ["ingredient_mismatch"] : [];
  const state = matched ? "verified_product_formula" : "identified_formula_unverified";
  const candidate = { product_id: root.product_id, variant_id: root.variant_id,
    formula_version_id: matched?.id ?? null,
    candidate_basis: matched ? "ingredient_fingerprint" : "combined_candidate_evidence",
    match_reasons: [matched ? "exact ordered ingredients match one verified formula for the prior variant"
      : "prior Check identity retained; ingredient formula remains unverified"] };
  const { data: saved, error: saveError } = await admin.rpc("record_product_resolution_continuation", {
    p_user_id: userId, p_root_case_id: root.id, p_parent_snapshot_id: input.parentSnapshotId,
    p_request_id: input.requestId, p_evidence_fingerprint: fingerprint,
    p_resolution_state: state,
    p_next_action: matched ? "evaluate_product_fit" : "photograph_ingredients",
    p_product_id: root.product_id, p_variant_id: root.variant_id,
    p_formula_version_id: matched?.id ?? null, p_conflicts: conflicts,
    p_evidence: evidence, p_candidates: [candidate],
  });
  if (saveError || !saved) {
    if (["23505", "23514"].includes(saveError?.code ?? "")) {
      throw new ServiceError("CONTINUATION_CONFLICT", "This Check changed or already has ingredient evidence", 409);
    }
    throw new ServiceError("RESOLUTION_UNAVAILABLE", "Ingredient evidence could not be saved", 503);
  }
  return { ...await responseForCase(admin, userId, saved as ResolutionCaseRow),
    attemptId: root.id, attemptRevision: 2, parentSnapshotId: input.parentSnapshotId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const { userId, user, admin } = await authenticate(req);
    let identityKind;
    try { identityKind = identityKindFromVerifiedUser(user); }
    catch { throw new ServiceError("IDENTITY_UNAVAILABLE", "Account identity could not be verified", 503); }
    const body = await readJsonObject(req);
    if (body.operation === "continue_ingredients") {
      return jsonResponse(await continueIngredients(admin, userId, body));
    }
    const request = parseRequest(body, userId);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(request)));
    const requestFingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    // Free Check can use server-granted private photos. Managed Shelf remains
    // separate, and legacy managed photo paths never become guest-accessible.
    let managedAccess = false;
    if (identityKind === "permanent") {
      try {
        await requireMemberEntitlement(admin, userId);
        managedAccess = true;
      } catch (error) {
        if (!(error instanceof ServiceError) || error.code !== "MEMBERSHIP_REQUIRED") throw error;
      }
    }
    if (request.consumer === "shelf" && !managedAccess) {
      throw new ServiceError("MEMBERSHIP_REQUIRED", "Managed Shelf requires an active membership", 403);
    }
    await verifyEvidencePhotos(admin, userId, request.evidencePhotos, managedAccess);
    const { data: replay, error: replayError } = await admin.from("product_resolution_cases")
      .select("id, consumer, resolution_state, product_id, variant_id, formula_version_id, next_action, requires_founder_review, evidence_snapshot")
      .eq("user_id", userId).eq("request_id", request.requestId).maybeSingle();
    if (replayError) {
      console.error("product resolution replay lookup failed:", replayError.code);
      throw new ServiceError("RESOLUTION_UNAVAILABLE", "Product resolution could not be loaded", 500);
    }
    if (replay) {
      if (replay.consumer !== request.consumer) {
        throw new ServiceError("REQUEST_CONFLICT", "This request ID belongs to a different product workflow", 409);
      }
      if (replay.evidence_snapshot?.requestFingerprint && replay.evidence_snapshot.requestFingerprint !== requestFingerprint) {
        throw new ServiceError('REQUEST_CONFLICT', 'This request ID belongs to different evidence', 409);
      }
      // Persisted candidate IDs and the sealed truth revision are sufficient
      // for replay; a growing catalog must never invalidate an old request ID.
      return jsonResponse(await responseForCase(admin, userId, replay as ResolutionCaseRow));
    }

    // Literal label contradictions still use the conservative existing path.
    // Exact ingredients no longer require a full catalog scan.
    const needsBroadRead = Boolean(request.labelText || request.packagingText
      || request.evidencePhotos.some((photo) => photo.extractedText
        && (photo.role === "front_label" || photo.role === "packaging")));
    const catalog = needsBroadRead
      ? await loadCatalog(admin, userId, !managedAccess)
      : isBarcodeOnly(request)
      ? await loadBarcodeCatalog(admin, userId, !managedAccess, request.barcode!)
      : request.barcode || (request.brand && request.productName) || request.ingredientList?.length
      ? (await Promise.all([
          request.barcode ? loadBarcodeCatalog(admin, userId, !managedAccess, request.barcode) : Promise.resolve([]),
          request.brand && request.productName
            ? loadExactTypedCatalog(admin, userId, !managedAccess, request.brand, request.productName)
            : Promise.resolve([]),
          request.ingredientList?.length
            ? loadIngredientCatalog(admin, userId, !managedAccess, request.ingredientList)
            : Promise.resolve([]),
        ])).flat()
      : [];

    const photoText = request.evidencePhotos.filter((photo) => photo.extractedText);
    const decision = resolveProductIdentity({
      barcode: request.barcode,
      brand: request.brand,
      productName: request.productName,
      variantName: request.variantName,
      regionCode: request.regionCode,
      labelText: [request.labelText, ...photoText.filter((photo) => photo.role === "front_label").map((photo) => photo.extractedText)].filter(Boolean).join(" "),
      packagingText: [request.packagingText, ...photoText.filter((photo) => photo.role === "packaging").map((photo) => photo.extractedText)].filter(Boolean).join(" "),
      ingredientList: request.ingredientList,
    }, catalog);

    const selectedProductId = ["verified_product_formula", "identified_formula_unverified"].includes(decision.state)
      ? decision.selected?.productId ?? null : null;
    const selectedVariantId = ["verified_product_formula", "identified_formula_unverified"].includes(decision.state)
      ? decision.selected?.variantId ?? null : null;
    const selectedFormulaId = ["verified_product_formula", "formula_only"].includes(decision.state)
      ? decision.selected?.formulaVersionId ?? null : null;
    const { data: saved, error: saveError } = await admin.rpc("record_product_resolution", {
      p_user_id: userId,
      p_request_id: request.requestId,
      p_consumer: request.consumer,
      p_resolution_state: decision.state,
      p_next_action: decision.nextAction,
      // Free acquisition must never create an unbounded founder queue.
      p_requires_founder_review: managedAccess && decision.requiresFounderReview,
      p_product_id: selectedProductId,
      p_variant_id: selectedVariantId,
      p_formula_version_id: selectedFormulaId,
      p_evidence_snapshot: {
        requestFingerprint,
        conflicts: decision.conflicts ?? [],
        hasBarcode: Boolean(request.barcode),
        hasTypedIdentity: Boolean(request.brand || request.productName || request.variantName),
        hasIngredientList: Boolean(request.ingredientList),
        photoRoles: request.evidencePhotos.map((photo) => photo.role),
      },
      p_evidence: buildEvidenceRows(request),
      p_candidates: decision.candidates.map((candidate) => ({
        product_id: candidate.productId,
        variant_id: candidate.variantId,
        formula_version_id: candidate.formulaVersionId,
        candidate_basis: candidate.basis,
        match_reasons: candidate.matchReasons,
      })),
    });
    if (saveError || !saved) {
      console.error("record_product_resolution failed:", saveError?.code ?? "empty");
      throw new ServiceError("RESOLUTION_UNAVAILABLE", "Product resolution could not be saved", 500);
    }
    if (saved.evidence_snapshot?.requestFingerprint && saved.evidence_snapshot.requestFingerprint !== requestFingerprint) {
      throw new ServiceError('REQUEST_CONFLICT', 'This request ID belongs to different evidence', 409);
    }
    return jsonResponse(await responseForCase(admin, userId, saved as ResolutionCaseRow, catalog, decision.candidates));
  } catch (error) {
    return errorResponse(error);
  }
});

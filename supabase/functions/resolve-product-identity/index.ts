import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.8";
import type {
  ProductEvidencePhotoRole,
  ProductResolutionCandidate,
  ProductResolutionResult,
} from "../../../src/contracts/ProductIdentityResolver.ts";
import {
  isValidGtin,
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

const PRODUCT_EVIDENCE_BUCKET = "customer-product-evidence";
const CATALOG_PAGE_SIZE = 1_000;
const MAX_CATALOG_ROWS_PER_TABLE = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_ROLES = new Set<ProductEvidencePhotoRole>(["front_label", "ingredients", "packaging"]);
const ALLOWED_FIELDS = new Set([
  "requestId", "consumer", "barcode", "brand", "productName", "variantName",
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
}

interface ResolutionCaseRow {
  id: string;
  resolution_state: ProductResolutionResult["state"];
  product_id: string | null;
  variant_id: string | null;
  formula_version_id: string | null;
  next_action: ProductResolutionResult["nextAction"];
  requires_founder_review: boolean;
}

interface ProductRow {
  id: string;
  brand: string;
  name: string;
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
  observed_at: string;
  packaging_markers: string[] | null;
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

function validateOwnedPhotoPath(userId: string, role: ProductEvidencePhotoRole, path: string): void {
  if (/^(file|ph|content|https?):\/\//i.test(path)) {
    throw new ServiceError("INVALID_EVIDENCE_PATH", "Product evidence must be uploaded before resolution", 400);
  }
  const parts = path.split("/");
  if (
    parts.length !== 3
    || parts[0] !== userId
    || parts[1] !== role
    || parts.some((part) => !part || part === "." || part === "..")
  ) {
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

async function verifyEvidencePhotos(admin: SupabaseClient, photos: ParsedEvidencePhoto[]): Promise<void> {
  for (const photo of photos) {
    const [owner, role, fileName] = photo.storagePath.split("/");
    const { data, error } = await admin.storage.from(PRODUCT_EVIDENCE_BUCKET)
      .list(`${owner}/${role}`, { search: fileName, limit: 2 });
    if (error) {
      console.error("product evidence storage lookup failed");
      throw new ServiceError("EVIDENCE_UNAVAILABLE", "Product evidence could not be verified", 500);
    }
    if (!(data ?? []).some((entry) => entry.name === fileName)) {
      throw new ServiceError("EVIDENCE_NOT_FOUND", "Uploaded product evidence was not found", 409);
    }
  }
}

async function loadCatalog(admin: SupabaseClient): Promise<CatalogResolutionRecord[]> {
  const [productRows, variantRows, formulaRows, identifierRows] = await Promise.all([
    loadPagedCatalogRows<ProductRow>("products", (from, to) => admin.from("products")
      .select("id, brand, name").order("id", { ascending: true }).range(from, to)),
    loadPagedCatalogRows<VariantRow>("variants", (from, to) => admin.from("product_variants")
      .select("id, product_id, variant_name, region_code, packaging_markers")
      .eq("lifecycle_status", "active").order("id", { ascending: true }).range(from, to)),
    loadPagedCatalogRows<FormulaRow>("formulas", (from, to) => admin.from("product_formula_versions")
      .select("id, variant_id, normalized_ingredient_fingerprint, verification_status, source_reference, observed_at, packaging_markers")
      .order("id", { ascending: true }).range(from, to)),
    loadPagedCatalogRows<IdentifierRow>("identifiers", (from, to) => admin.from("product_identifiers")
      .select("id, variant_id, formula_version_id, identifier_type, identifier_value, source_authority, observed_at, verified_at")
      .order("id", { ascending: true }).range(from, to)),
  ]);

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
        formulaSourceReference: formula.source_reference,
        formulaObservedAt: formula.observed_at,
        ingredientFingerprint: formula.normalized_ingredient_fingerprint,
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
      formulaSourceReference: formula?.source_reference,
      formulaObservedAt: formula?.observed_at,
      ingredientFingerprint: formula?.normalized_ingredient_fingerprint,
      packagingMarkers: [...(variant.packaging_markers ?? []), ...(formula?.packaging_markers ?? [])],
    });
  }
  for (const formula of formulaRows) {
    if (!formula.variant_id) {
      records.push({
        formulaVersionId: formula.id,
        formulaVerificationStatus: formula.verification_status,
        formulaSourceReference: formula.source_reference,
        formulaObservedAt: formula.observed_at,
        ingredientFingerprint: formula.normalized_ingredient_fingerprint,
        packagingMarkers: formula.packaging_markers ?? [],
      });
    }
  }
  return records;
}

function buildEvidenceRows(request: ParsedRequest): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  if (request.barcode) rows.push({ evidence_type: "barcode", source_type: "device_barcode", extracted_text: request.barcode });
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

async function responseForCase(
  admin: SupabaseClient,
  row: ResolutionCaseRow,
  catalog: CatalogResolutionRecord[],
  fallbackCandidates: ProductResolutionCandidate[] = [],
): Promise<ProductResolutionResult> {
  const selected = recordForIds(catalog, row.product_id, row.variant_id, row.formula_version_id);
  const { data: storedCandidates, error } = await admin.from("product_resolution_candidates")
    .select("product_id, variant_id, formula_version_id, candidate_basis, match_reasons, rank_order")
    .eq("case_id", row.id).order("rank_order", { ascending: true });
  if (error) {
    console.error("product resolution candidate reload failed:", error.code);
    throw new ServiceError("RESOLUTION_UNAVAILABLE", "Product resolution could not be loaded", 500);
  }
  const candidates = (storedCandidates ?? []).map((candidate) => {
    const record = recordForIds(catalog, candidate.product_id, candidate.variant_id, candidate.formula_version_id);
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
  const includeProduct = row.resolution_state === "verified_product_formula" || row.resolution_state === "identified_formula_unverified";
  const includeFormula = row.resolution_state === "verified_product_formula" || row.resolution_state === "formula_only";
  return {
    caseId: row.id,
    state: row.resolution_state,
    product: includeProduct && selected?.productId && selected.brand && selected.name ? {
      productId: selected.productId,
      brand: selected.brand,
      name: selected.name,
      variantId: selected.variantId,
      variantName: selected.variantName,
      regionCode: selected.regionCode,
    } : undefined,
    formula: includeFormula && selected?.formulaVersionId && selected.formulaVerificationStatus === "verified"
      && selected.formulaSourceReference && selected.formulaObservedAt ? {
        formulaVersionId: selected.formulaVersionId,
        verificationStatus: "verified",
        sourceReference: selected.formulaSourceReference,
        observedAt: selected.formulaObservedAt,
      } : undefined,
    candidates: candidates.length > 0 ? candidates : fallbackCandidates,
    nextAction: row.next_action,
    requiresFounderReview: row.requires_founder_review,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const { userId, admin } = await authenticate(req);
    await requireMemberEntitlement(admin, userId);
    const request = parseRequest(await readJsonObject(req), userId);
    await verifyEvidencePhotos(admin, request.evidencePhotos);
    const catalog = await loadCatalog(admin);

    const { data: replay, error: replayError } = await admin.from("product_resolution_cases")
      .select("id, resolution_state, product_id, variant_id, formula_version_id, next_action, requires_founder_review")
      .eq("user_id", userId).eq("request_id", request.requestId).maybeSingle();
    if (replayError) {
      console.error("product resolution replay lookup failed:", replayError.code);
      throw new ServiceError("RESOLUTION_UNAVAILABLE", "Product resolution could not be loaded", 500);
    }
    if (replay) return jsonResponse(await responseForCase(admin, replay as ResolutionCaseRow, catalog));

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
      p_requires_founder_review: decision.requiresFounderReview,
      p_product_id: selectedProductId,
      p_variant_id: selectedVariantId,
      p_formula_version_id: selectedFormulaId,
      p_evidence_snapshot: {
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
    return jsonResponse(await responseForCase(admin, saved as ResolutionCaseRow, catalog, decision.candidates));
  } catch (error) {
    return errorResponse(error);
  }
});

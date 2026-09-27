import type {
  ProductCandidateBasis,
  ProductResolutionCandidate,
  ProductResolutionNextAction,
  ProductResolutionState,
} from "../../../src/contracts/ProductIdentityResolver.ts";

export type IdentifierAuthority = "manufacturer" | "gs1" | "founder" | "retailer" | "member";

export interface CatalogResolutionRecord {
  productId?: string;
  variantId?: string;
  formulaVersionId?: string;
  brand?: string;
  name?: string;
  variantName?: string;
  regionCode?: string;
  identifierType?: string;
  identifierValue?: string;
  identifierAuthority?: IdentifierAuthority;
  identifierVerifiedAt?: string;
  identifierFormulaVersionId?: string;
  formulaVerificationStatus?: "provisional" | "verified" | "rejected" | "superseded";
  formulaSourceReference?: string;
  formulaObservedAt?: string;
  ingredientFingerprint?: string;
  formulaIngredients?: string[];
  formulaRegionCode?: string;
  packagingMarkers?: string[];
}

export interface ResolverEvidence {
  barcode?: string;
  brand?: string;
  productName?: string;
  variantName?: string;
  regionCode?: string;
  labelText?: string;
  packagingText?: string;
  ingredientList?: string[];
}

export interface ResolverDecision {
  state: ProductResolutionState;
  selected?: CatalogResolutionRecord;
  candidates: ProductResolutionCandidate[];
  nextAction: ProductResolutionNextAction;
  requiresFounderReview: boolean;
  conflicts?: Array<"identity_mismatch" | "region_mismatch" | "ingredient_mismatch" | "identifier_conflict">;
}

const AUTHORITATIVE_IDENTIFIER_SOURCES = new Set<IdentifierAuthority>(["manufacturer", "gs1", "founder"]);

// Unlike the persisted legacy fingerprint, evidence equality must retain
// Unicode, decimal separators and slash notation. Hyphens in identity labels
// are ordinary word separators; ingredient strings retain all punctuation.
function conservativeText(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

function identityEvidenceText(value: string | undefined): string {
  return conservativeText(value).replace(/[-‐‑]/g, " ").replace(/\s+/g, " ");
}

function matchesIngredientEvidence(ingredients: string[], record: CatalogResolutionRecord): boolean {
  if (record.formulaIngredients) {
    return ingredients.length === record.formulaIngredients.length
      && ingredients.every((ingredient, index) => Boolean(conservativeText(ingredient))
        && conservativeText(ingredient) === conservativeText(record.formulaIngredients?.[index]));
  }
  // Old projections expose only a lossy ASCII fingerprint. Abstain when that
  // representation cannot preserve every submitted occurrence and notation.
  if (ingredients.some((ingredient) => !/^[a-z0-9\s-]+$/i.test(ingredient) || !normalizeIdentityText(ingredient))) return false;
  return normalizeIngredientFingerprint(ingredients) === record.ingredientFingerprint;
}

function inconsistentFormulaAssertions(records: CatalogResolutionRecord[]): boolean {
  const seen = new Map<string, string>();
  return records.some((record) => {
    if (!record.formulaVersionId) return false;
    const key = [record.productId, record.variantId, record.formulaVersionId].join(":");
    const facts = JSON.stringify([record.formulaVerificationStatus, record.formulaSourceReference,
      record.formulaObservedAt, record.ingredientFingerprint, record.formulaIngredients, record.formulaRegionCode]);
    const prior = seen.get(key);
    seen.set(key, facts);
    return prior !== undefined && prior !== facts;
  });
}

export function normalizeIdentityText(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeBarcode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : undefined;
}

export function isValidGtin(value: string): boolean {
  if (![8, 12, 13, 14].includes(value.length) || !/^[0-9]+$/.test(value)) return false;
  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return checkDigit === (10 - (sum % 10)) % 10;
}

export function normalizeIngredientFingerprint(ingredients: string[] | undefined): string | undefined {
  if (!ingredients || ingredients.length === 0) return undefined;
  const normalized = ingredients
    .map((ingredient) => normalizeIdentityText(ingredient))
    .filter(Boolean);
  if (normalized.length === 0) return undefined;
  return normalized.join("|");
}

function candidateFrom(record: CatalogResolutionRecord, basis: ProductCandidateBasis, reasons: string[]): ProductResolutionCandidate {
  return {
    productId: record.productId,
    variantId: record.variantId,
    formulaVersionId: record.formulaVersionId,
    brand: record.brand,
    name: record.name,
    variantName: record.variantName,
    basis,
    matchReasons: [...new Set(reasons)],
  };
}

function uniqueRecords(records: CatalogResolutionRecord[]): CatalogResolutionRecord[] {
  // Preserve a completed explicit linkage when duplicate projections describe
  // the same formula; array order must not decide identifier authority.
  const ordered = [...records].sort((a, b) => Number(verifiedFormulaForIdentifier(b)) - Number(verifiedFormulaForIdentifier(a)));
  const seen = new Set<string>();
  return ordered.filter((record) => {
    const key = [record.productId ?? "", record.variantId ?? "", record.formulaVersionId ?? ""].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function verifiedFormulaForIdentifier(record: CatalogResolutionRecord): boolean {
  return Boolean(
    record.productId && record.variantId
      && normalizeIdentityText(record.brand) && normalizeIdentityText(record.name)
      && normalizeIdentityText(record.variantName)
      && record.identifierAuthority && AUTHORITATIVE_IDENTIFIER_SOURCES.has(record.identifierAuthority)
      && record.identifierVerifiedAt
      && record.formulaVersionId
      && record.identifierFormulaVersionId === record.formulaVersionId
      && record.formulaVerificationStatus === "verified"
      && record.formulaSourceReference
      && record.formulaObservedAt,
  );
}

function identifiedDecision(record: CatalogResolutionRecord, basis: ProductCandidateBasis, reasons: string[]): ResolverDecision {
  const verifiedFormula = basis === "authoritative_identifier" && verifiedFormulaForIdentifier(record);
  return {
    state: verifiedFormula ? "verified_product_formula" : "identified_formula_unverified",
    selected: record,
    candidates: [candidateFrom(record, basis, reasons)],
    nextAction: verifiedFormula ? "evaluate_product_fit" : "photograph_ingredients",
    requiresFounderReview: false,
  };
}

function ambiguousDecision(records: CatalogResolutionRecord[], basis: ProductCandidateBasis, reasons: string[]): ResolverDecision {
  return {
    state: "ambiguous_candidates",
    candidates: uniqueRecords(records).slice(0, 8).map((record) => candidateFrom(record, basis, reasons)),
    nextAction: "choose_candidate",
    requiresFounderReview: true,
  };
}

/**
 * Deterministic trust resolver. It never calls a model and never turns model or
 * OCR resemblance into verified truth.
 */
export function resolveProductIdentity(
  evidence: ResolverEvidence,
  catalog: CatalogResolutionRecord[],
): ResolverDecision {
  const barcode = normalizeBarcode(evidence.barcode);
  if (barcode && isValidGtin(barcode)) {
    const assertions = catalog.filter((record) =>
      record.identifierValue === barcode
      && record.identifierType === `gtin_${barcode.length}`
      && record.identifierAuthority
      && record.identifierVerifiedAt
      && AUTHORITATIVE_IDENTIFIER_SOURCES.has(record.identifierAuthority)
    );
    const matches = uniqueRecords(assertions);
    // Typed observations do not override an identifier. A contradiction must
    // remain visible rather than being discarded by barcode-first precedence.
    const identityFields: [string | undefined, keyof CatalogResolutionRecord][] = [
      [evidence.brand, "brand"], [evidence.productName, "name"],
      [evidence.variantName, "variantName"], [evidence.regionCode, "regionCode"],
    ];
    const conflictingFields = identityFields.filter(([submitted, field]) => {
      const normalized = identityEvidenceText(submitted);
      return normalized && assertions.some((record) => identityEvidenceText(record[field] as string | undefined) !== normalized);
    });
    const conflicts = conflictingFields.map(([, field]) => `submitted ${field} conflicts with or is unsupported by authoritative identifier`);
    if (matches.length && conflicts.length) return {
      ...ambiguousDecision(matches, "authoritative_identifier", conflicts),
      conflicts: [...new Set(conflictingFields.map(([, field]) => field === "regionCode" ? "region_mismatch" as const : "identity_mismatch" as const))],
    };
    if (matches.length && inconsistentFormulaAssertions(assertions)) {
      const identityKeys = new Set(matches.map((record) => `${record.productId ?? ""}:${record.variantId ?? ""}`));
      if (identityKeys.size === 1 && matches[0].productId) return {
        state: "identified_formula_unverified",
        selected: { ...matches[0], formulaVersionId: undefined, identifierFormulaVersionId: undefined },
        candidates: matches.map((record) => candidateFrom(record, "authoritative_identifier", ["conflicting formula facts for one identifier assertion"])),
        nextAction: "manual_review", requiresFounderReview: true, conflicts: ["identifier_conflict"],
      };
      return { ...ambiguousDecision(matches, "authoritative_identifier", ["conflicting formula facts for one identifier assertion"]), conflicts: ["identifier_conflict"] };
    }
    if (matches.length === 1) {
      const formulaRegionConflict = assertions.some((record) => Boolean(record.formulaRegionCode)
        && [evidence.regionCode, record.regionCode].some((region) => Boolean(region)
          && conservativeText(region) !== conservativeText(record.formulaRegionCode)));
      const ingredientConflict = Boolean(evidence.ingredientList?.length)
        && assertions.some((record) => !matchesIngredientEvidence(evidence.ingredientList!, record));
      if (ingredientConflict || formulaRegionConflict) {
        const match = matches[0];
        return {
          state: "identified_formula_unverified",
          selected: { ...match, formulaVersionId: undefined, identifierFormulaVersionId: undefined },
          candidates: [candidateFrom(match, "authoritative_identifier", [formulaRegionConflict
            ? "formula market conflicts with submitted or identifier-supported variant market"
            : "submitted ingredient list conflicts with or is unsupported by identifier-linked formula"])],
          nextAction: "photograph_ingredients",
          requiresFounderReview: true,
          conflicts: [...(ingredientConflict ? ["ingredient_mismatch" as const] : []), ...(formulaRegionConflict ? ["region_mismatch" as const] : [])],
        };
      }
      return identifiedDecision(matches[0], "authoritative_identifier", ["exact authoritative identifier"]);
    }
    if (matches.length > 1) {
      const identityKeys = new Set(matches.map((record) => `${record.productId ?? ""}:${record.variantId ?? ""}`));
      if (identityKeys.size === 1 && matches[0].productId) {
        return {
          state: "identified_formula_unverified",
          selected: { ...matches[0], formulaVersionId: undefined },
          candidates: matches.slice(0, 8).map((record) => candidateFrom(
            record,
            "authoritative_identifier",
            ["identifier establishes one variant but maps to multiple formula versions"],
          )),
          nextAction: "photograph_ingredients",
          requiresFounderReview: false,
        };
      }
      return {
        ...ambiguousDecision(matches, "authoritative_identifier", ["identifier maps to multiple product variants"]),
        conflicts: ["identifier_conflict"],
      };
    }
  }

  const brand = identityEvidenceText(evidence.brand);
  const productName = identityEvidenceText(evidence.productName);
  if (brand && productName) {
    const variant = identityEvidenceText(evidence.variantName);
    const region = identityEvidenceText(evidence.regionCode);
    const matches = uniqueRecords(catalog.filter((record) =>
      identityEvidenceText(record.brand) === brand
      && identityEvidenceText(record.name) === productName
      && (!variant || identityEvidenceText(record.variantName) === variant)
      && (!region || identityEvidenceText(record.regionCode) === region)
    ));
    if (matches.length === 1) return identifiedDecision(matches[0], "exact_typed_identity", ["exact brand and product name"]);
    if (matches.length > 1) {
      const identityKeys = new Set(matches.map((record) => `${record.productId ?? ""}:${record.variantId ?? ""}`));
      if (identityKeys.size === 1 && matches[0].productId) {
        return {
          state: "identified_formula_unverified",
          selected: { ...matches[0], formulaVersionId: undefined },
          candidates: matches.slice(0, 8).map((record) => candidateFrom(
            record,
            "exact_typed_identity",
            ["exact typed variant matches multiple formula versions"],
          )),
          nextAction: "photograph_ingredients",
          requiresFounderReview: false,
        };
      }
      return ambiguousDecision(matches, "exact_typed_identity", ["brand and name match multiple variants"]);
    }
  }

  if (evidence.ingredientList?.length) {
    const formulaMatches = uniqueRecords(catalog.filter((record) =>
      record.formulaVerificationStatus === "verified"
      && matchesIngredientEvidence(evidence.ingredientList!, record)
    ));
    if (formulaMatches.length === 1) {
      const match = formulaMatches[0];
      return {
        state: "formula_only",
        selected: match,
        candidates: [candidateFrom(match, "ingredient_fingerprint", ["exact verified ingredient fingerprint"])],
        nextAction: match.productId ? "confirm_variant" : "manual_review",
        requiresFounderReview: true,
      };
    }
    if (formulaMatches.length > 1) {
      return ambiguousDecision(formulaMatches, "ingredient_fingerprint", ["ingredient fingerprint matches multiple formulas"]);
    }
  }

  const normalizedLabelText = normalizeIdentityText(evidence.labelText);
  const normalizedPackagingText = normalizeIdentityText(evidence.packagingText);
  const candidateText = normalizeIdentityText([normalizedLabelText, normalizedPackagingText].filter(Boolean).join(" "));
  if (candidateText) {
    const tokenMatches = uniqueRecords(catalog.filter((record) => {
      const brandToken = normalizeIdentityText(record.brand);
      const nameToken = normalizeIdentityText(record.name);
      return Boolean(nameToken && candidateText.includes(nameToken) && (!brandToken || candidateText.includes(brandToken)));
    }));
    if (tokenMatches.length > 0) {
      const basis: ProductCandidateBasis = normalizedLabelText && normalizedPackagingText
        ? "combined_candidate_evidence"
        : normalizedLabelText
        ? "label_text"
        : "packaging";
      return ambiguousDecision(tokenMatches, basis, ["label or packaging text resembles catalog identity"]);
    }
  }

  return {
    state: "insufficient_evidence",
    candidates: [],
    nextAction: "manual_review",
    requiresFounderReview: true,
  };
}

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
  identifierFormulaVersionId?: string;
  formulaVerificationStatus?: "provisional" | "verified" | "rejected" | "superseded";
  formulaSourceReference?: string;
  formulaObservedAt?: string;
  ingredientFingerprint?: string;
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
}

const AUTHORITATIVE_IDENTIFIER_SOURCES = new Set<IdentifierAuthority>(["manufacturer", "gs1", "founder"]);

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
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = [record.productId ?? "", record.variantId ?? "", record.formulaVersionId ?? ""].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function verifiedFormulaForIdentifier(record: CatalogResolutionRecord): boolean {
  return Boolean(
    record.formulaVersionId
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
  if (barcode) {
    const matches = uniqueRecords(catalog.filter((record) =>
      normalizeBarcode(record.identifierValue) === barcode
      && record.identifierAuthority
      && AUTHORITATIVE_IDENTIFIER_SOURCES.has(record.identifierAuthority)
    ));
    if (matches.length === 1) return identifiedDecision(matches[0], "authoritative_identifier", ["exact authoritative identifier"]);
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
      return ambiguousDecision(matches, "authoritative_identifier", ["identifier maps to multiple product variants"]);
    }
  }

  const brand = normalizeIdentityText(evidence.brand);
  const productName = normalizeIdentityText(evidence.productName);
  if (brand && productName) {
    const variant = normalizeIdentityText(evidence.variantName);
    const region = normalizeIdentityText(evidence.regionCode);
    const matches = uniqueRecords(catalog.filter((record) =>
      normalizeIdentityText(record.brand) === brand
      && normalizeIdentityText(record.name) === productName
      && (!variant || normalizeIdentityText(record.variantName) === variant)
      && (!region || normalizeIdentityText(record.regionCode) === region)
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

  const ingredientFingerprint = normalizeIngredientFingerprint(evidence.ingredientList);
  if (ingredientFingerprint) {
    const formulaMatches = uniqueRecords(catalog.filter((record) =>
      record.formulaVerificationStatus === "verified"
      && record.ingredientFingerprint === ingredientFingerprint
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

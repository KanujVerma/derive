/** Provider-neutral proposals, never catalog truth. No image bytes, URLs or credentials. */
export type ExtractionEvidenceRole = 'front_label' | 'ingredients' | 'packaging';
export type ExtractionAbstentionReason = 'unreadable' | 'unsupported' | 'conflicting_evidence' | 'no_product_evidence';

export interface ExtractedNumberCandidate {
  /** Literal observed label strings: do not normalize units or infer concentration. */
  text: string;
  unitText: string;
  contextText: string;
}

export interface ProductEvidenceExtractionCandidate {
  schemaVersion: 1;
  /** Opaque task-local evidence reference; never a Storage path or signed URL. */
  evidenceId: string;
  role: ExtractionEvidenceRole;
  outcome: 'candidate' | 'abstained';
  abstentionReason?: ExtractionAbstentionReason;
  /** Every field below remains untrusted, including barcode digits. */
  barcodeText?: string;
  brandText?: string;
  productNameText?: string;
  variantText?: string;
  regionText?: string;
  labelText?: string;
  orderedIngredients?: string[];
  numbers?: ExtractedNumberCandidate[];
}

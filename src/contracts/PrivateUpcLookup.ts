/** Private provider suggestions. Never substitute these for ProductTruthSnapshot. */
export interface PrivateUpcCandidate {
  source: 'upcitemdb';
  rightsPolicy: 'internal_evaluation_only';
  sourceRecordId: string;
  sourceUrl: string;
  retrievedAt: string;
  observedBarcode: string;
  sourceBarcode: string;
  brand: string | null;
  name: string;
  size: string | null;
  category: string | null;
  canonicalProductId: null;
  formulaVerified: false;
}

export type PrivateUpcLookup =
  | { status: 'found'; candidates: [PrivateUpcCandidate]; truncated: false }
  | { status: 'ambiguous'; candidates: PrivateUpcCandidate[]; truncated: boolean }
  | { status: 'disabled' | 'invalid_barcode' | 'configuration_required' | 'not_found' | 'incomplete' | 'rate_limited' | 'unavailable'; candidates: []; truncated: false };

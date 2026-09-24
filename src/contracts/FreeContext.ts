/** Free Check memory. These records are user context, not catalog or clinical truth. */
export type FreeProductState = 'using' | 'considering' | 'stopped';
export type FreeExperienceKind = 'tolerated' | 'reacted' | 'liked' | 'finished';
export type FreeContextSection = 'products' | 'checks' | 'experiences';
export type FreeProductReference = { productId: string; name?: never; brand?: never }
  | { productId?: never; name: string; brand?: string };

export interface FreeSavedProduct {
  id: string;
  productId: string | null;
  brand: string | null;
  name: string;
  source: 'catalog' | 'user_reported';
  state: FreeProductState;
  createdAt: string;
  updatedAt: string;
}

export interface FreeCheckEntry {
  id: string;
  productId: string | null;
  brand: string | null;
  productName: string;
  resolutionState: string;
  checkedAt: string;
}

export interface FreeExperienceEntry {
  id: string;
  productId: string | null;
  brand: string | null;
  productName: string;
  source: 'catalog' | 'user_reported';
  kind: FreeExperienceKind;
  note: string | null;
  notedAt: string;
}

export type FreeContextRequest =
  | { operation: 'list'; section: FreeContextSection; limit?: number; cursor?: string }
  | { operation: 'save_product'; requestId: string; product: FreeProductReference; state: FreeProductState }
  | { operation: 'set_product_state'; id: string; state: FreeProductState }
  | { operation: 'delete_product'; id: string }
  | { operation: 'record_check'; requestId: string; productId: string; caseId?: never }
  | { operation: 'record_check'; requestId: string; caseId: string; productId?: never }
  | { operation: 'record_experience'; requestId: string; product: FreeProductReference; kind: FreeExperienceKind; note?: string }
  | { operation: 'delete_entry'; section: 'checks' | 'experiences'; id: string };

export type FreeContextItem = FreeSavedProduct | FreeCheckEntry | FreeExperienceEntry;
export interface FreeContextPage<T extends FreeContextItem> {
  items: T[];
  /** Last owner-bound entry ID for keyset pagination; null means no more rows. */
  nextCursor: string | null;
}

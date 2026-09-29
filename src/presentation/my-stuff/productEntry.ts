import type { FreeContextRequest, FreeProductReference, FreeProductState, FreeSavedProduct } from '../../contracts/FreeContext.ts';

type SaveRequest = Extract<FreeContextRequest, { operation: 'save_product' }>;
export type ProductEntrySelection = { productId: string; name: string; brand?: string } | { name: string; brand?: string; productId?: never };
export interface ProductEntryDraft { product: ProductEntrySelection | null; state: FreeProductState | null }
export interface ProductEntryState {
  ownerId: string | null; draft: ProductEntryDraft;
  status: 'editing' | 'saving' | 'error' | 'saved' | 'unavailable'; error: string | null;
}
export interface ProductEntryGateway {
  getOwner: () => string | null;
  getOwnerEpoch?: () => number;
  createRequestId: () => string;
  save: (ownerId: string, request: SaveRequest) => Promise<FreeSavedProduct>;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const validText = (value: string, max: number) => !!value.trim() && value.trim().length <= max && !/[\x00-\x1f\x7f]/.test(value);

/** Ephemeral shelf editor. Only the existing owner-bound API creates a record. */
export class ProductEntryController {
  private state: ProductEntryState = { ownerId: null, draft: { product: null, state: null }, status: 'unavailable', error: null };
  private generation = 0;
  private pending: SaveRequest | null = null;
  private acknowledged: { record: FreeSavedProduct; ownerId: string; generation: number; epoch: number | undefined } | null = null;
  private listeners = new Set<() => void>();
  private gateway: ProductEntryGateway;
  constructor(gateway: ProductEntryGateway) { this.gateway = gateway; }
  getState = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<ProductEntryState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  setOwner(ownerId: string | null) {
    if (ownerId === this.state.ownerId) return;
    this.generation++; this.pending = null; this.acknowledged = null;
    this.publish({ ownerId, draft: { product: null, state: null }, status: ownerId ? 'editing' : 'unavailable', error: null });
  }
  private edit(patch: Partial<ProductEntryDraft>) {
    if (!this.state.ownerId || this.state.status === 'saving' || this.state.status === 'saved' || this.pending) return;
    this.publish({ draft: { ...this.state.draft, ...patch }, status: 'editing', error: null });
  }
  enterManual(product: { name: string; brand?: string }) { this.edit({ product: { ...product } }); }
  selectCatalog(product: { productId: string; name: string; brand?: string }) { this.edit({ product: { ...product } }); }
  chooseState(state: FreeProductState) { this.edit({ state }); }
  /** Acknowledgment can cross a microtask boundary before the host returns to its list. */
  deliverAcknowledgement(record: FreeSavedProduct, onSaved: (record: FreeSavedProduct) => void): boolean {
    const ack = this.acknowledged;
    if (!ack || ack.record !== record || ack.ownerId !== this.state.ownerId || ack.generation !== this.generation
      || this.gateway.getOwner() !== ack.ownerId || this.gateway.getOwnerEpoch?.() !== ack.epoch || this.state.status !== 'saved') return false;
    this.acknowledged = null;
    onSaved(record);
    return true;
  }
  async save(): Promise<FreeSavedProduct | null> {
    const owner = this.state.ownerId, generation = this.generation, epoch = this.gateway.getOwnerEpoch?.();
    const current = () => this.state.ownerId === owner && this.generation === generation && this.gateway.getOwner() === owner && this.gateway.getOwnerEpoch?.() === epoch;
    if (!owner || !current() || this.state.status === 'saving' || this.state.status === 'saved') return null;
    const draft = this.state.draft;
    if (!draft.product || !draft.state) { this.publish({ error: draft.product ? 'Choose whether you use this product, are considering it, or have stopped.' : 'Choose a product or enter its name.' }); return null; }
    const selection = draft.product;
    if (!validText(selection.name, 180) || selection.brand !== undefined && selection.brand.trim() && !validText(selection.brand, 120) || selection.productId && !UUID.test(selection.productId)) {
      this.publish({ error: 'Enter a product name of up to 180 characters and a brand of up to 120 characters.' }); return null;
    }
    const product: FreeProductReference = selection.productId ? { productId: selection.productId } : { name: clean(selection.name), ...(selection.brand?.trim() ? { brand: clean(selection.brand) } : {}) };
    if (!this.pending) this.pending = { operation: 'save_product', requestId: this.gateway.createRequestId(), product, state: draft.state };
    const request = this.pending;
    this.publish({ status: 'saving', error: null });
    try {
      const result = await this.gateway.save(owner, request);
      if (!current()) return null;
      if (!result || !UUID.test(result.id) || result.state !== request.state || !validText(result.name, 180)
        || (request.product.productId ? result.productId !== request.product.productId || result.source !== 'catalog'
          : result.productId !== null || result.source !== 'user_reported' || result.name !== request.product.name || result.brand !== (request.product.brand ?? null))) throw new Error('UNCONFIRMED_PRODUCT');
      this.pending = null;
      this.acknowledged = { record: result, ownerId: owner, generation, epoch };
      this.publish({ status: 'saved', error: null });
      return current() ? result : null;
    } catch {
      if (current()) this.publish({ status: 'error', error: 'This save was not confirmed. Retry the same save before changing its details, or go back.' });
      return null;
    }
  }
}

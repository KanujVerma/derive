import type { FreeContextPage, FreeContextRequest, FreeSavedProduct } from '../../contracts/FreeContext.ts';
import type { PrivateIngredientQuery } from '../../contracts/PrivateIngredientSearch.ts';
import { validIngredientQuery, ingredientQueryKey } from './ingredientSearch.ts';

type SaveRequest = Extract<FreeContextRequest, { operation: 'save_product' }>;
export type ExternalProductSaveState = { ownerId: string; queryKey: string } & (
  { kind: 'saving' } | { kind: 'saved'; product: FreeSavedProduct } | { kind: 'error' });
const normalized = (text: string) => text.trim().replace(/\s+/g, ' ');
const sameLabel = (a: string | null, b: string | null) => normalized(a ?? '').toLowerCase() === normalized(b ?? '').toLowerCase();

/** Explicit package confirmation saves a user-reported shelf item, never external/canonical formula truth. */
export function createExternalProductSaver(input: {
  ownerId: string; query: PrivateIngredientQuery; getOwner: () => string | null;
  getQueryKey: () => string; createId: () => string;
  list: (cursor?: string) => Promise<FreeContextPage<FreeSavedProduct>>;
  save: (request: SaveRequest) => Promise<FreeSavedProduct>;
  publish: (state: ExternalProductSaveState) => void;
}) {
  const key = ingredientQueryKey(input.query);
  const scope = { ownerId: input.ownerId, queryKey: key };
  let disposed = false, pending = false, saved = false;
  let request: SaveRequest | null = null;
  const current = () => !disposed && Boolean(input.ownerId) && input.getOwner() === input.ownerId && input.getQueryKey() === key;
  const match = (product: FreeSavedProduct) => typeof product.id === 'string' && Boolean(product.id)
    && product.source === 'user_reported' && product.productId === null
    && sameLabel(product.name, input.query.name) && sameLabel(product.brand, input.query.brand);
  return {
    async save(packageConfirmed: boolean) {
      if (!packageConfirmed || !validIngredientQuery(input.query) || !current() || pending || saved) return;
      pending = true;
      input.publish({ kind: 'saving', ...scope });
      try {
        // A reopened scan should find the previously saved label, not create another shelf item.
        let cursor: string | undefined;
        const cursors = new Set<string>();
        let product: FreeSavedProduct | undefined;
        for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
          const page = await input.list(cursor);
          if (!current()) return;
          product = page.items.find(match);
          if (product || page.nextCursor === null) break;
          if (pageNumber === 19 || cursors.has(page.nextCursor)) throw new Error('SHELF_INCOMPLETE');
          cursors.add(page.nextCursor); cursor = page.nextCursor;
        }
        if (!product) {
          request ??= { operation: 'save_product', requestId: input.createId(),
            product: { name: normalized(input.query.name), ...(input.query.brand ? { brand: normalized(input.query.brand) } : {}) },
            state: 'considering' };
          if (!current()) return;
          product = await input.save(request);
          if (!current()) return;
          if (!match(product) || product.state !== 'considering') throw new Error('INVALID_SAVED_PRODUCT');
        }
        saved = true;
        input.publish({ kind: 'saved', product, ...scope });
      } catch {
        if (current()) input.publish({ kind: 'error', ...scope });
      } finally { pending = false; }
    },
    dispose() { disposed = true; },
  };
}

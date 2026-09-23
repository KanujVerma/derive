import type { AssembledRoutineContext } from './types.ts';
import type { CanonicalCatalogProduct, RoutineIntelligenceProposal, RoutineProposalProductDecision, RoutineProposalStep } from './types.ts';

export interface CatalogIdentityRow {
  id: string;
  brand: string;
  name: string;
  category: string;
  is_catalog_standard: boolean;
  catalog_verified_at: string | null;
}

export function isCatalogUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function verifyCommittedCatalogIdentity(
  context: AssembledRoutineContext,
  rows: readonly CatalogIdentityRow[],
): AssembledRoutineContext {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const confirmedProducts = context.confirmedProducts.map((product, index) => {
    const shelfRef = `shelf-${index + 1}`;
    if (product.isCatalogStandard !== true) return { ...product, shelfRef };
    const id = product.submittedCatalogId;
    if (!id || !isCatalogUuid(id)
      || seen.has(id)) throw new Error('Committed catalog selection has an invalid product ID');
    seen.add(id);
    const row = byId.get(id);
    if (!row || row.is_catalog_standard !== true || !row.catalog_verified_at
      || normalized(row.brand) !== normalized(product.brand)
      || normalized(row.name) !== normalized(product.name)
      || row.category !== product.category) {
      throw new Error('Committed catalog selection does not match a sourced product');
    }
    return { ...product, shelfRef, catalogProductId: row.id,
      brand: row.brand, name: row.name, category: row.category };
  });
  return { ...context, confirmedProducts };
}

export function bindProposalToCommittedCatalog(
  proposal: RoutineIntelligenceProposal,
  context: AssembledRoutineContext,
  rows: readonly CatalogIdentityRow[] = [],
): BoundRoutineProposal {
  const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const key = (brand: string, name: string) => `${normalized(brand)}::${normalized(name)}`;
  const byRef = new Map(context.confirmedProducts.map((product) => [product.shelfRef, product]));
  const byText = new Map(context.confirmedProducts.map((product) => [key(product.brand, product.name), product]));
  const catalogByText = new Map(rows.map((row) => [key(row.brand, row.name), row]));
  const seenCatalog = new Set<string>();
  const seenDecision = new Set<string>();

  if (context.confirmedProducts.some((product) => product.isCatalogStandard && !product.catalogProductId)) {
    throw new Error('Catalog selection was not verified against committed intake');
  }

  const resolve = (entry: { shelfRef?: string; brand: string; category: string }, name: string) => {
    const exact = byText.get(key(entry.brand, name));
    const selected = entry.shelfRef ? byRef.get(entry.shelfRef) : exact;
    if (entry.shelfRef && !selected) throw new Error('Provider referenced an unknown Shelf product');
    if (!selected) return undefined;
    if (entry.shelfRef && exact && exact.shelfRef !== entry.shelfRef) {
      throw new Error('Provider substituted another confirmed Shelf product');
    }
    if (entry.shelfRef && (normalized(entry.brand) !== normalized(selected.brand)
      || entry.category !== selected.category)) {
      throw new Error('Provider changed a referenced Shelf brand or category');
    }
    const knownCatalog = catalogByText.get(key(entry.brand, name));
    if (selected.catalogProductId && knownCatalog && knownCatalog.id !== selected.catalogProductId) {
      throw new Error('Provider substituted another catalog product');
    }
    return selected;
  };

  const catalogProducts = proposal.catalogProducts.map((entry) => {
    const selected = resolve(entry, entry.name);
    const { canonicalProductId: _untrusted, productId: _providerId, ...safe } = entry as CanonicalCatalogProduct & { canonicalProductId?: string; productId?: string };
    if (!selected?.catalogProductId) return { ...safe, canonicalProductId: undefined };
    if (seenCatalog.has(selected.shelfRef!)) throw new Error('Provider duplicated a selected catalog product');
    seenCatalog.add(selected.shelfRef!);
    return { ...safe, shelfRef: selected.shelfRef, brand: selected.brand, name: selected.name,
      category: selected.category as CanonicalCatalogProduct['category'], canonicalProductId: selected.catalogProductId };
  });

  const productDecisions = proposal.productDecisions.map((entry) => {
    const selected = resolve(entry, entry.productName);
    const { canonicalProductId: _untrusted, productId: _providerId, ...safe } = entry as RoutineProposalProductDecision & { canonicalProductId?: string; productId?: string };
    if (!selected?.catalogProductId) return { ...safe, canonicalProductId: undefined };
    if (entry.action === 'ADD' || seenDecision.has(selected.shelfRef!)) {
      throw new Error('Provider duplicated or re-added a selected catalog product');
    }
    seenDecision.add(selected.shelfRef!);
    return { ...safe, shelfRef: selected.shelfRef, brand: selected.brand, productName: selected.name,
      category: selected.category as RoutineProposalProductDecision['category'], canonicalProductId: selected.catalogProductId };
  });

  const bindStep = (entry: RoutineProposalStep) => {
    const selected = resolve(entry, entry.productName);
    const { canonicalProductId: _untrusted, productId: _providerId, ...safe } = entry as RoutineProposalStep & { canonicalProductId?: string; productId?: string };
    if (!selected?.catalogProductId) return { ...safe, canonicalProductId: undefined };
    return { ...safe, shelfRef: selected.shelfRef, brand: selected.brand, productName: selected.name,
      category: selected.category as RoutineProposalStep['category'], canonicalProductId: selected.catalogProductId };
  };
  const amSteps = proposal.amSteps.map(bindStep);
  const pmSteps = proposal.pmSteps.map(bindStep);
  for (const product of context.confirmedProducts.filter((item) => item.catalogProductId)) {
    if (!seenCatalog.has(product.shelfRef!) || !seenDecision.has(product.shelfRef!)) {
      throw new Error('Provider omitted a selected catalog product');
    }
  }
  return { ...proposal, catalogProducts, productDecisions, amSteps, pmSteps };
}

export type BoundRoutineProposal = Omit<RoutineIntelligenceProposal, 'catalogProducts' | 'productDecisions' | 'amSteps' | 'pmSteps'> & {
  catalogProducts: Array<CanonicalCatalogProduct & { canonicalProductId?: string }>;
  productDecisions: Array<RoutineProposalProductDecision & { canonicalProductId?: string }>;
  amSteps: Array<RoutineProposalStep & { canonicalProductId?: string }>;
  pmSteps: Array<RoutineProposalStep & { canonicalProductId?: string }>;
};

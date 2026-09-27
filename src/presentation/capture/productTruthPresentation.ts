import type { ProductTruthSnapshotV1 } from '../../contracts/ProductTruthSnapshot.ts';
import { hasVerifiedPackageFormula } from '../../contracts/ProductTruthSnapshot.ts';

/** Facts and one evidence action only; never personalized suitability advice. */
export function describeProductTruth(snapshot: ProductTruthSnapshotV1): {
  title: string; detail: string; nextAction: string;
} {
  if (hasVerifiedPackageFormula(snapshot)) return {
    title: 'Product and formula identified',
    detail: 'This exact variant has a sourced formula. That does not mean it is right for your skin.',
    nextAction: 'View formula details',
  };
  if (snapshot.state === 'identified_formula_unverified') return {
    title: 'Product found; formula unverified',
    detail: 'We found the product, but cannot confirm the formula in your package.',
    nextAction: snapshot.customerConfirmation === 'required' ? 'Choose the matching variant' : 'Photograph the ingredient list',
  };
  if (snapshot.state === 'ambiguous_candidates') return {
    title: 'Several possible products',
    detail: 'These are possible matches, not confirmed product or formula facts.',
    nextAction: 'Choose the matching variant',
  };
  if (snapshot.state === 'formula_only') return {
    title: 'Ingredient match; product unconfirmed',
    detail: 'The ingredient text matches a sourced formula, but does not identify your package.',
    nextAction: 'Scan the barcode',
  };
  return {
    title: 'Product not confirmed',
    detail: 'We do not have enough verified evidence. An unknown match does not mean the product is unsafe.',
    nextAction: snapshot.founderReview === 'pending' ? 'Await the requested review' : 'Scan the barcode or search by name',
  };
}

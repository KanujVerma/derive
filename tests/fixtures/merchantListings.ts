/** Test-only product-family example. Page identity does not prove package formula equivalence. */
import { exactProductKey, type MerchantListing } from '../../src/commerce/merchantListings.ts';

export const TEST_ULTA_LISTING: MerchantListing = {
  id: 'cerave-hydrating-cleanser-ulta-test',
  productKey: exactProductKey('CeraVe', 'Hydrating Facial Cleanser'),
  merchantId: 'ulta',
  merchantProductId: '2559841',
  url: 'https://www.ulta.com/p/hydrating-facial-cleanser-xlsImpprod4190255',
  verifiedAt: '2026-09-19',
  variant: 'Choose size at Ulta',
};

export const TEST_MERCHANT_LISTINGS: readonly MerchantListing[] = [TEST_ULTA_LISTING];

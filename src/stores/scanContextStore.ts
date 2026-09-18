import { create } from 'zustand';
import type { ProductScanResult } from '../domain/types.ts';

interface ScanContextState {
  activeScannedProduct: ProductScanResult | null;
  setActiveScannedProduct: (product: ProductScanResult | null) => void;
  clearScanContext: () => void;
}

/**
 * Ephemeral client-side store for transient Scan -> Ask context handoff.
 * Preserves the exact full ProductScanResult evaluated by Scan without
 * reconstructing partial synthetic records from URL query strings.
 */
export const useScanContextStore = create<ScanContextState>((set) => ({
  activeScannedProduct: null,
  setActiveScannedProduct: (product) => set({ activeScannedProduct: product }),
  clearScanContext: () => set({ activeScannedProduct: null }),
}));

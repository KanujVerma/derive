import type { SourcePolicy } from '../../contracts/PartOne.ts';

/** No provider terms are guessed. Enabling any operation requires a reviewed grant. */
const disabled = (provider: string, index: number): SourcePolicy => ({ policyId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, provider, version: 'unapproved-1', permissionEvidence: null, reviewedAt: null, expiresAt: null, revokedAt: null, operations: { lookup: false, process: false, retain: false, sharedDisplay: false, privateDisplay: false, ocr: false, cropThumbnail: false, rehost: false, hotlink: false, export: false }, retainedFields: [], attribution: null, purgeObligations: [] });
export const ExternalSourcePolicies: readonly SourcePolicy[] = Object.freeze(['open_facts', 'upcitemdb', 'manufacturer', 'dailymed', 'smartlabel', 'private_capture'].map((name, i) => Object.freeze(disabled(name, i + 1))));

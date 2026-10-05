import type { ScanResult } from '../../contracts/PartOne.ts';
import type { NormalizationResult } from '../../contracts/PartTwo.ts';
import type { PersonalResultV2 } from '../../contracts/PersonalResultV2.ts';

/** An ordinary owner-authorized scan read may supply header fields only for the
 * exact saved snapshot. It never replaces the answer with current context. */
export function savedCheckIdentity(scan: ScanResult | null, basis: NormalizationResult | null, saved: PersonalResultV2 | null, now: number): NonNullable<ScanResult['display']['selectedIdentity']> | null {
  if (!Number.isFinite(now) || !scan || basis?.state!=='ready' || !saved || saved.binding.ownerId!==basis.authenticatedOwnerId || saved.binding.subject.kind!=='declaration') return null;
  const subject=saved.binding.subject, identity=scan.display.selectedIdentity;
  if (!identity || scan.identity!=='exact' || scan.scanId!==basis.scanId || scan.generation!==basis.generation || scan.snapshotId!==subject.snapshotId || scan.itemId!==subject.itemId || identity.id!==subject.itemId || Date.parse(identity.expiresAt)<=now || !Number.isFinite(Date.parse(identity.expiresAt))) return null;
  if (Date.parse(basis.expiresAt)<=now || basis.output.reading.dependencyManifest.sourceRefs.some(ref=>!ref.permitted||Date.parse(ref.expiresAt)<=now)) return null;
  return {...identity,image:identity.image && Date.parse(identity.image.expiresAt)>now ? identity.image : null};
}

/** S-FREE-1: free Check access is independent of Managed Skincare membership. */
export type DeriveIdentityKind = 'anonymous' | 'permanent';
export type ManagedMembershipStatus = 'active' | 'paused' | 'cancelled' | 'none';

export interface FreeAccessState {
  userId: string;
  identityKind: DeriveIdentityKind;
  freeProductAccess: true;
  managedMembershipStatus: ManagedMembershipStatus;
  managedAccess: boolean;
}

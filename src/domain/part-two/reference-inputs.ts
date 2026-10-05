import { canonicalJson, sha256 } from './hash.ts';
/** A reviewed minimal factual projection, not a downloaded database/HTML hash. */
export const GLYCERIN_REFERENCE_INPUT = Object.freeze({
  projectionVersion: 'cosing-glycerin-humectant-projection-v1', ingredientName: 'GLYCERIN', referenceRole: 'HUMECTANT',
  roleDefinitionSummary: 'Retaining moisture in a formula during use; no skin efficacy or suitability inference.',
  sourceUrl: 'https://ec.europa.eu/growth/tools-databases/cosing/details/34040',
  roleDefinitionUrl: 'https://ec.europa.eu/growth/tools-databases/cosing/reference/functions', retrievedOn: '2026-10-02',
  sourceRevision: 'cosing-rendered-34040-and-functions-2026-10-02', sourceEvidence: 'Official CosIng entry and function definition verified in rendered UI by integration owner',
});
export const GLYCERIN_REFERENCE_INPUT_HASH = sha256(canonicalJson(GLYCERIN_REFERENCE_INPUT));
const policyContent = {
  policyId: 'cosing-eu-glycerin-humectant-local-v1', sourceUrl: GLYCERIN_REFERENCE_INPUT.sourceUrl, roleDefinitionUrl: GLYCERIN_REFERENCE_INPUT.roleDefinitionUrl,
  licenceId: 'EU-owned-CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', legalNoticeUrl: 'https://commission.europa.eu/legal-notice_en',
  sourceRevision: GLYCERIN_REFERENCE_INPUT.sourceRevision, importVersion: 'minimal-reviewed-projection-v1', sourceInventoryHash: GLYCERIN_REFERENCE_INPUT_HASH,
  retrievedOn: GLYCERIN_REFERENCE_INPUT.retrievedOn, reviewDate: '2026-10-02T00:00:00Z', reviewOwner: 'Codex-local-editorial-review', reviewScope: 'local_editorial_only' as const,
  allowedFields: ['ingredient_name', 'reference_humectant_role', 'function_definition_scope'], operations: { process: true, store: true, display: true, export: true },
  attribution: 'European Commission CosIng, © European Union, CC BY 4.0. Original Derive wording based on the reference role.',
  retentionRule: 'Retain only this minimal reviewed projection and original wording until withdrawal or policy expiry; no third-party chemical image or database content copied.',
  withdrawalDependencies: ['cosing-entry-34040', 'cosing-humectant-definition', 'EU-owned-CC-BY-4.0'], expiresAt: '2027-01-01T00:00:00Z', revoked: false,
};
export const GLYCERIN_REFERENCE_POLICY = { ...policyContent, policyHash: sha256(canonicalJson(policyContent)) };
export const GLYCERIN_REFERENCE_EXPLANATION = {
  explanationId: 'derive-glycerin-humectant-v1', revision: 1, ingredientId: 'glycerin', language: 'en', roleId: 'humectant',
  sentence: 'Glycerin has a reference humectant role: it can help retain moisture in a formula during use.',
  sourceUrl: GLYCERIN_REFERENCE_INPUT.sourceUrl, evidenceKind: 'reviewed_editorial' as const, ruleId: 'original-reference-role-sentence-v1', reviewDate: '2026-10-02T00:00:00Z',
  state: 'active' as const, policyId: GLYCERIN_REFERENCE_POLICY.policyId, dependencies: ['glycerin', GLYCERIN_REFERENCE_POLICY.policyId], expiresAt: '2027-01-01T00:00:00Z', permissionApproved: true,
};

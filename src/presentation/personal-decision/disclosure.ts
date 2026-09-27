import type { DecisionEvidence, Finding } from '../../contracts/PersonalDecision.ts';
export interface DecisionDetailGroup {
  reason: string;
  findingIds: string[];
  evidence: Array<{ label: string; source: DecisionEvidence; findingIds: string[] }>;
}
/** Group only identical approved copy and support states; keep every source and finding link. */
export function groupDecisionDetails(findings: Finding[], reasons: Map<string, string>): DecisionDetailGroup[] {
  const groups = new Map<string, DecisionDetailGroup>();
  const sources = new Map<DecisionDetailGroup, Map<string, DecisionDetailGroup['evidence'][number]>>();
  for (const finding of findings) {
    const reason = reasons.get(finding.id)!;
    const display = finding.display;
    const argumentsKey = display?.kind === 'role_match' ? [display.kind, display.goal, display.category]
      : display?.kind === 'routine_relation' ? [display.kind, display.role, display.timing, display.frequency]
      : display?.kind === 'prior_reaction' ? [display.kind, display.historicalFormulaVersionId]
      : display?.kind === 'routine_experience' ? [display.kind, display.outcome]
      : display?.kind === 'ingredient_context' ? [display.kind, display.ingredient, display.context]
      : display?.kind === 'evidence_gap' ? [display.kind, display.code] : null;
    // Identity/event references remain in every linked finding and source row; argument
    // or limitation differences never disappear solely because their template copy matches.
    const key = JSON.stringify([finding.kind, finding.ruleId, finding.ruleVersion, reason, argumentsKey,
      finding.applicability, finding.confidence, finding.severity, finding.uncertainty]);
    let group = groups.get(key);
    if (!group) { group = { reason, findingIds: [], evidence: [] }; groups.set(key, group); sources.set(group, new Map()); }
    group.findingIds.push(finding.id);
    for (const source of finding.evidence) {
      const identity = JSON.stringify(source), index = sources.get(group)!;
      const existing = index.get(identity);
      if (existing) { if (!existing.findingIds.includes(finding.id)) existing.findingIds.push(finding.id); continue; }
      const label = source.kind === 'product_fact' ? `Verified ${source.scope} evidence`
        : source.kind === 'routine_product_fact' ? `Verified routine-product ${source.scope} evidence`
        : source.kind === 'context_fact' ? `Your reported ${source.section} context`
        : source.kind === 'reviewed_claim' ? 'Reviewed claim evidence' : 'Unverified observation';
      const row = { label, source, findingIds: [finding.id] }; index.set(identity, row); group.evidence.push(row);
    }
  }
  return [...groups.values()];
}
/** Replace pages rather than append: DOM work stays bounded after any number of clicks. */
export function decisionPage<T>(items: T[], requestedPage: number, requestedSize = 10) {
  const size = Math.min(10, Math.max(1, Number.isFinite(requestedSize) ? Math.trunc(requestedSize) : 10));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pageCount - 1, Math.max(0, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 0));
  const start = page * size;
  return { items: items.slice(start, start + size), page, pageCount, total: items.length,
    start: items.length ? start + 1 : 0, end: Math.min(start + size, items.length), previous: page > 0, next: page + 1 < pageCount };
}

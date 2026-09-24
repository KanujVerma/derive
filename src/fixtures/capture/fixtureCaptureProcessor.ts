import type { CaptureEvidence, CaptureResult } from '../../presentation/capture/productEvidence.ts';

export type FixtureScenario = 'candidate' | 'ambiguous' | 'unknown' | 'insufficient_evidence';

export const fixtureCaptureProcessor = {
  async process(_evidence: readonly CaptureEvidence[], scenario: FixtureScenario = 'insufficient_evidence'): Promise<CaptureResult> {
    switch (scenario) {
      case 'candidate':
        return { state: 'candidates', candidates: [{ id: 'fixture-cream', label: 'Example Daily Cream', detail: 'Possible product. Package and formula unverified.' }] };
      case 'ambiguous':
        return { state: 'ambiguous', candidates: [
          { id: 'fixture-cream', label: 'Example Daily Cream', detail: 'Possible match' },
          { id: 'fixture-cream-rich', label: 'Example Daily Cream Rich', detail: 'Possible variant' },
        ] };
      case 'unknown':
        return { state: 'unknown', candidates: [] };
      default:
        return { state: 'insufficient_evidence', candidates: [] };
    }
  },
};

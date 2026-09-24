export const captureRoles = ['barcode', 'front_label', 'ingredients', 'packaging'] as const;
export type CaptureRole = typeof captureRoles[number];
export type PhotoRole = Exclude<CaptureRole, 'barcode'>;

export interface CaptureEvidence {
  role: CaptureRole;
  kind: 'barcode' | 'local_photo';
  value: string;
}

export interface CaptureCandidate {
  id: string;
  label: string;
  detail?: string;
}

export type CaptureResult =
  | { state: 'candidates'; candidates: CaptureCandidate[] }
  | { state: 'ambiguous'; candidates: CaptureCandidate[] }
  | { state: 'unknown'; candidates: [] }
  | { state: 'insufficient_evidence'; candidates: [] };

export type CapturePhase = 'collecting' | 'processing' | 'candidates' | 'candidate_selected' | 'ambiguous' | 'unknown' | 'insufficient_evidence';

export interface CaptureSession {
  phase: CapturePhase;
  evidence: CaptureEvidence[];
  candidates: CaptureCandidate[];
  selectedCandidateId?: string;
}

export type CaptureAction =
  | { type: 'barcode'; value: string }
  | { type: 'photo'; role: PhotoRole; uri: string }
  | { type: 'retake'; role: CaptureRole }
  | { type: 'process' }
  | { type: 'resolved'; result: CaptureResult }
  | { type: 'confirm_candidate'; candidateId: string }
  | { type: 'collect_more' };

export function createCaptureSession(): CaptureSession {
  return { phase: 'collecting', evidence: [], candidates: [] };
}

function replaceEvidence(session: CaptureSession, evidence: CaptureEvidence): CaptureSession {
  const next = session.evidence.filter((item) => item.role !== evidence.role).concat(evidence);
  return { ...createCaptureSession(), evidence: captureRoles.flatMap((role) => next.filter((item) => item.role === role)) };
}

export function reduceCapture(session: CaptureSession, action: CaptureAction): CaptureSession {
  switch (action.type) {
    case 'barcode':
      return action.value.trim() ? replaceEvidence(session, { role: 'barcode', kind: 'barcode', value: action.value.trim() }) : session;
    case 'photo':
      return action.uri.trim() ? replaceEvidence(session, { role: action.role, kind: 'local_photo', value: action.uri }) : session;
    case 'retake':
      return { ...createCaptureSession(), evidence: session.evidence.filter((item) => item.role !== action.role) };
    case 'process':
      return session.evidence.length ? { ...session, phase: 'processing', candidates: [], selectedCandidateId: undefined } : session;
    case 'resolved':
      if (session.phase !== 'processing') return session;
      return { ...session, phase: action.result.state, candidates: action.result.candidates, selectedCandidateId: undefined };
    case 'confirm_candidate':
      if (!['candidates', 'ambiguous'].includes(session.phase) || !session.candidates.some((candidate) => candidate.id === action.candidateId)) return session;
      return { ...session, phase: 'candidate_selected', selectedCandidateId: action.candidateId };
    case 'collect_more':
      return { ...session, phase: 'collecting', candidates: [], selectedCandidateId: undefined };
  }
}

export interface CaptureHandoff {
  authority: 'customer_evidence';
  evidence: CaptureEvidence[];
  selectedCandidateId?: string;
}

export function toCaptureHandoff(session: CaptureSession): CaptureHandoff {
  return { authority: 'customer_evidence', evidence: [...session.evidence], selectedCandidateId: session.selectedCandidateId };
}

export interface CaptureProcessor {
  process(evidence: readonly CaptureEvidence[]): Promise<CaptureResult>;
}

// Pending S-FREE-4 mapping. Device evidence alone cannot establish identity.
export const pendingCaptureProcessor: CaptureProcessor = {
  async process() { return { state: 'insufficient_evidence', candidates: [] }; },
};

import { researchSubjectFor } from '../../../presentation/part-four/researchSubject';
import { isOpenBeautyFactsSource, OBF_SOURCE_METHOD_URL } from '../../../presentation/part-one/sourceReuse';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';
import { CheckResultView } from '../result-sheet/CheckResultContent';
import { markCheckVerificationTiming } from '../../../services/checkVerificationTiming';
import { ResultSheetSurface } from '../result-sheet/ResultSheetSurface';
import { Button } from '../../ui/Button';
import { colors, spacing, typography } from '../../../constants/theme';
import type { PartOneView } from '../../../presentation/part-one/resultController';
import { usePartTwoView, PartTwoIngredientsView, PartTwoSourceSummary } from '../part-two/PartTwoIngredients';
import { partTwoTransport, partTwoSavedTransport } from '../../../services/partTwo';
import type { PartTwoSaveGuard } from '../../../services/partTwoClient';
import { usePartThreeCheck, type PartThreePorts } from '../part-three/usePartThreeCheck';
import { PartFourSections } from '../part-four/PartFourSections';
import { PartThreeSummary } from '../part-three/PartThreeSummary';
import { PartThreeDetails } from '../part-three/PartThreeDetails';
import { PartThreeControls } from '../part-three/PartThreeControls';
import type { PartTwoView, PartTwoTransport } from '../../../presentation/part-two/controller';
import { PART_FOUR_ENABLED, PART_FOUR_CLIENT_SELECTION } from '../../../services/partThree';
import { ISOLATED_423_EDUCATION } from '../../../domain/part-four/knowledge423';
import { sourceIngredientContext } from '../../../presentation/part-four/ingredientContext';

export function partOneStatus(view: PartOneView, now = Date.now()): string {
  const r = view.result;
  if (view.loading || !r) return view.error ?? 'Looking up product';
  if (r.declarationState === 'conflict') return 'Ingredient sources conflict. Ingredients are not verified.';
  if (r.declarationState === 'accepted' && (r.freshness.state !== 'fresh' || !r.freshness.expiresAt || Date.parse(r.freshness.expiresAt) <= now)) return 'Ingredient evidence expired. Check the current source before relying on it.';
  if (r.declarationState === 'accepted') return r.scope === 'private_package' ? 'Ingredients from this package' : 'Published ingredient declaration. Your package is unconfirmed.';
  if (r.declarationState === 'partial') return 'Partial ingredients. Missing sections remain unverified.';
  if (r.declarationState === 'uncertain') return 'Ingredient text needs review.';
  if (r.identity === 'unresolved') return r.reasonCodes.includes('provider:not_found') ? 'No verified match for this barcode.' : r.reasonCodes.includes('source_blocked') ? 'Product lookup source is unavailable.' : 'Product identity is unresolved.';
  return 'Ingredients not verified yet';
}

/** Uses the existing sheet. Revision updates keep its mounted scroll and detent. */
export function PartOneResultSheet({ view, onClose, onRefresh, onSelect, onSave, onCapture, onSearch, onFullChange, onScroll, localDraft, inline = true, savedInterpretationId, interpretationCaptureSessionId = null, ingredientEnabled, ingredientTransport, personalEnabled, personalPorts, savedAssessmentId, searchContent, searchEmpty, captureContent }: {
  searchContent?: React.ReactNode; searchEmpty?: boolean;
  captureContent?: React.ReactNode;
  view: PartOneView; onClose: () => void; onRefresh: () => void;
  onSelect: (id: string) => void; onSave: (details?: PartTwoSaveGuard) => void; onCapture?: () => void;
  onSearch: () => void; onFullChange: (full: boolean) => void;
  onScroll?: (offset: number) => void;
  inline?: boolean;
  localDraft?: React.ReactNode | ((sourceDenied: boolean, onIngredientView: (view: PartTwoView) => void) => React.ReactNode);
  savedInterpretationId?: string;
  interpretationCaptureSessionId?: string | null;
  ingredientEnabled?: boolean;
  ingredientTransport?: PartTwoTransport;
  personalEnabled?: boolean;
  personalPorts?: PartThreePorts;
  savedAssessmentId?: string | null;
}) {
  const r = view.result;
  const [sourceOpen, setSourceOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const ingredientOrigin=useRef({key:'',y:0});
  const [ingredientScroll,setIngredientScroll]=useState<{key:string;y:number}|null>(null);
  const [details, setDetails] = useState<PartTwoView | null>(null);
  const sourceKey = JSON.stringify([view.owner, r?.scanId, interpretationCaptureSessionId, r?.generation, r?.resultRevision]);
  if(ingredientOrigin.current.key!==sourceKey)ingredientOrigin.current={key:sourceKey,y:0};
  const sourceAccess = useRef({ key: sourceKey, denied: false, privateDenied: false });
  if (sourceAccess.current.key !== sourceKey) sourceAccess.current = { key: sourceKey, denied: false, privateDenied: false };
  const summaryLayout = useRef({ key: sourceKey, height: 0 });
  if (summaryLayout.current.key !== sourceKey) summaryLayout.current = { key: sourceKey, height: 0 };
  const clock = Math.max(now, Date.now());
  const expiresAt = r?.freshness.expiresAt;
  // Every visible field owns its expiry; readiness never extends display rights.
  const fieldExpiries = [expiresAt, r?.display.selectedIdentity?.expiresAt, r?.display.selectedIdentity?.image?.expiresAt,
    ...(r?.display.candidates.map(candidate => candidate.expiresAt) ?? []),
    ...(r?.display.candidates.map(candidate => candidate.image?.expiresAt) ?? []),
    ...(r?.display.sections.map(section => section.expiresAt) ?? []),
    ...(r?.display.sources.map(source => source.expiresAt) ?? [])];
  const nextExpiry = fieldExpiries.filter((value): value is string => Boolean(value))
    .map(Date.parse).filter(time => Number.isFinite(time) && time > clock).sort((a, b) => a - b)[0];
  useEffect(() => {
    if (!nextExpiry) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(60000, Math.max(1, nextExpiry - clock)));
    return () => clearTimeout(timer);
  }, [nextExpiry, now]);
  useEffect(() => { setNow(Date.now()); }, [r]);
  const current = (expiry: string) => Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > clock;
  const identity = r?.display.selectedIdentity && current(r.display.selectedIdentity.expiresAt) ? r.display.selectedIdentity : null;
  const candidates = r?.display.candidates.filter(candidate => current(candidate.expiresAt)) ?? [];
  const expiredIdentity = Boolean(r && ((r.display.selectedIdentity && !identity) || candidates.length !== r.display.candidates.length));
  const sections = r?.display.sections.filter(section => current(section.expiresAt)) ?? [];
  const sources = r?.display.sources.filter(source => current(source.expiresAt)) ?? [];
  const expiredFields = Boolean(r && (sections.length !== r.display.sections.length || sources.length !== r.display.sources.length));
  const expired = r?.declarationState === 'accepted' && (r.freshness.state !== 'fresh' || !expiresAt || Date.parse(expiresAt) <= clock);
  const partOneSummary = expiredIdentity ? 'Product evidence expired. Check the current source before relying on it.' : expiredFields && r?.declarationState !== 'conflict' ? 'Some ingredient evidence expired. Check the current source before relying on it.' : partOneStatus(view, clock);
  const acquisitionTarget = view.owner && r && !expired && (savedInterpretationId || !interpretationCaptureSessionId) ? { ownerId: view.owner, scanId: r.scanId, captureSessionId: interpretationCaptureSessionId, generation: r.generation, evidenceRevision: r.resultRevision } : null;
  const acquisitionTransport = useMemo(() => ingredientTransport ?? (savedInterpretationId ? partTwoSavedTransport(savedInterpretationId) : partTwoTransport), [ingredientTransport, savedInterpretationId]);
  const acquired = usePartTwoView(acquisitionTarget, ingredientEnabled, acquisitionTransport);
  useEffect(() => { if (identity && r) markCheckVerificationTiming('barcode', 'identity', r.requestId); }, [identity, r?.requestId]);
  useEffect(() => { if (acquired.result?.state === 'ready' && r) markCheckVerificationTiming('barcode', 'ingredients', r.requestId); }, [acquired.result, r?.requestId]);
  const evidenceDetails = acquisitionTarget ? acquired : details;
  const detailTarget = evidenceDetails?.target;
  const currentDetails = detailTarget && r && detailTarget.ownerId === view.owner && detailTarget.scanId === r.scanId && detailTarget.captureSessionId === interpretationCaptureSessionId && detailTarget.generation === r.generation && detailTarget.evidenceRevision === r.resultRevision ? evidenceDetails : null;
  if (currentDetails?.error || currentDetails?.result && currentDetails.result.state !== 'pending') sourceAccess.current.denied = true;
  if (currentDetails?.sourceWithdrawn) sourceAccess.current.privateDenied = true;
  if (currentDetails?.result && currentDetails.result.state !== 'ready' && currentDetails.result.state !== 'pending' && currentDetails.result.reasonCodes.some(code => code === 'source_evidence_unavailable' || code === 'source_withdrawn')) sourceAccess.current.privateDenied = true;
  // Ready details own fresh source attribution in their disclosure. A later
  // pending retry cannot restore a cached Part 1 source after a refusal.
  const sourceUnavailable = sourceAccess.current.denied;
  const currentRefusal = currentDetails?.error || currentDetails?.result && !['ready', 'pending', 'parse_limit'].includes(currentDetails.result.state);
  const status = currentRefusal || currentDetails?.result?.state === 'pending' && sourceUnavailable
    ? 'Ingredient evidence unavailable'
    : currentDetails?.result?.state === 'parse_limit' ? currentDetails.result.permittedText?.sections.length ? 'Ingredient wording remains available. Details need review.' : 'Ingredient details need review.' : partOneSummary;
  const personal = usePartThreeCheck({ ownerId: view.owner, details: currentDetails, enabled: personalEnabled, ports: personalPorts, savedAssessmentId });
  const partFour = personal.view.result?.partFour;
  const educationSelection = personalPorts?.partFourSelection ?? PART_FOUR_CLIENT_SELECTION;
  const education = personal.enabled && PART_FOUR_ENABLED && educationSelection?.education === 'approved423' && !currentRefusal && !sourceAccess.current.privateDenied
    ? {ownerId: view.owner, context: personal.context, knowledge: ISOLATED_423_EDUCATION} : undefined;
  const ingredientContext = education && currentDetails ? sourceIngredientContext(currentDetails.result, education, clock) : null;
  const contextSummary = ingredientContext?.points.length && currentDetails
    ? <PartTwoSourceSummary view={currentDetails} education={education} now={clock} /> : null;
  const partFourCurrent = Boolean(partFour && personal.view.result && Date.parse(personal.view.result.validUntil)>clock);
  const originalSections = !expired && sections.map(section => <View key={section.sectionId} style={{ gap: spacing.xs }}>
    <Text accessibilityRole="header">{({ ingredients: 'Ingredients', active: 'Active ingredients', inactive: 'Inactive ingredients', may_contain: 'May contain' })[section.kind]}</Text><Text selectable>{section.text}</Text>
  </View>);
  return <ResultSheetSurface inline={inline} overlay={captureContent} replacement={searchContent} contentSized={Boolean(searchContent)} contentSizeResetKey={searchEmpty ? 'empty' : 'query'} presentationKey={`part-one:${r?.scanId ?? 'pending'}`}
    scrollRequest={ingredientScroll?.key.startsWith(sourceKey+':')?ingredientScroll:null} onClose={onClose} onInteraction={personal.interact} onExpandedChange={onFullChange} onScrollOffset={onScroll} summary={<View style={{ gap: spacing.sm, minHeight: personal.enabled || currentRefusal || sourceAccess.current.privateDenied || currentDetails?.result?.state === 'pending' && sourceUnavailable ? summaryLayout.current.height || undefined : undefined }} onLayout={event => { summaryLayout.current.height = Math.max(summaryLayout.current.height, event.nativeEvent.layout.height); }}>
      {view.loading && <ActivityIndicator color={colors.brand} />}
      <CheckResultView section="summary" facts={{ brand: identity?.brand ?? '', name: identity?.name ?? 'Product not confirmed', categoryLabel: identity?.variantText ?? '', formula: null, source: null }}
        identityImage={identity?.image && current(identity.image.expiresAt) && failedImage !== identity.image.url ? <Image accessibilityLabel={`${identity.name} package`} source={{ uri: identity.image.url }} style={{ width: 48, height: 54 }} resizeMode="contain" onLoad={() => markCheckVerificationTiming('barcode', 'image', r?.requestId)} onError={() => setFailedImage(identity.image!.url)} /> : undefined}
        personalSummary={personal.enabled ? <>
          <PartThreeSummary view={personal.view} identityName={identity?.name} fallback={contextSummary} />
          {personal.view.result?.summary ? contextSummary : null}
        </> : undefined}
        verdict={{ state: 'unknown', label: 'Not enough information', reason: status, findings: [] }} />
      {personal.enabled && !contextSummary && <Text accessibilityLiveRegion="polite" style={{ color: colors.inkMuted }}>{status}</Text>}
      {identity && (!identity.image || failedImage === identity.image.url) && <Text style={{ color: colors.inkMuted, fontSize: typography.sizes.caption }}>No product image available</Text>}
      {r?.work === 'deferred_budget' && <Text>Lookup is deferred. Existing product facts remain available.</Text>}
      {r?.work === 'retry_wait' && <Text>The source is temporarily unavailable. Lookup will retry when eligible.</Text>}
      {r && ['queued', 'running'].includes(r.work) && <Text>Lookup is pending. You can close and reopen this result.</Text>}
      {view.error && <Text accessibilityRole="alert">{view.error}</Text>}
    </View>} compactActions={<View style={{ gap: spacing.sm }}>
      <PartThreeControls check={personal} />
      {r?.allowedActions.includes('choose_candidate') && candidates.map(candidate => <View key={candidate.id} style={{ gap: spacing.xs }}>
        <Text>Is this the product?</Text><Text>{candidate.brand} {candidate.name} {candidate.variantText}</Text>
        <Button label="Yes, this product" accessibilityHint={`Select ${candidate.name}. This confirms identity only.`} variant="outline" onPress={() => onSelect(candidate.id)} />
      </View>)}
      {!partFourCurrent && !expiredIdentity && !expired && !(expiredFields && r?.declarationState === 'accepted') && r?.snapshotId && r.allowedActions.some(action => action === 'save' || action === 'save_partial') && <Button
        label={view.saved ? 'Saved' : 'Save product'}
        disabled={view.saved} size="medium" variant="outline" onPress={() => {
          const d = currentDetails?.result, t = currentDetails?.target;
          const guard = d?.state === 'ready' && t && t.ownerId === view.owner && t.scanId === r.scanId && t.captureSessionId === interpretationCaptureSessionId && t.generation === r.generation && t.evidenceRevision === r.resultRevision && Date.parse(d.expiresAt) > Date.now() ? { bindingKey: d.bindingKey, expectedPartTwoRevision: d.resultRevision } : undefined;
          onSave(guard);
        }} />}
      {!partFourCurrent && r?.snapshotId && !r.declarationId && <Text>Saves the product only; this photo reading is not saved.</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {onCapture && r && (expired || expiredFields || r.declarationState !== 'accepted') && <Button label="Scan ingredients" size="medium" style={{ flex: 1, minHeight: 44 }} variant="ghost" onPress={onCapture} />}
        {(view.error || r?.allowedActions.includes('retry')) && <Button label="Retry" size="medium" style={{ flex: 1, minHeight: 44 }} variant="ghost" onPress={onRefresh} />}
        <Button label="Search by name" size="medium" style={{ flex: 1, minHeight: 44 }} variant="ghost" onPress={onSearch} />
      </View>
    </View>}>
    {typeof localDraft === 'function' ? localDraft(sourceAccess.current.privateDenied, setDetails) : !sourceAccess.current.privateDenied && localDraft}
    {personal.enabled && partFourCurrent && <PartThreeDetails view={personal.view} />}
    {partFourCurrent && partFour && currentDetails?.result?.state==='ready' ? <View onLayout={event=>{ingredientOrigin.current.y=event.nativeEvent.layout.y;}}><PartFourSections onIngredientJump={(id,y)=>{if(y!==undefined)setIngredientScroll({key:sourceKey+':'+id,y:ingredientOrigin.current.y+y});}} packet={partFour} researchSubject={researchSubjectFor(personal.view.result?.binding.subject)} now={clock} expectedBindingKey={currentDetails.result.bindingKey} expectedResultRevision={currentDetails.result.resultRevision} expectedDependencyDigest={currentDetails.result.output.reading.binding.dependencyDigest} withdrawn={Boolean(currentRefusal) || sourceAccess.current.privateDenied}/></View> : acquisitionTarget ? <PartTwoIngredientsView view={acquired} target={acquisitionTarget} enabled={ingredientEnabled} fallback={originalSections} education={education} contextSummary={false} /> : interpretationCaptureSessionId && localDraft ? null : originalSections}
    {!partFourCurrent && <Pressable accessibilityRole="button" accessibilityLabel="Source" accessibilityState={{ expanded: sourceOpen }} onPress={() => setSourceOpen(value => !value)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.brand }}>Source</Text></Pressable>}
    {!partFourCurrent && sourceOpen && !expired && !sourceUnavailable && sources.map(source => <View key={source.observationId} style={{ gap: spacing.xs }}>
      <Text>{source.label} · Observed {source.observedAt.slice(0, 10)}</Text>
      {source.url && <Button label={`View source: ${source.label}`} variant="ghost" onPress={() => {
        const url = source.url; if (url && new URL(url).protocol === 'https:') void Linking.openURL(url).catch(() => {});
      }} />}
    </View>)}
    {!partFourCurrent && sourceOpen && !expired && !sourceUnavailable && sources.some(source => isOpenBeautyFactsSource(source.url)) && <View>
      <Text>Open Beauty Facts contributors · Database ODbL · Contents DbCL.</Text>
      <Button label="Data licence and reuse" variant="ghost" onPress={() => { void Linking.openURL(OBF_SOURCE_METHOD_URL).catch(() => {}); }} />
    </View>}
    {personal.enabled && !partFourCurrent && <PartThreeDetails view={personal.view} />}
    {!partFourCurrent && r?.display.limitations.map((limitation, i) => <Text key={i}>{limitation}</Text>)}
  </ResultSheetSurface>;
}

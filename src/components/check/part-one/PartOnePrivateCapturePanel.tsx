import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CaptureBinding, MemoryLabelDraft } from '../../../presentation/part-one/capture';
import { privateEditReplacement, privateSourceEditChain, privateRecoveryRetentionDeadline, privateCapturedLabelProjection } from '../../../presentation/part-one/privateCaptureController';
import type { PrivateCaptureController } from '../../../presentation/part-one/privateCaptureController';
import type { CaptureRecovery } from '../../../contracts/PartOnePrivate';
import type { DraftLineRef } from '../../../presentation/part-one/captureReview';
const processing = (stage: string) => ['checking_policy','uploading','committing','saving','recovering','removing'].includes(stage);
const sectionLabels = { ingredients: 'Ingredients read from label', active: 'Active ingredients read from label', inactive: 'Inactive ingredients read from label', may_contain: 'May contain · read from label' };
const associations = { unknown: 'This label has not been associated with a catalog product.', candidate: 'Possible product association · needs review.',
  barcode_matches_catalog_same_asset: 'The barcode matches the selected catalog product in this photo. Ingredient coverage remains partial.',
  barcode_matches_catalog_unlinked_assets: 'The barcode matches the selected catalog product. The ingredient photos are not linked to that package.',
  contradiction: 'The package and product readings disagree.' };
const gapMessages: Record<string,string> = { ocr_panel_coverage_unverified: 'Text recognition cannot establish that the whole label panel was captured.',
  full_panel_not_established: 'Coverage of the full label panel has not been established.', section_tail_not_observed: 'The end of this label section has not been observed.',
  recognition_alternatives_unresolved: 'The recognition has unresolved alternative readings.', edited_layout_unresolved: 'The layout of corrected text needs review.',
  unresolved_column_layout: 'The order of label columns is uncertain.', same_package_photo_link_unestablished: 'The ingredient photos have not been linked to the barcode package.',
  package_barcode_unknown: 'A package barcode has not been established from these photos.', package_market_unknown: 'The package market is unknown.',
  package_category_unknown: 'The package category is unknown.', package_variant_incomplete: 'The exact package variant is not established.',
  ingredient_header_not_observed: 'An ingredient section heading has not been observed.', glare: 'Glare may obscure label text.', missing_region: 'A label region is missing.' };
function Action({ label, action, disabled = false, checked }: { label: string; action: () => void; disabled?: boolean; checked?: boolean }) {
  return <Pressable accessibilityLabel={label} accessibilityRole={checked === undefined ? 'button' : 'checkbox'} disabled={disabled}
    accessibilityState={{ disabled, ...(checked === undefined ? {} : { checked }) }} onPress={action} style={styles.action}><Text style={styles.body}>{checked ? 'Selected: ' : ''}{label}</Text></Pressable>;
}
function SavedLine({ controller, recovery, refValue, original, editable, role, photoNumber, originalObservationId }: { controller: PrivateCaptureController; recovery: CaptureRecovery;
  refValue: DraftLineRef; original: string; editable: boolean; role: 'ingredients' | 'package'; photoNumber: number; originalObservationId: string }) {
  const state = controller.getState(), chain = privateSourceEditChain(originalObservationId, [...recovery.edits, ...state.pendingEdits]);
  const validChain = chain !== null && chain.every(edit => !edit.sourceRef || edit.sourceRef.evidenceId === refValue.evidenceId);
  const matching = validChain ? chain!.filter(edit => edit.sourceRef?.lineIndex === refValue.lineIndex) : [];
  editable = editable && validChain;
  const [editing, setEditing] = useState(false), [text, setText] = useState(matching.length ? privateEditReplacement(matching.at(-1)!) : original);
  return <View style={styles.group}>
    <Text selectable style={styles.body}>Original recognition: {original}</Text>
    {!validChain && <Text style={styles.body}>Correction history is uncertain. Reopen before editing this observation.</Text>}
    {matching.map(edit => <Text selectable key={edit.observationId} style={styles.body}>Your private correction · revision {edit.revision}: {privateEditReplacement(edit)}</Text>)}
    {editable && <Action label={`Correct saved ${role} photo ${photoNumber} recognition ${refValue.observationIndex + 1} line ${refValue.lineIndex + 1}`}
      action={() => { setText(matching.length ? privateEditReplacement(matching.at(-1)!) : original); setEditing(true); }} />}
    {editing && editable && <><TextInput accessibilityLabel={`Saved correction for line ${refValue.lineIndex + 1}`} value={text} onChangeText={setText} multiline autoCorrect={false} spellCheck={false} autoCapitalize="none" maxLength={4000} style={styles.input} />
      <Action label={`Apply saved private correction to line ${refValue.lineIndex + 1}`} action={() => { if (controller.correctLine(refValue, text, originalObservationId)) setEditing(false); }} />
      <Action label={`Cancel saved private correction for line ${refValue.lineIndex + 1}`} action={() => setEditing(false)} /></>}
  </View>;
}
/** The real Check and My Stuff use this same handler surface. Production retention stays independently gated. */
export function PartOnePrivateCapturePanel({ controller, ownerId, draft, binding }: { controller: PrivateCaptureController; ownerId: string;
  draft?: MemoryLabelDraft; binding?: CaptureBinding | null }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [, refreshDraft] = useState(0), [clock, setClock] = useState(Date.now);
  useEffect(() => draft?.subscribe(() => refreshDraft(value => value + 1)), [draft]);
  const recovery = state.recovery && privateRecoveryRetentionDeadline(state.recovery) > Math.max(clock, Date.now()) ? state.recovery : null;
  const photoNumbers = new Map(Array.from(new Set([...(recovery?.sourceObservations.map(entry => entry.observation.evidenceId) ?? []),
    ...(recovery?.assets.map(entry => entry.asset.evidenceId) ?? [])])).map((evidenceId, index) => [evidenceId, index + 1]));
  const projectedResult = recovery?.boundResult ?? recovery?.result;
  const nextExpiry = [...(recovery?.assets.flatMap(entry => [entry.signedAccess?.expiresAt, entry.expiresAt]) ?? []), projectedResult?.freshness.expiresAt,
    recovery?.capturedSource?.candidate?.expiresAt, ...(projectedResult?.display.sections.map(section => section.expiresAt) ?? [])].filter((value): value is string => Boolean(value)).map(Date.parse)
    .filter(value => value > Math.max(clock, Date.now())).sort((a,b) => a-b)[0];
  useEffect(() => { if (!nextExpiry) return; const timer = setTimeout(() => setClock(Date.now()), Math.min(60000, Math.max(1,nextExpiry-Date.now()))); return () => clearTimeout(timer); }, [nextExpiry,clock]);
  if ((state.stage === 'disabled' && !state.error) || state.ownerId !== ownerId || !controller.isCurrentOwner()) return null;
  const local = draft && binding ? draft.read(binding) : null, working = processing(state.stage), locked = working || state.stage === 'disclosure', now = Math.max(clock,Date.now());
  const labelFacts = privateCapturedLabelProjection(state, ownerId, now);
  const acceptedCurrent = !recovery?.capturedSource && state.stage === 'saved_accepted' && Boolean(projectedResult?.freshness.expiresAt && Date.parse(projectedResult.freshness.expiresAt) > now);
  const status = acceptedCurrent ? 'Saved private package evidence · accepted by server review' :
    state.stage === 'saved_partial' || state.stage === 'saved_accepted' ? 'Saved private label note · partial or uncertain' : state.stage === 'removed' ? 'Private evidence removed' :
    state.stage === 'uploading' ? 'Uploading sanitized label photos privately…' : state.stage === 'committing' || state.stage === 'saving' ? 'Saving private label evidence…' :
    state.stage === 'recovering' ? 'Opening saved private evidence…' : state.stage === 'removing' ? 'Removing private evidence…' : 'Temporary label draft · unsaved';
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>Private label evidence</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{status}</Text>
    <Text style={styles.body}>Private photos, originals and corrections belong to this account. They do not verify the shared catalog. Coverage marks and OCR confidence do not establish acceptance.</Text>
    {state.error && <Text accessibilityRole="alert" style={styles.body}>{state.error}</Text>}
    {labelFacts && <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.heading}>{labelFacts.kind === 'accepted' ? 'Accepted declaration for this private package' : 'Read from this private label · partial or uncertain'}</Text>
      <Text style={styles.body}>{labelFacts.kind === 'accepted' ? 'These facts apply to this saved package and its reviewed declaration. They do not establish a timeless formula for every product with this barcode.' :
        'Only text seen in these private label photos is shown. This is not a complete ingredient list; unlisted ingredients cannot be ruled out. These readings do not verify the shared catalog.'}</Text>
      {labelFacts.name && <Text selectable style={styles.body}>Name read from label: {labelFacts.name}</Text>}
      {labelFacts.association && <Text style={styles.body}>{associations[labelFacts.association]}</Text>}
      {labelFacts.sections.map(section => <View key={section.id} style={styles.group}><Text accessibilityRole="header" style={styles.heading}>{sectionLabels[section.kind]}</Text>
        <Text selectable accessibilityLabel={`Private label reading: ${sectionLabels[section.kind]}`} style={styles.body}>{section.text}</Text></View>)}
      {labelFacts.capturedText.map(entry => <View key={entry.id} style={styles.group}><Text style={styles.body}>{entry.attributedEdit ? 'Your private correction · extracted text' : 'Text recognized from the uploaded label'}</Text>
        <Text selectable style={styles.body}>{entry.text}</Text></View>)}
      {labelFacts.gaps.length > 0 && <Text style={styles.body}>Additional label coverage or package association evidence is needed. Missing regions and unobserved text remain unknown.</Text>}
      {Array.from(new Set(labelFacts.gaps.map(code => gapMessages[code]).filter(Boolean))).map(message => <Text key={message} style={styles.body}>{message}</Text>)}
      {labelFacts.conflict && <Text accessibilityRole="alert" style={styles.body}>Some label readings disagree. Review the originals and corrections before relying on these partial facts.</Text>}
      {labelFacts.contradictions.map((entry,index) => <Text selectable key={index} style={styles.body}>Conflicting {entry.kind === 'source_reading' ? 'label text' : entry.kind} readings: {entry.values.join(' / ')}</Text>)}
      {labelFacts.limitations.map((limitation,index) => <Text key={index} style={styles.body}>{limitation}</Text>)}
    </View>}
    {local && local.shots.map((shot,index) => <View key={shot.evidenceId} style={styles.group}>
      <Text style={styles.body}>Photo {index+1} role · your observation</Text>
      <Action label={`Photo ${index+1} is an ingredient declaration`} checked={(state.photoRoles[shot.evidenceId] ?? 'ingredients') === 'ingredients'} disabled={locked}
        action={() => controller.setPhotoRole(shot.evidenceId,'ingredients')} />
      <Action label={`Photo ${index+1} is a package or barcode view`} checked={state.photoRoles[shot.evidenceId] === 'package'} disabled={locked}
        action={() => controller.setPhotoRole(shot.evidenceId,'package')} />
    </View>)}
    {local && local.shots.length > 0 && !working && state.stage !== 'disclosure' && <Action label="Review private photo and text save" disabled={draft?.hasPendingRecognition()} action={() => void controller.discloseDraft(local)} />}
    {state.stage === 'disclosure' && state.capability && <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.heading}>Before saving privately</Text>
      <Text style={styles.body}>This uploads the full selected label photos as sanitized JPEGs and saves the recognized text, your corrections and review history to your private account. Unnecessary background should be removed before selecting the photo. No raw original is uploaded.</Text>
      <Text style={styles.body}>The current policy retains private evidence for up to {state.capability.retentionSeconds} seconds. Requested deletion completes within {state.capability.deletionDeadlineSeconds} seconds. Policy: {state.capability.policyVersion}.</Text>
      <Text style={styles.body}>Local OCR permission alone does not authorize this upload. A partial saved note remains partial; your confirmation does not make it accepted.</Text>
      <Action label="I agree to the disclosed private photo and text upload" checked={state.disclosureAccepted} action={() => controller.acceptDisclosure(!state.disclosureAccepted)} />
      <Action label="Save disclosed private label evidence" disabled={!state.disclosureAccepted} action={() => void controller.confirmSave()} />
      <Action label="Cancel private save disclosure" action={() => controller.cancelDisclosure()} />
    </View>}
    {working && state.capture && state.stage !== 'removing' && <Action label="Cancel private save and remove uploaded evidence" action={() => void controller.cancelSave()} />}
    {state.stage === 'unavailable' && !working && <Action label="Retry private save with disclosure" action={() => void controller.retry()} />}
    {['conflict','unavailable','disabled'].includes(state.stage) && state.capture && !recovery && state.error && <Action label="Reopen private evidence after conflict" action={() => void controller.recover(ownerId,state.capture!.captureSessionId)} />}
    {recovery && <View style={styles.group}>
      {!recovery.editable && <Text style={styles.body}>The current product binding changed. This saved package evidence is read only and keeps its original context.</Text>}
      {recovery.assets.map(entry => <View key={entry.attestationId} style={styles.group}>
        <Text style={styles.body}>Saved photo {photoNumbers.get(entry.asset.evidenceId)} · expires {entry.expiresAt}</Text>
        {entry.signedAccess && Date.parse(entry.signedAccess.expiresAt)>now ? <Image accessibilityLabel={`Saved private sanitized photo ${photoNumbers.get(entry.asset.evidenceId)}`} source={{uri:entry.signedAccess.url,cache:'reload'}} resizeMode="contain" style={styles.image} /> : <Text style={styles.body}>Private photo access expired. Reopen to request current access.</Text>}
      </View>)}
      {recovery.sourceObservations.map((entry,index) => {
        const observationIndex = recovery.sourceObservations.slice(0,index).filter(previous => previous.observation.evidenceId === entry.observation.evidenceId).length;
        return <View key={entry.observationId} style={styles.group}>
          <Text style={styles.body}>Original {entry.role} observation · {entry.observation.recognizer} · correction {entry.observation.correctionEnabled ? 'on' : 'off'}</Text>
          {entry.observation.lines.map((line,lineIndex) => <SavedLine key={`${entry.observationId}:${lineIndex}`} controller={controller} recovery={recovery} original={line.text}
            originalObservationId={entry.observationId} role={entry.role} photoNumber={photoNumbers.get(entry.observation.evidenceId)!}
            refValue={{evidenceId:entry.observation.evidenceId,observationIndex,lineIndex}} editable={recovery.editable && !locked} />)}
        </View>;
      })}
      {recovery.review && <><Text style={styles.body}>Saved operator coverage: {recovery.review.coverage.startSeen ? 'start marked' : 'start missing'}; {recovery.review.coverage.endSeen ? 'end marked' : 'end missing'}.</Text>
        {recovery.review.coverage.missingRegions.map((region,index) => <Text key={index} style={styles.body}>Missing region: {region}</Text>)}
        {recovery.review.reviewState.assemblies.map(assembly => <View key={assembly.revision} style={styles.group}><Text style={styles.body}>Saved {assembly.section} · {assembly.language} assembly {assembly.revision}</Text>
          {assembly.lines.map((line,index) => <Text key={index} selectable style={styles.body}>{line.text}</Text>)}</View>)}
      </>}
      {state.pendingEdits.length>0 && <><Text style={styles.body}>Your new corrections are unsaved. Saving them requires new server review and may retract accepted evidence.</Text><Action label="Review private correction save" disabled={working} action={() => void controller.discloseChanges()} /></>}
      <Action label="Reopen saved private label evidence" disabled={working} action={() => void controller.recover(ownerId,recovery.capture.captureSessionId)} />
    </View>}
    {state.capture && !working && <Action label="Remove saved private label evidence" action={() => void controller.remove()} />}
  </View>;
}
const styles=StyleSheet.create({panel:{gap:12,paddingVertical:16},group:{gap:8},heading:{fontSize:19,fontWeight:'600',color:'#252B27'},
  body:{fontSize:17,lineHeight:25,color:'#353B36'},action:{minHeight:48,padding:12,borderWidth:1,borderColor:'#6A746A',borderRadius:14},
  input:{minHeight:48,padding:12,borderWidth:1,borderColor:'#6A746A',borderRadius:12,fontSize:17},image:{width:'100%',height:260}});

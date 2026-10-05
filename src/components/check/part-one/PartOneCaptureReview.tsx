import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { buildLocalDraftSummary, createCaptureReviewHandlers, DRAFT_GAP_PROMPTS, latestPhotoRefs, lineRefKey, resolveDraftLine } from '../../../presentation/part-one/captureReview';
import type { DraftGapKind, DraftLineRef, DraftSection, ReviewActionResult } from '../../../presentation/part-one/captureReview';
import type { CaptureBinding, CaptureDraft, MemoryLabelDraft } from '../../../presentation/part-one/capture';

type Props = { draft: MemoryLabelDraft; binding: CaptureBinding; onChange: () => void };
const sectionLabels: Record<DraftSection, string> = { unknown: 'Not assigned', ingredients: 'Ingredients', active: 'Active', inactive: 'Inactive', explanatory: 'Explanatory text' };
const sectionOrder: DraftSection[] = ['unknown', 'ingredients', 'active', 'inactive', 'explanatory'];
const errorCopy: Record<string, string> = {
  stale_capture: 'This temporary draft has ended. Return to the product and start a fresh capture.',
  invalid_source_lines: 'Choose readable lines from the current photo observations.',
  invalid_correction: 'Enter the text you can read from this line. Keep punctuation and quantities as printed.',
  invalid_language_tag: 'Use a language tag such as en, es or fr. Language is your observation, not inferred from the barcode.',
  section_or_language_mismatch: 'Keep different languages, active/inactive sections and explanatory text separate. Assign one section and language before assembling.',
  same_package_not_observed: 'Confirm each selected photo comes from this same physical package. This does not verify catalog identity.',
  same_declaration_not_observed: 'Only assemble views you observed on the same declaration of this physical package.',
  two_distinct_views_required: 'Select lines from at least two different photos.',
  noncontiguous_source_lines: 'Select consecutive readable lines within each photo. A hidden gap cannot be filled by assembly.',
  no_matching_overlap: 'These views have no exact readable overlap. Keep them separate and add a photo with more overlap.',
  ambiguous_repeated_overlap: 'Repeated text makes this overlap ambiguous. Keep the views separate and add more distinctive overlap.',
  insufficient_overlap: 'One ingredient name cannot establish alignment. Choose at least two overlap lines, or one complete distinctive line.',
  package_conflict: 'A package mismatch was reported. These views cannot be assembled as evidence for this item; return to the product and rescan.',
  corrected_overlap_disagrees: 'The overlapping corrections disagree. Both originals remain; review the actual package instead of combining them.',
};
function Action({ label, onPress, disabled = false, checked }: { label: string; onPress: () => void; disabled?: boolean; checked?: boolean }) {
  return <Pressable accessibilityRole={checked === undefined ? 'button' : 'checkbox'} accessibilityLabel={label}
    accessibilityState={{ disabled, ...(checked === undefined ? {} : { checked }) }} disabled={disabled} onPress={onPress} style={styles.action}>
    <Text style={styles.body}>{checked === undefined ? '' : checked ? 'Selected: ' : ''}{label}</Text>
  </Pressable>;
}

function CorrectionEditor({ current, refValue, photoNumber, advanced, apply }: { current: CaptureDraft; refValue: DraftLineRef; photoNumber: number; advanced: boolean;
  apply: (ref: DraftLineRef, text: string) => ReviewActionResult }) {
  const line = resolveDraftLine(current, refValue)!;
  const [editing, setEditing] = useState(false), [text, setText] = useState(line.text), [error, setError] = useState<string | null>(null);
  const history = current.edits.filter(edit => edit.observationEvidenceId === refValue.evidenceId && edit.observationIndex === refValue.observationIndex && edit.lineIndex === refValue.lineIndex);
  return <View style={styles.group}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Correct photo ${photoNumber} line ${refValue.lineIndex + 1}`} onPress={() => { setText(line.text); setEditing(true); }} style={{ minHeight: 44, paddingVertical: 8 }}><Text style={styles.body}>{line.text}</Text>{line.correctionRevision !== null && <Text style={styles.provenance}>Your correction</Text>}</Pressable>
    {advanced && line.correctionRevision !== null && <Text selectable style={styles.body}>Original recognition: {line.rawText}</Text>}
    {editing && <>
      <Text style={styles.body}>Type only what you can read on this package. A correction cannot fill a hidden line or clear a missing region.</Text>
      <TextInput accessibilityLabel={`Correction for photo ${photoNumber} line ${refValue.lineIndex + 1}`} multiline value={text} onChangeText={setText}
        autoCorrect={false} autoCapitalize="none" spellCheck={false} maxLength={4000} style={styles.input} />
      <Action label={`Apply local correction to photo ${photoNumber} line ${refValue.lineIndex + 1}`} onPress={() => {
        const result = apply(refValue, text); if (result.ok) { setEditing(false); setError(null); } else setError(errorCopy[result.reason] ?? result.reason);
      }} />
      <Action label={`Cancel correction for photo ${photoNumber} line ${refValue.lineIndex + 1}`} onPress={() => { setEditing(false); setError(null); }} />
      {error && <Text accessibilityLiveRegion="polite" style={styles.body}>{error}</Text>}
    </>}
    {advanced && history.map(edit => <Text selectable key={edit.revision} style={styles.provenance}>Your local correction {edit.revision}{edit.supersedesRevision === null ? ' · original edit' : ` · supersedes ${edit.supersedesRevision}`}: {edit.text}</Text>)}
  </View>;
}

export function PartOneCaptureReview({ draft, binding, onChange }: Props) {
  const [, refresh] = useState(0);
  const currentBinding = useRef(binding); currentBinding.current = binding;
  useEffect(() => draft.subscribe(() => refresh(value => value + 1)), [draft]);
  const [selected, setSelected] = useState<DraftLineRef[]>([]), [sameDeclaration, setSameDeclaration] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [notice, setNotice] = useState('Check the readable text. Missing words remain unknown.');
  const current = draft.read(binding);
  if (!current) return <Text style={styles.body}>This temporary draft has ended. Return to the product to begin a fresh capture.</Text>;
  const handlers = createCaptureReviewHandlers(draft, () => currentBinding.current, () => { refresh(value => value + 1); onChange(); });
  const model = buildLocalDraftSummary(current);
  const selectedKeys = new Set(selected.map(lineRefKey));
  const run = (result: ReviewActionResult, success: string) => setNotice(result.ok ? success : errorCopy[result.reason] ?? result.reason);
  const toggle = (ref: DraftLineRef) => setSelected(values => values.some(value => lineRefKey(value) === lineRefKey(ref)) ? values.filter(value => lineRefKey(value) !== lineRefKey(ref)) : [...values, ref]);
  return <View style={styles.content}>
    <Text accessibilityRole="header" style={styles.heading}>Review the label</Text>
    <Text style={styles.body}>Review what the photo shows. You can correct a readable line or add another view. This reading may be incomplete.</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text>
    {advanced && <>
    <Action label="This is a cosmetic ingredients label" checked={current.review.mode === 'cosmetic'} onPress={() => run(handlers.setMode('cosmetic'), 'Cosmetic ingredient coverage selected.')} />
    <Action label="This is Drug Facts with active and inactive ingredients" checked={current.review.mode === 'drug_facts'} onPress={() => run(handlers.setMode('drug_facts'), 'Active and inactive sections are both required.')} />
    <Action label="Label type is uncertain" checked={current.review.mode === 'unknown'} onPress={() => run(handlers.setMode('unknown'), 'Label scope remains uncertain.')} />
    <Action label="Selected lines show the declaration start" disabled={!selected.length} checked={current.coverage.startSeen}
      onPress={() => run(handlers.markBoundary('start', current.coverage.startSeen ? [] : selected), 'Declaration start observation updated.')} />
    <Action label="Selected lines show the declaration end" disabled={!selected.length} checked={current.coverage.endSeen}
      onPress={() => run(handlers.markBoundary('end', current.coverage.endSeen ? [] : selected), 'Declaration end observation updated.')} />
    <Text style={styles.heading}>Missing or unreadable regions</Text>
    {(['right_edge', 'left_edge', 'tail', 'glare', 'hidden_line', 'fold', 'active', 'inactive'] as DraftGapKind[]).map(kind => <Action key={kind}
      label={`Report ${kind.replaceAll('_', ' ')} missing or unreadable`} onPress={() => run(handlers.reportGap(kind), DRAFT_GAP_PROMPTS[kind])} />)}
    {current.review.gaps.map(gap => <View key={gap.id} style={styles.group}>
      <Text style={styles.body}>{gap.status === 'missing' ? DRAFT_GAP_PROMPTS[gap.kind] : `You marked ${gap.kind.replaceAll('_', ' ')} visible in selected source lines. This is an operator observation.`}</Text>
      {gap.status === 'missing' && <Action label={`Selected lines cover ${gap.kind.replaceAll('_', ' ')}`} disabled={!selected.length}
        onPress={() => run(handlers.resolveGap(gap.id, selected), 'Region marked visible in the selected observations. Other missing regions remain.')} />}
    </View>)}
    </>}
    {current.shots.map((shot, photoIndex) => {
      const refs = latestPhotoRefs(current, shot.evidenceId), assignedLanguage = current.review.assignments.find(value => value.ref.evidenceId === shot.evidenceId)?.language ?? '';
      return <PhotoReview key={`${shot.evidenceId}:${shot.observations.length}`} current={current} shotId={shot.evidenceId} photoNumber={photoIndex + 1}
        advanced={advanced} refs={refs} language={assignedLanguage} selectedKeys={selectedKeys} toggle={toggle} run={run} handlers={handlers}
        selectAll={() => setSelected(values => [...values.filter(value => value.evidenceId !== shot.evidenceId), ...refs])} />;
    })}
    {advanced && <>
    <Text accessibilityRole="header" style={styles.heading}>Assemble overlapping views</Text>
    <Text style={styles.body}>Select consecutive lines from each view in reading order. Only a unique exact overlap from the same package, declaration, section and language can join. Hidden words and catalog text are never filled in.</Text>
    <Text style={styles.body}>View order: {[...new Set(selected.map(ref => ref.evidenceId))].map(id => `Photo ${current.shots.findIndex(shot => shot.evidenceId === id) + 1}`).join(' → ') || 'No lines selected'}</Text>
    <Action label="Reverse selected view order" disabled={selected.length < 2} onPress={() => setSelected(values => [...values].reverse())} />
    <Action label="These views overlap on the same declaration of this physical package" checked={sameDeclaration} onPress={() => setSameDeclaration(value => !value)} />
    <Action label="Assemble selected overlapping views locally" disabled={!selected.length} onPress={() => run(handlers.assemble(selected, sameDeclaration), 'Overlapping views assembled locally with original photo and region lineage.')} />
    {model?.assemblies.map(assembly => <View key={assembly.revision} style={styles.group}>
      <Text style={styles.heading}>{assembly.section} · {assembly.language} · local assembly {assembly.revision}</Text>
      {assembly.stale && <Text style={styles.body}>This assembly needs review after a correction.</Text>}
      {assembly.lines.map((line, index) => <Text selectable key={index} style={styles.body}>{line.text}</Text>)}
    </View>)}
    </>}
    <Action label={advanced ? "Hide label options" : "Label options"} onPress={() => setAdvanced(value => !value)} />
    <Text style={styles.body}>No local review, correction or assembly is a permanent save or shared catalog contribution.</Text>
  </View>;
}

function PhotoReview({ advanced, current, shotId, photoNumber, refs, language, selectedKeys, toggle, run, handlers, selectAll }: {
  advanced: boolean; current: CaptureDraft; shotId: string; photoNumber: number; refs: DraftLineRef[]; language: string; selectedKeys: Set<string>;
  toggle: (ref: DraftLineRef) => void; run: (result: ReviewActionResult, success: string) => void;
  handlers: ReturnType<typeof createCaptureReviewHandlers>; selectAll: () => void;
}) {
  const [languageText, setLanguageText] = useState(language), [history, setHistory] = useState(false);
  const shot = current.shots.find(value => value.evidenceId === shotId)!;
  return <View style={styles.photo}>
    <Text accessibilityRole="header" style={styles.heading}>Photo {photoNumber}</Text>
    <Image source={{ uri: shot.uri }} accessibilityLabel={`Original local ingredient photo ${photoNumber}`} resizeMode="contain" style={styles.image} />
    {advanced && <>
    <Action label={`Photo ${photoNumber} is from this same physical package`} checked={current.review.samePackagePhotoIds.includes(shotId)}
      onPress={() => run(handlers.confirmPackage(shotId, !current.review.samePackagePhotoIds.includes(shotId)), 'Package observation updated privately; catalog verification is unchanged.')} />
    <Action label={`Photo ${photoNumber} shows a different product or package`} onPress={() => run(handlers.reportPackageConflict(shotId), 'Package mismatch recorded. Confirmation and edits cannot clear it; return to the product and rescan.')} />
    <Text style={styles.body}>Language you can see (for example en, es, fr). This is not inferred from OCR, GPS or barcode.</Text>
    <TextInput accessibilityLabel={`Observed language for photo ${photoNumber}`} value={languageText} onChangeText={setLanguageText} autoCorrect={false} autoCapitalize="none" maxLength={25} style={styles.input} />
    <Action label={`Apply observed language to photo ${photoNumber}`} disabled={!refs.length} onPress={() => run(handlers.setPhotoLanguage(shotId, languageText), 'Language recorded as your package observation.')} />
    {(['ingredients', 'active', 'inactive', 'explanatory'] as DraftSection[]).map(section => <Action key={section}
      label={`Photo ${photoNumber} all readable lines are ${sectionLabels[section]}`} disabled={!refs.length}
      onPress={() => run(handlers.assignLines(refs, section, languageText), 'Section assigned to readable lines. Use individual line controls when sections differ.')} />)}
    <Action label={`Select all readable lines from photo ${photoNumber}`} disabled={!refs.length} onPress={selectAll} />
    </>}
    {refs.map(ref => {
      const raw = shot.observations[ref.observationIndex].lines[ref.lineIndex], assignment = current.review.assignments.find(value => lineRefKey(value.ref) === lineRefKey(ref));
      return <View key={lineRefKey(ref)} style={styles.line}>
        {advanced && <>
        <Text style={styles.provenance}>Photo {photoNumber} · recognition {ref.observationIndex + 1} · line {ref.lineIndex + 1}; original punctuation retained</Text>
        {raw.alternatives.some(value => value !== raw.text) && <Text selectable style={styles.body}>Recognition alternatives: {raw.alternatives.join(' | ')}. This remains uncertain.</Text>}
        <Action label={`Select photo ${photoNumber} line ${ref.lineIndex + 1} for coverage or overlap`} checked={selectedKeys.has(lineRefKey(ref))} onPress={() => toggle(ref)} />
        <Action label={`Change section for photo ${photoNumber} line ${ref.lineIndex + 1}: ${sectionLabels[assignment?.section ?? 'unknown']}`}
          onPress={() => run(handlers.assignLines([ref], sectionOrder[(sectionOrder.indexOf(assignment?.section ?? 'unknown') + 1) % sectionOrder.length], languageText), 'Line section updated; active, inactive and explanatory text stay separate.')} />
        </>}
        <CorrectionEditor advanced={advanced} current={current} refValue={ref} photoNumber={photoNumber} apply={handlers.correctLine} />
      </View>;
    })}
    {advanced && <Action label={`Show original recognition history for photo ${photoNumber}`} onPress={() => setHistory(value => !value)} />}
    {advanced && history && shot.observations.map((observation, index) => <View key={index} style={styles.group}>
      <Text style={styles.provenance}>Original recognition {index + 1} · {observation.recognizer} · correction {observation.correctionEnabled ? 'on' : 'off'} · {observation.status}</Text>
      {observation.lines.map((line, lineIndex) => <Text selectable key={lineIndex} style={styles.body}>{line.text}</Text>)}
    </View>)}
    {advanced && history && current.edits.filter(edit => edit.observationEvidenceId === shotId).map(edit => <Text key={`edit-${edit.revision}`} selectable style={styles.provenance}>
      Your correction {edit.revision} · recognition {edit.observationIndex + 1}{edit.lineIndex === null ? '' : ` · line ${edit.lineIndex + 1}`}{edit.supersedesRevision === null ? '' : ` · supersedes ${edit.supersedesRevision}`}: {edit.text}
    </Text>)}
  </View>;
}

const styles = StyleSheet.create({ content: { gap: 12 }, heading: { fontSize: 19, fontWeight: '600', color: '#252B27' },
  body: { fontSize: 17, lineHeight: 25, color: '#353B36' }, provenance: { fontSize: 15, lineHeight: 22, color: '#353B36' },
  group: { gap: 7 }, photo: { gap: 12, paddingVertical: 14 }, line: { gap: 8, paddingVertical: 10 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#6A746A', borderRadius: 12, padding: 12, fontSize: 17, color: '#252B27' },
  action: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#6A746A', borderRadius: 14 }, image: { width: '100%', height: 260 } });

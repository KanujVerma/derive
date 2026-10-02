import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildLocalDraftSummary, lineRefKey } from '../../../presentation/part-one/captureReview';
import type { CaptureBinding, MemoryLabelDraft } from '../../../presentation/part-one/capture';

type Props = { draft: MemoryLabelDraft; binding: CaptureBinding; onReview?: () => void; onRemove?: () => void };
/** Existing result sheet may embed this component without another sheet or evidence commit. */
export function PartOneLocalDraftSummary({ draft, binding, onReview, onRemove }: Props) {
  const [, refresh] = useState(0);
  useEffect(() => draft.subscribe(() => refresh(value => value + 1)), [draft]);
  const model = buildLocalDraftSummary(draft.read(binding));
  if (!model) return null;
  const represented = new Set(model.assemblies.flatMap(assembly => assembly.lines.flatMap(line => line.sources.map(lineRefKey))));
  return <View style={styles.content}>
    <Text accessibilityRole="header" style={styles.heading}>{model.state === 'partial' ? 'Partial local label draft' : 'Local label preview'}</Text>
    {model.limitations.map(limit => <Text key={limit} style={styles.body}>{limit}</Text>)}
    {model.prompts.map(prompt => <Text key={prompt} style={styles.body}>{prompt}</Text>)}
    {model.assemblies.map(assembly => <View key={assembly.revision} style={styles.group}>
      <Text style={styles.heading}>{assembly.section} · {assembly.language} · overlapping views reviewed by you</Text>
      {assembly.stale && <Text accessibilityLiveRegion="polite" style={styles.body}>This assembly needs review after a correction or source change.</Text>}
      {assembly.lines.map((line, index) => <View key={index} style={styles.group}>
        <Text selectable style={styles.body}>{line.text}</Text>
        {line.correctionRevision !== null && <><Text style={styles.body}>Your correction · revision {line.correctionRevision}</Text><Text selectable style={styles.body}>Original recognition: {line.rawText}</Text></>}
        <Text style={styles.provenance}>{line.sources.map(source => {
          const photo = model.photos.find(value => value.evidenceId === source.evidenceId);
          return `Photo ${photo?.photoNumber ?? '?'} · recognition ${source.observationIndex + 1} · line ${source.lineIndex + 1}`;
        }).join('; ')}</Text>
      </View>)}
    </View>)}
    {model.photos.map(photo => {
      const lines = photo.lines.filter(line => !represented.has(lineRefKey(line.ref)));
      if (!lines.length) return null;
      return <View key={photo.evidenceId} style={styles.group}>
        <Text style={styles.heading}>Photo {photo.photoNumber} · separate local view</Text>
        {lines.map(line => <View key={lineRefKey(line.ref)} style={styles.group}>
          <Text selectable style={styles.body}>{line.text}</Text>
          {line.correctionRevision !== null && <><Text style={styles.body}>Your correction · revision {line.correctionRevision}</Text><Text selectable style={styles.body}>Original recognition: {line.rawText}</Text></>}
        </View>)}
      </View>;
    })}
    {onReview && <Pressable accessibilityRole="button" accessibilityLabel="Review local label draft and add missing photos" onPress={onReview} style={styles.action}><Text style={styles.body}>Review draft or add photo</Text></Pressable>}
    {onRemove && <Pressable accessibilityRole="button" accessibilityLabel="Remove local label draft" onPress={onRemove} style={styles.action}><Text style={styles.body}>Remove draft</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({ content: { gap: 12, paddingVertical: 12 }, heading: { fontSize: 18, fontWeight: '600', color: '#252B27' },
  body: { fontSize: 17, lineHeight: 25, color: '#353B36' }, provenance: { fontSize: 15, lineHeight: 22, color: '#353B36' },
  group: { gap: 6 }, action: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#6A746A', borderRadius: 14 } });

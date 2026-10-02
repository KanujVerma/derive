import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button } from '../ui/Button';
import { PartOneResultSheet } from '../check/part-one/PartOneResultSheet';
import { deletePartOneSave, listPartOneSaves, readPartOneSave, type PartOneSavedProduct } from '../../services/partOne';
import { useAuthStore } from '../../stores/authStore';
import { PartOnePrivateCapturePanel } from '../check/part-one/PartOnePrivateCapturePanel';
import { createPrivateCaptureController } from '../../presentation/part-one/privateCaptureController';
import { PART_ONE_PRIVATE_ENABLED, partOnePrivateTransport } from '../../services/partOnePrivate';
import { preparePrivateLabelUpload } from '../../../modules/derive-label-ocr';
import { createCatalogRequestId } from '../../services/productCatalog';
import type { PrivateCaptureSummary } from '../../contracts/PartOnePrivate';
import { spacing } from '../../constants/theme';

/** Server reads preserve snapshot-at-save. No ingredient text is cached on disk. */
export function PartOneSavedProducts({ ownerId }: { ownerId: string }) {
  const reloadPrivateList = useRef<(() => Promise<void>) | null>(null);
  const [notes, setNotes] = useState<PrivateCaptureSummary[]>([]);
  const [privateController] = useState(() => createPrivateCaptureController({ enabled: PART_ONE_PRIVATE_ENABLED, transport: partOnePrivateTransport,
    sanitize: preparePrivateLabelUpload, currentOwner: () => useAuthStore.getState().sessionUserId, createId: createCatalogRequestId,
    onSaved: () => { void reloadPrivateList.current?.(); }, onRemoved: () => { setSelected(null); void reloadPrivateList.current?.(); } }));
  const privateState = useSyncExternalStore(privateController.subscribe, privateController.getState);
  const [records, setRecords] = useState<PartOneSavedProduct[]>([]);
  const [selected, setSelected] = useState<PartOneSavedProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const clock = Math.max(now, Date.now());
  const nextExpiry = records.flatMap(record => [record.result.display.selectedIdentity?.expiresAt, record.result.freshness?.expiresAt])
    .filter((value): value is string => Boolean(value)).map(Date.parse).filter(time => Number.isFinite(time) && time > clock).sort((a, b) => a - b)[0];
  useEffect(() => {
    if (!nextExpiry) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(60000, Math.max(1, nextExpiry - clock)));
    return () => clearTimeout(timer);
  }, [nextExpiry, now]);
  const name = (record: PartOneSavedProduct) => {
    const identity = record.result.display.selectedIdentity;
    return identity && Date.parse(identity.expiresAt) > clock ? identity.name : 'saved product';
  };
  const accepted = (record: PartOneSavedProduct) => record.result.declarationState === 'accepted' && record.result.freshness.state === 'fresh'
    && Boolean(record.result.freshness.expiresAt && Date.parse(record.result.freshness.expiresAt) > clock);

  const epoch = useRef(0); const reads = useRef(0); const owner = useRef(ownerId); owner.current = ownerId;
  const current = (token: number) => token === epoch.current && owner.current === ownerId && useAuthStore.getState().sessionUserId === ownerId;
  const load = async () => { const token = epoch.current; try { const [next, nextNotes] = await Promise.all([listPartOneSaves(), PART_ONE_PRIVATE_ENABLED ? partOnePrivateTransport.list() : Promise.resolve([])]); if (current(token)) { setRecords(next); setNotes(nextNotes); setSelected(previous => previous ? next.find(record => record.saveId === previous.saveId) ?? null : null); setError(null); } } catch { if (current(token)) setError('Saved products are unavailable. Try again.'); } };
  reloadPrivateList.current = load;
  useEffect(() => { epoch.current++; setRecords([]); setNotes([]); setSelected(null); setError(null); privateController.setOwner(ownerId); void load(); return () => { epoch.current++; privateController.close(); }; }, [ownerId]);
  useFocusEffect(React.useCallback(() => { void load(); const timer = setInterval(() => void load(), 10000); return () => { clearInterval(timer); epoch.current++; }; }, [ownerId]));
  const open = async (id: string) => { const token = epoch.current; const read = ++reads.current; try { const record = await readPartOneSave(id); if (current(token) && read === reads.current) { setSelected(previous => previous?.saveId === id && previous.result.resultRevision > record.result.resultRevision ? previous : record);
      if (PART_ONE_PRIVATE_ENABLED && record.captureSessionId) void privateController.recover(ownerId, record.captureSessionId); else privateController.close(); } } catch { if (current(token) && read === reads.current) setError('This saved product changed or is unavailable.'); } };
  const remove = async (id: string) => { reads.current++; const token = ++epoch.current; setSelected(null); privateController.close(); try { await deletePartOneSave(id); if (current(token)) await load(); } catch { if (current(token)) setError('This product could not be removed. Try again.'); } };
  const privateReadBlocked = Boolean(selected?.captureSessionId && privateState.ownerId === ownerId && privateState.error &&
    ['conflict','unavailable','disabled'].includes(privateState.stage) && !privateState.recovery);
  if (useAuthStore.getState().sessionUserId !== ownerId) return null;
  return <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
    <Text accessibilityRole="header">Saved product evidence</Text>
    {error && <><Text accessibilityRole="alert">{error}</Text><Button label="Retry saved products" variant="ghost" onPress={() => void load()} /></>}
    {records.map(record => <View key={record.saveId} style={{ gap: spacing.xs }}>
      <Button label={`Open ${name(record)}`} variant="outline" onPress={() => void open(record.saveId)} />
      <Text>{accepted(record) ? 'Saved evidence with source references' : 'Saved without verified ingredients'}</Text>
      <Button label={`Remove ${name(record)}`} variant="ghost" onPress={() => void remove(record.saveId)} />
    </View>)}
    {PART_ONE_PRIVATE_ENABLED && notes.filter(note => !records.some(record => record.captureSessionId === note.capture.captureSessionId)).map(note => <View key={note.capture.captureSessionId} style={{ gap: spacing.xs }}>
      <Button label="Open saved private label note" variant="outline" onPress={() => { setSelected(null); void privateController.recover(ownerId, note.capture.captureSessionId); }} />
      <Text>Saved private package context · {note.boundResult?.declarationState === 'accepted' ? 'server review recorded; reopen for current rights and freshness' : 'partial or uncertain'}</Text>
    </View>)}
    {PART_ONE_PRIVATE_ENABLED && !selected && privateState.ownerId === ownerId && privateState.result && <PartOneResultSheet inline={false}
      view={{ owner: ownerId, result: privateState.result, loading: false, error: null, saved: true, scrollOffset: 0 }}
      localDraft={<PartOnePrivateCapturePanel controller={privateController} ownerId={ownerId} />}
      onClose={() => privateController.close()} onRefresh={() => { if (privateState.capture) void privateController.recover(ownerId, privateState.capture.captureSessionId); }}
      onSelect={() => {}} onSave={() => {}} onSearch={() => privateController.close()} onFullChange={() => {}} />}
    {PART_ONE_PRIVATE_ENABLED && !selected && !privateState.result && privateState.stage !== 'temporary' && <PartOnePrivateCapturePanel controller={privateController} ownerId={ownerId} />}
    {selected && <PartOneResultSheet inline={false} view={{ owner: ownerId, result: privateState.stage === 'removing' || privateReadBlocked ? null : selected.result, loading: privateState.stage === 'removing', error: privateReadBlocked ? privateState.error : null, saved: true, scrollOffset: 0 }}
      localDraft={PART_ONE_PRIVATE_ENABLED && selected.captureSessionId ? <PartOnePrivateCapturePanel controller={privateController} ownerId={ownerId} /> : undefined}
      onClose={() => { epoch.current++; setSelected(null); privateController.close(); }} onRefresh={() => void open(selected.saveId)} onSelect={() => {}}
      onSave={() => {}} onSearch={() => { setSelected(null); privateController.close(); }} onFullChange={() => {}} />}
  </View>;
}

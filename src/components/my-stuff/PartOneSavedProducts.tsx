import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button } from '../ui/Button';
import { PartOneResultSheet } from '../check/part-one/PartOneResultSheet';
import { deletePartOneSave, listPartOneSaves, readPartOneSave, type PartOneSavedProduct } from '../../services/partOne';
import { useAuthStore } from '../../stores/authStore';
import { spacing } from '../../constants/theme';

/** Server reads preserve snapshot-at-save. No ingredient text is cached on disk. */
export function PartOneSavedProducts({ ownerId }: { ownerId: string }) {
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
  const load = async () => { const token = epoch.current; try { const next = await listPartOneSaves(); if (current(token)) { setRecords(next); setSelected(previous => previous ? next.find(record => record.saveId === previous.saveId) ?? null : null); setError(null); } } catch { if (current(token)) setError('Saved products are unavailable. Try again.'); } };
  useEffect(() => { epoch.current++; setRecords([]); setSelected(null); setError(null); void load(); return () => { epoch.current++; }; }, [ownerId]);
  useFocusEffect(React.useCallback(() => { void load(); const timer = setInterval(() => void load(), 10000); return () => { clearInterval(timer); epoch.current++; }; }, [ownerId]));
  const open = async (id: string) => { const token = epoch.current; const read = ++reads.current; try { const record = await readPartOneSave(id); if (current(token) && read === reads.current) setSelected(previous => previous?.saveId === id && previous.result.resultRevision > record.result.resultRevision ? previous : record); } catch { if (current(token) && read === reads.current) setError('This saved product changed or is unavailable.'); } };
  const remove = async (id: string) => { reads.current++; const token = ++epoch.current; setSelected(null); try { await deletePartOneSave(id); if (current(token)) await load(); } catch { if (current(token)) setError('This product could not be removed. Try again.'); } };
  return <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
    <Text accessibilityRole="header">Saved product evidence</Text>
    {error && <><Text accessibilityRole="alert">{error}</Text><Button label="Retry saved products" variant="ghost" onPress={() => void load()} /></>}
    {records.map(record => <View key={record.saveId} style={{ gap: spacing.xs }}>
      <Button label={`Open ${name(record)}`} variant="outline" onPress={() => void open(record.saveId)} />
      <Text>{accepted(record) ? 'Saved evidence with source references' : 'Saved without verified ingredients'}</Text>
      <Button label={`Remove ${name(record)}`} variant="ghost" onPress={() => void remove(record.saveId)} />
    </View>)}
    {selected && <PartOneResultSheet inline={false} view={{ owner: ownerId, result: selected.result, loading: false, error: null, saved: true, scrollOffset: 0 }}
      onClose={() => { epoch.current++; setSelected(null); }} onRefresh={() => void open(selected.saveId)} onSelect={() => {}}
      onSave={() => {}} onSearch={() => setSelected(null)} onFullChange={() => {}} />}
  </View>;
}

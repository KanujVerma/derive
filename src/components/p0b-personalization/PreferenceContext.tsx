import type {DictionaryRelease} from '../../domain/part-two/dictionary';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Button } from '../ui/Button';
import { PreferenceChoices } from './PreferenceChoices';
import { createPreferenceController, type PreferencePorts } from '../../presentation/p0b-personalization/preferenceController';
import { preferenceProductChoices } from '../../presentation/p0b-personalization/preferences';
import { spacing } from '../../constants/theme';
export function PreferenceContext({ ownerId, ports, onSaved, onClose, productLabels = {}, dictionaryRelease }: {
    ownerId: string;
    dictionaryRelease?:DictionaryRelease;
    productLabels?: Record<string, string>;
    ports: PreferencePorts;
    onSaved: () => void;
    onClose: () => void;
}) {
    const [controller] = useState(() => createPreferenceController(ports));
    const view = useSyncExternalStore(controller.subscribe, controller.getState);
    useEffect(() => { controller.setOwner(ownerId); void controller.load(); return () => controller.close(); }, [ownerId, controller]);
    if (ports.owner() !== ownerId || view.ownerId !== ownerId)
        return null;
    return <Screen scrollable><View style={{ gap: spacing.sm, padding: 24 }}><Text accessibilityRole="header">Your confirmed preferences</Text><Text>Save choices explicitly. Notes are not interpreted or proposed as preferences.</Text>
  {view.context && <PreferenceChoices dictionaryRelease={dictionaryRelease} preferences={view.preferences} products={preferenceProductChoices(view.context, productLabels)} createId={ports.createId} loading={view.loading || view.saving} onChange={controller.update} onRemove={id => void controller.remove(id)}/>}
  {view.error && <Text accessibilityRole="alert">{view.error}</Text>}
  {view.pendingRemoval && <Button label="Retry preference removal" variant="outline" disabled={view.saving} onPress={()=>void controller.remove(view.pendingRemoval!)}/>}
  {!view.context && <Button label="Retry loading preferences" variant="outline" disabled={view.loading} onPress={() => void controller.load()}/>}
  {view.context && <><Text>Saving updates preferences with your complete current context. Other profile answers, reports, assessments and private notes are preserved. If context has changed, saving stops for review.</Text><Button label="Save confirmed preferences" loading={view.saving} disabled={view.loading} onPress={() => void controller.save().then(saved => { if (saved && ports.owner() === ownerId)
        onSaved(); })}/></>}
  <Button label="Back" variant="ghost" disabled={view.saving} onPress={onClose}/>
 </View></Screen>;
}

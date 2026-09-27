import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/ui/Screen';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { ContextFlow } from '@/src/components/p0b-personalization/ContextFlow';
import { RoutineContext } from '@/src/components/p0b-personalization/RoutineContext';
import { ExperienceContext } from '@/src/components/p0b-personalization/ExperienceContext';
import { customerController, currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { deriveJitReproductiveQuestions, deriveProfileEditQuestions } from '@/src/presentation/personal-decision/customerController';
import type { CustomerWrite } from '@/src/presentation/personal-decision/customerController';
import { profileFromStorage, profileToStorage, routineFromStorage, routineToStorage, experienceFromStorage, experienceToStorage, catalogReferenceKey, contextProductLabel } from '@/src/presentation/p0b-personalization/storageAdapter';
import { createCatalogRequestId } from '@/src/services/productCatalog';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PersonalizationFlow } from '@/src/components/personalization/PersonalizationFlow';
import { colors } from '@/src/constants/theme';
import { personalizationGateway, resolvePersonalizationOwnerId } from '@/src/presentation/personalization/gateway';
import { ownerPinnedLegacyGateway } from '@/src/presentation/personal-decision/customerGateway';
import type { PersonalizationGateway } from '@/src/presentation/personalization/gateway';
import { Button } from '@/src/components/ui/Button';
import type { PersonalizationDraft } from '@/src/presentation/personalization/draft';
import { useAuthStore } from '@/src/stores/authStore';
import { publicEnvironment } from '@/src/config/environment';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveShellPresentation } from '@/src/utils/shellPresentation';

/** The same optional editor is opened from Check and My Stuff. Back retains the originating screen. */
function LegacyPersonalizeScreen() {
  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const shell = resolveShellPresentation({
    buildFlavor: publicEnvironment.buildFlavor,
    remoteEnabled: isRemoteServiceEnabled(),
    supabaseUrl: publicEnvironment.supabaseUrl,
  });
  const ownerId = resolvePersonalizationOwnerId(sessionUserId, shell);
  const live = shell === 'local_free_integration';
  return <PersonalizeEditor key={ownerId ?? 'signed-out'} ownerId={ownerId}
    gateway={live ? ownerPinnedLegacyGateway : personalizationGateway} live={live} />;
}

function PersonalizeEditor({ ownerId, gateway, live }: {
  ownerId: string | null; gateway: PersonalizationGateway; live: boolean;
}) {
  const router = useRouter();
  const [initialDraft, setInitialDraft] = useState<PersonalizationDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void gateway.loadProfile(ownerId).then((result) => {
      if (!active) return;
      if (result.kind === 'ready') setInitialDraft(result.profile);
      setLoaded(true);
    }).catch(() => { if (active) { setLoadError(true); setLoaded(true); } });
    return () => { active = false; };
  }, [ownerId, gateway]);

  if (!ownerId || !loaded) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  if (loadError) return <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 24, justifyContent: 'center' }}>
    <Text>We could not load your skin profile. Please try again.</Text>
    <Button label="Back" variant="outline" onPress={() => router.back()} />
  </View>;
  return <View style={{ flex: 1, backgroundColor: colors.canvas }}>
    {saveError && <Text accessibilityRole="alert" style={{ padding: 12, color: colors.actionStop.text }}>
      Your answers were not saved. Please try again.
    </Text>}
    {saving && <Text style={{ padding: 12, color: colors.inkMuted }}>Saving your answers...</Text>}
    <PersonalizationFlow initialDraft={initialDraft ?? undefined}
      onComplete={(answers) => {
        if (saving) return;
        setSaving(true); setSaveError(false);
        void gateway.saveProfile(ownerId, answers).then((result) => {
          if (result.kind === 'ready' || !live) router.back();
          else setSaveError(true);
        }).catch(() => { if (!live) router.back(); else setSaveError(true); })
          .finally(() => setSaving(false));
      }}
      onSkip={() => router.back()} />
  </View>;
}


/** P0-B uses the same route and back stack; legacy draft/profile behavior stays isolated. */
export default function PersonalizeScreen() {
  const params = useLocalSearchParams<{ p0b?: string; mode?: string; source?: string; snapshotId?: string }>();
  const session = useAuthStore(state => state.sessionUserId);
  const status = useAuthStore(state => state.status);
  const access = useFreeAccessStore(state => state.status);
  const owner = currentCustomerOwner();
  return params.p0b === '1' ? <ProgressiveEditor key={owner ?? 'unavailable'} ownerId={owner} mode={params.mode} decisionSnapshotId={params.source === 'check' ? params.snapshotId : undefined} /> : <LegacyPersonalizeScreen />;
}

function ProgressiveEditor({ ownerId, mode, decisionSnapshotId }: { ownerId: string | null; mode?: string; decisionSnapshotId?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const state = useSyncExternalStore(customerController.subscribe, customerController.getState);
  const [section, setSection] = useState<'profile' | 'routine' | 'history'>(mode === 'routine' || mode === 'history' ? mode : 'profile');
  const [questionDecision] = useState(() => { const current = customerController.getState(); return current.ownerId === ownerId && current.decision.kind === 'ready' && current.decision.expectedBinding.productSnapshotId === decisionSnapshotId ? current.decision : null; });
  const [editingExperience, setEditingExperience] = useState<string | 'new' | null>(null);
  useEffect(() => { customerController.setOwner(ownerId); if (ownerId) void customerController.load(); }, [ownerId]);
  const context = state.ownerId === ownerId ? state.context : null;
  const close = () => router.back();
  if (!ownerId) return <Screen><Text>Personal context is unavailable in this session.</Text><Button label="Back" onPress={close} /></Screen>;
  if (!context) return <Screen><Text>{state.error ?? 'Loading your personal context...'}</Text><Button label="Try again" onPress={() => void customerController.load()} /><Button label="Back" variant="ghost" onPress={close} /></Screen>;
  const save = (input: CustomerWrite) => { void customerController.save(input).then(saved => { if (saved && currentCustomerOwner() === ownerId) close(); }); };
  const loading = state.status === 'saving' || state.status === 'loading';
  const existing = editingExperience && editingExperience !== 'new' ? context.experiences.find(item => item.data.id === editingExperience) : null;
  const displayLabels = state.originReference ? { ...state.displayLabels, [catalogReferenceKey(state.originReference)]: state.originReference.label } : state.displayLabels;
  const historyRefs = context.experiences.flatMap(item => item.data.reference.kind === 'catalog' ? [item.data.reference] : []);
  const routineRefs = context.routine?.data.items.flatMap(item => item.reference.kind === 'catalog' ? [item.reference] : []) ?? [];
  const candidates = [...routineRefs, ...historyRefs, ...(state.originReference ? [state.originReference] : [])];
  const uniqueRefs = [...new Map(candidates.map(item => [catalogReferenceKey(item), item])).values()];
  const refs = uniqueRefs.map((item, index) => ({ ...item, label: contextProductLabel(item, displayLabels, index + 1) }));
  const presentationLabels = { ...displayLabels, ...Object.fromEntries(refs.map(item => [catalogReferenceKey(item), item.label])) };
  const selectedMissing = editingExperience && editingExperience !== 'new' && !existing;
  const questionBinding = questionDecision?.expectedBinding;
  const ready = questionDecision && questionBinding?.ownerId === ownerId && questionBinding.profileRevision === (context.profile?.id ?? null) && questionBinding.routineRevision === (context.routine?.id ?? null) && questionBinding.historyRevision === context.historyRevision ? questionDecision.packet : null;
  const jitReproductive = deriveJitReproductiveQuestions(ready, questionBinding ?? null, context);
  const jitContext = ready ? [ ...(ready.evidenceNeeds.some(need => need.code === 'current_treatments') ? ['treatments' as const] : []), ...(ready.evidenceNeeds.some(need => need.code === 'sensitivity_context') ? ['sensitivities' as const] : []) ] : [];
  const editQuestions = deriveProfileEditQuestions(context.profile?.data ?? null, jitReproductive, jitContext);
  const reproductive = editQuestions.reproductive, questions = editQuestions.context;
  return <View style={{ flex: 1, backgroundColor: colors.canvas }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 12, paddingTop: insets.top + 12 }}>
      <Button label="Skin and goals" size="medium" variant="ghost" disabled={loading} onPress={() => { setSection('profile'); setEditingExperience(null); }} />
      <Button label="Routine" size="medium" variant="ghost" disabled={loading} onPress={() => { setSection('routine'); setEditingExperience(null); }} />
      <Button label="Experiences" size="medium" variant="ghost" disabled={loading} onPress={() => { setSection('history'); setEditingExperience(null); }} />
    </View>
    {section === 'profile' && <ContextFlow key={'profile:' + context.revision} initialDraft={context.profile ? profileFromStorage(context.profile.data) : undefined} contextQuestions={questions} relevance={reproductive.length ? { fields: reproductive, evidenceReason: jitReproductive.length ? 'These answers can change the caution shown for this product. You can leave them unanswered.' : 'Review the answers you have already shared. You can change them or leave them unanswered.' } : undefined} loading={loading} error={state.error} onApply={draft => save({ operation: 'save_profile', profile: profileToStorage(draft) })} onSkip={close} />}
    {section === 'routine' && <RoutineContext key={'routine:' + context.revision} initialDraft={context.routine ? routineFromStorage(context.routine.data, presentationLabels) : undefined} createItemId={createCatalogRequestId} availableProducts={refs} loading={loading} error={state.error} onApply={draft => save({ operation: 'save_routine', routine: routineToStorage(draft) })} onSkip={close} />}
    {section === 'history' && selectedMissing && <Screen><Text>This report is not in the loaded history. Load the latest history before correcting it.</Text><Button label="Back to experiences" onPress={() => setEditingExperience(null)} /></Screen>}
    {section === 'history' && editingExperience && !selectedMissing && <ExperienceContext key={(existing?.id ?? 'new') + ':' + context.revision} createRecordId={createCatalogRequestId} existing={existing ? { draft: experienceFromStorage(existing.data, presentationLabels, context.experiences.indexOf(existing) + 1), revisionId: existing.id } : undefined} availableProducts={refs} loading={loading} error={state.error} onApply={edit => save({ operation: 'append_experience', experience: experienceToStorage(edit.draft), supersedesRevisionId: edit.supersedesRevisionId })} onSkip={() => setEditingExperience(null)} />}
    {section === 'history' && !editingExperience && <Screen scrollable><Text style={{ color: colors.ink, fontSize: 24, marginBottom: 16 }}>Product experiences</Text><Text>Reports describe what you noticed. They do not establish ingredient causation.</Text>
      {state.error && <Text accessibilityRole="alert">{state.error}</Text>}
      {context.historyTruncated && <><Text>Showing a limited history. Other reports may exist.</Text><Button label="Load more experiences" disabled={loading} variant="outline" onPress={() => void customerController.loadMoreHistory()} /></>}
      {context.experiences.map((item, index) => <GroupedSection key={item.id} header={contextProductLabel(item.data.reference, presentationLabels, index + 1)}><View style={{ padding: 16 }}><Text>{experienceLabels[item.data.kind]}</Text><Button label="Correct this experience" variant="outline" disabled={loading} onPress={() => setEditingExperience(item.data.id)} /></View></GroupedSection>)}
      <Button label="Add an experience" disabled={loading} onPress={() => setEditingExperience('new')} /><Button label="Back" variant="ghost" onPress={close} />
    </Screen>}
  </View>;
}
const experienceLabels = { reacted: 'Reported reaction', tolerated: 'Reported tolerance', no_reaction_reported: 'No reaction reported', liked: 'Liked it', finished: 'Finished it', ineffective: 'Did not help the reported goal' };

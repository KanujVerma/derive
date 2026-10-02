import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/ui/Screen';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { ContextFlow } from '@/src/components/p0b-personalization/ContextFlow';
import { RoutineContext } from '@/src/components/p0b-personalization/RoutineContext';
import { ExperienceContext } from '@/src/components/p0b-personalization/ExperienceContext';
import { ReactionProductResearch } from '@/src/components/p0b-personalization/ReactionProductResearch';
import { customerController, currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { deriveJitReproductiveQuestions, deriveProfileEditQuestions } from '@/src/presentation/personal-decision/customerController';
import type { CustomerWrite } from '@/src/presentation/personal-decision/customerController';
import { profileFromStorage, profileToStorage, routineFromStorage, routineToStorage, experienceFromStorage, experienceToStorage, catalogReferenceKey, contextProductLabel } from '@/src/presentation/p0b-personalization/storageAdapter';
import { createCatalogRequestId } from '@/src/services/productCatalog';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
import { isFreeIntegrationShell, resolveShellPresentation } from '@/src/utils/shellPresentation';
import { useScannerEntryStore } from '@/src/stores/scannerEntryStore';
import { ProductEntry } from '@/src/components/my-stuff/ProductEntry';
import { myStuffStore } from '@/src/presentation/my-stuff/myStuffRemote';
import { createEditorReturnGate, experienceDraftForProduct } from '@/src/presentation/personal-decision/editorEntry';
import { createExperienceDraft, selectExperienceCatalogProduct } from '@/src/presentation/p0b-personalization/experience';
import { createSetupBundle, type SetupBundle } from '@/src/presentation/p0b-personalization/setup';
import { createSetupPersistence, setupBundleFromContext } from '@/src/presentation/p0b-personalization/setupPersistence';
import type { PersonalContextSnapshot } from '@/src/contracts/PersonalContext';

function useEditorReturnGate() {
  const [gate] = useState(() => createEditorReturnGate(currentCustomerOwner()));
  useEffect(() => {
    const sync = () => { const owner = currentCustomerOwner(); gate.observeOwner(owner); customerController.setOwner(owner); };
    sync();
    const auth = useAuthStore.subscribe(sync), access = useFreeAccessStore.subscribe(sync);
    return () => { auth(); access(); gate.invalidate(); };
  }, [gate]);
  return gate;
}

/** The same optional editor is opened from Check and My Stuff. Back retains the originating screen. */
function LegacyPersonalizeScreen() {
  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const shell = resolveShellPresentation({
    buildFlavor: publicEnvironment.buildFlavor,
    remoteEnabled: isRemoteServiceEnabled(),
    supabaseUrl: publicEnvironment.supabaseUrl,
  });
  const ownerId = resolvePersonalizationOwnerId(sessionUserId, shell);
  const live = isFreeIntegrationShell(shell);
  return <PersonalizeEditor key={ownerId ?? 'signed-out'} ownerId={ownerId}
    gateway={live ? ownerPinnedLegacyGateway : personalizationGateway} live={live} />;
}

function PersonalizeEditor({ ownerId, gateway, live }: {
  ownerId: string | null; gateway: PersonalizationGateway; live: boolean;
}) {
  const router = useRouter();
  const gate = useEditorReturnGate();
  const [initialDraft, setInitialDraft] = useState<PersonalizationDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!live || !ownerId) return;
    let active = true;
    setLoaded(false); setLoadError(false);
    void gateway.loadProfile(ownerId).then(result => {
      if (!active) return;
      if (result.kind === 'ready') setInitialDraft(result.profile);
      setLoaded(true);
    }).catch(() => { if (active) { setLoadError(true); setLoaded(true); } });
    return () => { active = false; };
  }, [ownerId, gateway, live, loadAttempt]);
  if (!live || !ownerId) return <PersonalizationFlow available={false} onComplete={() => {}} onSkip={() => router.back()} />;
  if (!loaded) return <Screen><Text>Loading your skin profile...</Text><Button label="Back" variant="ghost" onPress={() => router.back()} /></Screen>;
  if (loadError) return <Screen><Text>Your skin profile could not be loaded.</Text>
    <Button label="Try again" onPress={() => setLoadAttempt(value => value + 1)} />
    <Button label="Back" variant="ghost" onPress={() => router.back()} />
  </Screen>;
  return <View style={{ flex: 1, backgroundColor: colors.canvas }}>
    <PersonalizationFlow initialDraft={initialDraft ?? undefined} available={live} loading={saving}
      error={saveError ? 'Your answers were not saved. Please try again.' : null}
      onComplete={answers => {
        if (savingRef.current || currentCustomerOwner() !== ownerId) return;
        const token = gate.begin(ownerId);
        savingRef.current = true; setSaving(true); setSaveError(false);
        void gateway.saveProfile(ownerId, answers).then(result => {
          if (result.kind === 'ready' && gate.takeReturn(token, currentCustomerOwner())) router.back();
          else if (gate.isCurrent(token, currentCustomerOwner())) setSaveError(true);
        }).catch(() => { if (gate.isCurrent(token, currentCustomerOwner())) setSaveError(true); })
          .finally(() => { savingRef.current = false; if (gate.isCurrent(token, currentCustomerOwner())) setSaving(false); });
      }} onSkip={() => router.back()} />
  </View>;
}

/** P0-B uses the same route and back stack; legacy draft/profile behavior stays isolated. */
export default function PersonalizeScreen() {
  const params = useLocalSearchParams<{ p0b?: string; mode?: string; source?: string; snapshotId?: string; entry?: string; experienceId?: string; productRecordId?: string }>();
  const session = useAuthStore(state => state.sessionUserId);
  const status = useAuthStore(state => state.status);
  const access = useFreeAccessStore(state => state.status);
  const owner = currentCustomerOwner();
  const router = useRouter();
  if (params.mode === 'product') return <ProductEntry key={owner ?? 'unavailable'} ownerId={owner} onClose={() => router.back()} onSaved={() => {
    if (owner && currentCustomerOwner() === owner) { myStuffStore.getState().setOwner(owner); void myStuffStore.getState().load(); router.back(); }
  }} />;
  return params.p0b === '1' || Boolean(owner) ? <ProgressiveEditor key={owner ?? 'unavailable'} ownerId={owner} mode={params.mode} entry={params.entry} experienceId={params.experienceId} productRecordId={params.productRecordId} decisionSnapshotId={params.source === 'check' ? params.snapshotId : undefined} /> : <LegacyPersonalizeScreen />;
}

function ProgressiveEditor({ ownerId, mode, decisionSnapshotId, entry, experienceId, productRecordId }: { ownerId: string | null; mode?: string; decisionSnapshotId?: string; entry?: string; experienceId?: string; productRecordId?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const state = useSyncExternalStore(customerController.subscribe, customerController.getState);
  const [section] = useState<'profile' | 'routine' | 'history'>(mode === 'routine' || mode === 'history' ? mode : 'profile');
  const [questionDecision] = useState(() => { const current = customerController.getState(); return current.ownerId === ownerId && current.decision.kind === 'ready' && current.decision.expectedBinding.productSnapshotId === decisionSnapshotId ? current.decision : null; });
  const directExperience = entry === 'new' || Boolean(experienceId);
  const [editingExperience, setEditingExperience] = useState<string | 'new' | null>(entry === 'new' ? 'new' : experienceId ?? null);
  const [newReportId] = useState(createCatalogRequestId);
  const gate = useEditorReturnGate();
  const setupBase = useRef<PersonalContextSnapshot | null>(null);
  const setupBundle = useRef<SetupBundle>(createSetupBundle(ownerId));
  const [setupPersistence] = useState(() => createSetupPersistence(customerController, createCatalogRequestId));
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const setupSavingRef = useRef(false);
  useEffect(() => { customerController.setOwner(ownerId); if (ownerId) void customerController.load(); }, [ownerId]);
  if (state.ownerId === ownerId && state.context && !setupBase.current) setupBase.current = state.context;
  // Sequential writes change revisions. Keep this editor mounted with its draft until all writes read back.
  const context = state.ownerId === ownerId ? state.context ?? (section === 'profile' ? setupBase.current : null) : null;
  const close = () => {
    if (entry === '1') {
      if (!ownerId || currentCustomerOwner() !== ownerId) return;
      useScannerEntryStore.getState().markProfileIntroHandled(ownerId);
      router.replace('/(tabs)/check');
    } else router.back();
  };
  if (!ownerId) return <Screen><Text>Personal context is unavailable in this session.</Text><Button label="Back" onPress={close} /></Screen>;
  if (!context) return <Screen><Text>{state.error ?? 'Loading your personal context...'}</Text><Button label="Try again" onPress={() => void customerController.load()} /><Button label="Back" variant="ghost" onPress={close} /></Screen>;
  const save = (input: CustomerWrite) => {
    const token = gate.begin(ownerId);
    void customerController.save(input).then(saved => { if (saved && gate.takeReturn(token, currentCustomerOwner())) close(); });
  };
  const saveSetup = (draft: Parameters<typeof profileToStorage>[0]) => {
    if (setupSavingRef.current || currentCustomerOwner() !== ownerId) return;
    const token = gate.begin(ownerId);
    setupSavingRef.current = true; setSetupSaving(true); setSetupError(null);
    void (async () => {
      if (!customerController.getState().context && !await customerController.load()) return 'failed';
      return setupPersistence.save(ownerId, draft, setupBundle.current, () => gate.isCurrent(token, currentCustomerOwner()));
    })().then(result => {
      if (result === 'saved' && gate.takeReturn(token, currentCustomerOwner())) close();
      else if (gate.isCurrent(token, currentCustomerOwner())) setSetupError('Not all answers were confirmed. Your draft is still here. Try saving again to finish.');
    }).catch(() => {
      if (gate.isCurrent(token, currentCustomerOwner())) setSetupError('Not all answers were confirmed. Try saving again to finish.');
    }).finally(() => {
      setupSavingRef.current = false;
      if (gate.isCurrent(token, currentCustomerOwner())) setSetupSaving(false);
    });
  };
  const loading = setupSaving || state.status === 'saving' || state.status === 'loading';
  const existing = editingExperience && editingExperience !== 'new' ? context.experiences.find(item => item.data.id === editingExperience) : null;
  const displayLabels = state.originReference ? { ...state.displayLabels, [catalogReferenceKey(state.originReference)]: state.originReference.label } : state.displayLabels;
  const historyRefs = context.experiences.flatMap(item => item.data.reference.kind === 'catalog' ? [item.data.reference] : []);
  const routineRefs = context.routine?.data.items.flatMap(item => item.reference.kind === 'catalog' ? [item.reference] : []) ?? [];
  const saved = myStuffStore.getState();
  const fromSaved = productRecordId ? experienceDraftForProduct(newReportId, ownerId, saved.ownerId, saved.model.products.find(product => product.id === productRecordId)) : null;
  const fromCheck = !productRecordId && questionDecision && state.originReference && questionDecision.expectedBinding.productId === state.originReference.productId
    ? { ...createExperienceDraft(newReportId), reference: selectExperienceCatalogProduct(state.originReference) } : null;
  const initialExperience = fromSaved ?? fromCheck;
  const candidates = [...routineRefs, ...historyRefs, ...(state.originReference ? [state.originReference] : []), ...(initialExperience?.reference.kind === 'catalog' ? [initialExperience.reference] : [])];
  const uniqueRefs = [...new Map(candidates.map(item => [catalogReferenceKey(item), item])).values()];
  const entryLabels = initialExperience?.reference.kind === 'catalog'
    ? { ...displayLabels, [catalogReferenceKey(initialExperience.reference)]: initialExperience.reference.label } : displayLabels;
  const refs = uniqueRefs.map((item, index) => ({ ...item, label: contextProductLabel(item, entryLabels, index + 1) }));
  const presentationLabels = { ...entryLabels, ...Object.fromEntries(refs.map(item => [catalogReferenceKey(item), item.label])) };
  const selectedMissing = editingExperience && editingExperience !== 'new' && !existing;
  const questionBinding = questionDecision?.expectedBinding;
  const ready = questionDecision && questionBinding?.ownerId === ownerId && questionBinding.profileRevision === (context.profile?.id ?? null) && questionBinding.routineRevision === (context.routine?.id ?? null) && questionBinding.historyRevision === context.historyRevision ? questionDecision.packet : null;
  const jitReproductive = deriveJitReproductiveQuestions(ready, questionBinding ?? null, context);
  const jitContext = ready ? [ ...(ready.evidenceNeeds.some(need => need.code === 'current_treatments') ? ['treatments' as const] : []), ...(ready.evidenceNeeds.some(need => need.code === 'sensitivity_context') ? ['sensitivities' as const] : []) ] : [];
  const editQuestions = deriveProfileEditQuestions(context.profile?.data ?? null, jitReproductive, jitContext);
  const reproductive = editQuestions.reproductive, questions = editQuestions.context;
  const combinedSetup = section === 'profile' && reproductive.length === 0 && questions.length === 0;
  const initialSetup = setupBase.current ? setupBundleFromContext(ownerId, setupBase.current, presentationLabels) : createSetupBundle(ownerId);
  return <View style={{ flex: 1, backgroundColor: colors.canvas }}>
    <View style={{ paddingHorizontal: 24, paddingTop: insets.top, alignItems: 'flex-start' }}>
      <Button label="Back" size="medium" variant="ghost" disabled={loading} onPress={close} />
    </View>
    {section === 'profile' && <ContextFlow key={combinedSetup ? 'setup:' + setupBase.current!.revision : 'profile:' + context.revision}
      initialDraft={(combinedSetup ? setupBase.current?.profile : context.profile) ? profileFromStorage((combinedSetup ? setupBase.current!.profile! : context.profile!).data) : undefined}
      setup={combinedSetup} persistentSetup={combinedSetup} initialSetup={initialSetup} ownerId={ownerId} createId={createCatalogRequestId}
      completionLabel={combinedSetup ? 'Save answers' : 'Save skin profile'} collectIntent={false}
      onSetup={bundle => { setupBundle.current = bundle; }} contextQuestions={questions}
      relevance={reproductive.length ? { fields: reproductive, evidenceReason: jitReproductive.length ? 'These answers can change the caution shown for this product. You can leave them unanswered.' : 'Review the answers you have already shared. You can change them or leave them unanswered.' } : undefined}
      loading={loading} error={setupError ?? state.error}
      onApply={draft => combinedSetup ? saveSetup(draft) : save({ operation: 'save_profile', profile: profileToStorage(draft) })} onSkip={close} />}
    {section === 'routine' && <RoutineContext key={'routine:' + context.revision} initialDraft={context.routine ? routineFromStorage(context.routine.data, presentationLabels) : undefined} createItemId={createCatalogRequestId} availableProducts={refs} loading={loading} error={state.error} onApply={draft => save({ operation: 'save_routine', routine: routineToStorage(draft) })} onSkip={close} />}
    {section === 'history' && selectedMissing && <Screen><Text>This report is not in the loaded history. Load the latest history before correcting it.</Text><Button label="Back" onPress={directExperience ? close : () => setEditingExperience(null)} /></Screen>}
    {section === 'history' && editingExperience === 'new' && productRecordId && !initialExperience && <Screen><Text>This saved product could not be loaded for this account.</Text><Button label="Back to My Stuff" onPress={close} /></Screen>}
    {section === 'history' && editingExperience && !selectedMissing && !(editingExperience === 'new' && productRecordId && !initialExperience) && <ExperienceContext key={(existing?.id ?? 'new') + ':' + context.revision} ownerId={ownerId} createRecordId={createCatalogRequestId} initialDraft={editingExperience === 'new' ? initialExperience ?? undefined : undefined} existing={existing ? { draft: experienceFromStorage(existing.data, presentationLabels, context.experiences.indexOf(existing) + 1), revisionId: existing.id } : undefined} availableProducts={refs} loading={loading} error={state.error} onApply={edit => save({ operation: 'append_experience', experience: experienceToStorage(edit.draft), supersedesRevisionId: edit.supersedesRevisionId })} onSkip={directExperience ? close : () => setEditingExperience(null)} />}
    {section === 'history' && !editingExperience && <Screen scrollable><Text style={{ color: colors.ink, fontSize: 24, marginBottom: 16 }}>Product experiences</Text><Text>Reports describe what you noticed. They do not establish ingredient causation.</Text>
      {state.error && <Text accessibilityRole="alert">{state.error}</Text>}
      {context.historyTruncated && <><Text>Showing a limited history. Other reports may exist.</Text><Button label="Load more experiences" disabled={loading} variant="outline" onPress={() => void customerController.loadMoreHistory()} /></>}
      {context.experiences.map((item, index) => <GroupedSection key={item.id} header={contextProductLabel(item.data.reference, presentationLabels, index + 1)}><View style={{ padding: 16 }}><Text>{experienceLabels[item.data.kind]}</Text>
        {item.data.kind === 'reacted' && item.data.reference.kind === 'manual' && <ReactionProductResearch ownerId={ownerId} name={item.data.reference.name} />}
        <Button label="Correct this experience" variant="outline" disabled={loading} onPress={() => setEditingExperience(item.data.id)} /></View></GroupedSection>)}
      <Button label="Add an experience" disabled={loading} onPress={() => setEditingExperience('new')} /><Button label="Back" variant="ghost" onPress={close} />
    </Screen>}
  </View>;
}
const experienceLabels = { reacted: 'Reported reaction', tolerated: 'Reported tolerance', no_reaction_reported: 'No reaction reported', liked: 'Liked it', finished: 'Finished it', ineffective: 'Did not help the reported goal' };

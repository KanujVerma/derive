import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');

/** Actual Surface/guard/geometry, inert native hosts. Component keys own hook
 * state and effect cleanup; the BottomSheet host retains -1 after native close
 * until a real remount. This proves source lifecycle, never UIKit gestures. */
function surfaceLifecycle() {
  type Instance = { slots: any[]; cursor: number };
  const instances = new Map<string, Instance>(), cache = new Map<string, any>();
  const types = new Map<any, number>();
  let current: Instance | null = null, used = new Set<string>();
  let effects: Array<() => void> = [];
  const nativeSheets = new Map<string, any>();
  let hosts: Array<{ type: string; props: any }> = [], mountedSheets: any[] = [], nativeOuterHeight=844;
  const slot = () => { assert(current, 'hooks need a mounted component'); return { instance: current, index: current.cursor++ }; };
  const memo = (factory: () => any, deps: readonly unknown[]) => {
    const { instance, index } = slot(), previous = instance.slots[index];
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) instance.slots[index] = { value: factory(), deps };
    return instance.slots[index].value;
  };
  const effect = (callback: () => any, deps?: readonly unknown[]) => {
    const { instance, index } = slot(), previous = instance.slots[index];
    if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) effects.push(() => {
      previous?.cleanup?.(); instance.slots[index] = { deps, cleanup: callback() };
    });
  };
  const hooks = { ...React, createContext(initial: any) { const context: any={value:initial}; context.Provider={context}; return context; }, useContext(context: any) { return context.value; }, useRef(initial: any) {
    const { instance, index } = slot();
    return instance.slots[index] ??= { current: initial };
  }, useState(initial: any) {
    const { instance, index } = slot();
    if (!(index in instance.slots)) instance.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [instance.slots[index], (next: any) => { instance.slots[index] = typeof next === 'function' ? next(instance.slots[index]) : next; }];
  }, useMemo: memo, useCallback: (callback: any, deps: readonly unknown[]) => memo(() => callback, deps),
  useEffect: effect, useLayoutEffect: effect };
  function load(path: string): any {
    const file = [path, `${path}.tsx`, `${path}.ts`].find(existsSync)!;
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} as any };
    const dependency = (name: string): any => {
      if (name === 'react') return hooks;
      if (name === 'react-native') return { Modal: 'Modal', View: 'View', Pressable: 'Pressable',
        Keyboard: { dismiss() {} }, Platform: { OS: 'ios' }, AccessibilityInfo: {}, findNodeHandle: () => null,
        StyleSheet: { create: (value: unknown) => value, absoluteFill: {} }, useWindowDimensions: () => ({ height: 844 }) };
      if (name === 'react-native-safe-area-context') return { SafeAreaProvider: 'SafeAreaProvider', useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) };
      if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: 'GestureHandlerRootView' };
      if (name === 'react-native-reanimated') return { ReduceMotion: { System: 'system' } };
      if (name === '@gorhom/bottom-sheet') return { __esModule: true, default: 'BottomSheet', BottomSheetScrollView: 'BottomSheetScrollView', BottomSheetBackdrop: 'BottomSheetBackdrop' };
      if (name.endsWith('/Icon')) return { Icon: 'Icon' };
      return name.startsWith('.') ? load(resolve(dirname(file), name)) : require(name);
    };
    const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    new Function('require', 'module', 'exports', 'requestAnimationFrame', 'cancelAnimationFrame', output)(dependency, module, module.exports, () => 1, () => {});
    cache.set(file, module.exports); return module.exports;
  }
  const { ResultSheetSurface } = load(resolve(root, 'src/components/check/result-sheet/ResultSheetSurface'));
  function visit(value: any, path: string): void {
    if (Array.isArray(value)) { value.forEach((item, i) => visit(item, `${path}/${i}`)); return; }
    if (!value || typeof value !== 'object' || !('props' in value)) return;
    if (value.type?.context) { const context=value.type.context,previous=context.value; context.value=value.props.value;visit(value.props.children,`${path}/provider`);context.value=previous;return; }
    if (value.type === React.Fragment) { visit(value.props.children, `${path}/fragment`); return; }
    if (typeof value.type === 'function') {
      if (!types.has(value.type)) types.set(value.type, types.size + 1);
      const key = `${path}/component-${types.get(value.type)}:${value.key ?? ''}`;
      used.add(key);
      let instance = instances.get(key);
      if (!instance) { instance = { slots: [], cursor: 0 }; instances.set(key, instance); }
      instance.cursor = 0; const parent = current; current = instance;
      let child;
      try { child = value.type(value.props); } finally { current = parent; }
      visit(child, key); return;
    }
    hosts.push({ type: value.type, props: value.type==='GestureHandlerRootView' ? {...value.props,onLayout(event: any){nativeOuterHeight=event.nativeEvent.layout.height;value.props.onLayout(event);}} : value.props });
    if (value.type === 'BottomSheet') {
      const key = `${path}/native-sheet`, props = value.props;
      used.add(key);
      let native = nativeSheets.get(key);
      if (!native) {
        native = { index: props.index, props, pending: [] as Array<() => void>, forced: false,
          close() { this.gestureClose(); },
          forceClose() { if(this.forced)return; this.forced = true; this.gestureClose(); },
          snapToIndex(index: number) { if(this.forced)return; if (this.index === -1 && index >= 0) this.pending = []; this.index = index; this.props.onChange(index); },
          gestureClose() {
            const closeProps = this.props;
            // Pinned Gorhom nonmodal/non-detached hosting container subtracts
            // both insets before calculating its closed detent position.
            closeProps.onAnimate?.(this.index, -1, 100, nativeOuterHeight-closeProps.topInset-closeProps.bottomInset);
            this.index = -1; closeProps.onChange(-1);
            this.pending.push(() => closeProps.onClose());
          },
          finishClose() { this.pending.shift()?.(); this.forced = false; },
        };
        nativeSheets.set(key, native);
      }
      native.props = props; props.ref.current = native; mountedSheets.push(native);
      visit(React.createElement(props.handleComponent, {}), `${path}/handle`);
    }
    visit(value.props.children, `${path}/children`);
  }
  return { hooks, render(props: any) {
    used = new Set(); hosts = []; mountedSheets = []; effects = [];
    visit(React.createElement(ResultSheetSurface, props), 'surface');
    for (const [key, instance] of instances) if (!used.has(key)) {
      for (const item of instance.slots) item?.cleanup?.(); instances.delete(key);
    }
    for (const key of nativeSheets.keys()) if (!used.has(key)) nativeSheets.delete(key);
    const pending = effects; effects = []; pending.forEach(callback => callback());
    return { hosts, sheet: mountedSheets[0] };
  }, dispose() {
    for (const instance of instances.values()) for (const item of instance.slots) item?.cleanup?.();
    instances.clear(); nativeSheets.clear();
  } };
}

test('actual native X cancels replacement search, restores an open result and rearms whole-result close without remounting capture', t => {
  const r = surfaceLifecycle(); t.after(() => r.dispose());
  let search = false, visible = true, cancelled = 0, dismissed = 0, mounts = 0, unmounts = 0;
  const retainedDraft = { photo: 'synthetic local draft' }; let draft: object | null = retainedDraft;
  function CaptureOverlay() {
    r.hooks.useEffect(() => { mounts++; return () => { unmounts++; }; }, []);
    return React.createElement('CaptureOverlay', { draft });
  }
  const render = () => r.render({ visible, presentationKey: 'scan-a',
    summary: React.createElement('Summary'), children: React.createElement('Findings'),
    overlay: React.createElement(CaptureOverlay),
    replacement: search ? React.createElement('Search') : undefined, contentSized: search,
    onClose: search ? () => { cancelled++; search = false; } : () => { dismissed++; draft = null; visible = false; },
  });
  const initial = render(); assert.equal(initial.sheet.index, 0); assert.equal(mounts, 1);
  search = true; const replacement = render();
  assert.notEqual(replacement.sheet, initial.sheet, 'search owns a fresh native sheet lifetime');
  const close = replacement.hosts.find(host => host.type === 'Pressable' && host.props.accessibilityLabel === 'Close result')!;
  close.props.onPress(); assert.equal(replacement.sheet.index, -1); replacement.sheet.finishClose();
  assert.equal(cancelled, 1); assert.equal(dismissed, 0); assert.equal(draft, retainedDraft);
  const restored = render(); assert.equal(restored.sheet.index, 0, 'result is open after cancelling a closed search');
  assert.notEqual(restored.sheet, initial.sheet, 'restored result has a fresh once-only dismissal guard');
  assert.equal(mounts, 1); assert.equal(unmounts, 0, 'outer modal capture lifetime stays mounted');
  replacement.sheet.props.onClose(); initial.sheet.props.onClose();
  assert.equal(cancelled, 1); assert.equal(dismissed, 0, 'late callbacks from previous modes are fenced');
  restored.hosts.find(host => host.type === 'Modal')!.props.onRequestClose();
  assert.equal(restored.sheet.index, -1); restored.sheet.finishClose(); restored.sheet.props.onClose();
  assert.equal(dismissed, 1); assert.equal(draft, null); render(); assert.equal(unmounts, 1);
});

test('actual swipe/backdrop cancellation repeats safely and old close completions cannot dismiss restored or newer cases', t => {
  const r = surfaceLifecycle(); t.after(() => r.dispose());
  let search = false, key = 'scan-a', cancelled = 0, dismissed = 0;
  const render = () => r.render({ presentationKey: key, summary: React.createElement('Summary'), children: React.createElement('Findings'),
    replacement: search ? React.createElement('Search') : undefined,
    onClose: search ? () => { search = false; cancelled++; } : () => { dismissed++; },
  });
  const initial = render(); search = true; const first = render();
  first.sheet.gestureClose(); first.sheet.finishClose(); let restored = render();
  assert.equal(cancelled, 1); assert.equal(restored.sheet.index, 0);
  search = true; const second = render(); second.sheet.gestureClose(); second.sheet.finishClose(); restored = render();
  assert.equal(cancelled, 2); assert.equal(restored.sheet.index, 0);
  initial.sheet.props.onClose(); first.sheet.props.onClose(); second.sheet.props.onClose();
  assert.equal(dismissed, 0, 'mode cycles cannot reactivate an unmounted guard with the same key');
  restored.sheet.gestureClose(); key = 'scan-b'; const newer = render(); restored.sheet.finishClose();
  assert.equal(dismissed, 0); assert.equal(newer.sheet.index, 0);
  newer.sheet.gestureClose(); newer.sheet.finishClose(); assert.equal(dismissed, 1);
});

test('same-lifetime callback updates use the current action while one-shot and key fences remain intact', t => {
  const r = surfaceLifecycle(); t.after(() => r.dispose());
  let old = 0, current = 0;
  const props = { presentationKey: 'scan-a', summary: React.createElement('Summary'), children: React.createElement('Findings') };
  const first = r.render({ ...props, onClose: () => { old++; } });
  const updated = r.render({ ...props, onClose: () => { current++; } });
  assert.equal(first.sheet, updated.sheet, 'same presentation/mode remains mounted');
  updated.sheet.gestureClose(); updated.sheet.finishClose(); updated.sheet.props.onClose();
  assert.equal(old, 0); assert.equal(current, 1);
});

test('native handle keeps its component type through detent and interaction callback updates', t => {
  const r=surfaceLifecycle();t.after(()=>r.dispose());let latest=0;
  const props={presentationKey:'stable-touch',summary:React.createElement('Summary'),children:React.createElement('Findings'),onClose(){},onInteraction(){}};
  const initial=r.render(props),handleType=initial.sheet.props.handleComponent;
  initial.sheet.props.onChange(1);
  const updated=r.render({...props,onInteraction(){latest++;}});
  assert.equal(updated.sheet.props.handleComponent,handleType,'changing the handle component type replaces its native press target during an in-flight touch');
  const handle=updated.hosts.find(host=>host.type==='Pressable' && host.props.accessibilityLabel==='Product result')!;
  assert.equal(handle.props.accessibilityValue.text,'Expanded','stable handle still receives the current detent');
  handle.props.onPress();assert.equal(latest,1,'stable handle uses the current interaction callback');
});


test('late oversized summary updates cannot reopen an explicit or gesture close in flight', t => {
  for (const method of ['button', 'gesture'] as const) {
    const r = surfaceLifecycle();let closed = 0;t.after(() => r.dispose());
    const render = (key='oversized') => r.render({ presentationKey: key, onClose: () => { closed++; },
      summary: React.createElement('Summary', { revision: closed }), compactActions: React.createElement('Actions'), children: React.createElement('Findings') });
    const measure = (value: ReturnType<typeof render>) => value.hosts.find(host => host.type === 'View' && typeof host.props.onLayout === 'function')!.props.onLayout({ nativeEvent: { layout: { height: 1000 } } });
    measure(render());const expanded = render();assert.equal(expanded.sheet.index,2,'oversized content genuinely requires the full detent');
    if(method==='button')expanded.hosts.find(host => host.type==='Pressable' && host.props.accessibilityLabel==='Close result')!.props.onPress();else expanded.sheet.gestureClose();
    assert.equal(expanded.sheet.index,-1);render();
    assert.equal(expanded.sheet.index,-1,'late summary/personal-result updates must not cancel the native close animation');
    expanded.sheet.finishClose();assert.equal(closed,1,'close acknowledgment survives the late update');
    const newer=render('new-case');measure(newer);const resized=render('new-case');assert.equal(resized.sheet.index,2,'a new body may size normally after the prior close');
  }
});

test('explicit dismissal fences native detent reevaluation and retries an interrupted native close', t => {
  const r=surfaceLifecycle();t.after(()=>r.dispose());let closed=0;
  const result=r.render({presentationKey:'native-interruption',onClose:()=>{closed++;},summary:React.createElement('Summary'),children:React.createElement('Findings')});
  result.sheet.gestureClose();result.sheet.snapToIndex(2);
  assert.equal(result.sheet.index,2,'native detent reevaluation can interrupt an ordinary library close');
  result.hosts.find(host=>host.type==='Pressable' && host.props.accessibilityLabel==='Close result')!.props.onPress();
  result.sheet.snapToIndex(2);assert.equal(result.sheet.index,-1,'explicit close must fence library-internal detent reevaluation too');
  result.sheet.finishClose();assert.equal(closed,1);
});

test('off-detent layout and keyboard animations do not latch a live result as closing', t => {
  const r=surfaceLifecycle();t.after(()=>r.dispose());let closed=0;
  const result=r.render({presentationKey:'restored-result',onClose:()=>{closed++;},summary:React.createElement('Summary'),children:React.createElement('Findings')});
  result.hosts.find(host=>host.type==='GestureHandlerRootView')!.props.onLayout({nativeEvent:{layout:{height:800}}});
  result.sheet.props.onAnimate(0,-1,500,450);
  result.hosts.find(host=>host.type==='Pressable' && host.props.accessibilityLabel==='Product result')!.props.onPress();
  assert.equal(result.sheet.index,1,'a restored result must still expand after a nonclosing off-detent animation');assert.equal(closed,0);
  result.sheet.props.onAnimate(1,-1,450,800);
  result.hosts.find(host=>host.type==='Pressable' && host.props.accessibilityLabel==='Product result')!.props.onPress();
  assert.equal(result.sheet.index,1,'a genuine close animation must fence accidental handle expansion');
});


test('oversized verdicts retain distinct reachable detents after replacement search', async () => {
  const {resultSheetGeometry}=await import('../src/presentation/check/result-sheet/geometry.ts');
  for(const height of [568,844,874])for(const summaryHeight of [700,1000,1600]){
    const geometry=resultSheetGeometry({height,topInset:44,bottomPadding:34,summaryHeight});
    assert.equal(geometry.needsFullHeight,true);
    assert.ok(geometry.snapPoints[1]-geometry.snapPoints[0]>=20,'compact and expanded positions must not collapse to a one-pixel move');
    assert.ok(geometry.snapPoints[2]-geometry.snapPoints[1]>=20,'full-height expansion must remain a distinct native position');
    assert.ok(geometry.snapPoints[2]<=height-44,'the full result remains within the safe viewport');
  }
});


test('interrupted gesture close rearms visible result interaction while explicit close remains fenced', t => {
 const r=surfaceLifecycle();t.after(()=>r.dispose());let closed=0;
 const props={presentationKey:'interrupted-gesture',onClose:()=>{closed++;},summary:React.createElement('Summary'),children:React.createElement('Findings')};
 let result=r.render(props);
 result.sheet.props.onAnimate(0,-1,500,844);
 result.sheet.snapToIndex(2);result=r.render(props);
 result.hosts.find(host=>host.type==='Pressable' && host.props.accessibilityLabel==='Product result')!.props.onPress();
 assert.equal(result.sheet.index,0,'a native close interrupted by a visible detent must allow the next deliberate handle action');
 result.hosts.find(host=>host.type==='Pressable' && host.props.accessibilityLabel==='Close result')!.props.onPress();
 result.sheet.props.onChange(2);result=r.render(props);
 result.hosts.find(host=>host.type==='Pressable' && host.props.accessibilityLabel==='Product result')!.props.onPress();
 assert.equal(result.sheet.index,-1,'queued native updates must not rearm an explicit forced close');
 result.sheet.finishClose();assert.equal(closed,1);
});

test('actual inset-adjusted swipe and backdrop close fence late oversized layout before acknowledgment', t => {
  for(const bottomInset of [0,40])for(const method of ['swipe','backdrop']){
    const r=surfaceLifecycle();t.after(()=>r.dispose());let closed=0;
    const render=()=>r.render({presentationKey:`inset-${bottomInset}-${method}`,bottomInset,onClose(){closed++;},summary:React.createElement('Summary'),children:React.createElement('Findings')});
    const initial=render();initial.hosts.find(host=>host.type==='GestureHandlerRootView')!.props.onLayout({nativeEvent:{layout:{height:844}}});
    assert.equal(initial.sheet.props.topInset,52);assert.equal(844-initial.sheet.props.topInset-bottomInset,bottomInset===0?792:752);
    if(method==='swipe')initial.sheet.gestureClose();else initial.sheet.close();
    initial.hosts.find(host=>host.type==='View'&&host.props.onLayout)!.props.onLayout({nativeEvent:{layout:{height:1000}}});
    const late=render();assert.equal(late.sheet.index,-1,'a native close at the inner inset-adjusted boundary must stay closed while late content requests full height');
    late.sheet.finishClose();assert.equal(closed,1,'the current lifetime delivers exactly one native acknowledgment');
  }
});

test('keyboard and off-detent minus-one positions on either side of the close boundary remain interactive', t => {
  for(const position of [560,790,794,880]){
    const r=surfaceLifecycle();t.after(()=>r.dispose());let closed=0;
    const props={presentationKey:`keyboard-${position}`,onClose(){closed++;},summary:React.createElement('Summary'),children:React.createElement('Findings')};
    const initial=r.render(props);initial.sheet.props.onAnimate(0,-1,100,position);
    initial.hosts.find(host=>host.type==='Pressable'&&host.props.accessibilityLabel==='Product result')!.props.onPress();
    assert.equal(initial.sheet.index,1,'minus-one alone or a non-boundary position must not latch live interaction as closing');assert.equal(closed,0);
  }
});

/** Node-only component harness. Native hosts are inert; production choice/save handlers run unchanged. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as React from 'react';
const nativeRequire = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Element = { type: string | ((props: any) => unknown); props: Record<string, any> };
export function componentHarness(file: string, name: string, initialProps: Record<string, any>, options: { modules?: Record<string, any>; developmentRuntime?: boolean } = {}) {
  const slots: any[] = [];
  let cursor = 0;
  const cache = new Map<string, any>();
  const react = { ...React, useState(initial: any) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], (update: any) => { slots[index] = typeof update === 'function' ? update(slots[index]) : update; }];
  }, useRef(initial: any) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index];
  }, useEffect() {}, useCallback(callback: any) { return callback; },
  useSyncExternalStore(_subscribe: any, getSnapshot: any) { return getSnapshot(); } };
  function load(path: string): any {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} as any }; cache.set(path, module.exports);
    const source = readFileSync(path, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    function requireModule(id: string): any {
      if (options.modules && id in options.modules) return options.modules[id];
      if (id === 'react') return react;
      if (id === 'react-native') return { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', Keyboard: { dismiss() {} }, Linking: { openURL: async () => {} }, StyleSheet: { create: (styles: any) => styles } };
      if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (id.startsWith('@/src/components/ui/')) { const component = id.slice(id.lastIndexOf('/') + 1); return { [component]: component }; }
      if (id.endsWith('/CatalogProductSearch')) return { CatalogProductSearch: ({ label, onSelect, onQueryChange }: { label?: string; onSelect: (product: { productId: string; brand: string; name: string }) => void; onQueryChange?: (query: string) => void }) => React.createElement('button', { label, onPress: () => onSelect({ productId: 'catalog-product', brand: 'CeraVe', name: 'Moisturizer' }), onQueryChange }) };
      if (id.startsWith('@/') || id.startsWith('.')) {
        const target = id.startsWith('@/') ? resolve(root, id.slice(2)) : resolve(dirname(path), id);
        const full = /\.(tsx?|js)$/.test(target) ? target : target + (target.includes('/components/') ? '.tsx' : '.ts');
        return load(full);
      }
      return nativeRequire(id);
    }
    new Function('require', 'module', 'exports', '__DEV__', 'React', output)(requireModule, module, module.exports, options.developmentRuntime ?? true, react);
    cache.set(path, module.exports); return module.exports;
  }
  const Component = load(resolve(root, file))[name];
  let props = initialProps;
  function render(nextProps?: Record<string, any>): Element[] {
    if (nextProps) props = { ...props, ...nextProps };
    cursor = 0;
    const nodes: Element[] = [];
    function visit(value: any): void {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== 'object' || !('props' in value)) return;
      if (typeof value.type === 'function') { visit(value.type(value.props)); return; }
      nodes.push(value); visit(value.props.children);
    }
    visit(Component(props)); return nodes;
  }
  return { render };
}
export function control(nodes: Element[], label: string): Element {
  const found = nodes.find(node => node.props.label === label || node.props.accessibilityLabel === label || (typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith(`${label}, `)));
  if (!found) throw new Error(`Missing control: ${label}`);
  return found;
}
export function textContent(nodes: Element[]): string {
  return nodes.filter(node => node.type === 'Text').flatMap(node => React.Children.toArray(node.props.children).filter(value => typeof value === 'string' || typeof value === 'number')).join(' ');
}
export function press(node: Element): void { (node.props.onSelect ?? node.props.onPress)(); }

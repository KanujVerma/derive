import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/check/PersonalIngredientNotes.tsx', import.meta.url), 'utf8');

test('ingredient guidance stays inline without an external browser action', () => {
  assert.doesNotMatch(source, /Linking|openURL|GUIDANCE_URL|Read dermatologist/);
  assert.match(source, /What this means for your skin/);
  assert.match(source, /<IngredientFindings notes=\{notes\} \/>/);
  assert.match(source, /notes\.sentences\.slice\(0, -1\)/);
  assert.match(source, /notes\.sentences\[notes\.sentences\.length - 1\]/);
  assert.match(source, /Cosmetic guidance, not a diagnosis or a safety verdict/);
});

test('missing ingredients offer a collapsed accessible editor scoped to the active owner and product', () => {
  assert.match(source, /useState<string \| null>\(null\)/);
  assert.match(source, /const editorOpen = editorScope === scope/);
  assert.match(source, /useEffect\(\(\) => \{ setEditorScope\(null\); \}, \[scope\]\)/);
  assert.match(source, /!lists\.length &&/);
  assert.match(source, /accessibilityState=\{\{ expanded: editorOpen \}\}/);
  assert.match(source, /if \(isCurrent\(\)\) setEditorScope\(editorOpen \? null : scope\)/);
  assert.match(source, /editorOpen && <View style=\{styles\.editor\}>/);
  assert.match(source, /does not save the text or send it to AI/);
  assert.match(source, /Any optional AI explanation is a separate action/);
});

test('an unanswered saved profile offers the same context editor as a missing profile', () => {
  assert.match(source, /results\.some\(result => result\.notes\.status === 'profile_missing'\)/);
  assert.match(source, /manual\?\.status === 'profile_missing'/);
  assert.match(source, /missingProfile &&/);
  assert.match(source, /label="Add skin context"/);
  assert.match(source, /if \(isCurrent\(\)\) router\.push/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const context = readFileSync(new URL('../src/components/p0b-personalization/ContextFlow.tsx', import.meta.url), 'utf8');
const routine = readFileSync(new URL('../src/components/p0b-personalization/RoutineContext.tsx', import.meta.url), 'utf8');
assert.ok(context.includes('const fields = relevantQuestions(relevance)'));
assert.ok(context.includes('fields.map(field => <AnswerChoices'));
assert.ok(context.includes('contextQuestions = []'));
// Step Skip and edit cancellation are exercised in ux-profile-step-skip.test.ts.
assert.ok(context.includes('accessibilityRole="alert"'));
assert.ok(context.includes('onApply(createContextDraft(draft))'));
assert.ok(routine.includes('Manual name. Formula and ingredients are unverified.'));
const useFields = readFileSync(new URL('../src/components/p0b-personalization/ReportedUseFields.tsx', import.meta.url), 'utf8');
assert.ok(useFields.includes('A few times a week'));
assert.ok(routine.includes('<ReportedUseFields'));
assert.ok(routine.includes('A partial routine cannot establish'));
assert.ok(routine.includes('onApply(createRoutineDraft(draft))'));
for (const source of [context, routine]) {
  assert.ok(source.includes('loading'));
  assert.ok(!source.includes('AsyncStorage'));
  assert.ok(!/saved successfully|profile saved/i.test(source));
}
console.log('P0-B optional module boundaries passed');
const experience = readFileSync(new URL('../src/components/p0b-personalization/ExperienceContext.tsx', import.meta.url), 'utf8');
assert.ok(experience.includes('prepareExperienceEdit(existing.draft, existing.revisionId)'));
assert.ok(experience.includes('No reaction to report does not mean you confirmed tolerance.'));
assert.ok(experience.includes('Skip experience'));
assert.ok(experience.includes('supersedesRevisionId: edit.supersedesRevisionId'));
assert.ok(context.includes("['Not sure', 'unsure']"));

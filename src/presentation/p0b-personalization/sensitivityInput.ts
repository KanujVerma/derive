import type { Answer } from './draft.ts';
/** Keep the editing buffer intact while deriving only explicitly entered names. */
export function editSensitivityInput(text: string): { text: string; answer: Answer<string[]> } {
  const values = text.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  return { text, answer: values.length ? { state: 'answered', value: values } : { state: 'unanswered' } };
}

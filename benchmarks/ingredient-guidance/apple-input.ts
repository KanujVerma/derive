import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CASES, CORPUS_VERSION, corpusSha256, projectCase } from './corpus.ts';

const source = readFileSync(new URL('../../supabase/functions/_shared/ingredient-explanation-model.ts', import.meta.url), 'utf8');
// Share the actual provider instructions without moving or editing server source.
// Fail closed if its representation changes; never silently use a stale prompt.
const matches = [...source.matchAll(/systemInstruction: \{ parts: \[\{ text: '([^']+)' \}\] \}/g)];
if (matches.length !== 1 || !matches[0][1].startsWith('Write 1 to 4 short plain-language cosmetic ingredient considerations')) {
  throw Error('Cannot extract the exact current ingredient explanation instructions. Update the benchmark generator explicitly.');
}
const instructions = matches[0][1];
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
if (CASES.length !== 12 || CASES.some(c => c.input.productName !== 'Synthetic cosmetic test product')) {
  throw Error('Expected the bounded 12-case synthetic corpus, never actual profiles or products.');
}
console.log(JSON.stringify({
  instructions,
  instructionSha256: hash(instructions),
  corpusVersion: CORPUS_VERSION,
  corpusSha256: corpusSha256(),
  cases: CASES.map(c => {
    const input = projectCase(c);
    return { id: c.id, input, inputSha256: hash(JSON.stringify(input)) };
  }),
}, null, 2));

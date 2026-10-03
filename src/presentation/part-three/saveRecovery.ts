import { z } from 'zod';
import type { PartThreeRequest } from '../../contracts/PartThreeService.ts';
import { canonicalJson, sha256 } from '../../domain/part-two/hash.ts';

export interface SaveRecoveryStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface SaveRecoveryAccount { ownerId: string; accountGeneration: number }
export interface SaveRecoveryScope extends SaveRecoveryAccount { encounterId: string; scanId: string; captureSessionId: string | null }
export type PendingSaveRequest = Extract<PartThreeRequest, { operation: 'save' }> & { expectedPacketHash: string };
export interface PartThreeSaveRecoveryPort {
  recover(scope: SaveRecoveryScope): Promise<PendingSaveRequest | null>;
  retain(scope: SaveRecoveryScope, request: PendingSaveRequest): Promise<void>;
  complete(scope: SaveRecoveryScope, request: PendingSaveRequest): Promise<void>;
  retireOwner(ownerId: string, accountGeneration: number): Promise<void>;
}
export type SaveRecoveryDiscovery = { state: 'none' } | { state: 'ambiguous' } |
  { state: 'pending'; scope: SaveRecoveryScope; request: PendingSaveRequest };

const uuid = z.uuid();
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const accountSchema = z.strictObject({ ownerId: uuid, accountGeneration: revision });
const scopeSchema = accountSchema.extend({ encounterId: uuid, scanId: uuid, captureSessionId: uuid.nullable() });
const requestSchema = z.strictObject({ operation: z.literal('save'), requestId: uuid, resultId: uuid,
  expectedResultRevision: revision, expectedBindingHash: hash, expectedPacketHash: hash });
const version = z.literal('part-three-save-recovery/v1');
const recordSchema = z.discriminatedUnion('status', [
  z.strictObject({ version, status: z.literal('active'), ownerId: uuid, accountGeneration: revision,
    attempts: z.array(z.strictObject({ scope: scopeSchema, request: requestSchema })).max(20) }),
  // Erasure retains only an opaque storage-key/generation fence, not owner or
  // request identifiers. A retired authentication generation cannot be resumed.
  z.strictObject({ version, status: z.literal('retired'), accountGeneration: revision }),
]);
type Journal = z.infer<typeof recordSchema>;
type ActiveJournal = Extract<Journal, { status: 'active' }>;

const scopeKey = (scope: SaveRecoveryScope) => canonicalJson(scope);
const accountKey = (account: SaveRecoveryAccount) => canonicalJson([account.ownerId, account.accountGeneration]);
export const saveRecoveryStorageKey = (ownerId: string) => `derive:private:part-three-save-recovery:v1:${sha256(ownerId)}`;

type Coordinator = { tails: Map<string, Promise<unknown>>; retired: Set<string> };
// Every factory using the same AsyncStorage object shares ordering and immediate
// retirement. New controllers cannot race an old controller's late disk write.
const coordinators = new WeakMap<SaveRecoveryStorage, Coordinator>();

/** Metadata-only private journal. currentAccount must come from the guarded,
 * authenticated session anchor; stored generations never establish authority.
 * No packet, formula, note, source URL or context value is accepted or retained. */
export function createPartThreeSaveRecoveryStore(storage: SaveRecoveryStorage, currentAccount: () => SaveRecoveryAccount | null) {
  let coordinator = coordinators.get(storage);
  if (!coordinator) { coordinator = { tails: new Map(), retired: new Set() }; coordinators.set(storage, coordinator); }
  const shared = coordinator;
  function ordered<T>(owner: string, operation: () => Promise<T>): Promise<T> {
    const previous = shared.tails.get(owner) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    shared.tails.set(owner, result);
    void result.finally(() => { if (shared.tails.get(owner) === result) shared.tails.delete(owner); }).catch(() => undefined);
    return result;
  }
  function assertAccount(account: SaveRecoveryAccount) {
    const current = currentAccount();
    if (!current || accountKey(current) !== accountKey(account) || shared.retired.has(accountKey(account))) throw Error('Save recovery session changed');
  }
  async function read(owner: string): Promise<Journal | null> {
    const raw = await storage.getItem(saveRecoveryStorageKey(owner));
    if (raw === null) return null;
    if (raw.length > 65536) throw Error('Save recovery journal is invalid');
    const value = recordSchema.parse(JSON.parse(raw));
    if (value.status === 'active') {
      if (value.ownerId !== owner || value.attempts.some(attempt => attempt.scope.ownerId !== owner || attempt.scope.accountGeneration !== value.accountGeneration) ||
        new Set(value.attempts.map(attempt => scopeKey(attempt.scope))).size !== value.attempts.length ||
        new Set(value.attempts.map(attempt => attempt.request.requestId)).size !== value.attempts.length) throw Error('Save recovery journal is invalid');
    }
    return value;
  }
  async function currentJournal(account: SaveRecoveryAccount): Promise<ActiveJournal | null> {
    assertAccount(account);
    const value = await read(account.ownerId);
    assertAccount(account);
    if (value?.status === 'retired' && value.accountGeneration === account.accountGeneration) throw Error('Save recovery session retired');
    return value?.status === 'active' && value.accountGeneration === account.accountGeneration ? value : null;
  }
  async function write(account: SaveRecoveryAccount, value: Journal) {
    assertAccount(account);
    await storage.setItem(saveRecoveryStorageKey(account.ownerId), canonicalJson(recordSchema.parse(value)));
    assertAccount(account);
  }
  return {
    async recover(scope: SaveRecoveryScope): Promise<PendingSaveRequest | null> {
      const expected = scopeSchema.parse(scope);
      assertAccount(expected);
      return ordered(expected.ownerId, async () => {
        const journal = await currentJournal(expected);
        const found = journal?.attempts.find(attempt => scopeKey(attempt.scope) === scopeKey(expected));
        return found ? structuredClone(found.request) : null;
      });
    },
    async discover(scope: SaveRecoveryAccount & { scanId: string; captureSessionId: string | null }): Promise<SaveRecoveryDiscovery> {
      const expected = accountSchema.extend({ scanId: uuid, captureSessionId: uuid.nullable() }).parse(scope);
      assertAccount(expected);
      return ordered(expected.ownerId, async () => {
        const journal = await currentJournal(expected);
        const matches = journal?.attempts.filter(attempt => attempt.scope.scanId === expected.scanId && attempt.scope.captureSessionId === expected.captureSessionId) ?? [];
        if (matches.length > 1) return { state: 'ambiguous' };
        return matches.length ? { state: 'pending', ...structuredClone(matches[0]) } : { state: 'none' };
      });
    },
    async retain(scope: SaveRecoveryScope, request: PendingSaveRequest): Promise<void> {
      const expected = scopeSchema.parse(scope), accepted = requestSchema.parse(request);
      assertAccount(expected);
      return ordered(expected.ownerId, async () => {
        const journal = await currentJournal(expected) ?? { version: 'part-three-save-recovery/v1', status: 'active',
          ownerId: expected.ownerId, accountGeneration: expected.accountGeneration, attempts: [] };
        const existing = journal.attempts.find(attempt => scopeKey(attempt.scope) === scopeKey(expected));
        if (existing) {
          if (canonicalJson(existing.request) !== canonicalJson(accepted)) throw Error('Another Save confirmation is pending');
          return;
        }
        if (journal.attempts.length >= 20 || journal.attempts.some(attempt => attempt.request.requestId === accepted.requestId)) throw Error('Save recovery journal cannot accept this request');
        await write(expected, { ...journal, attempts: [...journal.attempts, { scope: expected, request: accepted }] });
      });
    },
    async complete(scope: SaveRecoveryScope, request: PendingSaveRequest): Promise<void> {
      const expected = scopeSchema.parse(scope), accepted = requestSchema.parse(request);
      assertAccount(expected);
      return ordered(expected.ownerId, async () => {
        const journal = await currentJournal(expected);
        if (!journal) return;
        const existing = journal.attempts.find(attempt => scopeKey(attempt.scope) === scopeKey(expected));
        if (!existing) return;
        if (canonicalJson(existing.request) !== canonicalJson(accepted)) throw Error('Save recovery request changed');
        await write(expected, { ...journal, attempts: journal.attempts.filter(attempt => scopeKey(attempt.scope) !== scopeKey(expected)) });
      });
    },
    retireOwner(ownerId: string, accountGeneration: number): Promise<void> {
      const account = accountSchema.parse({ ownerId, accountGeneration });
      // Synchronous refusal precedes all outstanding reads/writes. The queued
      // tombstone runs after prior disk writes, so they cannot resurrect entries.
      shared.retired.add(accountKey(account));
      return ordered(ownerId, async () => {
        let value: Journal | null;
        try { value = await read(ownerId); } catch { value = null; }
        if (value && value.accountGeneration !== accountGeneration) return;
        await storage.setItem(saveRecoveryStorageKey(ownerId), canonicalJson({ version: 'part-three-save-recovery/v1', status: 'retired', accountGeneration }));
      });
    },
    // Only confirmed account retirement may use this owner cleanup. It removes
    // older process/session metadata as well as an uninitialized namespace.
    // An independently active fresh session supersedes a delayed retirement.
    eraseOwner(ownerId:string):Promise<void> {
      uuid.parse(ownerId);
      return ordered(ownerId,async()=>{
        const superseded=()=>{const current=currentAccount();return Boolean(current?.ownerId===ownerId&&!shared.retired.has(accountKey(current)));};
        if(superseded())return;
        let value:Journal|null;try{value=await read(ownerId);}catch{value=null;}
        // getItem may complete after a new authenticated namespace is ready.
        // The shared owner queue puts new writes after this operation; the
        // authority recheck also preserves writes already completed before it.
        if(superseded())return;
        const accountGeneration=value?.accountGeneration??0;
        shared.retired.add(accountKey({ownerId,accountGeneration}));
        await storage.setItem(saveRecoveryStorageKey(ownerId),canonicalJson({version:'part-three-save-recovery/v1',status:'retired',accountGeneration}));
      });
    },
  };
}

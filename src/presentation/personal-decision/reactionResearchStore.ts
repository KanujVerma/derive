import type { ReactionIngredientRecord, ReactionProduct } from './reactionIngredientComparison.ts';
import type { WebProductIngredientLookup, IngredientProductCandidate } from '../../contracts/WebProductIngredients.ts';
import { parseWebProductIngredientLookup, validWebIngredientQuery } from '../external-products/webProductIngredients.ts';

export interface ReactionResearchStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Entry = { record: ReactionIngredientRecord; checkedAt: number };
export const REACTION_RESEARCH_TTL = 7 * 24 * 60 * 60 * 1000;
const prefix = 'derive:private-reaction-research:v1:';
export const reactionResearchKey = (product: ReactionProduct) => JSON.stringify([product.key, product.name, product.brand]);
const ownerKey = (owner: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(owner) ? prefix + owner : null;

/** Private device cache of public product facts, never a culprit, allergy, personal score or canonical formula. */
export class ReactionResearchStore {
  private owner: string | null = null;
  private generation = 0;
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private snapshot = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private writes: Promise<unknown> = Promise.resolve();
  private hydrate: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, Promise<ReactionIngredientRecord | null>>();
  private storage: ReactionResearchStorage;
  private lookup: (product: ReactionProduct, owner: string, current: () => boolean) => Promise<WebProductIngredientLookup>;
  private pause: () => Promise<void>;
  private now: () => number;
  constructor(storage: ReactionResearchStorage,
    lookup: (product: ReactionProduct, owner: string, current: () => boolean) => Promise<WebProductIngredientLookup>,
    pause: () => Promise<void>, now = Date.now) {
    this.storage = storage; this.lookup = lookup; this.pause = pause; this.now = now;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private publish() { this.snapshot++; this.listeners.forEach(listener => listener()); }
  setOwner(owner: string | null) {
    if (owner === this.owner) return;
    const previous = this.owner;
    this.owner = owner && ownerKey(owner) ? owner : null;
    const generation = ++this.generation;
    this.entries.clear(); this.pending.clear(); this.publish();
    // Serial removal follows any in-flight cache write. A sign-out/deletion cannot resurrect it.
    if (previous) {
      const key = ownerKey(previous)!;
      this.writes = this.writes.catch(() => {}).then(() => this.storage.removeItem(key)).catch(() => {});
    }
    const key = this.owner && ownerKey(this.owner);
    this.hydrate = key ? this.writes.then(async () => {
      try {
        const raw = await this.storage.getItem(key);
        if (!raw || raw.length > 400000 || generation !== this.generation) return;
        const data = JSON.parse(raw);
        if (data?.version !== 'reaction-research-v1' || data.owner !== this.owner || !Array.isArray(data.entries) || data.entries.length > 20) return;
        for (const entry of data.entries) {
          try {
            const product = entry.record?.product;
            if (!product || typeof product.key !== 'string' || product.key.length > 200
              || !validWebIngredientQuery({ barcode: '', name: product.name, brand: product.brand, size: null })
              || !Number.isFinite(entry.checkedAt) || entry.checkedAt > this.now()
              || this.now() - entry.checkedAt >= REACTION_RESEARCH_TTL) continue;
            const parsed = parseWebProductIngredientLookup({ status: entry.record.status, evidence: entry.record.evidence });
            if (parsed.status !== 'found') continue;
            const record: ReactionIngredientRecord = { product: { key: product.key, name: product.name, brand: product.brand }, status: 'found', evidence: parsed.evidence };
            this.entries.set(reactionResearchKey(product), { record, checkedAt: entry.checkedAt });
          } catch { /* Bad cache entries are not evidence. */ }
        }
        this.publish();
      } catch { /* Storage failure must not prevent saving a report or scanning. */ }
    }) : Promise.resolve();
  }
  record(owner: string, product: ReactionProduct): ReactionIngredientRecord | null {
    if (owner !== this.owner) return null;
    const entry = this.entries.get(reactionResearchKey(product));
    if (!entry || this.now() - entry.checkedAt >= (entry.record.status === 'found' ? REACTION_RESEARCH_TTL : 60000)) return null;
    return entry.record;
  }
  async choose(owner: string, product: ReactionProduct, candidate: IngredientProductCandidate): Promise<ReactionIngredientRecord | null> {
    const generation = this.generation;
    const previous = this.record(owner, product);
    if (previous?.status !== 'ambiguous' || !previous.candidates?.some(item => item.name === candidate.name && item.brand === candidate.brand)) return null;
    await this.pending.get(reactionResearchKey(product));
    if (owner !== this.owner || generation !== this.generation) return null;
    return this.research(owner, product, true, candidate);
  }
  async research(owner: string, product: ReactionProduct, force = false, selected?: IngredientProductCandidate): Promise<ReactionIngredientRecord | null> {
    const generation = this.generation;
    const current = () => owner === this.owner && generation === this.generation;
    await this.hydrate;
    if (!current()) return null;
    const key = reactionResearchKey(product), pending = this.pending.get(key);
    if (pending) return pending;
    const cached = this.record(owner, product);
    if (cached && !force) return cached;
    if (!validWebIngredientQuery({ barcode: '', name: product.name, brand: product.brand, size: null })) {
      const record: ReactionIngredientRecord = { product, status: 'ambiguous' };
      this.entries.set(key, { record, checkedAt: this.now() }); this.publish(); return record;
    }
    this.entries.set(key, { record: { product, status: 'loading' }, checkedAt: this.now() }); this.publish();
    const job = this.queue.catch(() => {}).then(async () => {
      if (!current()) return null;
      // Same existing private provider cooldown as barcode research. No expansion of request budgets.
      await this.pause(); if (!current()) return null;
      let result: WebProductIngredientLookup;
      try { result = parseWebProductIngredientLookup(await this.lookup(selected ? { ...product, name: selected.name, brand: selected.brand } : product, owner, current)); }
      catch { result = { status: 'unavailable' }; }
      if (!current()) return null;
      const record: ReactionIngredientRecord = result.status === 'found'
        ? { product, status: 'found', evidence: result.evidence }
        : { product, status: result.status === 'configuration_required' ? 'unavailable' : result.status,
          ...(result.status === 'ambiguous' && result.candidates ? { candidates: result.candidates } : {}) };
      this.entries.set(key, { record, checkedAt: this.now() }); this.publish();
      // Only found, attributed facts are retained. Failures stay retryable and user context is excluded.
      if (result.status === 'found') {
        const cache = { version: 'reaction-research-v1', owner, entries: [...this.entries.values()]
          .filter(e => e.record.status === 'found' && this.now() - e.checkedAt < REACTION_RESEARCH_TTL).slice(-20) };
        this.writes = this.writes.catch(() => {}).then(async () => {
          if (current()) await this.storage.setItem(ownerKey(owner)!, JSON.stringify(cache));
        }).catch(() => {});
        await this.writes;
      }
      return record;
    });
    this.pending.set(key, job); this.queue = job;
    void job.finally(() => { if (current()) this.pending.delete(key); });
    return job;
  }
}

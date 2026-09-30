import type { ProductLinkIntakeResult, ResolveProductLinkInput } from '../../contracts/ProductLinkIntake.ts';
import { ProductLinkError, resolveProductLink } from '../../services/productLinks.ts';

type FailureCode = ProductLinkError['code'] | 'OWNER_UNAVAILABLE';
interface LinkViewBase { readonly ownerId: string | null; readonly url: string; readonly requestId: string | null }
export type ProductLinkView = LinkViewBase & (
  | { readonly kind: 'idle' | 'loading'; readonly message: null }
  | { readonly kind: 'resolution'; readonly result: Extract<ProductLinkIntakeResult, { status: 'resolution' }>; readonly message: null }
  | { readonly kind: 'label_candidate'; readonly result: Extract<ProductLinkIntakeResult, { status: 'label_candidate' }>; readonly message: string }
  | { readonly kind: 'needs_details'; readonly result: Extract<ProductLinkIntakeResult, { status: 'needs_details' }>; readonly message: string }
  | { readonly kind: 'error'; readonly code: FailureCode; readonly message: string }
);

const recoveryText = 'Search by name or photograph the package to check this product.';
const labelText = 'This published label is a possible match. Confirm the package before checking its ingredients.';
const errorText: Readonly<Record<FailureCode, string>> = Object.freeze({
  INVALID_LINK: 'Enter a full HTTPS product link.',
  RATE_LIMITED: 'Product lookup is temporarily limited. Try again later.',
  UNAVAILABLE: 'We could not check this link. Try again, search by name, or scan the package.',
  OWNER_UNAVAILABLE: 'Please wait while we prepare your session.',
});

/** One mounted link input. Every async branch is fenced to its owner and input. */
export function createProductLinkController(options: {
  transport?: (input: ResolveProductLinkInput) => Promise<ProductLinkIntakeResult>;
  createRequestId: () => string;
  /** Pin to the live Auth/access owner, including before React effects run. */
  getCurrentOwner?: () => string | null;
}) {
  const transport = options.transport ?? resolveProductLink;
  const createRequestId = options.createRequestId;
  let state: ProductLinkView = Object.freeze({ ownerId: null, url: '', requestId: null, kind: 'idle', message: null });
  let sequence = 0;
  const listeners = new Set<() => void>();
  const publish = (next: ProductLinkView) => {
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  const setOwner = (ownerId: string | null) => {
    if (state.ownerId === ownerId) return;
    sequence++;
    publish({ ownerId, url: '', requestId: null, kind: 'idle', message: null });
  };
  const setInput = (value: string) => {
    const url = value.trim();
    if (url === state.url) return;
    sequence++;
    publish({ ownerId: state.ownerId, url, requestId: null, kind: 'idle', message: null });
  };
  const reset = () => {
    sequence++;
    publish({ ownerId: state.ownerId, url: '', requestId: null, kind: 'idle', message: null });
  };
  const submit = async (): Promise<ProductLinkIntakeResult | null> => {
    if (state.kind === 'loading') return null;
    const ownerId = state.ownerId;
    const url = state.url;
    const liveOwner = options.getCurrentOwner ? options.getCurrentOwner() : ownerId;
    if (liveOwner !== ownerId) { setOwner(liveOwner); return null; }
    if (!ownerId) {
      publish({ ownerId, url, requestId: null, kind: 'error', code: 'OWNER_UNAVAILABLE', message: errorText.OWNER_UNAVAILABLE });
      return null;
    }
    if (!url) {
      publish({ ownerId, url, requestId: null, kind: 'error', code: 'INVALID_LINK', message: errorText.INVALID_LINK });
      return null;
    }
    const requestId = state.requestId ?? createRequestId();
    const requestSequence = ++sequence;
    const current = () => {
      if (sequence !== requestSequence || state.ownerId !== ownerId || state.url !== url) return false;
      const currentOwner = options.getCurrentOwner ? options.getCurrentOwner() : state.ownerId;
      if (currentOwner !== ownerId) { setOwner(currentOwner); return false; }
      return true;
    };
    publish({ ownerId, url, requestId, kind: 'loading', message: null });
    try {
      const result = await transport({ requestId, url });
      if (!current()) return null;
      if (result.status === 'resolution') publish({ ownerId, url, requestId, kind: 'resolution', result, message: null });
      else if (result.status === 'label_candidate') publish({ ownerId, url, requestId, kind: 'label_candidate', result, message: labelText });
      else publish({ ownerId, url, requestId, kind: 'needs_details', result, message: recoveryText });
      return result;
    } catch (error) {
      if (!current()) return null;
      const code = error instanceof ProductLinkError ? error.code : 'UNAVAILABLE';
      publish({ ownerId, url, requestId, kind: 'error', code, message: errorText[code] });
      return null;
    }
  };
  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setOwner, setInput, reset, submit,
  };
}

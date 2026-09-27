# P0-D release, privacy, and support copy audit

Audit date: 2026-09-27. Source base: `aefbd46085698d49be9789b7742acbf2a1288471`. This is copy preparation, not evidence that a new beta binary, hosted free access, or public page deployment exists.

## Evidence and scope

- The live [home](https://derive-beta-site.vercel.app/), [Privacy](https://derive-beta-site.vercel.app/privacy), [Support](https://derive-beta-site.vercel.app/support), and [Privacy choices](https://derive-beta-site.vercel.app/privacy-choices) pages were read in the browser on the audit date. Their visible text matched the tracked `apple-site/*.html` files before this edit.
- The app compiles those three legal/support URLs in `src/config/environment.ts`. Development Mock and exact local Supabase can show the free Check shell. `src/utils/shellPresentation.ts` routes Remote Staging and production to the legacy managed shell. `src/utils/membershipPresentation.ts` hides price and provider features in Remote Staging. These are source facts, not installed-binary or hosted-service observations.
- `src/components/account/FreeAccountShell.tsx` shows Privacy, Support, and **Delete Derive data** under **Account & Settings** for a local free session. `app/profile/index.tsx` shows the managed **Account** screen with **Delete Account**. `src/services/accountDeletion.ts` invokes `delete-customer-account` and clears the local session only after confirmed success. The server removes owner files and Auth identity in `supabase/functions/delete-customer-account/index.ts`. Actual local deletion was exercised in the P0-D local journey recorded in [P0_D_ACCEPTANCE.md](../P0_D_ACCEPTANCE.md); hosted deletion for a new candidate remains unverified.

## Reconciliation

| Claim or path | Observed mismatch | Correction or boundary |
| --- | --- | --- |
| Home and Support | Both described only a managed skincare beta. | Home now identifies current invited managed access and says free Check is in development, with no hosted free claim. Support uses a broader cosmetic beta description. |
| Account identity | Privacy described every user as supplying name, email, and password. | Privacy distinguishes invited member details from a guest Auth identifier where that free session is available. It preserves Supabase Auth handling of any password. Hosted guest access remains gated. |
| Deletion | Privacy choices and Support named only the managed **Delete Account** path. | Both now name the local free **Account & Settings → Delete Derive data** path conditionally. Privacy retains its Storage/record deletion, log/backup, and no instant-backup-erasure language. A lost guest session has no proven self-service recovery path and needs a hosted lifecycle decision before free activation. |
| Product photo and AI | A captured package image could be read as photo recognition; provider readiness is not proven. | Privacy now says a development Check photo alone neither identifies the product nor verifies the formula. Existing policy commitment to update before new model-provider data use is retained. No public OCR, provider, or contribution claim was added. |
| Free, Managed, and price | `$25/month Managed Skincare` is an approved hypothesis; old `$25` Founding Beta display/checkout exists in other flavors. Remote Staging is a free invited managed beta and hosted free Check is off. | Site makes no price or activated billing promise. The revised home describes the current hosted access and future free path separately. Recheck the exact candidate offer and Account screen before publication. |
| Adult and medical scope | Site did not state the intended initial cohort. | Home and Privacy state the U.S. adult 18+ beta intent and cosmetic, non-diagnostic boundary. This is not an age-verification claim. |
| Contribution | `src/domain/catalog-contribution/proposal.ts` defines a request shape, but customer submission and review runtime are not present at this base. | No site claim that customers can submit products or that a product photo adds it to the shared catalog. Recheck after the separate backend and customer UI land. |

## Required release handoffs

1. **Publication decision:** `apple-site/vercel.json` provides rewrites and `apple-site/.gitignore` excludes the local `.vercel` link. There is no tracked deploy workflow or project link. The public pages are hosted at the configured Vercel URLs, but this audit could not establish whether merging `apple-site` on `main` automatically publishes them. Treat the PR merge as a possible public-policy publication and inspect the actual Vercel Git integration before merge. The private dashboard read was rejected by automatic approval review because access to private account and deployment information was not explicitly authorized; it was not retried or bypassed.
2. **Privacy/legal review:** Review the revised Privacy and Privacy choices text against the candidate binary, hosted processing, support operation, and intended legal commitments before public deployment. In particular, confirm the external build's AI availability, any model-provider processing, exact guest-session lifecycle and deletion reachability, and log/backup retention terms. This patch does not establish those facts.
3. **Binary and hosted acceptance:** Verify the installed candidate's Account labels and links, Support open/retry, hosted guest or managed access, exact offer and billing presentation, actual hosted deletion, adult eligibility handling, and image behavior. No source or public-page observation substitutes for those gates.

No support email was sent. No public page or Vercel setting was changed by this repository edit.

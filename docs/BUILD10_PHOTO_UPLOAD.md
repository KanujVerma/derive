# Build 10 native onboarding photo upload

## Scope and evidence

Build 9 physical iOS onboarding reached `prepare-onboarding` and left an uncommitted draft with no objects in `customer-skin-photos`. The existing client helper read each `file://` URI with `fetch(...).blob()` and passed a Blob to Supabase Storage. The iOS capture module writes a temporary `.jpg` file and returns its absolute `file://` URI. The server already issues owner-bound paths and reports which objects exist for retry.

Supabase's [JavaScript Storage upload reference](https://supabase.com/docs/reference/javascript/file-buckets-upload) accepts an ArrayBuffer and its [Expo React Native guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native) uploads an ArrayBuffer with an explicit content type. The [Expo SDK 57 FileSystem reference](https://docs.expo.dev/versions/latest/sdk/filesystem/) specifies `File.exists`, `size`, `type`, and `arrayBuffer()`. This is a client-only change: the native upload now reads the captured file through Expo FileSystem and sends an ArrayBuffer. Web continues to upload a Blob. The bucket, server-issued path, and `upsert: false` remain unchanged.

The helper rejects inaccessible, empty, oversized, or unsupported files before upload. The 10 MiB limit matches the existing private bucket. It accepts JPEG, PNG, WebP, HEIC, and HEIF, preferring the File MIME type and using a known extension only when that type is absent or generic. Error codes contain no local URI, object path, bytes, or lower-level error text. The Review screen describes intake failure accurately, keeps its state after failure, and prevents duplicate Submit taps while a request is in flight. Remote Staging no longer advertises hidden Ask and Scan features there.

## Verification boundary

- The focused Build 10 test covers native ArrayBuffer body, local fixture bytes, MIME, file/read/Storage failures, private bucket and server path, immutable uploads, web Blob behavior, and partial retry. The repository's existing onboarding tests cover committed replay and client payload sanitization.
- `npm test`, both TypeScript checks, clean web and iOS JavaScript exports, and `git diff --check` passed on the Build 10 branch before PR.
- One disposable authenticated account with a temporary active beta entitlement received a server-issued path in hosted project `snojlbqovlawewwqbviz`. The actual Build 10 adapter uploaded an ArrayBuffer there. A second prepare call reported `front.uploaded: true`; independent database readback found exactly one front object and an uncommitted draft. The app's account-deletion function removed the account, entitlement, draft and object, and readback showed zero remaining.
- This hosted Node fixture proves authenticated ArrayBuffer acceptance, not physical iOS `File` reads or end-to-end onboarding. Build 10 physical TestFlight acceptance is still required.
- Expo Doctor reported four existing SDK 57 patch mismatches in `expo`, `expo-constants`, `expo-image-picker`, and `expo-router`. The newly installed `expo-file-system@57.0.7` matches its recommended version.

## Retry and restart

In a running app session, the Review screen retains front/left/right URIs after failure. Repeated Submit reuses the draft; `uploaded: true` targets are skipped, and `upsert: false` prevents replacing completed uploads. If the app process restarts before commit, the Zustand onboarding store does not persist those URIs, and camera files live in a temporary directory. A fresh capture may be needed. Persisting sensitive photos and their lifecycle needs separate design and privacy review.

import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { uploadPhotoToStorage } from '../src/services/onboardingPhotoUpload.ts';

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const SERVER_PATH = 'user-id/front/server-issued.jpg';

type FileShape = {
  exists: boolean;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function mockClient(error: Error | null = null) {
  const calls: Array<{ bucket: string; path: string; body: unknown; options: any }> = [];
  return {
    calls,
    client: {
      storage: {
        from(bucket: string) {
          return {
            async upload(path: string, body: unknown, options: any) {
              calls.push({ bucket, path, body, options });
              return { data: error ? null : { path }, error };
            },
          };
        },
      },
    },
  };
}

function nativeFile(bytes = JPG, type = 'image/jpeg'): FileShape {
  return {
    exists: true,
    size: bytes.byteLength,
    type,
    async arrayBuffer() { return bytes.slice().buffer; },
  };
}

test('Build 10 native upload sends ArrayBuffer to the private bucket and exact server path', async () => {
  const { client, calls } = mockClient();
  await uploadPhotoToStorage(SERVER_PATH, 'file:///tmp/captured.jpg', client, {
    platform: 'ios',
    nativeFileFactory: () => nativeFile(),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bucket, 'customer-skin-photos');
  assert.equal(calls[0].path, SERVER_PATH);
  assert.ok(calls[0].body instanceof ArrayBuffer);
  assert.deepEqual(new Uint8Array(calls[0].body as ArrayBuffer), JPG);
  assert.deepEqual(calls[0].options, { contentType: 'image/jpeg', upsert: false });
});

test('Build 10 native reader accepts a temporary local fixture and preserves MIME truth', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'derive-photo-upload-'));
  try {
    const fixture = join(dir, 'capture-without-extension');
    await writeFile(fixture, JPG);
    const { client, calls } = mockClient();
    await uploadPhotoToStorage(SERVER_PATH, `file://${fixture}`, client, {
      platform: 'android',
      nativeFileFactory: () => ({
        exists: true,
        size: JPG.byteLength,
        type: 'image/jpeg',
        async arrayBuffer() {
          const contents = await readFile(fixture);
          return contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength);
        },
      }),
    });
    assert.equal(calls[0].options.contentType, 'image/jpeg');
    assert.ok(calls[0].body instanceof ArrayBuffer);
    assert.deepEqual(new Uint8Array(calls[0].body as ArrayBuffer), JPG);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Build 10 MIME selection prefers file type and handles allowed extension fallbacks', async () => {
  for (const [uri, reported, expected] of [
    ['file:///capture.jpg', 'image/heic', 'image/heic'],
    ['file:///capture.heif', 'image/heif', 'image/heif'],
    ['file:///capture.png', '', 'image/png'],
    ['file:///capture.webp', 'application/octet-stream', 'image/webp'],
  ] as const) {
    const { client, calls } = mockClient();
    await uploadPhotoToStorage(SERVER_PATH, uri, client, {
      platform: 'ios', nativeFileFactory: () => nativeFile(JPG, reported),
    });
    assert.equal(calls[0].options.contentType, expected);
  }
});

test('Build 10 rejects unreadable, empty, oversized and unsupported native files before upload', async () => {
  for (const [label, file] of [
    ['unreadable', { ...nativeFile(), exists: false }],
    ['empty', { ...nativeFile(), size: 0 }],
    ['oversize', { ...nativeFile(), size: 10 * 1024 * 1024 + 1 }],
    ['wrong MIME', { ...nativeFile(), type: 'text/plain' }],
  ] as const) {
    const { client, calls } = mockClient();
    await assert.rejects(
      uploadPhotoToStorage(SERVER_PATH, 'file:///private/capture.jpg', client, {
        platform: 'ios', nativeFileFactory: () => file,
      }),
      { name: 'PhotoUploadError' },
      label,
    );
    assert.equal(calls.length, 0, label);
  }
});

test('Build 10 native read and Storage failures fail closed without sensitive logs', async () => {
  const warnings: unknown[][] = [];
  const oldWarn = console.warn;
  console.warn = (...args) => { warnings.push(args); };
  try {
    const readClient = mockClient();
    await assert.rejects(uploadPhotoToStorage(SERVER_PATH, 'file:///private/secret.jpg', readClient.client, {
      platform: 'ios', nativeFileFactory: () => ({
        ...nativeFile(),
        async arrayBuffer(): Promise<ArrayBuffer> { throw new Error('secret image bytes token password'); },
      }),
    }));
    assert.equal(readClient.calls.length, 0);

    const storageClient = mockClient(new Error('secret image bytes token password'));
    await assert.rejects(uploadPhotoToStorage(SERVER_PATH, 'file:///private/secret.jpg', storageClient.client, {
      platform: 'ios', nativeFileFactory: () => nativeFile(),
    }));
    const logged = JSON.stringify(warnings);
    assert.doesNotMatch(logged, /secret|token|password|private\/secret|ff,d8/i);
  } finally {
    console.warn = oldWarn;
  }
});

test('Build 10 web path still uploads a Blob with its actual MIME', async () => {
  const { client, calls } = mockClient();
  const blob = new Blob([JPG], { type: 'image/png' });
  await uploadPhotoToStorage(SERVER_PATH, 'blob:photo', client, {
    platform: 'web',
    fetchPhoto: async () => ({ ok: true, blob: async () => blob }),
  });
  assert.equal(calls[0].body, blob);
  assert.equal(calls[0].options.contentType, 'image/png');
});

test('Build 10 retries only the missing photo after a partial Storage failure', async () => {
  const { RemoteDeriveService } = await import('../src/services/remote/RemoteDeriveService.ts');
  const { buildOnboardingPayload } = await import('../src/services/deriveClient.ts');
  const uploaded = new Set<string>();
  const uploadCalls: Array<{ path: string; upsert: boolean }> = [];
  let commitCount = 0;
  let failRightOnce = true;
  const paths = {
    front: 'usr/front/server.jpg',
    left: 'usr/left/server.jpg',
    right: 'usr/right/server.jpg',
  };
  const client = {
    functions: {
      async invoke(name: string) {
        if (name === 'prepare-onboarding') return {
          data: {
            submissionId: 'same-draft',
            uploadTargets: Object.fromEntries(Object.entries(paths).map(([side, path]) => [side, { path, uploaded: uploaded.has(path) }])),
          },
          error: null,
        };
        if (name === 'onboard-customer') {
          commitCount++;
          return { data: { userId: 'usr', initialRoutineState: 'pending_generation' }, error: null };
        }
        throw new Error('unexpected function');
      },
    },
    storage: {
      from(bucket: string) {
        assert.equal(bucket, 'customer-skin-photos');
        return {
          async upload(path: string, _body: unknown, options: { upsert: boolean }) {
            uploadCalls.push({ path, upsert: options.upsert });
            if (path === paths.right && failRightOnce) {
              failRightOnce = false;
              return { data: null, error: new Error('temporary failure') };
            }
            uploaded.add(path);
            return { data: { path }, error: null };
          },
        };
      },
    },
  };
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, blob: async () => new Blob([JPG], { type: 'image/jpeg' }) } as any);
  try {
    const service = new RemoteDeriveService(client);
    const payload = buildOnboardingPayload({
      frontPhotoUri: 'file:///front.jpg', leftPhotoUri: 'file:///left.jpg', rightPhotoUri: 'file:///right.jpg',
    }, 'usr_real', true);
    await assert.rejects(service.onboard(payload));
    assert.equal(commitCount, 0);
    assert.deepEqual(uploadCalls.map((call) => call.path), [paths.front, paths.left, paths.right]);
    await service.onboard(payload);
    assert.deepEqual(uploadCalls.map((call) => call.path), [paths.front, paths.left, paths.right, paths.right]);
    assert.ok(uploadCalls.every((call) => call.upsert === false));
    assert.equal(commitCount, 1);
  } finally {
    globalThis.fetch = priorFetch;
  }
});

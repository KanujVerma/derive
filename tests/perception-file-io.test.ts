import assert from 'node:assert/strict';
import test from 'node:test';
import fs, { mkdtempSync, writeFileSync, appendFileSync, symlinkSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { readBoundedBenchmarkFile } from '../scripts/perception-file-io.ts';

function temporaryFiles(run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'derive-perception-io-'));
  try { run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('accepts exact 10MiB image bytes and rejects one-byte oversize before reading', () => {
  temporaryFiles(directory => {
    const limit = 10 * 1024 * 1024;
    const path = join(directory, 'image.jpg');
    const bytes = Buffer.alloc(limit, 7);
    writeFileSync(path, bytes);
    assert.deepEqual(readBoundedBenchmarkFile(path, limit), bytes);
    appendFileSync(path, Buffer.from([8]));
    assert.throws(() => readBoundedBenchmarkFile(path, limit));
    for (const invalid of [0, -1, Number.NaN, 1.5, 16_000_001]) assert.throws(() => readBoundedBenchmarkFile(path, invalid));
  });
});

test('rejects symlink images and non-files without following or reading them', () => {
  temporaryFiles(directory => {
    const path = join(directory, 'image.jpg');
    writeFileSync(path, 'bounded bytes');
    const link = join(directory, 'link.jpg');
    symlinkSync(path, link);
    assert.throws(() => readBoundedBenchmarkFile(link, 100));
    assert.throws(() => readBoundedBenchmarkFile(directory, 100));
  });
});

test('actual read remains capped at limit plus one if image grows after descriptor metadata checks', () => {
  temporaryFiles(directory => {
    const path = join(directory, 'image.jpg');
    writeFileSync(path, 'abcd');
    const originalStat = fs.fstatSync;
    const originalRead = fs.readSync;
    let bytesRead = 0;
    try {
      fs.fstatSync = ((...args: Parameters<typeof fs.fstatSync>) => {
        const metadata = originalStat(...args);
        appendFileSync(path, 'efghijklmnop');
        return metadata;
      }) as typeof fs.fstatSync;
      fs.readSync = ((...args: Parameters<typeof fs.readSync>) => {
        const count = originalRead(...args);
        bytesRead += count;
        return count;
      }) as typeof fs.readSync;
      syncBuiltinESMExports();
      assert.throws(() => readBoundedBenchmarkFile(path, 4));
      assert.equal(bytesRead, 5);
    } finally {
      fs.fstatSync = originalStat;
      fs.readSync = originalRead;
      syncBuiltinESMExports();
    }
  });
});

test('rejects image inode replacement and symlink replacement between lstat and open', () => {
  temporaryFiles(directory => {
    const path = join(directory, 'image.jpg');
    const replacement = join(directory, 'replacement.jpg');
    const originalOpen = fs.openSync;
    try {
      for (const symlink of [false, true]) {
        writeFileSync(path, 'abcd');
        writeFileSync(replacement, 'efgh');
        fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
          fs.openSync = originalOpen;
          syncBuiltinESMExports();
          rmSync(path);
          if (symlink) symlinkSync(replacement, path);
          else renameSync(replacement, path);
          return originalOpen(...args);
        }) as typeof fs.openSync;
        syncBuiltinESMExports();
        assert.throws(() => readBoundedBenchmarkFile(path, 4));
        rmSync(path);
      }
    } finally { fs.openSync = originalOpen; syncBuiltinESMExports(); }
  });
});

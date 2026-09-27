/// <reference types="node" />
import { lstatSync, openSync, closeSync, fstatSync, readSync, constants } from 'node:fs';

/** Offline benchmark input only: bind regular-file checks to the opened inode and cap actual reads. */
export function readBoundedBenchmarkFile(path: string, limit: number): Buffer {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 16_000_000) throw new Error();
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > limit) throw new Error();
  // NONBLOCK also avoids hanging if a regular file is replaced by a FIFO before open.
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.size > limit || opened.dev !== metadata.dev || opened.ino !== metadata.ino) throw new Error();
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = readSync(descriptor, buffer, length, buffer.length - length, null);
      if (!read) break;
      length += read;
    }
    if (length > limit) throw new Error();
    return buffer.subarray(0, length);
  } finally { closeSync(descriptor); }
}

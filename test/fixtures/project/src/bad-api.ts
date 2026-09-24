// Calls a made-up method that does not exist on Node's "fs" module - the
// classic "agent hallucinated an API" bug.
import fs from 'node:fs';

export function readFast(filePath: string): string {
  return fs.readFileSyncSuperFast(filePath, 'utf8');
}

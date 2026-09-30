// Calls only real, documented methods of the Node "fs" and "path" builtins.
import fs from 'node:fs';
import path from 'node:path';
import type { PathLike } from 'node:fs';
import { type Stats } from 'node:fs';

export function readConfig(configDir: PathLike): string {
  const configPath = path.join(configDir.toString(), 'config.json');
  return fs.readFileSync(configPath, 'utf8');
}

export function describeStats(stats: Stats): string {
  return stats.isFile() ? 'file' : 'not a file';
}

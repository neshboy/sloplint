// Calls only real, documented methods of the Node "fs" and "path" builtins.
import fs from 'node:fs';
import path from 'node:path';

export function readConfig(configDir: string): string {
  const configPath = path.join(configDir, 'config.json');
  return fs.readFileSync(configPath, 'utf8');
}

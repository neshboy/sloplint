// Imports a real Node builtin (node:fs) and a package actually declared in
// this fixture's package.json ("lodash"). Neither should be flagged.
import fs from 'node:fs';
import { debounce } from 'lodash';

export function logDebounced(message: string): void {
  const log = debounce(() => {
    fs.writeFileSync('/tmp/sloplint-fixture.log', message);
  }, 100);
  log();
}

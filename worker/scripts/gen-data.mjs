import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const root   = join(dirname(fileURLToPath(import.meta.url)), '../..');
const VENDOR = join(root, 'vendor/chombat');
const OUT    = join(root, 'worker/src/generated');

mkdirSync(OUT, { recursive: true });

const files = [
  { src: 'units.js',     exp: 'export { units };' },
  { src: 'presets.js',   exp: 'export { presets };' },
  { src: 'scenarios.js', exp: 'export { scenarios, featuredScenarios };' },
];

for (const { src, exp } of files) {
  const content = readFileSync(join(VENDOR, src), 'utf8');
  writeFileSync(join(OUT, src), content + '\n' + exp + '\n');
  console.log(`gen-data: wrote generated/${src}`);
}

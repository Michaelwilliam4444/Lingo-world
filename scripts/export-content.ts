/** Writes the seed content bundle to content-export/bundle.json (for CMS import or review). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { getSeedContent } from '../src/content/index';
mkdirSync('content-export', { recursive: true });
const b = getSeedContent();
writeFileSync('content-export/bundle.json', JSON.stringify(b, null, 2));
for (const key of ['concepts', 'lexemes', 'phrases', 'units', 'episodes', 'books'] as const) writeFileSync(`content-export/${key}.json`, JSON.stringify(b[key], null, 2));
console.log(`Exported ${b.version} to content-export/`);

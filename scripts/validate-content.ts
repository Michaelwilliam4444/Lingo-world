import { getSeedContent, getContentIndex } from '../src/content/index';
import { validateBundle } from '../src/content/schema';

const bundle = getSeedContent();
const issues = validateBundle(bundle);
const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');
for (const i of issues) console.log(`${i.severity.toUpperCase()} ${i.where}: ${i.message}`);
const idx = getContentIndex();
console.log(`\nConcepts: ${bundle.concepts.length} · Lexemes: ${bundle.lexemes.length} · Phrases: ${new Set(bundle.phrases.map(p=>p.id)).size}×5`);
console.log(`Units: ${bundle.units.length} · Worlds: ${bundle.worlds.length} · Arcs: ${bundle.arcs.length} · Episodes: ${bundle.episodes.length}`);
console.log(`Games: ${bundle.games.length} · Templates: ${bundle.gameTemplates.length} · Books: ${bundle.books.length} · Songs: ${bundle.songs.length} · Roleplays: ${bundle.roleplays.length}`);
void idx;
console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);

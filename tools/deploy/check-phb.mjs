import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Pages releases explicitly require the licensed full pack. Never silently ship SRD-only.
const path = new URL('../../packs/phb-2024/src/generated/phb.json', import.meta.url);
let data;
try {
  data = JSON.parse(await readFile(path, 'utf8'));
} catch (error) {
  throw new Error('PHB data is missing or invalid. Run the licensed PHB generator before building Pages.', { cause: error });
}
assert.equal(data.source?.repo, 'DND5eChm/DND5e_chm');
assert.match(data.source?.commit ?? '', /^[0-9a-f]{40}$/);
const expected = { spells: 380, feats: 75, backgrounds: 16, species: 10, classes: 12, items: 150, masteries: 8 };
for (const [kind, minimum] of Object.entries(expected)) {
  assert.ok(Array.isArray(data[kind]) && data[kind].length >= minimum, `PHB ${kind} incomplete (expected at least ${minimum})`);
}
assert.equal(data.classes.reduce((n, cls) => n + cls.subclasses.length, 0), 48, 'PHB subclasses incomplete');
console.log(`Verified PHB ${data.source.commit}: ${data.spells.length} spells, 12 classes, 48 subclasses`);

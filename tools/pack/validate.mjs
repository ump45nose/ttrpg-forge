// pnpm validate:pack <pack.json> [more.json ...]
// Checks a rule pack against the built-in packs (SRD, plus the PHB when its generated
// data is present locally): schema, references, formulas, and smoke-built characters.
// Runs the TypeScript sources through Vite's SSR loader, the same way the app bundles them.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("../../", import.meta.url);
const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: pnpm validate:pack <pack.json> [...]");
  process.exit(2);
}

const require = createRequire(new URL("apps/web/package.json", root));
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const server = await createServer({ root: new URL(".", root).pathname, configFile: false, logLevel: "silent", server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true } });

let failed = false;
try {
  const core = await server.ssrLoadModule("/packages/core/src/index.ts");
  const { srd52 } = await server.ssrLoadModule("/packs/srd-5.2.1/src/index.ts");
  const base = [srd52];
  try {
    const phb = await (await server.ssrLoadModule("/packs/phb-2024/src/index.ts")).loadPhb2024();
    if (phb) base.push(phb);
  } catch {
    // no licensed PHB data on this machine: check against the SRD only
  }
  console.log(`base packs: ${base.map((p) => p.id).join(", ")}\n`);

  const cwd = process.env.INIT_CWD ?? process.cwd();
  for (const f of files) {
    const path = resolve(cwd, f);
    let data;
    try {
      data = JSON.parse(await readFile(path, "utf8"));
    } catch (e) {
      console.log(`✗ ${f}: cannot read JSON — ${e.message}`);
      failed = true;
      continue;
    }
    const r = core.checkPack(data, base);
    const s = r.stats;
    console.log(`${r.ok ? "✓" : "✗"} ${f}${s ? `  (${s.entities} entities, ${s.overrides} overrides, ${s.patches} patches${s.systemConfig ? ", house rules" : ""})` : ""}`);
    for (const e of r.errors) console.log(`  error   ${e}`);
    for (const w of r.warnings) console.log(`  warning ${w}`);
    for (const b of r.smoke) console.log(`  built   ${b}`);
    console.log();
    if (!r.ok) failed = true;
  }
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);

import type { RulePack } from "@forge/core";
import type { PhbData } from "./data";

export { buildPhbPack } from "./build";
export type { PhbData } from "./data";

/*
 * src/generated/phb.json is produced locally by `pnpm --filter @forge/pack-phb2024 generate`
 * and is git-ignored. Without it this pack simply doesn't exist and the app runs on the SRD.
 */
const files = import.meta.glob<PhbData>("./generated/phb.json", { import: "default" });
const load = Object.values(files)[0];

/** The pack (data and builder code) is its own chunk, fetched once at startup; undefined when not generated. */
export async function loadPhb2024(): Promise<RulePack | undefined> {
  if (!load) return undefined;
  const [{ buildPhbPack }, data] = await Promise.all([import("./build"), load()]);
  return buildPhbPack(data).pack;
}

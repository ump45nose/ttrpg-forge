import type { RulePack } from "@forge/core";
import { buildPhbPack } from "./build";
import type { PhbData } from "./data";

export { buildPhbPack } from "./build";
export type { PhbData } from "./data";

/*
 * src/generated/phb.json is produced locally by `pnpm --filter @forge/pack-phb2024 generate`
 * and is git-ignored. Without it this pack simply doesn't exist and the app runs on the SRD.
 */
const files = import.meta.glob<PhbData>("./generated/phb.json", { eager: true, import: "default" });
const data = Object.values(files)[0];

export const phb2024: RulePack | undefined = data ? buildPhbPack(data).pack : undefined;
export default phb2024;

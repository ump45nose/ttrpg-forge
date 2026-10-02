import type { RulePack } from "@forge/core";
import { backgrounds } from "./backgrounds";
import { classes } from "./classes";
import { feats } from "./feats";
import { GLOSSARY } from "./glossary.generated";
import { t } from "./helpers";
import { items } from "./items";
import { conditions, globalGrants } from "./rules";
import { species } from "./species";
import { spells } from "./spells";

export const SRD_ATTRIBUTION = t(
  'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Chinese rules glossary from SRD5.2Chm by DND5eChm (https://github.com/DND5eChm/SRD5.2Chm, CC BY 4.0); other Chinese text is an independent translation/summary.',
  "本作品包含来自威世智（Wizards of the Coast LLC）《系统参考文档 5.2.1》（SRD 5.2.1）的内容，原文见 https://www.dndbeyond.com/srd，依据知识共享署名 4.0 国际许可协议（CC BY 4.0）授权。中文规则术语释义取自 DND5eChm《SRD5.2Chm》（https://github.com/DND5eChm/SRD5.2Chm，CC BY 4.0），其余中文内容为独立翻译与摘要。",
);

export const srd52: RulePack = {
  id: "srd-5.2.1",
  version: "0.1.0",
  system: "dnd5e-2024",
  name: t("SRD 5.2.1 (D&D 2024)", "SRD 5.2.1（D&D 2024）"),
  license: "CC-BY-4.0",
  attribution: SRD_ATTRIBUTION,
  globalGrants,
  // content currently covers levels 1-8; house-rule packs can raise this
  systemConfig: { maxLevel: 8 },
  entities: [...classes, ...species, ...backgrounds, ...feats, ...spells, ...items, ...conditions, ...GLOSSARY],
};

export default srd52;

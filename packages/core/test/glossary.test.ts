import { describe, expect, it } from "vitest";
import { Engine, Glossary, stripTermMarkup, type RulePack } from "../src";
import { fixturePack } from "./fixture";

const terms: RulePack = {
  id: "terms",
  version: "1",
  system: "dnd5e-2024",
  name: "Terms",
  entities: [
    { id: "rule:advantage", type: "rule", name: { en: "Advantage", zh: "优势" }, text: { en: "Roll two d20s.", zh: "投两枚 d20。" } },
    { id: "rule:action", type: "rule", name: { en: "Action", zh: "动作" }, tags: ["no-autolink"] },
    { id: "rule:bonus-action", type: "rule", name: { en: "Bonus Action", zh: "附赠动作" }, text: { en: "See {{rule:action}}.", zh: "另见{{rule:action|动作}}。" } },
    { id: "rule:attack-roll", type: "rule", name: { en: "Attack Roll", zh: "攻击检定" } },
    { id: "rule:attack", type: "rule", name: { en: "Attack", zh: "攻击" } },
    { id: "condition:prone", type: "condition", name: { en: "Prone", zh: "倒地" } },
  ],
};
const g = new Glossary(new Engine([fixturePack, terms]).reg);
const ids = (toks: ReturnType<Glossary["tokenize"]>) => toks.filter((t) => typeof t !== "string").map((t) => (t as { id: string }).id);

describe("glossary tokenizer", () => {
  it("explicit markup links, with or without a label", () => {
    expect(g.tokenize("另见{{rule:action|动作}}与{{rule:advantage}}。")).toEqual(["另见", { id: "rule:action", label: "动作" }, "与", { id: "rule:advantage" }, "。"]);
  });

  it("unknown explicit ids degrade to their label", () => {
    expect(g.tokenize("x {{rule:nope|无}} y")).toEqual(["x 无 y"]);
  });

  it("auto-links Chinese with longest match first", () => {
    expect(ids(g.tokenize("你的攻击检定具有优势，然后倒地。"))).toEqual(["rule:attack-roll", "rule:advantage", "condition:prone"]);
  });

  it("auto-links English whole words, case-sensitively", () => {
    expect(ids(g.tokenize("You have Advantage on an Attack Roll; advantage again; Disadvantaged"))).toEqual(["rule:advantage", "rule:attack-roll"]);
  });

  it("links each term once and never itself", () => {
    expect(ids(g.tokenize("优势 优势 附赠动作", { selfId: "rule:bonus-action" }))).toEqual(["rule:advantage"]);
  });

  it("respects no-autolink and auto:false", () => {
    expect(ids(g.tokenize("执行一个动作"))).toEqual([]);
    expect(ids(g.tokenize("具有优势", { auto: false }))).toEqual([]);
  });

  it("strips markup for plain text", () => {
    expect(stripTermMarkup("另见{{rule:action|动作}}和{{rule:advantage}}")).toBe("另见动作和advantage");
  });
});

describe("srd glossary content", () => {
  it("non-rule entities are terms but only explicit", () => {
    expect(g.get("species:dwarf")?.autoLink).toBe(false);
    expect(ids(g.tokenize("矮人"))).toEqual([]);
  });
});

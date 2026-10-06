# 规则包与插件制作说明

给想往 Forge 里加内容的人：村规、新专长、新物品、新职业，或者一块新的界面。

- **只改数值、加几件东西**：用应用里的「创造工坊」（设置 → 创造工坊），不用写代码。
- **成批制作、分享给别人**：写一个规则包 JSON，在设置 → 规则包里导入。本页第 1–5 节讲这个。
- **加界面、换主题、换美术**：写插件（源码）。见第 6 节。

写完先自检：

```bash
pnpm validate:pack 你的包.json
```

可以直接复制的模板：[`docs/examples/house-rules.json`](examples/house-rules.json)。它包含一个专长、一件物品、购点上限 17 和一个补丁。

---

## 1. 规则包是什么

一个规则包就是一个 JSON 对象。字段的权威定义在 `packages/core/src/schema/types.ts`，导入时的校验在 `packages/core/src/schema/zod.ts`。

```jsonc
{
  "id": "house:my-table",        // 唯一；再导入同 id 的包会替换旧包（会先询问）
  "version": "1.0.0",
  "system": "dnd5e-2024",         // 目前只有这一个规则系统
  "name": { "en": "My table", "zh": "我们团的村规" },
  "requires": ["srd-5.2.1"],      // 说明依赖，目前只作提示
  "entities": [ ... ],            // 新内容，或同 id 覆盖已有内容
  "patches": [ ... ],             // 修改已有内容的一部分
  "systemConfig": { ... },        // 改系统数值：购点、等级上限、熟练加值表……
  "globalGrants": [ ... ],        // 每个角色都会得到的东西（通用动作等）
  "samples": [ ... ]              // 预设角色（首页「从现成的英雄开始」）
}
```

**加载顺序**：SRD → PHB → 插件带的包 → 你导入的包（按设置里的顺序）→ 本机村规 `local:homebrew`（设置 → 村规写到这里）。

**覆盖规则**：
- 两个包里有相同 `id` 的实体时，**后加载的整个替换**前面的。
- `patches` 修改的是加载到它那一刻的「当前版本」。

**文本**：凡是 `LocalizedText` 的地方，可以写一个字符串，也可以写 `{ "en": "...", "zh": "..." }`。`en` 必填。
- 规则文本里写 `{{rule:advantage|优势}}` 会变成可点的术语链接。id 取自 `packs/srd-5.2.1/src/glossary.generated.ts`。

## 2. 实体类型与必填字段

`id` 惯例写成 `<类型>:<名字>`：`feat:quick-draw`、`item:fire-tonic`、`class:artificer`。用自己的前缀（如 `house-`）可以避免和官方内容撞名。

所有实体都必填 `id`、`type`、`name`，可选 `summary`、`text`、`tags`、`prereq`、`grants`、`repeatable`、`art`、`accent`。各类型另需：

| type | 另需 | 说明 |
|---|---|---|
| `class` | `hitDie` `primaryAbility` `starting` `multiclass` `levels` `subclassLevel` | `levels` 的键是等级字符串 `"1"`…`"20"`，值是该级获得的 grants 列表。`starting` 只给首职，`multiclass` 只给兼职进来的 |
| `subclass` | `classId` `levels` | 子职在 `subclassLevel` 那一级的子职选择里出现 |
| `species` | `size` `speed` | |
| `background` | — | 一般 grants 里放属性选择、技能、起源专长（`{"type":"grant","entity":"feat:..."}`）、起始装备 |
| `feat` | `category`：`origin` / `general` / `fighting-style` / `epic-boon` | 起源专长另加标签 `origin` |
| `spell` | `level` `school` `castingTime` `activation` `range` `components` `duration` | `action` 写攻击、豁免、伤害；`upcast`、`cantripScaling` 写升环和戏法成长；标签 `<职业>` 决定进哪个职业的法术表（如 `wizard`） |
| `item` | `itemType`：`weapon` / `armor` / `gear` / `tool` / `pack` / `focus` | `cost` 写成 `"10 GP"` / `"5 SP"` / `"2 CP"`，商店按它定价；`weapon`、`armor` 写数据；`consumable` + `use` 让它能在背包里直接使用 |
| `condition` / `effect` | — | 状态和增益。grants 在状态生效期间加到角色身上 |
| `rule` | — | 术语表词条；`category` 决定弹窗上的分组标签 |

## 3. 机制：grants

实体靠 `grants` 给角色东西。引擎把角色能触及的所有 grants 收集起来，再算出角色卡。

| type | 作用 | 例子 |
|---|---|---|
| `modifier` | 改一个数值。`op`：`add`（默认，相加）/ `atLeast` / `override` / `base`；可加 `when` 条件 | `{"type":"modifier","target":"ac","value":1,"when":"@equipped.armor"}` |
| `proficiency` | 熟练。`kind`：`save` `skill` `armor` `weapon` `tool` `language` `mastery`；`level` 可写 `half` / `expertise` | `{"type":"proficiency","kind":"skill","key":"stealth"}` |
| `resource` | 可消耗的次数，带恢复规则 | 见示例包的 `house-burst` |
| `action` | 动作卡：攻击、豁免、伤害、治疗、消耗、施加效果 | 见下 |
| `feature` | 有名字的特性，出现在角色卡上；可以嵌套 grants | `tags` 写 `once-per-turn` / `rider`，战斗页的「记得用」区会列出它 |
| `choice` | 让玩家选。`from.kind`：`entity`（从某类实体里选）/ `options`（自定选项）/ `proficiency` / `ability` | `{"type":"choice","id":"skill","name":"技能","count":2,"from":{"kind":"proficiency","profKind":"skill","keys":"any"}}` |
| `grant` | 整个给出另一个实体 | 背景给起源专长 |
| `spellcasting` | 职业施法：属性、进度（`full` / `half` / `third` / `pact`）、法术表标签、备法方式 | |
| `spell` | 直接给一个法术，可设免费施放次数 | 种族、专长法术 |
| `item` | 给物品 | 起始装备 |
| `tag` | 打一个标记，见下表 | `{"type":"tag","tag":"resist:fire"}` |
| `dice` | 额外的骰子：`on` 写加在哪类掷骰上（`attack` / `damage` / `save` / `check`），`dice` 写骰子（可为负，如 `-1d4`），伤害骰可写 `damageType`；`kinds` 限定 `melee` / `ranged` / `spell`；`properties` 限定武器属性（巨武器大师：`["heavy"]`，`dice` 写 `"@prof"` 即固定加值）；`once` 表示用一次就没（如吟游激励） | `{"type":"dice","on":["attack","save"],"dice":"1d4"}`（祝福术） |

**动作**（`action` 里的 `action` 对象，以及法术的 `action`、物品的 `use`）：

```jsonc
{
  "id": "flame-lash", "name": { "en": "Flame Lash", "zh": "火鞭" },
  "activation": "bonus",                  // action / bonus / reaction / free / special / minute / hour
  "cost": [{ "resource": "house-burst" }], // 或 { "slot": 1 }、{ "economy": "reaction" }
  "attack": { "bonus": "@ability.dex.mod + @prof", "kind": "melee" },
  "save": { "ability": "dex", "dc": "8 + @prof + @ability.cha.mod", "onSave": "half" },
  "damage": [{ "dice": "1d6 + @ability.dex.mod", "type": "fire" }],
  "trigger": { "en": "You hit with a weapon", "zh": "以武器命中时" }, // 反应和附加效果写触发条件
  "tags": ["rider", "once-per-turn"],
  "when": "@class.fighter.level >= 3"      // 不满足时不出现
}
```

**常用标签**：

| 标签 | 效果 |
|---|---|
| `resist:<伤害类型>` `immune:<…>` `vuln:<…>` | 角色卡显示抗性、免疫、易伤 |
| `adv:<目标>`、`dis:<目标>` | 角色卡提示优势或劣势。目标如 `save.dex`、`save.concentration`、`skill.stealth`、`check.str`、`attack.spell`、`initiative` |
| `size:<体型>` | 体型 |
| `once-per-turn` `rider` | 战斗页「记得用」提醒，角色卡标「记得用」；带 `rider` 且触发写着 hit（命中）的动作、以及带 `rider` 的法术（斩击类），会出现在武器攻击的「命中后还能追加」里 |
| `shop:<商店 id>` | 物品上架到商店的常备货：`general` 杂货铺、`smith` 铁匠铺、`apothecary` 药剂铺、`arcane` 奥术用品店、`crafts` 工具与乐器 |
| `magic` `consumable` `potion` `rarity:<稀有度>` | 物品分类；带 `magic` 的物品名显示为魔法色 |
| `buff` `suggest:<职业>` / `suggest:all` | 效果（`effect`）带 `buff` 才会出现在角色卡的快捷增益里；`suggest:` 决定默认推荐给哪些职业 |

## 4. 公式

用到数值的地方都可以写公式字符串。公式由安全解析器求值，不会执行代码，实现在 `packages/core/src/formula/index.ts`。

- **运算**：`+ - * / %`、比较（`< <= > >= == !=`）、`&& || !`、`条件 ? a : b`。布尔值就是 1 或 0。
- **函数**：`floor` `ceil` `round` `min` `max` `abs` `clamp` `if` `table`。
- **伤害骰模板**：`"1d8 + @ability.str.mod"` 会直接代入数值；`"[[ceil(@class.rogue.level / 2)]]d6"` 会先算出方括号里的部分。

可以引用的值（在 `packages/core/src/derive/sheet.ts` 中定义）：

| 引用 | 含义 |
|---|---|
| `@level` `@prof` | 角色等级、熟练加值 |
| `@class.<职业>.level` | 某职业等级；没练这个职业时为 0 |
| `@ability.<str…>.score` `.mod` | 属性值、调整值 |
| `@save.<属性>` `@skill.<技能>` `@passive.<技能>` | 豁免、技能、被动值 |
| `@ac` `@initiative` `@hp.max` `@speed.walk` / `fly` / `swim` / `climb` `@sense.darkvision` | 同名数值，也都可以作为 modifier 的 `target` |
| `@attack.melee` / `ranged` / `spell`、`@damage.melee` / `ranged`、`@crit.bonus` | 只给 modifier 当 `target` 用：额外命中、额外伤害、扩大重击范围 |
| `@spell.<职业>.dc` / `.attack` / `.mod` / `.max-level` | 某职业的法术 DC、法术攻击、施法属性调整值、最高可用法术环阶 |
| `@resource.<id>.max` | 资源上限 |
| `@tag.<标签>` | 有这个标签时为 1 |
| `@prof.<kind>.<key>` | 熟练倍数（0、0.5、1、2），如 `@prof.skill.stealth` |
| `@equipped.armor` `@equipped.shield` `@armor.light` / `medium` / `heavy` | 当前装备状态 |

写错的引用（如 `@abilty.dex.mod`）不会报错，只会当作 0，并留下一条警告。`validate:pack` 会把这类警告列出来。

## 5. 常见配方

**新专长**：复制示例包里的 `feat:house-quick-draw`，改 id、名字和 grants。起源专长要有 `"category": "origin"` 和标签 `origin`。

**新物品，并让商店卖它**：
```json
{ "id": "item:house-rope-ladder", "type": "item", "itemType": "gear",
  "name": { "en": "Rope Ladder", "zh": "绳梯" }, "cost": "1 GP", "weight": 25, "tags": ["gear", "shop:general"] }
```

**改购点（村规）**：
```json
"systemConfig": { "pointBuy": { "max": 17, "budget": 30 } }
```
- 16 以上的花费会自动补齐：16 = 12、17 = 15、18 = 19。你在 `cost` 里自己写的数字优先。
- 只是自己团用的话，直接在 设置 → 村规 里点选就行。

**改已有内容（补丁）**，不必复制整个实体：
```jsonc
"patches": [
  { "target": "item:potion-of-healing", "set": { "cost": "40 GP" } },          // 浅合并字段
  { "target": "species:human", "grants": { "add": [{ "type": "tag", "tag": "resist:poison" }] } },
  { "target": "class:fighter", "levels": { "2": { "remove": [{ "type": "feature", "id": "action-surge" }] } } }
]
```
`remove` 的匹配条件可以组合 `type`、`id`、`key`、`target`，写出的条件都满足才会移除。

**给职业加一个特性**：用补丁的 `levels`，给某一级 `add` 一个 `feature`。

**预设角色**：写 `samples`，只列关键决定（职业、种族、背景、属性、部分选择），其余由引擎自动补全。
- 选择的路径形如 `class:fighter@1/weapon-mastery`、`species:human/skillful`。
- 不确定路径时，导出一个角色 JSON，看其中的 `build.choices`。

**新职业或子职**：工作量最大。参考 `packs/srd-5.2.1/src/classes/` 下的写法，写完一定跑 `validate:pack`，它会把职业从 1 级一直建到最高级。

## 6. 插件

插件是**源码**，随应用一起构建。出于安全考虑，目前不支持运行时加载第三方 JS 插件。规则内容请用规则包。

- 契约在 `packages/plugin-api/src/index.ts`。
- 内置插件在 `apps/web/src/plugins/`，有三个可以参考：
  - `themes.ts`：纯数据
  - `art/`：美术包
  - `workshop/`：完整的界面插件

**做法**：在 `apps/web/src/plugins/<名字>/` 导出一个 `AppPlugin`，再加进 `plugins/index.ts` 的 `BUILTIN_PLUGINS`。设置 → 插件 里可以开关它。

```ts
export const myPlugin: AppPlugin = {
  manifest: { id: "my.plugin", version: "1.0.0", name: { en: "My plugin", zh: "我的插件" }, engine: "^0.1.0", kind: "ui" },
  contributes: {
    rulePacks: [myPack],
    slots: [{ id: "my.panel", slot: "sheet.panel", component: MyPanel }],
  },
  setup(host) {
    // 可选：订阅事件、晚些时候再贡献；返回的函数在插件被关闭时调用
    return () => {};
  },
};
```

**实际接通的扩展点**：

| 贡献 | 用途 |
|---|---|
| `rulePacks` | 规则包，排在 SRD/PHB 之后、用户包之前 |
| `themes` | 主题：一组 CSS 变量（`--bg` `--accent`…），设置里可选 |
| `art` | 插画，按实体 id 或 `scene:*` 索引；后加载的覆盖先加载的 |
| `sounds` | 替换提示音：`roll` `land` `crit` `fumble` `heal` `hurt` |
| `slots` | 界面插槽，见下表 |

| slot | 位置 | 组件收到的 props |
|---|---|---|
| `app.page` | 整页，地址 `/p/<slot id>` | — |
| `app.overlay` | 常驻浮层（编辑器、全局弹窗） | — |
| `settings.section` | 设置页的一节 | — |
| `library.action` | 首页顶栏按钮 | — |
| `builder.toolbar` | 车卡页顶栏按钮 | — |
| `sheet.panel` | 角色卡侧栏或资源页 | `character` `sheet` `state` |

**已经定义但还没接通**（写了也不会生效，等后续版本）：
- 贡献项：`locales`、`actionFx`、`diceRenderers`、`importers`、`exporters`
- 宿主事件：只有 `plugins:changed` 会触发；`play:committed`、`dice:rolled`、`theme:changed` 目前没有发出。

## 7. 自检与提交

```bash
pnpm validate:pack docs/examples/house-rules.json   # 换成你的包
pnpm test                                             # 改了引擎或内置包时
```

`validate:pack` 会做这些事：
- 按 schema 校验格式。
- 查找不存在的引用 id 和补丁目标。
- 检查公式能否解析。
- 用包里的职业、子职、种族、背景、专长和状态各建一个示例角色，报告未知引用和构筑错误。

它会对照 SRD 来检查；如果本机有 PHB 数据，也会一起对照。

往仓库提交内容时的规矩：
- **不提交 PHB 衍生文本**。`packs/phb-2024/src/generated/` 已被忽略，请保持这样。
- 新的内置内容写进 `packs/srd-5.2.1/`，只能用 SRD 5.2.1（CC-BY-4.0）里有的内容。
- 改了内置包，跑 `pnpm test`。其中 `golden.test.ts` 会核对几套标准角色的关键数值。

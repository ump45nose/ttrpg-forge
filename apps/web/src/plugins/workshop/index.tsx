import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Hammer } from "lucide-react";
import { useCreator } from "../../app/creator";
import type { AppPlugin } from "../../app/host";
import { useT } from "../../app/i18n";
import { usePacks } from "../../app/packs";
import { Button } from "../../ui/Button";
import { EntityEditor } from "./editor/EntityEditor";
import { WORKSHOP_TYPES } from "./editor/factory";
import { WorkshopPage } from "./WorkshopPage";

export const WORKSHOP_ID = "builtin.workshop";

/** Always mounted: renders the editor whenever anyone calls `openCreator`. */
function EditorHost() {
  const req = useCreator((s) => s.req);
  const close = useCreator((s) => s.close);
  return <EntityEditor req={req} onClose={close} />;
}

function SettingsEntry() {
  const t = useT();
  const navigate = useNavigate();
  const count = usePacks((s) => s.packs.reduce((n, p) => n + (p.origin === "import" ? 0 : p.pack.entities.length), 0));
  return (
    <section className="mt-7">
      <button type="button" onClick={() => navigate({ to: "/p/$page", params: { page: "workshop" } })} className="card flex w-full items-center gap-4 p-4 text-left transition-colors hover:border-accent/50">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/40 bg-accent/10 text-accent">
          <Hammer size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg text-ink">{t("workshop.title")}</span>
          <span className="block text-xs text-ink-3">{t("workshop.settingsHint", { n: count })}</span>
        </span>
        <ChevronRight size={18} className="text-ink-3" />
      </button>
    </section>
  );
}

function ToolbarButton() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <Button variant="ghost" size="icon-sm" onClick={() => navigate({ to: "/p/$page", params: { page: "workshop" } })} aria-label={t("workshop.title")} title={t("workshop.title")}>
      <Hammer size={17} />
    </Button>
  );
}

/**
 * The Creation Workshop: author classes, subclasses, spells, feats, species, backgrounds,
 * items and glossary terms into user packs. Everything it adds to the app goes through
 * plugin slots and the creator contract, so disabling it removes every entry point.
 */
export const workshopPlugin: AppPlugin = {
  manifest: {
    id: WORKSHOP_ID,
    version: "1.0.0",
    name: { en: "Creation Workshop", zh: "创造工坊" },
    description: { en: "Create and house-rule classes, spells, gear and more.", zh: "创作与改造职业、法术、装备等规则内容。" },
    engine: "^0.1.0",
    kind: "ui",
    builtin: true,
  },
  contributes: {
    slots: [
      { id: "workshop", slot: "app.page", title: { en: "Creation Workshop", zh: "创造工坊" }, icon: "hammer", component: WorkshopPage },
      { id: "workshop.editor", slot: "app.overlay", component: EditorHost },
      { id: "workshop.entry", slot: "settings.section", order: 10, component: SettingsEntry },
      { id: "workshop.toolbar", slot: "library.action", component: ToolbarButton },
      { id: "workshop.toolbar", slot: "builder.toolbar", component: ToolbarButton },
    ],
  },
  setup() {
    return useCreator.getState().register([...WORKSHOP_TYPES]);
  },
};

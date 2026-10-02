import { Link, useParams } from "@tanstack/react-router";
import { Puzzle } from "lucide-react";
import { host, useHostRevision } from "./host";
import { useT } from "./i18n";

/** Full-page plugin contributions, routed at /p/<slot id>. */
export function PluginPage() {
  const t = useT();
  useHostRevision();
  const { page } = useParams({ from: "/p/$page" });
  const s = host.slots("app.page").find((x) => x.id === page);
  if (s) return <s.component />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <Puzzle size={32} className="text-ink-3" />
      <p className="text-sm text-ink-2">{t("plugins.pageMissing")}</p>
      <Link to="/settings" className="text-sm text-accent">
        {t("settings.title")}
      </Link>
    </div>
  );
}

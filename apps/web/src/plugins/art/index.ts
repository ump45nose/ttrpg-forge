import type { ArtImage } from "@forge/plugin-api";
import type { AppPlugin } from "../../app/host";
import manifest from "./manifest.json";

/**
 * The built-in illustration pack: classic sourcebook-style oil paintings for
 * classes, subclasses, species, backgrounds, default portraits and a few scenes.
 * Images live in public/art (not precached; cached on first view). Regenerate
 * with tools/art/generate.py + build.py.
 */
export const artPlugin: AppPlugin = {
  manifest: {
    id: "builtin.art-classic",
    version: "1.0.0",
    name: { en: "Classic art pack", zh: "经典美术包" },
    description: { en: "Sourcebook-style illustrations for classes, species, backgrounds and portraits.", zh: "职业、种族、背景与头像的经典设定集风格插画。" },
    engine: "^0.1.0",
    kind: "data",
    builtin: true,
  },
  contributes: {
    art: [{ id: "classic", name: { en: "Classic", zh: "经典" }, images: manifest as Record<string, ArtImage> }],
  },
};

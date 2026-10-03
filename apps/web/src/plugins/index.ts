import type { AppPlugin } from "../app/host";
import { artPlugin } from "./art";
import { themesPlugin } from "./themes";
import { workshopPlugin } from "./workshop";

export const BUILTIN_PLUGINS: AppPlugin[] = [themesPlugin, artPlugin, workshopPlugin];

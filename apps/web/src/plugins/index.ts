import type { AppPlugin } from "../app/host";
import { themesPlugin } from "./themes";
import { workshopPlugin } from "./workshop";

export const BUILTIN_PLUGINS: AppPlugin[] = [themesPlugin, workshopPlugin];

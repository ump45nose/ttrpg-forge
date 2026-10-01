import type { AppPlugin } from "../app/host";
import { themesPlugin } from "./themes";

export const BUILTIN_PLUGINS: AppPlugin[] = [themesPlugin];

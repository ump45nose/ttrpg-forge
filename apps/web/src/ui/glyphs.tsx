import {
  Axe, Ban, BatteryLow, BookOpen, Church, Clover, Cog, Crosshair, EarOff, Eye, EyeOff, Feather, Flame, FlaskConical, Ghost, Hammer, Hand, Heart,
  HeartPulse, KeyRound, Leaf, Link, Maximize, Moon, Mountain, Radar, Shield, ShieldPlus, Shirt, Skull, Sparkle, Sparkles, Sun, Sword, Swords, User,
  VenetianMask, WandSparkles, Wind, Zap, ZapOff, ArrowDown, CircleDot, type LucideIcon,
} from "lucide-react";

const ENTITY: Record<string, LucideIcon> = {
  "class:fighter": Swords,
  "class:rogue": VenetianMask,
  "class:cleric": Sun,
  "class:wizard": WandSparkles,
  "species:dragonborn": Flame,
  "species:dwarf": Hammer,
  "species:elf": Leaf,
  "species:gnome": Cog,
  "species:goliath": Mountain,
  "species:halfling": Clover,
  "species:human": User,
  "species:orc": Axe,
  "species:tiefling": Moon,
  "background:acolyte": Church,
  "background:criminal": KeyRound,
  "background:sage": BookOpen,
  "background:soldier": Shield,
};

const NAMED: Record<string, LucideIcon> = {
  "eye-off": EyeOff, heart: Heart, "ear-off": EarOff, "battery-low": BatteryLow, ghost: Ghost, hand: Hand, ban: Ban, "eye-closed": Eye,
  "zap-off": ZapOff, mountain: Mountain, flask: FlaskConical, "arrow-down": ArrowDown, link: Link, sparkles: Sparkles, moon: Moon,
  shield: Shield, shirt: Shirt, "shield-plus": ShieldPlus, sparkle: Sparkle, wind: Wind, "heart-pulse": HeartPulse, feather: Feather,
  flame: Flame, maximize: Maximize, radar: Radar, skull: Skull, zap: Zap, crosshair: Crosshair, sword: Sword,
};

export function entityGlyph(id: string | undefined): LucideIcon {
  if (!id) return CircleDot;
  return ENTITY[id] ?? (id.startsWith("class:") ? Swords : id.startsWith("species:") ? User : id.startsWith("spell:") ? Sparkles : CircleDot);
}

export function namedGlyph(name: string | undefined): LucideIcon {
  return (name && NAMED[name]) || CircleDot;
}

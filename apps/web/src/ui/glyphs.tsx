import {
  Axe, Ban, BatteryLow, BookOpen, Church, Clover, Cog, Crosshair, EarOff, Eye, EyeOff, Feather, Flame, FlaskConical, Ghost, Hammer, Hand, Heart,
  HeartPulse, KeyRound, Leaf, Link, Maximize, Moon, Mountain, Radar, Shield, ShieldPlus, Shirt, Skull, Sparkle, Sparkles, Sun, Sword, Swords, User,
  VenetianMask, WandSparkles, Wind, Zap, ZapOff, ArrowDown, CircleDot, BicepsFlexed, HandFist, Music, ShieldHalf, Target, Sprout, Orbit,
  Wrench, Drama, Wheat, ShieldCheck, Compass, Tent, Coins, Crown, Anchor, PenTool, Footprints, Sunrise, type LucideIcon,
} from "lucide-react";

const ENTITY: Record<string, LucideIcon> = {
  "class:barbarian": BicepsFlexed,
  "class:bard": Music,
  "class:cleric": Sun,
  "class:druid": Sprout,
  "class:fighter": Swords,
  "class:monk": HandFist,
  "class:paladin": ShieldHalf,
  "class:ranger": Target,
  "class:rogue": VenetianMask,
  "class:sorcerer": Zap,
  "class:warlock": Orbit,
  "class:wizard": WandSparkles,
  "species:aasimar": Sunrise,
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
  "background:artisan": Wrench,
  "background:charlatan": Drama,
  "background:entertainer": Music,
  "background:farmer": Wheat,
  "background:guard": ShieldCheck,
  "background:guide": Compass,
  "background:hermit": Tent,
  "background:merchant": Coins,
  "background:noble": Crown,
  "background:sailor": Anchor,
  "background:scribe": PenTool,
  "background:wayfarer": Footprints,
};

const NAMED: Record<string, LucideIcon> = {
  "eye-off": EyeOff, heart: Heart, "ear-off": EarOff, "battery-low": BatteryLow, ghost: Ghost, hand: Hand, ban: Ban, "eye-closed": Eye,
  "zap-off": ZapOff, mountain: Mountain, flask: FlaskConical, "arrow-down": ArrowDown, link: Link, sparkles: Sparkles, moon: Moon,
  shield: Shield, shirt: Shirt, "shield-plus": ShieldPlus, sparkle: Sparkle, wind: Wind, "heart-pulse": HeartPulse, feather: Feather,
  flame: Flame, sun: Sun, maximize: Maximize, radar: Radar, skull: Skull, zap: Zap, crosshair: Crosshair, sword: Sword,
  compass: Compass, music: Music, leaf: Leaf, footprints: Footprints, crown: Crown,
};

export function entityGlyph(id: string | undefined): LucideIcon {
  if (!id) return CircleDot;
  return ENTITY[id] ?? (id.startsWith("class:") ? Swords : id.startsWith("species:") ? User : id.startsWith("spell:") ? Sparkles : CircleDot);
}

export function namedGlyph(name: string | undefined): LucideIcon {
  return (name && NAMED[name]) || CircleDot;
}

import {
  Award,
  BadgeCheck,
  Clock,
  Flame,
  Gift,
  Heart,
  Megaphone,
  Percent,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  Truck,
  Zap
} from "lucide-react";

/** Curated icon choices for a promo card — kept to a safe, recognizable set. */
export const PROMO_CARD_ICONS = [
  { key: "percent", icon: Percent },
  { key: "truck", icon: Truck },
  { key: "megaphone", icon: Megaphone },
  { key: "award", icon: Award },
  { key: "gift", icon: Gift },
  { key: "tag", icon: Tag },
  { key: "star", icon: Star },
  { key: "sparkles", icon: Sparkles },
  { key: "clock", icon: Clock },
  { key: "zap", icon: Zap },
  { key: "thumbsUp", icon: ThumbsUp },
  { key: "flame", icon: Flame },
  { key: "heart", icon: Heart },
  { key: "badgeCheck", icon: BadgeCheck }
];

/** Curated color choices — same tone system StudioInfoCard already themes with. */
export const PROMO_CARD_TONES = [
  { key: "wine", label: "زرشکی", swatch: "#7c2740" },
  { key: "gold", label: "طلایی", swatch: "#ad7f2e" },
  { key: "success", label: "سبز", swatch: "#3f7a52" },
  { key: "info", label: "آبی", swatch: "#378add" },
  { key: "danger", label: "قرمز", swatch: "#a8433a" },
  { key: "purple", label: "بنفش", swatch: "#6d3ee8" },
  { key: "teal", label: "فیروزه‌ای", swatch: "#1f8a8a" }
];

export function getPromoCardIcon(key) {
  return PROMO_CARD_ICONS.find((entry) => entry.key === key)?.icon || Star;
}

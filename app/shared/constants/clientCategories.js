import { skillGroupsForService } from "../lib/serviceSkills.js";

/**
 * What a client usually comes for, as the tiles on the salons tab. Each tile covers one or more of the
 * skill groups in serviceSkills.js, so «مو» means any hair service. `icon` is a beautyEmoji id.
 */
export const CLIENT_CATEGORIES = [
  { id: "nails", label: "ناخن", icon: "gel_nails", groups: ["nails"] },
  { id: "hair", label: "مو", icon: "haircut", groups: ["hair_cut_style", "hair_color", "hair_treatment", "hair_extension"] },
  { id: "brows", label: "ابرو و مژه", icon: "eyebrow", groups: ["brow_lash"] },
  { id: "makeup", label: "میکاپ", icon: "lipstick", groups: ["makeup"] },
  { id: "bridal", label: "عروس", icon: "bridal", groups: ["bridal"] },
  { id: "skin", label: "پوست", icon: "facial", groups: ["skin"] },
  { id: "injection", label: "تزریق و فیلر", icon: "injection", groups: ["clinic"] },
  { id: "removal", label: "لیزر و وکس", icon: "waxing", groups: ["laser", "waxing"] },
  { id: "spa", label: "ماساژ و اسپا", icon: "massage", groups: ["body_spa"] },
  { id: "tattoo", label: "تتو", icon: "tattoo", groups: ["tattoo"] },
  { id: "piercing", label: "پیرسینگ", icon: "piercing", groups: ["piercing"] }
];

export function findClientCategory(id) {
  return CLIENT_CATEGORIES.find((category) => category.id === String(id || "")) || null;
}

/** Whether a service (`{ name, emoji? }`) is one of this category's. */
export function serviceInCategory(service, category) {
  if (!category) return false;
  return skillGroupsForService(service).some((group) => category.groups.includes(group));
}

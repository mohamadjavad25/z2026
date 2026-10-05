/** Placeholder pictures for profiles that haven't uploaded one. Salons get their own emblem (a salon mirror); everyone else the person silhouette. */
export const DEFAULT_PERSON_AVATAR = "/profile-icon.svg";
export const DEFAULT_SALON_LOGO = "/salon-logo-default.svg";

export function defaultAvatarFor(type) {
  return type === "salon" ? DEFAULT_SALON_LOGO : DEFAULT_PERSON_AVATAR;
}

export function isDefaultAvatar(src) {
  const value = String(src || "");
  return !value || value.includes(DEFAULT_PERSON_AVATAR) || value.includes(DEFAULT_SALON_LOGO);
}

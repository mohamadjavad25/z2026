/**
 * «نظر و پیشنهاد» in support (owner 2026-11-06): a person picks a part of frfro, says what it was and, if they want,
 * gives it stars. It lands in the normal support inbox. Used by the form and by the server, so both agree on the lists.
 * «پیدا کردن سالن یا آرتیست» is left out of the client's list until that part is switched on for clients.
 */
export const FEEDBACK_KINDS = ["مشکل داشتم", "پیشنهاد دارم", "خوشم اومد"];

export const FEEDBACK_SECTIONS = {
  artist: ["نمونه‌کار", "خدمت‌ها و قیمت‌ها", "ساعت کاری", "نوبت‌ها", "مشتری‌ها", "اعلان‌ها", "کجاست؟", "اشتراک", "کل اپ"],
  salon: ["نمونه‌کار", "خدمت‌ها و قیمت‌ها", "ساعت کاری", "تیم", "نوبت‌ها", "مشتری‌ها", "اعلان‌ها", "کجاست؟", "اشتراک", "کل اپ"],
  client: ["نوبت گرفتن", "اعلان‌ها", "کجاست؟", "پروفایل من", "کل اپ"]
};

export const sectionsFor = (role) => FEEDBACK_SECTIONS[role] || FEEDBACK_SECTIONS.client;

/** Every section any role can pick, for checking what a phone sends. */
export const ALL_FEEDBACK_SECTIONS = [...new Set(Object.values(FEEDBACK_SECTIONS).flat())];

export const feedbackSubject = (section) => `نظر دربارهٔ «${section}»`;

/** The line shown at the top of a feedback chat, so the person knows this is the support chat for good. */
export const FEEDBACK_THANKS = "نظرت رسید، مرسی. از این به بعد هر چی خواستی بگی یا بپرسی، همین‌جا بنویس. جوابمون هم همین‌جا می‌رسه.";

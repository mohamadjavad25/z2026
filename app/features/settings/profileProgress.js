/**
 * «کارهای مونده» at the top of Settings: which of the few things that make a profile findable are still undone.
 * Pure, so it is unit-tested (tests/unit/profileProgress.test.js). `target` says what the «+» opens.
 */
export function profileTodos({ type, data = {}, hasDefaultAvatar = true, openDaysCount = 0 }) {
  const isSalon = type === "salon";
  const isPro = isSalon || type === "artist";
  const hasLocation = Boolean(String(data.area || "").trim());
  if (!isPro) {
    return [
      { key: "avatar", label: "عکست رو بذار", done: !hasDefaultAvatar, target: "avatar" },
      { key: "email", label: "ایمیلت رو بذار", done: Boolean(String(data.email || "").trim()), target: "edit" },
      { key: "location", label: "جات رو روی نقشه بذار", done: hasLocation, target: "location" }
    ];
  }
  return [
    { key: "avatar", label: isSalon ? "لوگو بذار" : "عکست رو بذار", done: !hasDefaultAvatar, target: "avatar" },
    { key: "poster", label: "یه پوستر بذار", done: Boolean(data.poster), target: "poster" },
    { key: "location", label: "جات رو روی نقشه بذار", done: hasLocation, target: "location" },
    { key: "hours", label: "ساعت کاریت رو بذار", done: openDaysCount > 0, target: "hours" },
    { key: "instagram", label: "اینستاگرامت رو وصل کن", done: Boolean(String(data.instagram || "").trim()), target: "instagram" }
  ];
}

export function progressOf(todos) {
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 100, left: todos.filter((t) => !t.done) };
}

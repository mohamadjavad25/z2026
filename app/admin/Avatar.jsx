/** A round-rect initial in a hue derived from the name, so the same person always looks the same. */
export function Avatar({ name = "", phone = "" }) {
  const label = String(name || "").trim() || String(phone || "");
  const initial = Array.from(label)[0] || "؟";
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.codePointAt(0)) % 360;
  return <span className="admAvatar" style={{ "--h": hash }} aria-hidden="true">{initial}</span>;
}

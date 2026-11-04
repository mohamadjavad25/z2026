import { ServiceIcon } from "../../components/ServiceIcon";

/**
 * The moving picture at the top of the about page (replaces the old video, 2026-11-04). Pure CSS motion, no video file,
 * no frame and no app screens: soft pink and violet light drifts behind paper sheets that slide in one at a time, each
 * with one icon and one short line (find, see, book, connect). Styles and the 14-second loop: styles/features/landingMotion.css.
 * Visitors who asked for less motion get the first sheet standing still.
 */
const SCENES = [
  { word: "پیدا کن", line: "سالن و آرتیست نزدیکت", icon: "manicure" },
  { word: "ببین", line: "نمونه‌کار واقعی", icon: "highlights" },
  { word: "نوبت بگیر", line: "ساعت آزاد، یه لمس", icon: "eyebrow" },
  { word: "وصل شو", line: "به سالن محبوبت", icon: "bridal" }
];

export function HeroMotion() {
  return (
    <div className="heroMotion" role="img" aria-label="پیدا کن، ببین، نوبت بگیر، وصل شو">
      <i className="heroMotion__glow is-pink" aria-hidden="true" />
      <i className="heroMotion__glow is-violet" aria-hidden="true" />
      {SCENES.map((scene, index) => (
        <div key={scene.word} className={`heroMotion__scene is-${index}`} aria-hidden="true">
          <span className="heroMotion__sheet is-back" />
          <span className="heroMotion__sheet is-front">
            <ServiceIcon emoji={scene.icon} size="xl" />
            <strong>{scene.word}</strong>
            <span>{scene.line}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

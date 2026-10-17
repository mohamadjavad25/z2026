import { MapPin, Sparkles, UserRound } from "lucide-react";

/**
 * A small looping animation + «به زودی» for a feature that is not open yet (system suggestions
 * of salons and artists). Pure CSS motion (see styles/features/comingSoon.css); it stops under
 * `prefers-reduced-motion`.
 *
 * Props:
 *  - title: what is coming
 *  - text: one plain line under it
 *  - className: extra class on the card
 */
export function ComingSoon({ title, text, className = "" }) {
  return (
    <div className={`csoon ${className}`.trim()} role="status">
      <div className="csoonStage" aria-hidden="true">
        <span className="csoonRing is-a" />
        <span className="csoonRing is-b" />
        <span className="csoonRing is-c" />
        <span className="csoonOrbit is-one"><i><UserRound size={13} /></i></span>
        <span className="csoonOrbit is-two"><i><MapPin size={13} /></i></span>
        <span className="csoonOrbit is-three"><i><UserRound size={13} /></i></span>
        <span className="csoonCore"><Sparkles size={26} /></span>
      </div>
      <span className="csoonPill">به زودی</span>
      <b className="csoonTitle">{title}</b>
      {text ? <span className="csoonText">{text}</span> : null}
    </div>
  );
}

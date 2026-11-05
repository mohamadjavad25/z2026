"use client";

import { useEffect, useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";

/**
 * The moving picture at the top of the about page (2026-11-05, owner: «کارتی»: cards, no frame, no words, no mascot,
 * no app screens, drawn straight on the page's own background). Six glossy service cards, each with the brand's own
 * service icon. Three ways to move them, all pure CSS and all looping without a jump (styles: landingMotion.css):
 *   drift  two columns of cards drifting in opposite directions (the default: always full, no odd angle)
 *   ring   a turning ring of cards in 3D (one smooth turn every 30 s)
 *   deck   a fanned deck, the front card flies off and returns at the back
 * The owner left the choice to Claude; `?m=ring` or `?m=deck` on the page shows the others while comparing.
 */
const CARDS = [
  { icon: "manicure", tone: "blend" },
  { icon: "highlights", tone: "white" },
  { icon: "lipstick", tone: "ink" },
  { icon: "eyebrow", tone: "violet" },
  { icon: "facial", tone: "soft" },
  { icon: "bridal", tone: "mist" }
];
const VARIANTS = ["ring", "deck", "drift"];

function Card({ card, index }) {
  return (
    <div className={`hmCard is-${card.tone}`} style={{ "--i": index }}>
      <span className="hmHalo" aria-hidden="true" />
      <ServiceIcon emoji={card.icon} size="xl" className="hmIcon" style={{ "--svc-tile": "34cqw" }} />
      <span className="hmDots" aria-hidden="true"><i /><i /><i /></span>
      <span className="hmSheen" aria-hidden="true" />
    </div>
  );
}

export function HeroMotion() {
  const [variant, setVariant] = useState("drift");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("m");
    if (VARIANTS.includes(wanted)) setVariant(wanted);
  }, []);

  return (
    <div className={`heroMotion is-${variant}`} role="img" aria-label="کارت‌های خدمت‌های زیبایی">
      <i className="hmGlow is-pink" aria-hidden="true" />
      <i className="hmGlow is-violet" aria-hidden="true" />
      {variant === "ring" ? (
        <div className="hmStage" aria-hidden="true">
          <div className="hmRing">
            <div className="hmSpin">
              {CARDS.map((card, index) => <Card key={card.icon} card={card} index={index} />)}
            </div>
          </div>
          <i className="hmFloor" />
        </div>
      ) : null}
      {variant === "deck" ? (
        <div className="hmStage" aria-hidden="true">
          {CARDS.map((card, index) => <Card key={card.icon} card={card} index={index} />)}
        </div>
      ) : null}
      {variant === "drift" ? (
        <div className="hmCols" aria-hidden="true">
          {[0, 1].map((column) => (
            <div key={column} className={`hmTrack is-${column}`}>
              {[...CARDS.slice(column * 2), ...CARDS.slice(0, column * 2), ...CARDS.slice(column * 2), ...CARDS.slice(0, column * 2)].map((card, index) => (
                <Card key={`${card.icon}-${index}`} card={card} index={index} />
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

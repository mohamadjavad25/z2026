"use client";

import { useEffect, useRef } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";

/**
 * The moving picture at the top of the about page (owner, 2026-11-05: «کارتی», no frame, no words, no mascot, no app
 * screens, on the page's own background, and one scenario that changes shape). Six glossy cards, each with the brand's own
 * service icon, play one 18-second story that loops without a jump: two columns drift in opposite directions, gather into a
 * deck, the deck flips twice, fans open into a turning 3D ring, then the cards spread back into the columns.
 * Every card's pose is computed from the clock (pure functions below, drawn with transform and opacity only), so each
 * change of shape is a real morph. Styles: styles/features/landingMotion.css. Stops while off screen and, for visitors who
 * asked for less motion, stands still as the deck.
 */
const CARDS = [
  { icon: "manicure", tone: "blend" },
  { icon: "highlights", tone: "white" },
  { icon: "lipstick", tone: "ink" },
  { icon: "eyebrow", tone: "violet" },
  { icon: "facial", tone: "soft" },
  { icon: "bridal", tone: "mist" }
];

const LOOP = 18;
const PERIOD = 174; // one column's scroll length (three cards plus gaps), in cqw
const STEP = 58;
const SEGMENTS = [
  [0, 4, "drift"],
  [4, 6.4, "drift>deck"],
  [6.4, 10.6, "deck"],
  [10.6, 13, "deck>ring"],
  [13, 16.4, "ring"],
  [16.4, 18, "ring>drift"]
];
const DECK_SCALE = 1.18;
const RING_RADIUS = 38;
const DECK_FRONT_AT_RING = 2; // the deck's front card after two flips: it becomes the ring's front card

const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (A, B, t) => ({ x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t), z: lerp(A.z, B.z, t), ry: lerp(A.ry, B.ry, t), rz: lerp(A.rz, B.rz, t), s: lerp(A.s, B.s, t), o: lerp(A.o, B.o, t) });
const wrapAngle = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

function driftPose(i, t) {
  const col = i % 2;
  const k = Math.floor(i / 2);
  const dir = col ? -1 : 1;
  const v = k * STEP + dir * (t / LOOP) * PERIOD;
  const y = ((((v + PERIOD / 2) % PERIOD) + PERIOD) % PERIOD) - PERIOD / 2;
  const x = col ? 22 : -22;
  const a = (-7 * Math.PI) / 180;
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a), z: 0, ry: 0, rz: -7, s: 1, o: 1 - clamp((Math.abs(y) - 40) / 38) };
}
const shiftAt = (t) => ease(clamp((t - 7.2) / 1)) + ease(clamp((t - 9.4) / 1));
const fan = (k) => ({ x: -3 * k + 2, y: -3.6 * k + 3, z: -3 * k, ry: 0, rz: -3.5 * k, s: DECK_SCALE * (1 - 0.05 * k), o: 1 });
const EXIT = { x: 26, y: 16, z: 10, ry: 0, rz: 16, s: DECK_SCALE * 1.04, o: 0 };
function deckPose(i, t) {
  const r = ((((i - shiftAt(t) + 1) % 6) + 6) % 6) - 1;
  if (r < 0) {
    const pose = mix(fan(0), EXIT, ease(-r));
    pose.o = 1 - clamp((-r - 0.3) / 0.45);
    return pose;
  }
  const pose = fan(r);
  pose.o = r > 4 ? clamp(5 - r) : 1;
  return pose;
}
const ringTurn = (t) => 360 * ease(clamp((t - 10.6) / (16.4 - 10.6)));
function ringPose(i, t) {
  const theta = wrapAngle((i - DECK_FRONT_AT_RING) * 60 + ringTurn(t));
  const a = (theta * Math.PI) / 180;
  return { x: Math.sin(a) * RING_RADIUS, y: 0, z: Math.cos(a) * RING_RADIUS - RING_RADIUS * 0.4, ry: theta, rz: 0, s: 1, o: 1 };
}
const stagger = (u, i) => clamp(u * 1.55 - 0.55 * (i / 5));

function poseOf(i, t) {
  for (const [from, to, name] of SEGMENTS) {
    if (t < from || t >= to) continue;
    const u = (t - from) / (to - from);
    if (name === "drift") return driftPose(i, t);
    if (name === "deck") return deckPose(i, t);
    if (name === "ring") return ringPose(i, t);
    const e = ease(stagger(u, i));
    if (name === "drift>deck") return mix(driftPose(i, t), deckPose(i, t), e);
    if (name === "deck>ring") return mix(deckPose(i, t), ringPose(i, t), e);
    return mix(ringPose(i, t), driftPose(i, t), e);
  }
  return driftPose(i, t);
}
function ringWeight(t) {
  if (t >= 13 && t < 16.4) return 1;
  if (t >= 10.6 && t < 13) return ease((t - 10.6) / 2.4);
  if (t >= 16.4) return 1 - ease((t - 16.4) / 1.6);
  return 0;
}

export function HeroMotion() {
  const root = useRef(null);
  const cardRefs = useRef([]);
  const world = useRef(null);
  const floor = useRef(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return undefined;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t = calm ? 7.6 : 0;
    let last = 0;
    let frame = 0;
    let visible = true;

    function paint() {
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const p = poseOf(i, t);
        el.style.transform = `translate3d(${p.x.toFixed(2)}cqw, ${p.y.toFixed(2)}cqw, ${p.z.toFixed(2)}cqw) rotateY(${p.ry.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg) scale(${p.s.toFixed(3)})`;
        el.style.opacity = clamp(p.o).toFixed(3);
      });
      const ring = ringWeight(t);
      if (world.current) world.current.style.transform = `rotateX(${(-9 * ring).toFixed(2)}deg)`;
      if (floor.current) floor.current.style.opacity = (ring * 0.9).toFixed(2);
    }
    function tick(now) {
      if (visible && !calm) {
        if (last) t = (t + Math.min(now - last, 100) / 1000) % LOOP;
        paint();
      }
      last = now;
      frame = requestAnimationFrame(tick);
    }
    paint();
    if (!calm) frame = requestAnimationFrame(tick);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; }, { threshold: 0.05 });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={root} className="heroMotion" role="img" aria-label="کارت‌های خدمت‌های زیبایی">
      <i className="hmGlow is-pink" aria-hidden="true" />
      <i className="hmGlow is-violet" aria-hidden="true" />
      <i ref={floor} className="hmFloor" aria-hidden="true" />
      <div className="hmScene" aria-hidden="true">
        <div ref={world} className="hmWorld">
          {CARDS.map((card, index) => (
            <div key={card.icon} ref={(el) => { cardRefs.current[index] = el; }} className={`hmCard is-${card.tone}`}>
              <span className="hmHalo" />
              <ServiceIcon emoji={card.icon} size="xl" className="hmIcon" style={{ "--svc-tile": "34cqw" }} />
              <span className="hmDots"><i /><i /><i /></span>
              <span className="hmSheen" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

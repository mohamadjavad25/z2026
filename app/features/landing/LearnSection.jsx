"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Palette, Pause, Play, RotateCcw, Search, Store } from "lucide-react";
import { LEARN_ROLES, SCENE_MS, tutorialSeconds } from "./tutorials";
import { TutorialScreen, TutorialSheet } from "./TutorialScreen";

/**
 * «آموزش» on the about page: short silent "screen recordings" for clients, salons and artists.
 * Not video files: each tutorial is a script (tutorials.js) played on a mock phone, with a
 * finger that taps the real button names, a caption per step and video-style controls.
 * Plays only while on screen (and never by itself when the visitor asked for less motion).
 * The landing page is mounted on every page (hidden on phone pages), so nothing runs while hidden.
 */

const ROLE_ICONS = { client: Search, salon: Store, artist: Palette };
const toFa = (value) => String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[digit]);

function sceneMs(scene) {
  return scene.ms || SCENE_MS;
}

/** Offset of `node` inside `root`, ignoring transforms (screens slide in while we measure). */
function offsetWithin(node, root) {
  let x = node.offsetWidth / 2;
  let y = node.offsetHeight / 2;
  let current = node;
  while (current && current !== root) {
    x += current.offsetLeft;
    y += current.offsetTop;
    current = current.offsetParent;
  }
  return current === root ? { x, y } : null;
}

export function LearnSection({ icons = {} }) {
  const [roleId, setRoleId] = useState(LEARN_ROLES[0].id);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [run, setRun] = useState(0); // bumps on every scene start so a replayed scene animates again
  const [epoch, setEpoch] = useState(0); // bumps when a tutorial (re)starts, so its first screen slides in again
  const [touch, setTouch] = useState(null);

  const role = LEARN_ROLES.find((item) => item.id === roleId) || LEARN_ROLES[0];
  const tutorial = role.tutorials[tutorialIndex] || role.tutorials[0];
  const scene = tutorial.scenes[sceneIndex] || tutorial.scenes[0];
  const sceneKey = `${tutorial.id}:${sceneIndex}:${run}`;

  const stageRef = useRef(null);
  const screenRef = useRef(null);
  const remaining = useRef(sceneMs(scene));
  const keyRef = useRef(sceneKey);
  const visible = useRef(false);
  const userPaused = useRef(false);
  const calm = useRef(false);
  const endedRef = useRef(false);
  endedRef.current = ended;

  const show = useCallback((nextTutorial, nextScene) => {
    const target = nextTutorial.scenes[nextScene];
    remaining.current = sceneMs(target);
    setEnded(false);
    setRun((value) => value + 1);
    setSceneIndex(nextScene);
  }, []);

  // keyRef follows the scene being shown, so a timer cleanup knows whether its scene is still on.
  keyRef.current = sceneKey;

  // Scene timer: pausing keeps what is left of the scene, resuming plays only that.
  useEffect(() => {
    if (!playing) return undefined;
    const startedFor = sceneKey;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      if (sceneIndex + 1 < tutorial.scenes.length) {
        show(tutorial, sceneIndex + 1);
      } else {
        setPlaying(false);
        setEnded(true);
      }
    }, Math.max(remaining.current, 60));
    return () => {
      window.clearTimeout(timer);
      if (keyRef.current === startedFor) remaining.current -= Date.now() - startedAt;
    };
  }, [playing, sceneKey, sceneIndex, tutorial, show]);

  // Play while at least half of the player is on screen; stop when it leaves or the tab is hidden.
  useEffect(() => {
    calm.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (!entry.isIntersecting) setPlaying(false);
      else if (!userPaused.current && !calm.current && !endedRef.current) setPlaying(true);
    }, { threshold: 0.5 });
    observer.observe(stage);
    const onVisibility = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Move the finger to this scene's target (measured after the screen is laid out).
  useLayoutEffect(() => {
    const root = screenRef.current;
    if (!root || !scene.tap) {
      setTouch((current) => (current ? { ...current, hidden: true } : null));
      return;
    }
    const node = root.querySelector(`[data-tap="${scene.tap}"]`);
    const point = node ? offsetWithin(node, root) : null;
    setTouch(point ? { ...point, hidden: false } : null);
  }, [sceneKey, scene.tap]);

  function startTutorial(nextRole, nextIndex, autoplay = true) {
    const nextTutorial = nextRole.tutorials[nextIndex];
    setRoleId(nextRole.id);
    setTutorialIndex(nextIndex);
    setTouch(null);
    setEpoch((value) => value + 1);
    show(nextTutorial, 0);
    userPaused.current = !autoplay;
    setPlaying(autoplay && visible.current);
  }

  function togglePlay() {
    if (ended) {
      startTutorial(role, tutorialIndex);
      return;
    }
    userPaused.current = playing;
    setPlaying(!playing);
  }

  function jumpTo(index) {
    show(tutorial, index);
    userPaused.current = false;
    setPlaying(true);
  }

  // Typing and the finger's press share the scene: typing into the tapped field starts after the
  // press; typing elsewhere goes first and the press waits for it.
  const typed = [...scene.els, ...(scene.sheet?.els || [])].find((el) => el.type);
  const typesFirst = typed && typed.id !== scene.tap;
  const timing = { "--press": typesFirst ? "1.75s" : "0.95s", "--type-delay": typed && !typesFirst ? "1.15s" : "0.3s" };

  const nextIndex = tutorialIndex + 1 < role.tutorials.length ? tutorialIndex + 1 : -1;
  const seconds = tutorialSeconds(tutorial);

  return (
    <div className={`learn is-${role.id}`}>
      <div className="learn__roles" role="tablist" aria-label="آموزش برای">
        {LEARN_ROLES.map((item) => {
          const Icon = ROLE_ICONS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === role.id}
              className={item.id === role.id ? "is-on" : ""}
              onClick={() => startTutorial(item, 0)}
            >
              <Icon size={18} aria-hidden="true" />
              برای {item.label}
            </button>
          );
        })}
      </div>

      <div className="learn__layout">
        <div className="learn__player">
          <div ref={stageRef} className={`learn__stage${playing ? "" : " is-paused"}`}>
            <div className="learn__glow" aria-hidden="true" />
            <div className="learn__phone" aria-hidden="true">
              <div className="lsStatusBar"><span>۹:۴۱</span><i /></div>
              <div ref={screenRef} className="lsScreen" style={timing}>
                <div key={`${tutorial.id}:${scene.screen}:${epoch}`} className="lsScreenSlide">
                  <TutorialScreen scene={scene} icons={icons} />
                </div>
                {scene.sheet ? (
                  <>
                    <div className="lsScrim" />
                    <TutorialSheet key={`${tutorial.id}:${scene.sheet.title}`} sheet={scene.sheet} tap={scene.tap} icons={icons} />
                  </>
                ) : null}
                {scene.toast ? (
                  <div key={`toast-${sceneKey}`} className="lsToast"><span>✓</span>{scene.toast}</div>
                ) : null}
                {touch ? (
                  <span className={`lsTouch${touch.hidden ? " is-hidden" : ""}`} style={{ "--tx": `${touch.x}px`, "--ty": `${touch.y}px` }}>
                    <i key={sceneKey} />
                  </span>
                ) : null}
              </div>
            </div>

            <p key={`say-${sceneKey}`} className="learn__caption" aria-hidden="true">{scene.say}</p>

            {ended ? (
              <div className="learn__end">
                <strong>«{tutorial.title}» تمام شد</strong>
                <div>
                  <button type="button" className="learn__endBtn is-ghost" onClick={() => startTutorial(role, tutorialIndex)}>
                    <RotateCcw size={16} aria-hidden="true" /> دوباره
                  </button>
                  {nextIndex >= 0 ? (
                    <button type="button" className="learn__endBtn" onClick={() => startTutorial(role, nextIndex)}>
                      بعدی: {role.tutorials[nextIndex].title} ←
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="learn__controls">
            <button type="button" className="learn__play" onClick={togglePlay} aria-label={ended ? "پخش دوباره" : playing ? "توقف" : "پخش"}>
              {ended ? <RotateCcw size={18} aria-hidden="true" /> : playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            </button>
            <div className="learn__bar" aria-hidden="true">
              {tutorial.scenes.map((item, index) => (
                <span key={index} className={index < sceneIndex || ended ? "is-done" : ""}>
                  {index === sceneIndex && !ended ? (
                    <i key={sceneKey} className={playing ? "" : "is-paused"} style={{ animationDuration: `${sceneMs(item)}ms` }} />
                  ) : null}
                </span>
              ))}
            </div>
            <span className="learn__time">{toFa(sceneIndex + 1)}/{toFa(tutorial.scenes.length)}</span>
          </div>
        </div>

        <div className="learn__side">
          <ul className="learn__list">
            {role.tutorials.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={index === tutorialIndex ? "is-on" : ""}
                  aria-current={index === tutorialIndex ? "true" : undefined}
                  onClick={() => startTutorial(role, index)}
                >
                  <span className="learn__num">{toFa(index + 1)}</span>
                  <span className="learn__listText">
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </span>
                  <span className="learn__dur">{toFa(tutorialSeconds(item))} ثانیه</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="learn__steps">
            <p className="learn__stepsHead">
              مرحله‌به‌مرحله: <strong>{tutorial.title}</strong>
              <span> · {toFa(seconds)} ثانیه</span>
            </p>
            <ol>
              {tutorial.scenes.map((item, index) => (
                <li key={index}>
                  <button type="button" className={index === sceneIndex ? "is-on" : index < sceneIndex ? "is-done" : ""} onClick={() => jumpTo(index)}>
                    {item.say}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

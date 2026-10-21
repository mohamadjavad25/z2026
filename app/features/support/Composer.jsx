"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Mic, Plus, Send, Square, Trash2, X } from "lucide-react";
import { VoicePlayer } from "./Attachments";
import { MAX_IMAGES, canRecordVoice, duration, loadVoiceEncoder, prepareImage, useVoiceRecorder } from "./media";

/** Whether this device can record; if so the MP3 encoder starts loading now, so the first tap records at once. */
function useCanVoice() {
  const [canVoice, setCanVoice] = useState(false);
  useEffect(() => {
    const ok = canRecordVoice();
    setCanVoice(ok);
    if (ok) loadVoiceEncoder().catch(() => {});
  }, []);
  return canVoice;
}

/** Turns picked or pasted files into ready-to-send pictures, keeping at most MAX_IMAGES. */
async function addImages(files, current, setImages, setError) {
  const room = MAX_IMAGES - current.length;
  const list = [...files].filter((file) => file.type?.startsWith("image/"));
  if (!list.length) return;
  if (list.length > room) setError("در هر پیام حداکثر ۴ عکس می‌شود فرستاد.");
  const ready = [];
  for (const file of list.slice(0, Math.max(room, 0))) {
    try {
      ready.push({ kind: "image", data: await prepareImage(file) });
    } catch (failure) {
      setError(failure.message || "این عکس آماده نشد.");
    }
  }
  if (ready.length) setImages((prev) => [...prev, ...ready].slice(0, MAX_IMAGES));
}

function PickedImages({ images, onRemove }) {
  if (!images.length) return null;
  return (
    <ul className="scPicked" aria-label="عکس‌های آمادهٔ ارسال">
      {images.map((image, index) => (
        <li key={index}>
          <img src={image.data} alt="" />
          <button type="button" onClick={() => onRemove(index)} aria-label="برداشتن عکس"><X size={14} aria-hidden="true" /></button>
        </li>
      ))}
    </ul>
  );
}

/** While recording: throw away, a red dot with the time and live level bars, and stop-and-send. */
function RecordingBar({ recorder, onSend, sendLabel = "ارسال پیام صوتی", stopOnly = false }) {
  const bars = useRef(Array.from({ length: 22 }, () => 0.15));
  const [, redraw] = useState(0);
  useEffect(() => {
    bars.current = [...bars.current.slice(1), Math.max(0.12, recorder.level)];
    redraw((n) => n + 1);
  }, [recorder.level]);
  return (
    <div className="scRecRow" role="group" aria-label="در حال ضبط صدا">
      <button type="button" className="scIconBtn is-danger" onClick={recorder.cancel} aria-label="حذف ضبط"><Trash2 size={19} aria-hidden="true" /></button>
      <div className="scRecLive">
        <i className="scRecDot" aria-hidden="true" />
        <span className="scRecTime" aria-live="off">{duration(recorder.elapsed)}</span>
        <span className="scRecBars" aria-hidden="true">
          {bars.current.map((value, index) => <i key={index} style={{ blockSize: `${Math.round(value * 100)}%` }} />)}
        </span>
      </div>
      <button type="button" className="scSend" onClick={onSend} aria-label={sendLabel}>
        {stopOnly ? <Square size={16} aria-hidden="true" /> : <Send size={19} aria-hidden="true" />}
      </button>
    </div>
  );
}

/**
 * The chat composer: one rounded box with the text on top and round buttons underneath (+ for pictures, the microphone, send). Pictures can also be pasted. A voice note is sent the moment recording stops.
 * `onSend({ message, attachments })` resolves to true when the message went out.
 */
export function Composer({ placeholder, onSend, disabled = false }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A voice note that failed to send is kept, so a long recording is never lost to a dropped connection.
  const [unsent, setUnsent] = useState(null);
  const fileRef = useRef(null);
  const boxRef = useRef(null);
  const canVoice = useCanVoice();

  async function deliver(payload, after) {
    setBusy(true);
    setError("");
    const ok = await onSend(payload);
    setBusy(false);
    if (ok) after?.();
    return ok;
  }

  async function sendVoice(voice) {
    const item = { kind: "voice", data: voice.data, durationMs: voice.durationMs };
    setUnsent(null);
    if (!(await deliver({ message: "", attachments: [item] }))) setUnsent(item);
  }

  const recorder = useVoiceRecorder({ onLimit: sendVoice });
  const recording = recorder.state !== "idle";
  const shownError = error || recorder.error;
  const hasContent = Boolean(text.trim() || images.length);

  function resize(element) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 130)}px`;
  }

  async function submit(event) {
    event?.preventDefault();
    if (!hasContent || busy || disabled) return;
    await deliver({ message: text.trim(), attachments: images }, () => {
      setText("");
      setImages([]);
      if (boxRef.current) boxRef.current.style.height = "auto";
    });
  }

  async function stopAndSend() {
    const voice = await recorder.stop();
    if (voice) await sendVoice(voice);
  }

  return (
    <form className={`scComposer${recording ? " is-recording" : ""}`} onSubmit={submit}>
      {shownError ? (
        <p className="scError" role="alert">
          {shownError}
          <button type="button" className="scErrorX" onClick={() => { setError(""); recorder.clearError(); }} aria-label="بستن پیام خطا"><X size={14} aria-hidden="true" /></button>
        </p>
      ) : null}
      <PickedImages images={images} onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))} />
      {unsent && !busy ? (
        <div className="scUnsent" role="alert">
          <span>پیام صوتی ({duration(unsent.durationMs)}) ارسال نشد.</span>
          <button type="button" onClick={() => sendVoice(unsent)}>ارسال دوباره</button>
          <button type="button" className="is-quiet" onClick={() => setUnsent(null)}>حذف</button>
        </div>
      ) : null}
      {recorder.state === "recording" ? (
        <RecordingBar recorder={recorder} onSend={stopAndSend} />
      ) : (
        <div className="scBox">
          <textarea
            ref={boxRef}
            rows={1}
            value={text}
            maxLength={2000}
            placeholder={placeholder}
            aria-label="پیام"
            onChange={(event) => {
              setText(event.target.value);
              resize(event.target);
            }}
            onPaste={(event) => {
              const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith("image/"));
              if (!files.length) return;
              event.preventDefault();
              addImages(files, images, setImages, setError);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit(event);
            }}
          />
          <div className="scBoxBar">
            <button type="button" className="scRound" onClick={() => fileRef.current?.click()} disabled={busy || images.length >= MAX_IMAGES} aria-label="فرستادن عکس">
              <Plus size={21} aria-hidden="true" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                addImages(event.target.files, images, setImages, setError);
                event.target.value = "";
              }}
            />
            <span className="scBoxGap" />
            {canVoice && !hasContent ? (
              <button type="button" className="scRound" disabled={busy || disabled || recording} onClick={recorder.start} aria-label="ضبط پیام صوتی">
                <Mic size={20} aria-hidden="true" />
              </button>
            ) : null}
            <button type="submit" className={`scRound is-send${busy ? " is-busy" : ""}`} disabled={busy || disabled || !hasContent} aria-label="ارسال">
              <ArrowUp size={21} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {busy ? <p className="scSending" aria-live="polite">در حال ارسال…</p> : null}
    </form>
  );
}

/**
 * Pictures and a voice note for the new-message form, before anything is sent: add up to four pictures, or record one
 * voice note and listen to it first. `value` is the list of attachments; `onChange` receives the new list.
 */
export function AttachmentField({ value, onChange, bare = false, controlRef = null }) {
  const [error, setError] = useState("");
  const canVoice = useCanVoice();
  const [preview, setPreview] = useState("");
  const fileRef = useRef(null);
  const recorder = useVoiceRecorder({ onLimit: (voice) => keepVoice(voice) });
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const images = value.filter((item) => item.kind === "image");
  const voice = value.find((item) => item.kind === "voice");

  function keepVoice(recorded) {
    setPreview(URL.createObjectURL(recorded.blob));
    onChange([{ kind: "voice", data: recorded.data, durationMs: recorded.durationMs }]);
  }
  // `bare`: no label or buttons; the host (a composer with its own + and mic buttons) drives it through controlRef.
  if (controlRef) controlRef.current = { pick: () => fileRef.current?.click(), record: () => recorder.start(), recording: recorder.state !== "idle" };

  return (
    <div className={`scAttachField${bare ? " is-bare" : ""}`}>
      {bare ? null : <span className="scAttachLabel">عکس یا صدا (اختیاری)</span>}
      {recorder.state === "recording" ? (
        <RecordingBar recorder={recorder} sendLabel="پایان ضبط" stopOnly onSend={async () => { const recorded = await recorder.stop(); if (recorded) keepVoice(recorded); }} />
      ) : voice ? (
        <div className="scAttachVoice">
          <VoicePlayer src={preview} durationMs={voice.durationMs} />
          <button type="button" className="scIconBtn is-danger" onClick={() => { onChange([]); setPreview(""); }} aria-label="حذف پیام صوتی"><Trash2 size={18} aria-hidden="true" /></button>
        </div>
      ) : (
        <>
          <PickedImages images={images} onRemove={(index) => onChange(images.filter((_, i) => i !== index))} />
          {bare ? null : <div className="scAttachButtons">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_IMAGES}>
              <ImagePlus size={18} aria-hidden="true" /> افزودن عکس
            </button>
            {canVoice && !images.length ? (
              <button type="button" onClick={recorder.start} disabled={recorder.state !== "idle"}>
                <Mic size={18} aria-hidden="true" /> ضبط صدا
              </button>
            ) : null}
          </div>}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              addImages(event.target.files, images, (update) => onChange(typeof update === "function" ? update(images) : update), setError);
              event.target.value = "";
            }}
          />
        </>
      )}
      {error || recorder.error ? <p className="scError" role="alert">{error || recorder.error}</p> : null}
    </div>
  );
}

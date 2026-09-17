import { EventEmitter } from "events";

/**
 * In-process pub/sub for chat real-time delivery (SSE). One Node process
 * serves this app (no multi-instance/serverless split), so a plain
 * EventEmitter is a real, working real-time bus — no external broker needed.
 * Stored on globalThis so Next.js dev-mode module reloads (Turbopack HMR)
 * reuse the same emitter instead of orphaning existing SSE subscribers.
 */
const bus = globalThis.__zibabanChatBus || new EventEmitter();
bus.setMaxListeners(0);
globalThis.__zibabanChatBus = bus;

const EVENT = "chat-event";

/** Publishes an event to every open SSE connection; each subscriber filters by its own membership. */
export function publishChatEvent(event) {
  bus.emit(EVENT, event);
}

/** Subscribes `onEvent` to every published event; returns an unsubscribe function. */
export function subscribeChatEvents(onEvent) {
  bus.on(EVENT, onEvent);
  return () => bus.off(EVENT, onEvent);
}

import { ensureDb } from "../../../lib/db/connection.js";
import { requireUser } from "../../../lib/http.js";
import { publishChatEvent, subscribeChatEvents } from "../../../lib/chatEvents.js";
import { connectPresence, disconnectPresence } from "../../../lib/presence.js";
import * as messages from "../../../lib/db/repos/messages.js";
import * as users from "../../../lib/db/repos/users.js";

export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;
const encoder = new TextEncoder();

/**
 * Server-Sent Events stream for real-time chat delivery. One connection per
 * open tab; EventSource sends the session cookie automatically (same-origin,
 * credentials included by default), so auth works exactly like any other
 * route here. Each connection only forwards events whose `recipients` list
 * (computed server-side at publish time — see chatEvents.js callers)
 * includes this user, so a subscriber never sees another user's messages.
 *
 * This connection also doubles as this app's real presence signal — see
 * app/lib/presence.js. Opening the stream registers one more "connection"
 * for this user (they may have several tabs/devices open); closing it
 * (tab closed, navigated away, connection dropped) unregisters it. Only the
 * 0-connections<->1+-connections transition is broadcast, as a "presence"
 * chat-event, to the user's actual conversation partners (never globally).
 */
export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  let unsubscribe = () => {};
  let heartbeat;
  let cleanedUp = false;

  // Presence partners are computed once per connection (who to notify), not
  // per broadcast — cheap, and stable enough for the lifetime of one stream.
  const partnerIds = messages.listConversationPartnerIds(userId);

  function goOffline() {
    if (cleanedUp) return; // cancel() and the abort listener can both fire
    cleanedUp = true;
    unsubscribe();
    clearInterval(heartbeat);
    const wentOffline = disconnectPresence(userId);
    if (wentOffline) {
      users.touchLastSeen(userId);
      if (partnerIds.length) {
        publishChatEvent({
          type: "presence",
          userId,
          online: false,
          lastSeenAt: new Date().toISOString(),
          recipients: partnerIds
        });
      }
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller already closed (client disconnected mid-write) — ignore
        }
      };

      send({ type: "ready" });

      unsubscribe = subscribeChatEvents((event) => {
        if (Array.isArray(event.recipients) && !event.recipients.includes(userId)) return;
        send(event);
      });

      const wentOnline = connectPresence(userId);
      if (wentOnline && partnerIds.length) {
        publishChatEvent({ type: "presence", userId, online: true, recipients: partnerIds });
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // ignore — cancel() below will clean up
        }
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", goOffline);
    },
    cancel() {
      goOffline();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

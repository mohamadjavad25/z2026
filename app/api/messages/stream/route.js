import { ensureDb } from "../../../lib/db/connection.js";
import { requireUser } from "../../../lib/http.js";
import { subscribeChatEvents } from "../../../lib/chatEvents.js";

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
 */
export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  let unsubscribe = () => {};
  let heartbeat;

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

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // ignore — cancel() below will clean up
        }
      }, HEARTBEAT_MS);
    },
    cancel() {
      unsubscribe();
      clearInterval(heartbeat);
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

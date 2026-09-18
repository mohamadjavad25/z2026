import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { error, json } from "../../../lib/http.js";
import * as artists from "../../../lib/db/repos/artists.js";
import * as messages from "../../../lib/db/repos/messages.js";
import { publishChatEvent } from "../../../lib/chatEvents.js";
import { enrichBookingCards } from "../../../lib/chatOrderCards.js";

export const runtime = "nodejs";

export async function POST(request) {
  ensureDb();
  const body = await request.json();
  const artistUserId = Number(body.artistUserId);
  if (!artistUserId) return error("آرتیست نامعتبر است.", 400);
  const viewer = getUserFromRequest(request);
  const result = artists.addArtistBooking(artistUserId, {
    ...body,
    clientUserId: viewer?.id || null,
    clientName: body.clientName || viewer?.name || "",
    clientPhone: body.clientPhone || viewer?.phone || ""
  });
  if (!result.ok) {
    return json({ error: result.error, code: result.code }, { status: result.code === "SLOT_TAKEN" ? 409 : 400 });
  }

  // Same appointment-card mechanism as /api/salon-bookings, for a client
  // booking an artist directly. Only when the booker is a real logged-in
  // account (this route also allows anonymous booking — see the report —
  // so `viewer` can be null, in which case there's nobody to message).
  if (viewer?.id && viewer.id !== artistUserId) {
    const conversation = messages.getOrCreateDirectConversation(viewer.id, artistUserId);
    if (conversation) {
      const sendResult = messages.sendArtistBookingCardMessage(conversation.id, viewer.id, result.booking.id);
      if (sendResult.ok) {
        enrichBookingCards([sendResult.message]);
        publishChatEvent({ type: "message", conversationId: conversation.id, message: sendResult.message, recipients: sendResult.recipients });
      }
    }
  }

  return json({
    data: {
      booking: result.booking,
      bookedSlots: artists.listArtistBookedSlots(artistUserId)
    }
  }, { status: 201 });
}

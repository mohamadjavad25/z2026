import { getOrderById } from "./db/repos/shops.js";

/**
 * Attaches a live order snapshot (status, items, price, image) to every
 * "order card" message in `messageList` — the card must never cache/store
 * its own copy of the status, or it'd go stale the moment the shop updates
 * the order. Mutates each message object in place and returns the list.
 */
export function enrichOrderCards(messageList) {
  for (const message of messageList) {
    if (message.attachmentType === "order" && message.orderRefId) {
      message.order = getOrderById(message.orderRefId);
    }
  }
  return messageList;
}

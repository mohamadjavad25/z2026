"use client";

import { useRef } from "react";
import { Check, CheckCheck, MessageCircle, Paperclip, Send, X } from "lucide-react";
import { ProfileEmptyState } from "./ProfileEmptyState";
import { formatChatTime, isMessageRead } from "../../shared/lib/chatTime";
import { SalonBookingCardBubble, ArtistBookingCardBubble } from "../chat/BookingCardBubble";

const MAX_ATTACHMENT_BYTES = 1_500_000;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Floating quick-chat sheet: thread list + one open conversation + composer.
 * Shared by owner inboxes (shop/artist/salon) and by a customer messaging
 * one of them — both sides read/write through the same useChat instance.
 */
export function OwnerChatSheet({
  open,
  myUserId,
  activeConversation,
  messages = [],
  threads = [],
  sendBusy = false,
  onClose,
  onSelectThread,
  onSend
}) {
  const draftRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingAttachmentRef = useRef("");

  if (!open) return null;

  const safeThreads = Array.isArray(threads) ? threads : [];
  const safeMessages = Array.isArray(messages) ? messages : [];

  async function handleAttachmentPick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/") || file.size > MAX_ATTACHMENT_BYTES) return;
    pendingAttachmentRef.current = await readFileAsDataUrl(file);
    onSend?.("", pendingAttachmentRef.current);
    pendingAttachmentRef.current = "";
  }

  function submit(event) {
    event.preventDefault();
    const text = draftRef.current?.value.trim() || "";
    if (!text) return;
    onSend?.(text, "");
    if (draftRef.current) draftRef.current.value = "";
  }

  return (
    <div className="shopOwnerChatBackdrop" onClick={onClose}>
      <section
        className="shopOwnerChatSheet"
        role="dialog"
        aria-modal="true"
        aria-label={activeConversation?.title || "چت"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheetHandle" />
        <div className="sheetHead">
          <div>
            <span>صندوق پیام</span>
            <h3>{activeConversation?.title || "چت مشتریان"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </div>
        <div className="shopOwnerInboxList" role="tablist" aria-label="گفتگوها">
          {safeThreads.length === 0 ? (
            <ProfileEmptyState
              className="chatInboxEmpty"
              icon={MessageCircle}
              title="هنوز گفتگویی نیست"
              description="وقتی پیام جدیدی برسد، اینجا در صندوق پیام ظاهر می‌شود."
            />
          ) : (
            safeThreads.map((thread) => (
              <button
                type="button"
                key={thread.id}
                role="tab"
                aria-selected={activeConversation?.id === thread.id}
                className={activeConversation?.id === thread.id ? "active" : ""}
                onClick={() => onSelectThread?.(thread.id)}
              >
                <b>{thread.type === "group" ? thread.title : thread.peer?.name || "کاربر"}</b>
                <span>
                  {thread.lastMessageAttachmentType === "order"
                    ? "🧾 سفارش جدید"
                    : thread.lastMessageAttachmentType === "salon-booking" || thread.lastMessageAttachmentType === "artist-booking"
                      ? "📅 نوبت جدید"
                      : thread.lastMessageAttachmentType === "image" && !thread.lastMessage
                        ? "عکس"
                        : thread.lastMessage || "بدون پیام"}
                </span>
                <small>{formatChatTime(thread.lastMessageAt)}{thread.unreadCount ? ` · ${thread.unreadCount}` : ""}</small>
              </button>
            ))
          )}
        </div>
        <div className="shopChatThread shopOwnerThread">
          {!activeConversation ? (
            <ProfileEmptyState
              className="chatThreadEmpty"
              icon={MessageCircle}
              title="گفتگویی انتخاب نشده"
              description="از فهرست بالا یک گفتگو را باز کن."
            />
          ) : safeMessages.length === 0 ? (
            <ProfileEmptyState
              className="chatThreadEmpty"
              icon={MessageCircle}
              title="گفتگو را شروع کن"
              description="از کادر پایین پیام بفرست تا گفتگو اینجا نمایش داده شود."
            />
          ) : (
            safeMessages.map((message) => {
              if (message.attachmentType === "salon-booking" || message.attachmentType === "artist-booking") {
                // Same unspoofable, structurally system-only card as the
                // order card above — only POST /api/salon-bookings and
                // POST /api/artist/bookings can create these.
                return (
                  <div className="shopChatSystemRow" key={message.id}>
                    {message.attachmentType === "salon-booking"
                      ? <SalonBookingCardBubble booking={message.booking} />
                      : <ArtistBookingCardBubble booking={message.booking} />}
                    <time>{formatChatTime(message.createdAt)}</time>
                  </div>
                );
              }
              const mine = message.senderUserId === myUserId;
              return (
                <div className={`shopChatBubble ${mine ? "user" : "shop"}`} key={message.id}>
                  {message.attachmentType === "image" && message.attachmentUrl ? (
                    <img className="shopChatBubbleImage" src={message.attachmentUrl} alt="" />
                  ) : null}
                  {message.body}
                  <span className="shopChatBubbleMeta">
                    <time>{formatChatTime(message.createdAt)}</time>
                    {mine ? (
                      isMessageRead(message, activeConversation, myUserId)
                        ? <CheckCheck size={12} className="is-read" />
                        : <Check size={12} />
                    ) : null}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <form className="shopChatComposer" onSubmit={submit}>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="chatAttachmentInput" onChange={handleAttachmentPick} />
          <button type="button" aria-label="پیوست عکس" onClick={() => fileInputRef.current?.click()} disabled={!activeConversation}>
            <Paperclip size={15} />
          </button>
          <input ref={draftRef} placeholder="پاسخ بنویس..." disabled={!activeConversation} maxLength={4000} />
          <button type="submit" aria-label="ارسال" disabled={!activeConversation || sendBusy}>
            <Send size={16} />
          </button>
        </form>
      </section>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { Maximize2, MessageCircle, Minus, Paperclip, Plus, Send, ShoppingBag, X } from "lucide-react";
import { SkeletonList } from "../../components/Skeleton";
import { formatToman } from "../../shared/lib/money";
import { shopChatQuickReplies } from "./mappers";
import { OrderCardBubble } from "../chat/OrderCardBubble";
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

export function ShopStoreDock({
  shop,
  myUserId,
  cartOpen,
  chatOpen,
  cartSummary,
  cartItems,
  chatMessages,
  chatLoading = false,
  onOpenCart,
  onCloseCart,
  onOpenChat,
  onCloseChat,
  onExpandChat,
  onCloseSheets,
  onUpdateCartQty,
  onCheckout,
  checkoutBusy = false,
  onShowProducts,
  onSendChatMessage
}) {
  const draftRef = useRef(null);
  const fileInputRef = useRef(null);

  if (!shop) return null;

  async function handleAttachmentPick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/") || file.size > MAX_ATTACHMENT_BYTES) return;
    const dataUrl = await readFileAsDataUrl(file);
    onSendChatMessage("", dataUrl);
  }

  function submit(event) {
    event.preventDefault();
    const text = draftRef.current?.value.trim() || "";
    if (!text) return;
    onSendChatMessage(text, "");
    if (draftRef.current) draftRef.current.value = "";
  }

  return (
    <>
      <div className={`shopStoreDock ${cartOpen || chatOpen ? "is-sheetOpen" : ""}`} aria-label="سبد خرید و پشتیبانی">
        <button
          type="button"
          className={`shopStoreDockCart ${cartSummary.count ? "has-items" : ""}`}
          onClick={onOpenCart}
        >
          <span className="shopStoreDockIcon">
            <ShoppingBag size={18} />
            {cartSummary.count ? <b>{cartSummary.count}</b> : null}
          </span>
          <span className="shopStoreDockCopy">
            <strong>{cartSummary.count ? "مشاهده سبد" : "سبد خرید"}</strong>
            <small>{cartSummary.count ? formatToman(cartSummary.total) : "محصول اضافه کن"}</small>
          </span>
        </button>
        <button
          type="button"
          className="shopStoreDockChat"
          aria-label="چت با فروشگاه"
          onClick={onOpenChat}
        >
          <MessageCircle size={18} />
          <span>چت</span>
        </button>
      </div>

      {(cartOpen || chatOpen) && (
        <div
          className="shopStoreSheetBackdrop"
          onClick={onCloseSheets}
        />
      )}

      {cartOpen && (
        <section className="shopStoreSheet shopCartSheet" role="dialog" aria-modal="true" aria-label="سبد خرید" onClick={(event) => event.stopPropagation()}>
          <div className="sheetHandle" />
          <div className="sheetHead">
            <div>
              <span>{shop.name}</span>
              <h3>سبد خرید</h3>
            </div>
            <button type="button" onClick={onCloseCart} aria-label="بستن">×</button>
          </div>
          {cartItems.length ? (
            <>
              <div className="shopCartList">
                {cartItems.map((item) => (
                  <article className="shopCartRow" key={item.id}>
                    <img src={item.product.image} alt="" aria-hidden="true" />
                    <div className="shopCartRowMain">
                      <b>{item.product.name}</b>
                      <small>{item.product.category}</small>
                      <strong>{item.product.price}</strong>
                    </div>
                    <div className="shopCartRowQty">
                      <button type="button" aria-label="کم کردن" onClick={() => onUpdateCartQty(item.id, -1)}><Minus size={14} /></button>
                      <span>{item.qty}</span>
                      <button type="button" aria-label="افزودن" onClick={() => onUpdateCartQty(item.id, 1)}><Plus size={14} /></button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="shopCartSummary">
                <div>
                  <span>جمع کل</span>
                  <strong>{formatToman(cartSummary.total)}</strong>
                </div>
                <small>{shop.delivery} · {shop.area}</small>
              </div>
              <button type="button" className="shopCartCheckout" disabled={checkoutBusy} onClick={onCheckout}>
                <ShoppingBag size={16} />
                {checkoutBusy ? "در حال ثبت…" : "ثبت سفارش"}
              </button>
            </>
          ) : (
            <div className="shopCartEmpty">
              <ShoppingBag size={28} />
              <b>سبد خرید خالی است</b>
              <span>محصول مورد علاقه‌ات را از ویترین انتخاب کن.</span>
              <button type="button" onClick={onShowProducts}>
                مشاهده محصولات
              </button>
            </div>
          )}
        </section>
      )}

      {chatOpen && (
        <section className="shopStoreSheet shopChatSheet" role="dialog" aria-modal="true" aria-label="چت با فروشگاه" onClick={(event) => event.stopPropagation()}>
          <div className="sheetHandle" />
          <div className="sheetHead">
            <div>
              <span>گفتگو با فروشگاه</span>
              <h3>{shop.name}</h3>
            </div>
          </div>
          <div className="shopChatThread">
            {chatLoading ? (
              <SkeletonList rows={3} variant="row" label="در حال بارگذاری گفتگو" />
            ) : chatMessages.length === 0 ? (
              <div className="shopChatEmpty">
                <MessageCircle size={24} />
                <b>هنوز پیامی نیست</b>
                <span>سؤالت رو بپرس؛ صاحب فروشگاه پیام رو می‌بینه و در اولین فرصت جواب می‌ده.</span>
              </div>
            ) : (
              chatMessages.map((message) => {
                // Neutral system message — centered, no "user"/"shop"
                // attribution, so it can never be mistaken for a regular
                // message either side typed. It structurally can't be faked
                // either: only POST /api/shop/orders can ever create an
                // attachmentType:"order" message — see messages.js.
                if (message.attachmentType === "order") {
                  return (
                    <div className="shopChatSystemRow" key={message.id}>
                      <OrderCardBubble order={message.order} />
                    </div>
                  );
                }
                if (message.attachmentType === "salon-booking" || message.attachmentType === "artist-booking") {
                  // Not expected in a shop's own chat dock in practice (bookings
                  // are salon/artist chats), but handled here too for the same
                  // reason every surface that renders `messages` must: any
                  // direct conversation can in principle carry any card type.
                  return (
                    <div className="shopChatSystemRow" key={message.id}>
                      {message.attachmentType === "salon-booking"
                        ? <SalonBookingCardBubble booking={message.booking} />
                        : <ArtistBookingCardBubble booking={message.booking} />}
                    </div>
                  );
                }
                return (
                  <div className={`shopChatBubble ${message.senderUserId === myUserId ? "user" : "shop"}`} key={message.id}>
                    {message.attachmentType === "image" && message.attachmentUrl ? (
                      <img className="shopChatBubbleImage" src={message.attachmentUrl} alt="" />
                    ) : null}
                    {message.body}
                  </div>
                );
              })
            )}
          </div>
          <div className="shopChatQuick">
            {shopChatQuickReplies.map((reply) => (
              <button type="button" key={reply} onClick={() => onSendChatMessage(reply, "")}>{reply}</button>
            ))}
          </div>
          <form className="shopChatComposer" onSubmit={submit}>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="chatAttachmentInput" onChange={handleAttachmentPick} />
            <button type="button" aria-label="پیوست عکس" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={15} />
            </button>
            <input ref={draftRef} placeholder="پیام خود را بنویس..." maxLength={4000} />
            <button type="submit" aria-label="ارسال"><Send size={16} /></button>
          </form>
        </section>
      )}

      {chatOpen && (
        <div className="shopChatSheetActions">
          <button type="button" onClick={onExpandChat} aria-label="باز کردن در چت کامل">
            <Maximize2 size={18} />
          </button>
          <button type="button" onClick={onCloseChat} aria-label="بستن گفتگو">
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

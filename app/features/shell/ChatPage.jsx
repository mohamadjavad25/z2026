"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCheck,
  LogOut,
  MessageCircle,
  Paperclip,
  Palette,
  Plus,
  Search,
  Send,
  Store,
  User,
  UserPlus,
  UsersRound,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { chatDayKey, formatChatDayLabel, formatChatTime, formatLastSeen, isMessageRead } from "../../shared/lib/chatTime";
import { OrderCardBubble } from "../chat/OrderCardBubble";

/** Single check = sent (message made it into the DB). Double check, accented,
    only once the recipient's real last_read_at has caught up — see
    isMessageRead in shared/lib/chatTime. No fabricated "delivered" state. */
function MessageTick({ message, conversation, myUserId }) {
  return isMessageRead(message, conversation, myUserId)
    ? <CheckCheck size={13} className="is-read" />
    : <Check size={13} />;
}

const MAX_ATTACHMENT_BYTES = 1_500_000; // ~2MB as a base64 data URL, matching the server's cap

const PEER_TYPE_ICON = {
  shop: Store,
  salon: Building2,
  artist: Palette,
  client: User
};

/** Real photo when the thread/peer has one; otherwise a placeholder icon — a
    people-icon for groups, a role-matched icon (shop/salon/artist/client)
    for a direct chat, both drawn inside the same tinted circle. */
function renderThreadAvatar(thread, size = 18) {
  if (thread.type === "group") return <UsersRound size={size} />;
  if (thread.avatar) return <img src={thread.avatar} alt="" />;
  const Icon = PEER_TYPE_ICON[thread.peer?.type] || User;
  return <Icon size={size} />;
}

function hasThreadPhoto(thread) {
  return thread.type !== "group" && Boolean(thread.avatar);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Picks distinct direct-chat peers (candidates for a new group / inviting into one), minus anyone already excluded. */
function directPeers(conversations, excludeIds = []) {
  const excluded = new Set(excludeIds);
  const seen = new Set();
  const peers = [];
  for (const conversation of conversations) {
    if (conversation.type !== "direct" || !conversation.peer) continue;
    const id = conversation.peer.id;
    if (!id || seen.has(id) || excluded.has(id)) continue;
    seen.add(id);
    peers.push(conversation.peer);
  }
  return peers;
}

export function ChatPage({
  active,
  embedded = false,
  title = "پیام‌ها",
  myUserId,
  connected = false,
  conversations = [],
  conversationsLoading = false,
  activeConversationId = null,
  activeConversation = null,
  activeMessages = [],
  activeMessagesLoading = false,
  hasMoreMessages = false,
  sendBusy = false,
  onOpenConversation,
  onLoadMore,
  onSend,
  onCreateGroup,
  onAddMembers,
  onRenameGroup,
  onRemoveMember,
  onLeaveGroup,
  onBack,
  initialPane = "inbox",
  onPaneChange
}) {
  const [pane, setPane] = useState("inbox");
  const [draft, setDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null); // { dataUrl, name }
  const [query, setQuery] = useState("");
  const [groupTitleDraft, setGroupTitleDraft] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const fileInputRef = useRef(null);
  const messageListRef = useRef(null);

  useEffect(() => {
    onPaneChange?.(pane);
  }, [pane, onPaneChange]);

  // The caller (HomeApp) opens the conversation itself, via the same shared
  // chat hook, before switching to this tab — activeConversationId is
  // already correct by the time we render. This just jumps to the right
  // pane so e.g. "message this shop" lands on the conversation, not the inbox.
  useEffect(() => {
    if (!active) return;
    setPane(initialPane || "inbox");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, initialPane]);

  useEffect(() => {
    setDraft("");
    setPendingAttachment(null);
  }, [activeConversationId]);

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [activeMessages.length]);

  const filteredConversations = useMemo(() => {
    const q = query.trim();
    if (!q) return conversations;
    return conversations.filter((c) => (c.type === "group" ? c.title : c.peer?.name || "").includes(q));
  }, [conversations, query]);

  const dayGroups = useMemo(() => {
    const groups = [];
    let lastKey = "";
    for (const message of activeMessages) {
      const key = chatDayKey(message.createdAt);
      if (key !== lastKey) {
        groups.push({ key, label: formatChatDayLabel(message.createdAt), messages: [] });
        lastKey = key;
      }
      groups[groups.length - 1].messages.push(message);
    }
    return groups;
  }, [activeMessages]);

  // A plain "back to inbox" by default — but if the caller flagged that this
  // conversation was opened from somewhere else (e.g. "message this shop"
  // from its storefront), onBack can redirect the whole app instead of just
  // switching panes here.
  function exitConversation() {
    onBack?.();
    setPane("inbox");
  }

  function openThread(id) {
    onOpenConversation?.(id);
    setPane("conversation");
  }

  async function handleAttachmentPick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_ATTACHMENT_BYTES) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPendingAttachment({ dataUrl, name: file.name });
  }

  async function submitMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text && !pendingAttachment) return;
    const ok = await onSend?.({ body: text, attachment: pendingAttachment?.dataUrl || "" });
    if (ok !== false) {
      setDraft("");
      setPendingAttachment(null);
    }
  }

  function startNewGroup() {
    setGroupTitleDraft("");
    setSelectedMemberIds([]);
    setPane("new-group");
  }

  async function submitNewGroup(event) {
    event.preventDefault();
    if (!groupTitleDraft.trim() || selectedMemberIds.length === 0) return;
    const conversation = await onCreateGroup?.(groupTitleDraft.trim(), selectedMemberIds);
    if (conversation) setPane("conversation");
  }

  async function submitAddMembers(event) {
    event.preventDefault();
    if (selectedMemberIds.length === 0) return;
    const ok = await onAddMembers?.(selectedMemberIds);
    if (ok) {
      setSelectedMemberIds([]);
      setPane("details");
    }
  }

  const candidatePeers = useMemo(
    () => directPeers(conversations, pane === "add-members" ? (activeConversation?.members || []).map((m) => m.id) : [myUserId]),
    [conversations, pane, activeConversation, myUserId]
  );

  return (
    <section
      className={`chatPage ${embedded ? "is-embedded" : "mobilePage page-chat"} ${active ? "is-active" : ""}`}
      id={embedded ? undefined : "chat"}
      dir="rtl"
    >
      <div className={`chatPhoneShell is-${pane}`}>
        {pane === "inbox" ? (
          <aside className="chatInboxPanel" aria-label="لیست گفتگوها">
            <header className="chatInboxHead">
              <div>
                <span className="chatMiniAvatar" />
                <h2>{title}</h2>
                <span className={`chatConnectionDot ${connected ? "is-online" : ""}`} title={connected ? "متصل" : "در حال اتصال…"}>
                  {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                </span>
              </div>
              <button type="button" aria-label="ایجاد گروه جدید" onClick={startNewGroup}>
                <Plus size={17} />
              </button>
            </header>

            <label className="chatSearch">
              <Search size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو" aria-label="جستجو در گفتگوها" />
            </label>

            <div className="chatThreadList">
              {conversationsLoading && conversations.length === 0 ? (
                <ProfileEmptyState className="chatInboxEmpty" icon={MessageCircle} title="در حال بارگذاری…" description="" />
              ) : filteredConversations.length === 0 ? (
                <ProfileEmptyState
                  className="chatInboxEmpty"
                  icon={MessageCircle}
                  title="هنوز گفتگویی نیست"
                  description="وقتی پیام جدیدی برسد، لیست گفتگوها اینجا نمایش داده می‌شود."
                />
              ) : (
                filteredConversations.map((thread) => (
                  <button
                    type="button"
                    key={thread.id}
                    className={`chatThread ${thread.id === activeConversationId ? "is-active" : ""}`}
                    onClick={() => openThread(thread.id)}
                  >
                    <span className={`chatAvatarWrap ${hasThreadPhoto(thread) ? "" : "is-placeholder"}`}>
                      {renderThreadAvatar(thread)}
                      {thread.type !== "group" && thread.peer?.online ? <i aria-hidden="true" title="آنلاین" /> : null}
                    </span>
                    <span className="chatThreadBody">
                      <b>{thread.type === "group" ? thread.title : thread.peer?.name || "کاربر"}</b>
                      <small>
                        {thread.lastMessageIsMine ? "شما: " : ""}
                        {thread.lastMessageAttachmentType === "order"
                          ? "🧾 سفارش جدید"
                          : thread.lastMessageAttachmentType === "image" && !thread.lastMessage
                            ? "عکس"
                            : thread.lastMessage || "بدون پیام"}
                      </small>
                    </span>
                    <span className="chatThreadMeta">
                      <time>{formatChatTime(thread.lastMessageAt)}</time>
                      {thread.unreadCount ? <em>{thread.unreadCount}</em> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>
        ) : pane === "new-group" || pane === "add-members" ? (
          <section className="chatConversationPanel" aria-label={pane === "new-group" ? "گروه جدید" : "افزودن عضو"}>
            <header className="chatConversationHead">
              <button type="button" aria-label="بازگشت" onClick={() => setPane(pane === "new-group" ? "inbox" : "details")}>
                <ArrowLeft size={18} />
              </button>
              <div className="chatContactTitle">
                <span><b>{pane === "new-group" ? "گروه جدید" : "افزودن عضو"}</b></span>
              </div>
            </header>

            <form className="chatNewGroupForm" onSubmit={pane === "new-group" ? submitNewGroup : submitAddMembers}>
              {pane === "new-group" ? (
                <input
                  className="chatNewGroupTitle"
                  value={groupTitleDraft}
                  onChange={(e) => setGroupTitleDraft(e.target.value)}
                  placeholder="نام گروه"
                  maxLength={60}
                  aria-label="نام گروه"
                  required
                />
              ) : null}

              <div className="chatMemberPickList">
                {candidatePeers.length === 0 ? (
                  <ProfileEmptyState
                    className="chatInboxEmpty"
                    icon={UsersRound}
                    title="کسی برای افزودن نیست"
                    description="فقط کسانی که قبلاً با آن‌ها گفتگوی مستقیم داشته‌ای قابل افزودنند."
                  />
                ) : (
                  candidatePeers.map((peer) => {
                    const checked = selectedMemberIds.includes(peer.id);
                    return (
                      <button
                        type="button"
                        key={peer.id}
                        className={`chatMemberPickItem ${checked ? "is-checked" : ""}`}
                        onClick={() => setSelectedMemberIds((prev) => (
                          checked ? prev.filter((id) => id !== peer.id) : [...prev, peer.id]
                        ))}
                      >
                        <span className={`chatAvatarWrap ${peer.avatar ? "" : "is-placeholder"}`}>
                          {peer.avatar ? <img src={peer.avatar} alt="" /> : (() => {
                            const Icon = PEER_TYPE_ICON[peer.type] || User;
                            return <Icon size={16} />;
                          })()}
                        </span>
                        <span className="chatThreadBody"><b>{peer.name}</b></span>
                        <span className={`chatMemberPickCheck ${checked ? "is-checked" : ""}`}>
                          {checked ? <Check size={13} /> : null}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                type="submit"
                className="chatNewGroupSubmit"
                disabled={selectedMemberIds.length === 0 || (pane === "new-group" && !groupTitleDraft.trim())}
              >
                {pane === "new-group" ? "ایجاد گروه" : "افزودن"}
              </button>
            </form>
          </section>
        ) : pane === "details" ? (
          <section className="chatConversationPanel chatTeamDetailsPanel" aria-label={`اطلاعات ${activeConversation?.title || ""}`}>
            <header className="chatConversationHead">
              <button type="button" aria-label="بازگشت به گفتگو" onClick={() => setPane("conversation")}>
                <ArrowLeft size={18} />
              </button>
              <div className="chatContactTitle">
                <span className="chatGroupTitleAvatar"><UsersRound size={17} /></span>
                <span><b>{activeConversation?.title}</b></span>
              </div>
              <button type="button" aria-label="افزودن عضو" onClick={() => { setSelectedMemberIds([]); setPane("add-members"); }}>
                <UserPlus size={17} />
              </button>
            </header>

            <div className="chatTeamDetailsBody">
              <section className="chatTeamHero">
                <span className="chatTeamHeroIcon"><UsersRound size={24} /></span>
                <h3>{activeConversation?.title}</h3>
                <p>{(activeConversation?.members || []).length} عضو</p>
              </section>

              <section className="chatTeamSection">
                <div className="chatTeamSectionHead"><b>اعضای گروه</b></div>
                <div className="chatTeamMemberList">
                  {(activeConversation?.members || []).map((member) => (
                    <article key={member.id}>
                      {member.avatar ? <img src={member.avatar} alt="" /> : <span>{(member.name || "?").slice(0, 1)}</span>}
                      <div>
                        <b>{member.name}</b>
                        <small>{member.id === activeConversation?.createdBy ? "سازنده گروه" : "عضو"}</small>
                      </div>
                      {activeConversation?.isCreator && member.id !== myUserId ? (
                        <button type="button" aria-label={`حذف ${member.name}`} onClick={() => onRemoveMember?.(member.id)}>
                          <X size={14} />
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>

              <button type="button" className="chatLeaveGroup" onClick={() => onLeaveGroup?.()}>
                <LogOut size={15} />
                ترک گروه
              </button>
            </div>
          </section>
        ) : !activeConversationId ? (
          <section className="chatConversationPanel" aria-label="گفتگو">
            <header className="chatConversationHead">
              <button type="button" aria-label="بازگشت به گفتگوها" onClick={exitConversation}>
                <ArrowLeft size={18} />
              </button>
              <div className="chatContactTitle"><span><b>گفتگو</b><small>پیامی انتخاب نشده</small></span></div>
            </header>
            <div className="chatMessageList">
              <ProfileEmptyState className="chatThreadEmpty" icon={MessageCircle} title="گفتگویی انتخاب نشده" description="از فهرست گفتگوها یکی را باز کن." />
            </div>
          </section>
        ) : (
          <section className="chatConversationPanel" aria-label={`گفتگو با ${activeConversation?.title || ""}`}>
            <header className="chatConversationHead">
              <button type="button" aria-label="بازگشت به گفتگوها" onClick={exitConversation}>
                <ArrowLeft size={18} />
              </button>
              <button
                type="button"
                className={`chatContactTitle ${activeConversation?.type === "group" ? "is-clickable" : ""}`}
                onClick={() => { if (activeConversation?.type === "group") setPane("details"); }}
                aria-label={activeConversation?.type === "group" ? `نمایش اطلاعات ${activeConversation.title}` : undefined}
              >
                {activeConversation?.type === "group" ? (
                  <span className="chatGroupTitleAvatar"><UsersRound size={17} /></span>
                ) : (
                  <span className="chatHeaderAvatar">
                    {activeConversation?.avatar ? (
                      <img src={activeConversation.avatar} alt="" />
                    ) : (
                      <span className="chatGroupTitleAvatar">
                        {(() => {
                          const Icon = PEER_TYPE_ICON[activeConversation?.peer?.type] || User;
                          return <Icon size={17} />;
                        })()}
                      </span>
                    )}
                    {activeConversation?.peer?.online ? <i aria-hidden="true" title="آنلاین" /> : null}
                  </span>
                )}
                <span>
                  <b>{activeConversation?.title || "…"}</b>
                  {activeConversation?.type !== "group" ? (
                    <small>
                      {activeConversation?.peer?.online
                        ? "آنلاین"
                        : activeConversation?.peer?.lastSeenAt
                          ? `بازدید ${formatLastSeen(activeConversation.peer.lastSeenAt)}`
                          : ""}
                    </small>
                  ) : null}
                </span>
              </button>
            </header>

            <div className="chatMessageList" ref={messageListRef}>
              {hasMoreMessages ? (
                <button type="button" className="chatLoadMore" onClick={() => onLoadMore?.()}>
                  پیام‌های قدیمی‌تر
                </button>
              ) : null}
              {activeMessagesLoading && activeMessages.length === 0 ? (
                <ProfileEmptyState className="chatThreadEmpty" icon={MessageCircle} title="در حال بارگذاری…" description="" />
              ) : activeMessages.length === 0 ? (
                <ProfileEmptyState
                  className="chatThreadEmpty"
                  icon={MessageCircle}
                  title="هنوز پیامی در این گفتگو نیست"
                  description="اولین پیام را بفرست تا گفتگو اینجا شروع شود."
                />
              ) : (
                dayGroups.map((group) => (
                  <div key={group.key} className="chatDayGroup">
                    <div className="chatDayDivider">{group.label}</div>
                    {group.messages.map((message) => {
                      const mine = message.senderUserId === myUserId;
                      if (message.attachmentType === "order") {
                        return (
                          <article key={message.id} className={`chatBubble is-order ${mine ? "is-me" : "is-them"}`}>
                            <OrderCardBubble order={message.order} />
                            <time>{formatChatTime(message.createdAt)}</time>
                            {mine ? <MessageTick message={message} conversation={activeConversation} myUserId={myUserId} /> : null}
                          </article>
                        );
                      }
                      return (
                        <article key={message.id} className={`chatBubble ${mine ? "is-me" : "is-them"}`}>
                          {activeConversation?.type === "group" && !mine ? (
                            <strong>{activeConversation.members?.find((m) => m.id === message.senderUserId)?.name || "عضو"}</strong>
                          ) : null}
                          {message.attachmentType === "image" && message.attachmentUrl ? (
                            <img className="chatBubbleImage" src={message.attachmentUrl} alt="" />
                          ) : null}
                          {message.body ? <p>{message.body}</p> : null}
                          <time>{formatChatTime(message.createdAt)}</time>
                          {mine ? <MessageTick message={message} conversation={activeConversation} myUserId={myUserId} /> : null}
                        </article>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {pendingAttachment ? (
              <div className="chatPendingAttachment">
                <img src={pendingAttachment.dataUrl} alt="" />
                <button type="button" aria-label="حذف عکس" onClick={() => setPendingAttachment(null)}>
                  <X size={14} />
                </button>
              </div>
            ) : null}

            <form className="chatComposer" onSubmit={submitMessage}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="chatAttachmentInput"
                onChange={handleAttachmentPick}
              />
              <button type="button" aria-label="پیوست عکس" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={16} />
              </button>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="پیام بنویس" maxLength={4000} />
              <button type="submit" className="chatSendButton" disabled={sendBusy || (!draft.trim() && !pendingAttachment)} aria-label="ارسال پیام">
                <Send size={17} />
              </button>
            </form>
          </section>
        )}
      </div>
    </section>
  );
}

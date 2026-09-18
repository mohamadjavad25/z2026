"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createConversation,
  getConversation as apiGetConversation,
  getConversationMessages,
  leaveConversation as apiLeaveConversation,
  listConversations,
  markConversationRead,
  sendConversationMessage,
  updateConversation
} from "../../shared/api/chat";

const CONVERSATIONS_POLL_MS = 45000; // SSE-primary; this is only a safety net for a dropped connection
const SSE_RETRY_BASE_MS = 1500;
const SSE_RETRY_MAX_MS = 20000;

/**
 * Single, app-wide chat engine — every messaging surface (owner inbox, the
 * floating quick-chat sheet, a customer messaging a shop/salon/artist,
 * group chats) reads/writes through one instance of this hook so there's
 * exactly one conversation list, one active conversation, one real-time
 * connection, and one send/attachment/pagination implementation.
 *
 * Real-time: a single SSE connection (GET /api/messages/stream) pushes new
 * messages, conversation changes (renames, membership), read receipts and
 * peer presence (online/offline) as they happen; a slow poll is kept as a
 * fallback only in case the stream drops.
 */
export function useChat({ myUserId = null, onNotice } = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [activeMessagesLoading, setActiveMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  const activeConversationIdRef = useRef(null);
  activeConversationIdRef.current = activeConversationId;

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0),
    [conversations]
  );

  const refreshConversations = useCallback(async () => {
    if (!myUserId) return;
    setConversationsLoading(true);
    try {
      const { ok, data } = await listConversations({ limit: 50 });
      if (ok) setConversations(data.conversations || []);
    } catch {
      // keep last known state; next tick/poll retries
    } finally {
      setConversationsLoading(false);
    }
  }, [myUserId]);

  const loadMessages = useCallback(async (conversationId, { before, silent = false } = {}) => {
    if (!conversationId) return;
    if (!silent) setActiveMessagesLoading(true);
    try {
      const { ok, data } = await getConversationMessages(conversationId, { before, limit: 40 });
      if (!ok) return;
      setActiveMessages((prev) => {
        const incoming = data.messages || [];
        if (before) {
          const existingIds = new Set(prev.map((m) => m.id));
          return [...incoming.filter((m) => !existingIds.has(m.id)), ...prev];
        }
        return incoming;
      });
      setHasMoreMessages(Boolean(data.nextCursor));
    } catch {
      // keep whatever was already shown
    } finally {
      if (!silent) setActiveMessagesLoading(false);
    }
  }, []);

  const loadMoreMessages = useCallback(() => {
    const oldest = activeMessages[0];
    if (!oldest || !activeConversationId) return;
    loadMessages(activeConversationId, { before: oldest.id });
  }, [activeMessages, activeConversationId, loadMessages]);

  /** Opens a conversation by id: loads detail + messages, marks it read, updates the local unread badge. */
  const openConversation = useCallback(async (conversationId) => {
    const id = Number(conversationId);
    if (!id) return;
    setActiveConversationId(id);
    setActiveMessages([]);
    setActiveConversation(null);
    setActiveMessagesLoading(true);
    try {
      const { ok, data } = await apiGetConversation(id);
      if (ok) setActiveConversation(data.conversation);
    } catch {
      // keep null; UI shows the "no conversation" state
    }
    await loadMessages(id);
    markConversationRead(id).catch(() => {});
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }, [loadMessages]);

  const closeConversation = useCallback(() => {
    setActiveConversationId(null);
    setActiveConversation(null);
    setActiveMessages([]);
  }, []);

  /** Sends into the currently-open conversation. `attachment` is a data: URL (already read client-side). */
  const sendMessage = useCallback(async ({ body = "", attachment = "" } = {}) => {
    const conversationId = activeConversationId;
    if (!conversationId) return false;
    const text = String(body || "").trim();
    if (!text && !attachment) return false;
    setSendBusy(true);
    try {
      const { ok, payload } = await sendConversationMessage(conversationId, { body: text, attachment });
      if (!ok) {
        notify(payload?.error || "ارسال پیام انجام نشد.");
        return false;
      }
      setActiveMessages((prev) => (prev.some((m) => m.id === payload.data.message.id) ? prev : [...prev, payload.data.message]));
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx === -1) return prev;
        const next = [...prev];
        const [current] = next.splice(idx, 1);
        next.unshift({
          ...current,
          lastMessage: text,
          lastMessageAttachmentType: attachment ? "image" : "",
          lastMessageAt: payload.data.message.createdAt,
          lastMessageIsMine: true,
          updatedAt: payload.data.message.createdAt
        });
        return next;
      });
      return true;
    } catch {
      notify("ارسال پیام انجام نشد؛ دوباره امتحان کن.");
      return false;
    } finally {
      setSendBusy(false);
    }
  }, [activeConversationId, notify]);

  /** Gets/creates a 1:1 conversation with `peerUserId`, opens it, and optionally sends an opening message. */
  const startDirectChat = useCallback(async (peerUserId, initialBody = "") => {
    const peerId = Number(peerUserId);
    if (!peerId) return null;
    try {
      const { ok, payload } = await createConversation({ peerUserId: peerId, body: initialBody });
      if (!ok) {
        notify(payload?.error || "شروع گفتگو انجام نشد.");
        return null;
      }
      const conversation = payload.data.conversation;
      await refreshConversations();
      await openConversation(conversation.id);
      return conversation;
    } catch {
      notify("شروع گفتگو انجام نشد؛ دوباره امتحان کن.");
      return null;
    }
  }, [notify, refreshConversations, openConversation]);

  const createGroup = useCallback(async (title, memberIds) => {
    try {
      const { ok, payload } = await createConversation({ type: "group", title, memberIds });
      if (!ok) {
        notify(payload?.error || "ایجاد گروه انجام نشد.");
        return null;
      }
      const conversation = payload.data.conversation;
      await refreshConversations();
      await openConversation(conversation.id);
      return conversation;
    } catch {
      notify("ایجاد گروه انجام نشد؛ دوباره امتحان کن.");
      return null;
    }
  }, [notify, refreshConversations, openConversation]);

  const addGroupMembers = useCallback(async (memberIds) => {
    if (!activeConversationId) return false;
    try {
      const { ok, payload } = await updateConversation(activeConversationId, { addMemberIds: memberIds });
      if (!ok) {
        notify(payload?.error || "افزودن عضو انجام نشد.");
        return false;
      }
      setActiveConversation(payload.data.conversation);
      return true;
    } catch {
      notify("افزودن عضو انجام نشد.");
      return false;
    }
  }, [activeConversationId, notify]);

  const renameGroup = useCallback(async (title) => {
    if (!activeConversationId) return false;
    try {
      const { ok, payload } = await updateConversation(activeConversationId, { title });
      if (!ok) {
        notify(payload?.error || "تغییر نام گروه انجام نشد.");
        return false;
      }
      setActiveConversation(payload.data.conversation);
      await refreshConversations();
      return true;
    } catch {
      notify("تغییر نام گروه انجام نشد.");
      return false;
    }
  }, [activeConversationId, notify, refreshConversations]);

  const removeGroupMember = useCallback(async (userId) => {
    if (!activeConversationId) return false;
    try {
      const { ok, payload } = await apiLeaveConversation(activeConversationId, userId);
      if (!ok) {
        notify(payload?.error || "حذف عضو انجام نشد.");
        return false;
      }
      if (userId == null || userId === myUserId) closeConversation();
      else if (activeConversation) {
        setActiveConversation({ ...activeConversation, members: activeConversation.members.filter((m) => m.id !== userId) });
      }
      await refreshConversations();
      return true;
    } catch {
      notify("حذف عضو انجام نشد.");
      return false;
    }
  }, [activeConversationId, activeConversation, myUserId, notify, refreshConversations, closeConversation]);

  const leaveConversation = useCallback(() => removeGroupMember(null), [removeGroupMember]);

  // Initial + safety-net poll of the conversation list.
  useEffect(() => {
    if (!myUserId) {
      // Logout (or switching accounts on the same browser session) must not
      // leave the previous user's open conversation/messages sitting in
      // memory for whoever's logged in next.
      setConversations([]);
      setActiveConversationId(null);
      setActiveConversation(null);
      setActiveMessages([]);
      return undefined;
    }
    refreshConversations();
    const interval = window.setInterval(refreshConversations, CONVERSATIONS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [myUserId, refreshConversations]);

  // Real-time: one SSE connection for as long as someone's logged in, with
  // exponential-backoff reconnect (a dropped stream shouldn't need a reload).
  useEffect(() => {
    if (!myUserId || typeof window === "undefined" || typeof EventSource === "undefined") return undefined;
    let source = null;
    let retryTimer = null;
    let retryDelay = SSE_RETRY_BASE_MS;
    let stopped = false;

    function handleEvent(raw) {
      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }
      if (event.type === "message") {
        const isActive = event.conversationId === activeConversationIdRef.current;
        if (isActive) {
          setActiveMessages((prev) => (prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]));
          if (event.message.senderUserId !== myUserId) markConversationRead(event.conversationId).catch(() => {});
        }
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === event.conversationId);
          const bump = {
            id: event.conversationId,
            lastMessage: event.message.body,
            lastMessageAttachmentType: event.message.attachmentType,
            lastMessageAt: event.message.createdAt,
            lastMessageIsMine: event.message.senderUserId === myUserId,
            updatedAt: event.message.createdAt,
            unreadCount: isActive || event.message.senderUserId === myUserId ? 0 : (Number(prev[idx]?.unreadCount) || 0) + 1
          };
          if (idx === -1) {
            refreshConversations();
            return prev;
          }
          const next = [...prev];
          const [current] = next.splice(idx, 1);
          next.unshift({ ...current, ...bump });
          return next;
        });
      } else if (event.type === "conversation") {
        refreshConversations();
        if (event.conversationId === activeConversationIdRef.current) {
          apiGetConversation(event.conversationId).then(({ ok, data }) => {
            if (ok) setActiveConversation(data.conversation);
          }).catch(() => {});
        }
      } else if (event.type === "read") {
        // Someone else moved their last_read_at forward — if it's the open
        // conversation, patch their lastReadAt in place so already-rendered
        // "sent" bubbles flip to "read" without a refetch.
        if (event.conversationId === activeConversationIdRef.current) {
          setActiveConversation((prev) => {
            if (!prev) return prev;
            if (prev.peer && prev.peer.id === event.userId) {
              return { ...prev, peer: { ...prev.peer, lastReadAt: event.readAt } };
            }
            if (prev.members) {
              return { ...prev, members: prev.members.map((m) => (m.id === event.userId ? { ...m, lastReadAt: event.readAt } : m)) };
            }
            return prev;
          });
        }
      } else if (event.type === "presence") {
        // Real online/offline for a conversation partner — driven by their
        // actual SSE connection count server-side (app/lib/presence.js), not
        // a poll. Patches every conversation-list row and the open
        // conversation's peer/member entry that matches this user, live.
        setConversations((prev) => prev.map((c) => (
          c.peer && c.peer.id === event.userId
            ? { ...c, peer: { ...c.peer, online: event.online, lastSeenAt: event.online ? c.peer.lastSeenAt : event.lastSeenAt } }
            : c
        )));
        setActiveConversation((prev) => {
          if (!prev) return prev;
          if (prev.peer && prev.peer.id === event.userId) {
            return { ...prev, peer: { ...prev.peer, online: event.online, lastSeenAt: event.online ? prev.peer.lastSeenAt : event.lastSeenAt } };
          }
          if (prev.members) {
            return {
              ...prev,
              members: prev.members.map((m) => (
                m.id === event.userId ? { ...m, online: event.online, lastSeenAt: event.online ? m.lastSeenAt : event.lastSeenAt } : m
              ))
            };
          }
          return prev;
        });
      } else if (event.type === "order-status") {
        // Live status push for any order-card bubble already on screen —
        // avoids the card showing a stale "جدید" after the shop ships it.
        setActiveMessages((prev) => prev.map((m) => (
          m.order && m.order.id === event.orderId ? { ...m, order: { ...m.order, status: event.status } } : m
        )));
      }
    }

    function connect() {
      if (stopped) return;
      source = new EventSource("/api/messages/stream");
      source.onopen = () => {
        retryDelay = SSE_RETRY_BASE_MS;
        setConnected(true);
      };
      source.onmessage = (event) => handleEvent(event.data);
      source.onerror = () => {
        setConnected(false);
        source?.close();
        if (stopped) return;
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, SSE_RETRY_MAX_MS);
      };
    }
    connect();

    return () => {
      stopped = true;
      setConnected(false);
      source?.close();
      if (retryTimer) window.clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId]);

  return {
    conversations,
    conversationsLoading,
    totalUnread,
    activeConversationId,
    activeConversation,
    activeMessages,
    activeMessagesLoading,
    hasMoreMessages,
    sendBusy,
    connected,
    refreshConversations,
    openConversation,
    closeConversation,
    loadMoreMessages,
    sendMessage,
    startDirectChat,
    createGroup,
    addGroupMembers,
    renameGroup,
    removeGroupMember,
    leaveConversation
  };
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ChatHeader from "./ChatHeader";
import MessageBubble, { Message } from "./MessageBubble";
import ChatInput from "./ChatInput";
import { ConversationItem } from "./ContactList";
import { useChatStore } from "@/store/chatStore";

interface SocketActions {
  isConnected: () => boolean;
  connected: boolean;
  joinConversation: (id: string) => void;
  sendMessage: (conversationId: string, content: string, tempId: string) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
}

interface ChatWindowProps {
  conversation: ConversationItem;
  currentUserId: string;
  currentUserLanguage: string;
  // isContactOnline is now derived from the Zustand store so the header
  // updates reactively without prop-drilling through the page component.
  socket: SocketActions;
  onBack?: () => void;
  onLeave?: () => void;
}

/** After this many ms without a message_saved confirmation, mark the message as failed. */
const PENDING_TIMEOUT_MS = 15_000;

/** Fetch at most this many messages per page. */
const PAGE_SIZE = 50;

export default function ChatWindow({
  conversation,
  currentUserId,
  currentUserLanguage,
  socket,
  onBack,
  onLeave,
}: ChatWindowProps) {
  // Subscribe to only the contact's online status — re-renders only when their
  // presence changes, not on any other store mutation.
  const isContactOnline = useChatStore(
    (state) => state.onlineUserIds.has(conversation.contact?.id ?? "")
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  /** IDs of messages that failed to send — shown with a red error + retry button. */
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  /** Whether there are older messages to load (pagination). */
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);

  /**
   * Fix #11: Throttle typing emissions — track when we last emitted
   * so we only call socket.startTyping at most once per second.
   */
  const lastTypingEmitRef = useRef(0);

  /**
   * Fix #4: Per-message timeout refs. If message_saved doesn't arrive
   * within PENDING_TIMEOUT_MS, the message is marked as failed.
   */
  const pendingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * Fix #10: Buffer for socket messages that arrive while fetchMessages
   * is still in-flight. These are flushed and merged after the fetch resolves,
   * preventing message loss or out-of-order display.
   */
  const socketBufferRef = useRef<Message[]>([]);
  const fetchDoneRef = useRef(false);

  // ── Data fetching ─────────────────────────────────────────────────

  const fetchMessages = useCallback(async (cursor?: string) => {
    try {
      const url = cursor
        ? `/api/conversations/${conversation.id}/messages?cursor=${cursor}&limit=${PAGE_SIZE}`
        : `/api/conversations/${conversation.id}/messages?limit=${PAGE_SIZE}`;

      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();

      if (cursor) {
        // Prepend older messages above the current list (pagination)
        setMessages((prev) => [...data.messages, ...prev]);
      } else {
        // Initial load: merge with any real-time messages received during the fetch.
        // Fix #1/#10: Instead of blindly replacing state, we keep any socket messages
        // that arrived during the HTTP round-trip (they won't be in data.messages yet).
        setMessages((prev) => {
          const dbIds = new Set((data.messages as Message[]).map((m) => m.id));
          const socketOnly = prev.filter(
            (m) => !dbIds.has(m.id) && !m.id.startsWith("temp-")
          );
          return [...data.messages, ...socketOnly];
        });
        // Fix #15: API now returns nextCursor (null when no older pages exist)
        setHasMore(data.nextCursor != null);

        // Mark fetch as done and flush buffered socket messages
        fetchDoneRef.current = true;
        if (socketBufferRef.current.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMsgs = socketBufferRef.current.filter((m) => !existingIds.has(m.id));
            socketBufferRef.current = [];
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
        }
      }
    } finally {
      if (!cursor) setLoading(false);
      else setLoadingMore(false);
    }
  }, [conversation.id]);

  // Reset all state when the conversation changes
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setIsContactTyping(false);
    setFailedIds(new Set());
    setHasMore(false);
    fetchDoneRef.current = false;
    socketBufferRef.current = [];

    fetchMessages();
    socket.joinConversation(conversation.id);

    // Clear all pending send-timeouts when leaving the conversation
    return () => {
      pendingTimeoutsRef.current.forEach((t) => clearTimeout(t));
      pendingTimeoutsRef.current.clear();
    };
  }, [conversation.id, fetchMessages, socket]);

  // ── Scroll helpers ────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Fix #7: Only auto-scroll when messages change — NOT when isContactTyping
  // changes. Triggering on isContactTyping caused the view to jump back to the
  // bottom while the user was scrolling up to read history.
  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom("smooth");
  }, [messages, scrollToBottom]);

  function handleScroll() {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 80;
    setShowScrollBtn(distFromBottom > 200);
  }

  // ── Socket event listeners ────────────────────────────────────────

  useEffect(() => {
    function onReceive(e: CustomEvent) {
      const { message } = e.detail as { message: Message };
      const msg = message as unknown as { conversationId: string } & Message;

      if (msg.conversationId !== conversation.id) return;
      if (msg.senderId === currentUserId) return; // sender handles via onSaved

      // Fix #10: If the initial fetch is still in-flight, buffer this message.
      // It will be flushed and merged once fetchMessages resolves.
      if (!fetchDoneRef.current) {
        socketBufferRef.current.push(message);
        return;
      }

      setMessages((prev) => {
        // Fix #1: Deduplicate — the message might already be in state
        // if it arrived via fetchMessages and socket simultaneously.
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setIsContactTyping(false);
    }

    function onSaved(e: CustomEvent) {
      const { tempId, message } = e.detail as { tempId: string; message: Message };
      // Clear the pending timeout for this message (#4)
      const t = pendingTimeoutsRef.current.get(tempId);
      if (t) { clearTimeout(t); pendingTimeoutsRef.current.delete(tempId); }
      setMessages((prev) => prev.map((m) => (m.id === tempId ? message : m)));
      setFailedIds((prev) => { const n = new Set(prev); n.delete(tempId); return n; });
    }

    function onError(e: CustomEvent) {
      const { tempId } = e.detail as { tempId: string };
      const t = pendingTimeoutsRef.current.get(tempId);
      if (t) { clearTimeout(t); pendingTimeoutsRef.current.delete(tempId); }
      setFailedIds((prev) => new Set([...prev, tempId]));
    }

    function onTyping(e: CustomEvent) {
      const { conversationId } = e.detail as { conversationId: string };
      if (conversationId !== conversation.id) return;
      setIsContactTyping(true);
      // Fix #3: Always clear + reset the auto-clear timer so it doesn't
      // fire prematurely when user is actively typing.
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsContactTyping(false), 5000);
    }

    function onStopTyping(e: CustomEvent) {
      const { conversationId } = e.detail as { conversationId: string };
      if (conversationId !== conversation.id) return;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setIsContactTyping(false);
    }

    window.addEventListener("socket:receive_message", onReceive as EventListener);
    window.addEventListener("socket:message_saved", onSaved as EventListener);
    window.addEventListener("socket:message_error", onError as EventListener);
    window.addEventListener("socket:user_typing", onTyping as EventListener);
    window.addEventListener("socket:user_stop_typing", onStopTyping as EventListener);

    return () => {
      window.removeEventListener("socket:receive_message", onReceive as EventListener);
      window.removeEventListener("socket:message_saved", onSaved as EventListener);
      window.removeEventListener("socket:message_error", onError as EventListener);
      window.removeEventListener("socket:user_typing", onTyping as EventListener);
      window.removeEventListener("socket:user_stop_typing", onStopTyping as EventListener);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversation.id, currentUserId]);

  // ── Send message ──────────────────────────────────────────────────

  async function handleSend(text: string) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      content: text,
      translatedContent: null,
      messageType: "TEXT",
      originalLanguage: currentUserLanguage,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    isAtBottomRef.current = true;
    socket.stopTyping(conversation.id);

    if (socket.isConnected()) {
      socket.sendMessage(conversation.id, text, tempId);

      // Fix #4: Start a watchdog timer. If message_saved doesn't arrive
      // within 15 seconds, assume the message failed and show the error UI.
      const timer = setTimeout(() => {
        pendingTimeoutsRef.current.delete(tempId);
        setFailedIds((prev) => new Set([...prev, tempId]));
      }, PENDING_TIMEOUT_MS);
      pendingTimeoutsRef.current.set(tempId, timer);
    } else {
      // Socket offline fallback: send via REST API
      try {
        const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
          } else {
            setFailedIds((prev) => new Set([...prev, tempId]));
          }
        } else {
          setFailedIds((prev) => new Set([...prev, tempId]));
        }
      } catch {
        setFailedIds((prev) => new Set([...prev, tempId]));
      }
    }
  }

  // Fix #11: Throttle typing socket events to at most once per second.
  // Previously every keypress emitted a socket event, flooding the server.
  function handleTyping() {
    const now = Date.now();
    if (now - lastTypingEmitRef.current >= 1000) {
      socket.startTyping(conversation.id);
      lastTypingEmitRef.current = now;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.stopTyping(conversation.id);
      lastTypingEmitRef.current = 0;
    }, 2000);
  }

  /** Remove failed state and re-queue the message for sending. */
  function handleRetry(tempId: string) {
    const msg = messages.find((m) => m.id === tempId);
    if (!msg) return;
    setFailedIds((prev) => { const n = new Set(prev); n.delete(tempId); return n; });
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
    handleSend(msg.content);
  }

  async function handleLoadMore() {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    const firstReal = messages.find((m) => !m.id.startsWith("temp-"));
    if (firstReal) await fetchMessages(firstReal.id);
  }

  // ── Guard ─────────────────────────────────────────────────────────

  if (!conversation.contact) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Contact not found
      </div>
    );
  }

  // ── Date label helpers ────────────────────────────────────────────

  function getDateLabel(dateStr: string) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return new Date(dateStr).toLocaleDateString([], {
      weekday: "long", month: "short", day: "numeric",
    });
  }

  const messageGroups: { label: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const label = getDateLabel(msg.createdAt);
    const last = messageGroups[messageGroups.length - 1];
    if (last && last.label === label) last.messages.push(msg);
    else messageGroups.push({ label, messages: [msg] });
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full relative" style={{ background: "#080d18" }}>
      <ChatHeader
        contact={conversation.contact}
        isOnline={isContactOnline}
        isTyping={isContactTyping}
        onBack={onBack}
        onLeave={onLeave}
      />

      {/* Fix #8: Reconnection banner — visible whenever the socket is offline */}
      {!socket.connected && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-medium">
            Reconnecting… Messages will sync when back online
          </span>
        </div>
      )}

      {/* Messages scroll area */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 chat-bg"
        style={{ scrollBehavior: "smooth", overscrollBehavior: "contain" }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#6C63FF]/30 border-t-[#6C63FF] animate-spin" />
              <p className="text-slate-600 text-xs">Loading messages…</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-up">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#6C63FF]/20 to-[#4ECDC4]/20 flex items-center justify-center text-4xl mb-4">
              💬
            </div>
            <p className="text-white font-semibold">Start the conversation!</p>
            <p className="text-slate-500 text-sm mt-1.5 max-w-[200px] leading-relaxed">
              Messages translate automatically between Bengali &amp; French
            </p>
            <div className="flex items-center gap-2 mt-4 bg-white/5 border border-white/8 rounded-xl px-4 py-2">
              <span>🇧🇩</span>
              <div className="flex items-center gap-0.5">
                <div className="w-1 h-1 rounded-full bg-[#6C63FF] animate-pulse" />
                <div className="w-4 h-px bg-gradient-to-r from-[#6C63FF] to-[#4ECDC4]" />
                <div className="w-1 h-1 rounded-full bg-[#4ECDC4] animate-pulse" style={{ animationDelay: "0.5s" }} />
              </div>
              <span>🇫🇷</span>
            </div>
          </div>
        ) : (
          <>
            {/* Fix #15: Load older messages button */}
            {hasMore && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/8 rounded-full px-4 py-1.5 transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <div className="w-3 h-3 rounded-full border border-slate-400 border-t-transparent animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                  Load older messages
                </button>
              </div>
            )}

            {messageGroups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[11px] text-slate-600 bg-white/4 px-3 py-1 rounded-full border border-white/5">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                {group.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isMine={msg.senderId === currentUserId}
                    currentUserLanguage={currentUserLanguage}
                    isFailed={failedIds.has(msg.id)}
                    onRetry={failedIds.has(msg.id) ? () => handleRetry(msg.id) : undefined}
                  />
                ))}
              </div>
            ))}

            {isContactTyping && (
              <div className="flex items-end gap-2 mb-2 animate-msg-left">
                <div className="bg-[#162035] border border-white/6 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-2" />
          </>
        )}
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={() => { isAtBottomRef.current = true; scrollToBottom(); }}
          className="absolute bottom-20 right-5 w-10 h-10 bg-[#6C63FF] hover:bg-[#5a52d5] text-white rounded-full shadow-xl shadow-[#6C63FF]/30 flex items-center justify-center transition-all active:scale-95 animate-fade-up z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      <ChatInput onSend={handleSend} onTyping={handleTyping} />
    </div>
  );
}

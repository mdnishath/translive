"use client";

import { useState, useEffect } from "react";
// Fix #17: Import from shared util instead of duplicating gradient/initials logic
import { avatarGradient, getInitials } from "@/lib/utils/avatar";
// Read shared chat state from the Zustand store — only re-renders when the
// subscribed slice changes (e.g. a new message arrives), not on unrelated updates.
import { useChatStore, PendingRequest } from "@/store/chatStore";

export interface ConversationItem {
  id: string;
  contact: {
    id: string;
    name: string;
    email: string;
    language: string;
    avatar: string | null;
  } | null;
  lastMessage: {
    id: string;
    content: string;
    translatedContent: string | null;
    messageType: string;
    senderId: string;
    createdAt: string;
  } | null;
  updatedAt: string;
}

interface ContactListProps {
  selectedId: string | null;
  currentUserId: string;
  onSelect: (conv: ConversationItem) => void;
  onAddContact: (email: string) => Promise<{ name: string }>;
  onAcceptRequest: (id: string) => Promise<void>;
  onDeclineRequest: (id: string) => Promise<void>;
  loading: boolean;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Inline spinner for loading states inside small buttons */
function Spinner() {
  return (
    <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
  );
}

/** A single pending contact request row with Accept / Decline buttons */
function RequestRow({
  request,
  onAccept,
  onDecline,
}: {
  request: PendingRequest;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
}) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const busy = accepting || declining;

  async function handleAccept() {
    setAccepting(true);
    try { await onAccept(request.id); } finally { setAccepting(false); }
  }

  async function handleDecline() {
    setDeclining(true);
    try { await onDecline(request.id); } finally { setDeclining(false); }
  }

  return (
    <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
      <div
        className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(request.from.id)} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
        aria-label={`${request.from.name}'s avatar`}
        role="img"
      >
        {getInitials(request.from.name)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate leading-tight">{request.from.name}</p>
        <p className="text-[10px] text-slate-500 truncate">{request.from.email}</p>
      </div>

      <div className="flex gap-1.5 flex-shrink-0">
        {/* Decline */}
        <button
          onClick={handleDecline}
          disabled={busy}
          aria-label={`Decline ${request.from.name}'s request`}
          title="Decline"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all disabled:opacity-40"
        >
          {declining ? <Spinner /> : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>

        {/* Accept */}
        <button
          onClick={handleAccept}
          disabled={busy}
          aria-label={`Accept ${request.from.name}'s request`}
          title="Accept"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-all disabled:opacity-40"
        >
          {accepting ? <Spinner /> : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function ContactList({
  selectedId,
  currentUserId,
  onSelect,
  onAddContact,
  onAcceptRequest,
  onDeclineRequest,
  loading,
}: ContactListProps) {
  // Subscribe to only the store slices this component needs.
  // Zustand ensures ContactList re-renders ONLY when conversations,
  // onlineUserIds, unreadCounts, or pendingRequests change.
  const conversations = useChatStore((state) => state.conversations);
  const onlineUserIds = useChatStore((state) => state.onlineUserIds);
  const unreadCounts = useChatStore((state) => state.unreadCounts);
  const pendingRequests = useChatStore((state) => state.pendingRequests);

  const [search, setSearch] = useState("");
  // Fix #20: Debounced search — filter only after 200ms of inactivity
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = conversations.filter(
    (c) =>
      c.contact?.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      c.contact?.email.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      const result = await onAddContact(addEmail);
      setAddSuccess(result.name);
      setAddEmail("");
      // Fix #21: Longer timeout so user can add another contact without reopening panel
      setTimeout(() => setAddSuccess(null), 4000);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "User not found");
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#0d1424" }}>

      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Messages</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
          {/* + button with pending-request badge */}
          <div className="relative">
            {pendingRequests.length > 0 && (
              <span
                className="absolute -top-1 -right-1 z-10 min-w-[16px] h-4 rounded-full bg-red-500 border-2 border-[#0d1424] text-[9px] font-bold text-white flex items-center justify-center px-0.5"
                aria-label={`${pendingRequests.length} contact request${pendingRequests.length !== 1 ? "s" : ""}`}
              >
                {pendingRequests.length > 9 ? "9+" : pendingRequests.length}
              </span>
            )}
            <button
              onClick={() => { setShowAdd((v) => !v); setAddError(""); setAddSuccess(null); }}
              aria-label={showAdd ? "Close add contact" : "Add new contact"}
              className={`w-9 h-9 flex items-center justify-center rounded-2xl transition-all duration-200 ${
                showAdd
                  ? "bg-[#6C63FF] text-white shadow-lg shadow-[#6C63FF]/30"
                  : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              }`}
              title="Add contact"
            >
              <svg className={`w-4 h-4 transition-transform duration-200 ${showAdd ? "rotate-45" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Add contact panel */}
        {showAdd && (
          <div className="mb-3 animate-slide-down">
            {addSuccess ? (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-emerald-400 text-sm font-semibold">Request sent to {addSuccess}!</p>
                  <p className="text-emerald-600 text-xs">They will need to accept before you can chat</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddContact} className="bg-white/4 rounded-2xl p-3 border border-white/8">
                <p className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#6C63FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Add by email
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="friend@example.com"
                    aria-label="Contact email address"
                    className="flex-1 bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-[#6C63FF]/50 transition-all"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={addLoading || !addEmail}
                    className="px-4 py-2 bg-[#6C63FF] text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-[#5a52d5] active:scale-95 transition-all shadow-lg shadow-[#6C63FF]/20"
                  >
                    {addLoading
                      ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : "Send"
                    }
                  </button>
                </div>
                {addError && (
                  <p className="text-red-400 text-xs mt-2 flex items-center gap-1" role="alert">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {addError}
                  </p>
                )}
              </form>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full bg-white/5 border border-white/5 text-white text-sm rounded-xl pl-9 pr-8 py-2.5 placeholder-slate-600 focus:outline-none focus:border-[#6C63FF]/40 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Contact requests section — only shown when there are pending requests */}
      {pendingRequests.length > 0 && (
        <div className="border-b border-white/5 bg-[#6C63FF]/5 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-2 px-1">
            <svg className="w-3 h-3 text-[#6C63FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6C63FF]">
              Contact Requests
            </span>
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#6C63FF] text-[9px] font-bold text-white px-1">
              {pendingRequests.length}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {pendingRequests.map((req) => (
              <RequestRow
                key={req.id}
                request={req}
                onAccept={onAcceptRequest}
                onDecline={onDeclineRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-1.5 px-2" role="list" aria-label="Conversations">
        {loading ? (
          <div className="flex flex-col gap-1 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-white/5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-white/5 rounded-full w-1/3 mb-2" />
                  <div className="h-2.5 bg-white/5 rounded-full w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 px-6 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-3xl bg-white/4 flex items-center justify-center text-3xl mb-3 shadow-inner">
              {search ? "🔍" : "💬"}
            </div>
            <p className="text-slate-300 text-sm font-semibold">
              {search ? "No results" : "No conversations yet"}
            </p>
            <p className="text-slate-600 text-xs mt-1.5 max-w-[180px] leading-relaxed">
              {search ? "Try a different search term" : "Tap + to send a contact request!"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filtered.map((conv) => {
              const contact = conv.contact;
              if (!contact) return null;

              const isSelected = conv.id === selectedId;
              const lastMsg = conv.lastMessage;
              const isMine = lastMsg?.senderId === currentUserId;
              const unread = unreadCounts[conv.id] ?? 0;
              const isOnline = onlineUserIds.has(contact.id);

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  role="listitem"
                  aria-label={`${contact.name}${unread > 0 ? `, ${unread} unread messages` : ""}`}
                  aria-current={isSelected ? "true" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-150 text-left relative group ${
                    isSelected ? "bg-[#6C63FF]/12" : "hover:bg-white/4 active:bg-white/6"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-[#6C63FF]" />
                  )}

                  {/* Fix #18: aria-label for avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient(contact.id)} flex items-center justify-center text-sm font-bold text-white`}
                      aria-label={`${contact.name}'s avatar`}
                      role="img"
                    >
                      {getInitials(contact.name)}
                    </div>
                    {isOnline && (
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-[2.5px] animate-online"
                        style={{ borderColor: "#0d1424" }}
                        aria-label="Online"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-semibold truncate ${unread > 0 ? "text-white" : isSelected ? "text-white" : "text-slate-200"}`}>
                        {contact.name}
                      </span>
                      <span className={`text-[10px] flex-shrink-0 ml-2 tabular-nums ${unread > 0 ? "text-[#6C63FF] font-medium" : "text-slate-600"}`}>
                        {lastMsg ? formatTime(lastMsg.createdAt) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        {isMine && unread === 0 && (
                          <svg className="w-3 h-3 text-[#4ECDC4] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Sent">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <p className={`text-xs truncate ${unread > 0 ? "text-slate-300 font-medium" : "text-slate-500"}`}>
                          {lastMsg
                            ? lastMsg.messageType === "VOICE"
                              ? "🎤 Voice message"
                              : lastMsg.content
                            : <span className="italic opacity-60">{contact.language === "fr" ? "Bonjour! 👋" : "হ্যালো! 👋"}</span>
                          }
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {unread > 0 ? (
                          <span className="inline-flex min-w-[20px] h-5 rounded-full bg-[#6C63FF] text-white text-[10px] font-bold items-center justify-center px-1.5 animate-badge-pop shadow-lg shadow-[#6C63FF]/30">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : (
                          <span className="text-sm opacity-40 group-hover:opacity-80 transition-opacity" aria-hidden="true">
                            {contact.language === "fr" ? "🇫🇷" : "🇧🇩"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

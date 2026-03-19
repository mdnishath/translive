"use client";

import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ContactList, { ConversationItem } from "@/components/chat/ContactList";
import ChatWindow from "@/components/chat/ChatWindow";
import { useSocket } from "@/hooks/useSocket";
import { Message } from "@/components/chat/MessageBubble";
import { useChatStore } from "@/store/chatStore";
import { LANGUAGES } from "@/lib/constants";

export default function ChatPage() {
  const { user, loading } = useAuth();

  // ── Zustand store actions ─────────────────────────────────────────
  const {
    setConversations,
    updateLastMessage,
    removeConversation,
    addOnlineUser,
    removeOnlineUser,
    setOnlineUsers,
    incrementUnread,
    clearUnread,
    setPendingRequests,
    removePendingRequest,
    setSentRequests,
    removeSentRequest,
    addContactToast,
    setBlockedUsers,
    removeBlockedUser,
    updateContactLanguage,
  } = useChatStore();

  // ── Local UI state ────────────────────────────────────────────────
  const [convLoading, setConvLoading] = useState(true);
  /** Fix #9: Track fetch errors so the user sees an error banner instead of an empty list. */
  const [convError, setConvError] = useState(false);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [chatKey, setChatKey] = useState(0);

  // Ref so socket event handlers always read the current selected conversation
  // without needing to be recreated when selection changes.
  const selectedRef = useRef<ConversationItem | null>(null);
  selectedRef.current = selected;

  // ── Fix: Clear selection when viewport shrinks to mobile while chat is open ──
  // Without this, resizing from desktop→mobile hides the chat panel via CSS but
  // leaves ChatWindow mounted, causing false read receipts and missed unread badges.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    function handleChange(e: MediaQueryListEvent) {
      if (!e.matches && selectedRef.current && mobileView === "list") {
        // Viewport shrunk below md breakpoint while chat panel would be hidden
        setSelected(null);
      }
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [mobileView]);

  // ── Data fetching ─────────────────────────────────────────────────
  // Defined BEFORE useSocket so they can be passed as callbacks.

  const fetchConversations = useCallback(async () => {
    setConvError(false);
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      } else {
        // Fix #9: Surface the error instead of leaving the list empty
        setConvError(true);
      }
    } catch {
      setConvError(true);
    } finally {
      setConvLoading(false);
    }
  }, [setConversations]);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts/requests");
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data.requests);
      }
    } catch {
      // Non-critical — silently fail
    }
  }, [setPendingRequests]);

  const fetchSentRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts/sent");
      if (res.ok) {
        const data = await res.json();
        setSentRequests(data.requests);
      }
    } catch {
      // Non-critical — silently fail
    }
  }, [setSentRequests]);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts/blocked");
      if (res.ok) {
        const data = await res.json();
        setBlockedUsers(data.blockedUsers);
      }
    } catch {
      // Non-critical
    }
  }, [setBlockedUsers]);

  useEffect(() => {
    if (user) {
      fetchConversations();
      fetchPendingRequests();
      fetchSentRequests();
      fetchBlockedUsers();
    }
  }, [user, fetchConversations, fetchPendingRequests, fetchSentRequests, fetchBlockedUsers]);

  // ── Socket message handlers ───────────────────────────────────────

  const handleReceiveMessage = useCallback((message: Message) => {
    const msgConvId = (message as unknown as { conversationId: string }).conversationId;

    // Update sidebar last-message preview via store action
    updateLastMessage(msgConvId, {
      id: message.id,
      content: message.content,
      translatedContent: message.translatedContent,
      messageType: message.messageType,
      senderId: message.senderId,
      createdAt: message.createdAt,
    });

    // Increment unread badge if message is not for the currently open conversation
    if (msgConvId !== selectedRef.current?.id) {
      incrementUnread(msgConvId);
    }
  }, [updateLastMessage, incrementUnread]);

  /** Someone sent us a contact request — refresh the pending list so the badge updates. */
  const handleContactRequest = useCallback(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  /** Our contact request was accepted — show toast, refresh conversations + sent requests. */
  const handleContactAccepted = useCallback((data: { byUserName?: string }) => {
    fetchConversations();
    fetchPendingRequests();
    fetchSentRequests();
    if (data.byUserName) {
      addContactToast({
        id: `accepted-${Date.now()}`,
        type: "accepted",
        userName: data.byUserName,
      });
    }
  }, [fetchConversations, fetchPendingRequests, fetchSentRequests, addContactToast]);

  /** Our contact request was declined — show toast + refresh sent requests. */
  const handleContactDeclined = useCallback((data: { byUserName?: string }) => {
    fetchSentRequests();
    if (data.byUserName) {
      addContactToast({
        id: `declined-${Date.now()}`,
        type: "declined",
        userName: data.byUserName,
      });
    }
  }, [fetchSentRequests, addContactToast]);

  /** A participant left a conversation — remove it from the sidebar. */
  const handleConversationLeft = useCallback(
    ({ conversationId }: { conversationId: string; userId: string }) => {
      removeConversation(conversationId);
      if (selectedRef.current?.id === conversationId) {
        setSelected(null);
        setMobileView("list");
      }
    },
    [removeConversation]
  );

  /** The other user blocked you — remove conversation and refresh sidebar. */
  const handleContactBlocked = useCallback(
    ({ conversationId }: { byUserId: string; conversationId?: string }) => {
      if (conversationId) {
        removeConversation(conversationId);
        if (selectedRef.current?.id === conversationId) {
          setSelected(null);
          setMobileView("list");
        }
      }
      fetchConversations();
    },
    [removeConversation, fetchConversations]
  );

  /** The other user disconnected — remove conversation and refresh sidebar. */
  const handleContactDisconnected = useCallback(
    ({ conversationId }: { byUserId: string; conversationId?: string }) => {
      if (conversationId) {
        removeConversation(conversationId);
        if (selectedRef.current?.id === conversationId) {
          setSelected(null);
          setMobileView("list");
        }
      }
      fetchConversations();
    },
    [removeConversation, fetchConversations]
  );

  /** A contact changed their language preference — update sidebar + header display. */
  const handleLanguageChanged = useCallback(
    ({ userId, language }: { userId: string; language: string }) => {
      updateContactLanguage(userId, language);
      // Also update the currently selected conversation if it's the same contact
      if (selectedRef.current?.contact?.id === userId) {
        setSelected((prev) =>
          prev ? { ...prev, contact: prev.contact ? { ...prev.contact, language } : prev.contact } : prev
        );
      }
    },
    [updateContactLanguage]
  );

  const socket = useSocket({
    onUserOnline: addOnlineUser,
    onUserOffline: removeOnlineUser,
    onOnlineUsers: setOnlineUsers,
    onReceiveMessage: handleReceiveMessage,
    onNewConversation: fetchConversations,
    onContactRequest: handleContactRequest,
    onContactAccepted: handleContactAccepted,
    onContactDeclined: handleContactDeclined,
    onConversationLeft: handleConversationLeft,
    onContactBlocked: handleContactBlocked,
    onContactDisconnected: handleContactDisconnected,
    onLanguageChanged: handleLanguageChanged,
  });

  // ── Fix #26: Update sidebar when the current user's own message is confirmed ─

  useEffect(() => {
    function onMessageSaved(e: Event) {
      const { message } = (e as CustomEvent).detail as {
        tempId: string;
        message: Message & { conversationId: string };
      };
      updateLastMessage(message.conversationId, {
        id: message.id,
        content: message.content,
        translatedContent: message.translatedContent,
        messageType: message.messageType,
        senderId: message.senderId,
        createdAt: message.createdAt,
      });
    }

    window.addEventListener("socket:message_saved", onMessageSaved);
    return () => window.removeEventListener("socket:message_saved", onMessageSaved);
  }, [updateLastMessage]);

  // ── Update sidebar when Claude refines a translation ────────────

  useEffect(() => {
    function onTranslationRefined(e: Event) {
      const { messageId, refined, conversationId } = (e as CustomEvent).detail as {
        messageId: string; refined: string; conversationId: string;
      };
      // Update the sidebar preview if this refined message is the last message
      const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
      if (conv?.lastMessage?.id === messageId) {
        updateLastMessage(conversationId, {
          ...conv.lastMessage,
          translatedContent: refined,
        });
      }
    }

    window.addEventListener("socket:translation_refined", onTranslationRefined);
    return () => window.removeEventListener("socket:translation_refined", onTranslationRefined);
  }, [updateLastMessage]);

  // ── Handlers ──────────────────────────────────────────────────────

  async function handleAddContact(email: string): Promise<{ name: string }> {
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send request");

    if (data.rejoined) {
      // User was re-connected after leaving — refresh conversations immediately
      fetchConversations();
      // Notify the other user so their sidebar updates in real time
      socket.notifyConversationRejoined(data.contact.id, data.conversationId);
      return { name: data.contact.name };
    }

    // Reliable relay: tell the socket server to notify the target user
    console.log("[ChatPage] About to notifyContactRequest, contact.id=", data.contact.id, "socket.connected=", socket.connected);
    socket.notifyContactRequest(data.contact.id);
    // Refresh sent requests so the "Sent" tab shows the new request
    fetchSentRequests();
    return { name: data.contact.name };
  }

  async function handleAcceptRequest(contactId: string): Promise<void> {
    const res = await fetch(`/api/contacts/${contactId}/accept`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to accept");
    removePendingRequest(contactId);
    // Reliable relay: notify the original requester + refresh both sidebars
    if (data.requesterId && data.conversationId) {
      socket.notifyContactAccepted(data.requesterId, data.conversationId);
    }
    // Also refresh our own conversations immediately
    fetchConversations();
  }

  async function handleDeclineRequest(contactId: string): Promise<void> {
    const res = await fetch(`/api/contacts/${contactId}/decline`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to decline");
    removePendingRequest(contactId);
    // Reliable relay: notify the original requester
    if (data.requesterId) {
      socket.notifyContactDeclined(data.requesterId);
    }
  }

  async function handleLeaveConversation() {
    if (!selected) return;
    const contactName = selected.contact?.name ?? "this conversation";
    if (!window.confirm(`Leave conversation with ${contactName}?\n\nYou'll need to be re-added to rejoin.`)) return;

    const res = await fetch(`/api/conversations/${selected.id}/leave`, { method: "PATCH" });
    if (res.ok) {
      // The CONVERSATION_LEFT socket event will fire and trigger handleConversationLeft,
      // but handle locally as a fallback in case the socket event is delayed.
      removeConversation(selected.id);
      setSelected(null);
      setMobileView("list");
    }
  }

  async function handleDisconnectContact() {
    if (!selected?.contact) return;
    const contactName = selected.contact.name;
    if (!window.confirm(`Disconnect from ${contactName}?\n\nChat history will be kept but the contact will be removed. You can re-add them later.`)) return;

    const contactId = selected.contact.id;
    const convId = selected.id;
    const res = await fetch(`/api/contacts/${contactId}/disconnect`, { method: "PATCH" });
    if (res.ok) {
      removeConversation(convId);
      setSelected(null);
      setMobileView("list");
      // Notify the other user in real-time so their sidebar updates instantly
      socket.notifyContactDisconnected(contactId, convId);
    }
  }

  async function handleClearChat() {
    if (!selected) return;
    const contactName = selected.contact?.name ?? "this conversation";
    if (!window.confirm(`Clear your chat history with ${contactName}?\n\nThis only clears for you, not for them.`)) return;

    const res = await fetch(`/api/conversations/${selected.id}/clear`, { method: "DELETE" });
    if (res.ok) {
      // Force remount ChatWindow by changing the key — bump a counter
      setChatKey((k) => k + 1);
    }
  }

  async function handleBlockContact() {
    if (!selected?.contact) return;
    const contactName = selected.contact.name;
    if (!window.confirm(`Block ${contactName}?\n\nThey won't be able to contact you until you unblock them.`)) return;

    const contactId = selected.contact.id;
    const convId = selected.id;
    const res = await fetch(`/api/contacts/${contactId}/block`, { method: "PATCH" });
    if (res.ok) {
      removeConversation(convId);
      setSelected(null);
      setMobileView("list");
      fetchBlockedUsers();
      // Notify the blocked user in real-time so their sidebar updates instantly
      socket.notifyContactBlocked(contactId, convId);
    }
  }

  async function handleUnblockUser(userId: string) {
    const res = await fetch(`/api/contacts/${userId}/unblock`, { method: "PATCH" });
    if (res.ok) {
      removeBlockedUser(userId);
    }
  }

  function handleSelectConversation(conv: ConversationItem) {
    setSelected(conv);
    setMobileView("chat");
    // Clear unread badge as soon as the conversation is opened
    clearUnread(conv.id);
  }

  // ── Guards ────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
    </div>
  );

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-[#0a0f1e] flex flex-col">

      {/* Top navigation bar */}
      <div className="bg-[#111827] border-b border-[#1f2d4a] px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#4ECDC4] flex items-center justify-center text-xs font-bold text-white"
            aria-label={`${user.name}'s avatar`}
            role="img"
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{user.name}</p>
            <p className="text-[#8B9EC7] text-xs">
              {LANGUAGES[user.language as keyof typeof LANGUAGES]
                ? `${LANGUAGES[user.language as keyof typeof LANGUAGES].flag} ${LANGUAGES[user.language as keyof typeof LANGUAGES].name}`
                : `🌐 ${user.language}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="hidden sm:flex items-center gap-1.5 bg-[#1f2d4a] rounded-full px-3 py-1.5 mr-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4] animate-pulse" aria-hidden="true" />
            <span className="text-[#8B9EC7] text-xs">Auto-translate ON</span>
          </div>
          <Link
            href="/profile"
            aria-label="Profile settings"
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#1f2d4a] transition-colors"
          >
            <svg className="w-5 h-5 text-[#8B9EC7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Fix #9: Show error banner if conversations failed to load */}
      {convError && (
        <div className="flex items-center justify-center gap-3 bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-red-400 text-xs">Failed to load conversations.</span>
          <button
            onClick={fetchConversations}
            className="text-[#6C63FF] text-xs font-medium hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left panel — contact list */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-[#1f2d4a] ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          } flex-col`}
        >
          {/* ContactList subscribes to conversations/onlineUserIds/unreadCounts/pendingRequests
              directly from the Zustand store — no prop-drilling needed */}
          <ContactList
            selectedId={selected?.id ?? null}
            currentUserId={user.id}
            onSelect={handleSelectConversation}
            onAddContact={handleAddContact}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            onUnblock={handleUnblockUser}
            loading={convLoading}
          />
        </div>

        {/* Right panel — chat window or empty state */}
        <div
          className={`flex-1 ${mobileView === "list" ? "hidden md:flex" : "flex"} flex-col`}
        >
          {selected ? (
            <ChatWindow
              key={`${selected.id}-${chatKey}`}
              conversation={selected}
              currentUserId={user.id}
              currentUserLanguage={user.language}
              socket={socket}
              onBack={() => { setSelected(null); setMobileView("list"); }}
              onLeave={handleLeaveConversation}
              onDisconnect={handleDisconnectContact}
              onClearChat={handleClearChat}
              onBlock={handleBlockContact}
            />
          ) : (
            /* Empty state shown on desktop when no conversation is selected */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 bg-[#0a0f1e]">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#6C63FF]/20 to-[#4ECDC4]/20 flex items-center justify-center text-5xl">
                💬
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Select a conversation</p>
                <p className="text-[#8B9EC7] text-sm mt-1">
                  Choose a contact to start chatting with auto-translation
                </p>
              </div>
              <div className="flex items-center gap-2 bg-[#111827] rounded-xl px-4 py-2.5 border border-[#1f2d4a]">
                <span className="text-lg">🇧🇩</span>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-[#6C63FF]" />
                  <div className="w-3 h-px bg-[#6C63FF]" />
                  <div className="w-1 h-1 rounded-full bg-[#4ECDC4]" />
                </div>
                <span className="text-lg">🇫🇷</span>
                <span className="text-[#8B9EC7] text-xs ml-1">Real-time translation</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

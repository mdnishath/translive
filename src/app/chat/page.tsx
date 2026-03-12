"use client";

import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ContactList, { ConversationItem } from "@/components/chat/ContactList";
import ChatWindow from "@/components/chat/ChatWindow";
import { useSocket } from "@/hooks/useSocket";
import { Message } from "@/components/chat/MessageBubble";
import { useChatStore } from "@/store/chatStore";

export default function ChatPage() {
  const { user, loading } = useAuth();

  // ── Zustand store actions ─────────────────────────────────────────
  // chat/page.tsx owns data-fetching and socket orchestration.
  // All shared state lives in the store so child components can subscribe
  // to only the slices they need — no unnecessary re-renders.
  const {
    setConversations,
    updateLastMessage,
    addOnlineUser,
    removeOnlineUser,
    setOnlineUsers,
    incrementUnread,
    clearUnread,
  } = useChatStore();

  // ── Local UI state ───────────────────────────────────────────────
  const [convLoading, setConvLoading] = useState(true);
  /** Fix #9: Track fetch errors so the user sees an error banner instead of an empty list. */
  const [convError, setConvError] = useState(false);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // Ref so socket event handlers always read the current selected conversation
  // without needing to be recreated when selection changes.
  const selectedRef = useRef<ConversationItem | null>(null);
  selectedRef.current = selected;

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

  const socket = useSocket({
    onUserOnline: addOnlineUser,
    onUserOffline: removeOnlineUser,
    onOnlineUsers: setOnlineUsers,
    onReceiveMessage: handleReceiveMessage,
  });

  // ── Fix #26: Also update the sidebar when the current user's own message ─
  // is confirmed by the server (message_saved). Previously, only messages    ──
  // received FROM others updated the sidebar last-message preview.           ──
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

  // ── Data fetching ─────────────────────────────────────────────────

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

  useEffect(() => {
    if (user) fetchConversations();
  }, [user, fetchConversations]);

  // ── Handlers ──────────────────────────────────────────────────────

  async function handleAddContact(email: string): Promise<{ name: string }> {
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add contact");
    await fetchConversations();
    return { name: data.contact.name };
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
              {user.language === "bn" ? "🇧🇩 বাংলা" : "🇫🇷 Français"}
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
          {/* ContactList subscribes to conversations/onlineUserIds/unreadCounts
              directly from the store — no prop-drilling of store-managed state */}
          <ContactList
            selectedId={selected?.id ?? null}
            currentUserId={user.id}
            onSelect={handleSelectConversation}
            onAddContact={handleAddContact}
            loading={convLoading}
          />
        </div>

        {/* Right panel — chat window or empty state */}
        <div
          className={`flex-1 ${mobileView === "list" ? "hidden md:flex" : "flex"} flex-col`}
        >
          {selected ? (
            <ChatWindow
              key={selected.id}
              conversation={selected}
              currentUserId={user.id}
              currentUserLanguage={user.language}
              socket={socket}
              onBack={() => setMobileView("list")}
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

/**
 * chatStore — Global Zustand store for all real-time chat state.
 *
 * Why Zustand?
 *  - Components subscribe to only the slice of state they need.
 *    A typing indicator update in ChatWindow does NOT re-render ContactList.
 *  - Zero-boilerplate compared to Redux; no Provider wrapper needed.
 *  - Works seamlessly with Next.js App Router (no hydration issues for
 *    client-only state like socket presence).
 *
 * Architecture:
 *  - Conversations list + last-message preview       → ChatPage, ContactList
 *  - Online presence (Set of userIds)                → ContactList, ChatWindow
 *  - Unread counts per conversation                  → ContactList
 *
 * Server data (conversations) is still fetched via REST (fetch) and stored
 * here so every subscriber sees the same cached copy without prop-drilling.
 */

import { create } from "zustand";
import { ConversationItem } from "@/components/chat/ContactList";

interface ChatState {
  // ── Data ────────────────────────────────────────────────────────────
  conversations: ConversationItem[];
  /** Set of userIds that are currently online. */
  onlineUserIds: Set<string>;
  /** Unread message count per conversationId. */
  unreadCounts: Record<string, number>;

  // ── Conversation actions ────────────────────────────────────────────
  setConversations: (convs: ConversationItem[]) => void;
  updateLastMessage: (
    conversationId: string,
    lastMessage: ConversationItem["lastMessage"]
  ) => void;

  // ── Presence actions ────────────────────────────────────────────────
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  setOnlineUsers: (userIds: string[]) => void;

  // ── Unread actions ──────────────────────────────────────────────────
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  onlineUserIds: new Set(),
  unreadCounts: {},

  // ── Conversation mutations ─────────────────────────────────────────

  setConversations: (conversations) => set({ conversations }),

  updateLastMessage: (conversationId, lastMessage) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id !== conversationId ? conv : { ...conv, lastMessage }
      ),
    })),

  // ── Presence mutations ─────────────────────────────────────────────

  addOnlineUser: (userId) =>
    set((state) => ({
      onlineUserIds: new Set([...state.onlineUserIds, userId]),
    })),

  removeOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUserIds);
      next.delete(userId);
      return { onlineUserIds: next };
    }),

  setOnlineUsers: (userIds) =>
    set({ onlineUserIds: new Set(userIds) }),

  // ── Unread mutations ───────────────────────────────────────────────

  incrementUnread: (conversationId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [conversationId]: (state.unreadCounts[conversationId] ?? 0) + 1,
      },
    })),

  clearUnread: (conversationId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [conversationId]: 0 },
    })),
}));

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
 *  - Pending contact requests                        → ContactList
 *
 * Server data (conversations) is still fetched via REST (fetch) and stored
 * here so every subscriber sees the same cached copy without prop-drilling.
 */

import { create } from "zustand";
import { ConversationItem } from "@/components/chat/ContactList";

/** A pending incoming contact request — fetched from GET /api/contacts/requests */
export interface PendingRequest {
  id: string; // contact record id — used for accept/decline endpoints
  from: {
    id: string;
    name: string;
    email: string;
    language: string;
    avatar: string | null;
  };
  createdAt: string;
}

/** An outgoing contact request — fetched from GET /api/contacts/sent */
export interface SentRequest {
  id: string;
  to: {
    id: string;
    name: string;
    email: string;
    language: string;
    avatar: string | null;
  };
  createdAt: string;
}

/** A blocked user entry */
export interface BlockedUser {
  id: string;
  name: string;
  email: string;
  language: string;
}

/** A toast notification shown temporarily at the top of the contact list */
export interface ContactToast {
  id: string;
  type: "accepted" | "declined";
  userName: string;
}

interface ChatState {
  // ── Data ────────────────────────────────────────────────────────────
  conversations: ConversationItem[];
  /** Set of userIds that are currently online. */
  onlineUserIds: Set<string>;
  /** Unread message count per conversationId. */
  unreadCounts: Record<string, number>;
  /** Incoming contact requests waiting for accept/decline. */
  pendingRequests: PendingRequest[];
  /** Outgoing contact requests (sent by current user, still PENDING). */
  sentRequests: SentRequest[];
  /** Temporary toast notifications for contact accept/decline feedback. */
  contactToasts: ContactToast[];
  /** Users blocked by the current user. */
  blockedUsers: BlockedUser[];

  // ── Conversation actions ────────────────────────────────────────────
  setConversations: (convs: ConversationItem[]) => void;
  updateLastMessage: (
    conversationId: string,
    lastMessage: ConversationItem["lastMessage"]
  ) => void;
  removeConversation: (conversationId: string) => void;

  // ── Presence actions ────────────────────────────────────────────────
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  setOnlineUsers: (userIds: string[]) => void;

  // ── Unread actions ──────────────────────────────────────────────────
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;

  // ── Contact request actions ─────────────────────────────────────────
  setPendingRequests: (requests: PendingRequest[]) => void;
  removePendingRequest: (id: string) => void;
  setSentRequests: (requests: SentRequest[]) => void;
  removeSentRequest: (id: string) => void;

  // ── Toast actions ─────────────────────────────────────────────────
  addContactToast: (toast: ContactToast) => void;
  removeContactToast: (id: string) => void;

  // ── Blocked users actions ───────────────────────────────────────────
  setBlockedUsers: (users: BlockedUser[]) => void;
  removeBlockedUser: (id: string) => void;

  // ── Contact language update ───────────────────────────────────────
  updateContactLanguage: (userId: string, language: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  onlineUserIds: new Set(),
  unreadCounts: {},
  pendingRequests: [],
  sentRequests: [],
  contactToasts: [],
  blockedUsers: [],

  // ── Conversation mutations ─────────────────────────────────────────

  setConversations: (conversations) => set({ conversations }),

  updateLastMessage: (conversationId, lastMessage) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id !== conversationId ? conv : { ...conv, lastMessage }
      ),
    })),

  removeConversation: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
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

  // ── Contact request mutations ──────────────────────────────────────

  setPendingRequests: (pendingRequests) => set({ pendingRequests }),

  removePendingRequest: (id) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.id !== id),
    })),

  setSentRequests: (sentRequests) => set({ sentRequests }),

  removeSentRequest: (id) =>
    set((state) => ({
      sentRequests: state.sentRequests.filter((r) => r.id !== id),
    })),

  // ── Toast mutations ──────────────────────────────────────────────

  addContactToast: (toast) =>
    set((state) => ({
      contactToasts: [...state.contactToasts, toast],
    })),

  removeContactToast: (id) =>
    set((state) => ({
      contactToasts: state.contactToasts.filter((t) => t.id !== id),
    })),

  // ── Blocked users mutations ──────────────────────────────────────

  setBlockedUsers: (blockedUsers) => set({ blockedUsers }),

  removeBlockedUser: (id) =>
    set((state) => ({
      blockedUsers: state.blockedUsers.filter((u) => u.id !== id),
    })),

  // ── Contact language mutations ──────────────────────────────────
  updateContactLanguage: (userId, language) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.contact?.id === userId
          ? { ...conv, contact: { ...conv.contact, language } }
          : conv
      ),
    })),
}));

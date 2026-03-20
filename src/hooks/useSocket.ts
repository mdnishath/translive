"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import { Message } from "@/components/chat/MessageBubble";

interface UseSocketOptions {
  onUserOnline?: (userId: string) => void;
  onUserOffline?: (userId: string) => void;
  onOnlineUsers?: (userIds: string[]) => void;
  onReceiveMessage?: (message: Message) => void;
  /** Called when a new conversation is created that involves this user. */
  onNewConversation?: () => void;
  /** Called when someone sends this user a contact request — refresh pending list. */
  onContactRequest?: () => void;
  /** Called when this user's contact request was accepted — refresh conversations + show toast. */
  onContactAccepted?: (data: { byUserName?: string }) => void;
  /** Called when this user's contact request was declined — show toast. */
  onContactDeclined?: (data: { byUserName?: string }) => void;
  /** Called when a participant leaves a conversation. */
  onConversationLeft?: (data: { conversationId: string; userId: string }) => void;
  /** Called when the other user blocked you — remove conversation from sidebar. */
  onContactBlocked?: (data: { byUserId: string; conversationId?: string }) => void;
  /** Called when the other user disconnected — remove conversation from sidebar. */
  onContactDisconnected?: (data: { byUserId: string; conversationId?: string }) => void;
  /** Called when a contact changed their language preference. */
  onLanguageChanged?: (data: { userId: string; language: string }) => void;
}

function dispatch(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Exposed so components can show a "reconnecting" banner (#8)
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Start with polling so HttpOnly auth_token cookie is sent on the
    // initial HTTP handshake. Socket.io upgrades to WebSocket afterward.
    const socket = io(window.location.origin, {
      transports: ["polling", "websocket"],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    // ── Connection lifecycle ────────────────────────────────────
    socket.on("connect", () => {
      console.log("[useSocket] Connected! socketId=", socket.id);
      setConnected(true);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      console.warn("[socket] connect error:", err.message);
      setConnected(false);
    });

    // ── Message events ──────────────────────────────────────────
    // Use window CustomEvents so deeply nested components (ChatWindow)
    // can subscribe without prop drilling.
    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, ({ message, engine }: { message: Message; engine?: string }) => {
      message.translationEngine = (engine as "google" | "claude" | "gemini") ?? null;
      optionsRef.current.onReceiveMessage?.(message);
      dispatch("socket:receive_message", { message });
    });

    socket.on(SOCKET_EVENTS.MESSAGE_SAVED, ({ tempId, message, engine }: { tempId: string; message: Message; engine?: string }) => {
      message.translationEngine = (engine as "google" | "claude" | "gemini") ?? null;
      dispatch("socket:message_saved", { tempId, message });
    });

    socket.on(SOCKET_EVENTS.MESSAGE_ERROR, ({ tempId, error }: { tempId: string; error: string }) => {
      dispatch("socket:message_error", { tempId, error });
    });

    // ── Typing events ───────────────────────────────────────────
    socket.on(SOCKET_EVENTS.USER_TYPING, (data: { userId: string; name: string; conversationId: string }) => {
      dispatch("socket:user_typing", data);
    });

    socket.on(SOCKET_EVENTS.USER_STOP_TYPING, (data: { userId: string; conversationId: string }) => {
      dispatch("socket:user_stop_typing", data);
    });

    // ── New conversation notification ────────────────────────────
    // Fired by the server when a new contact/conversation is created.
    // The client auto-joins the socket room and refreshes the sidebar —
    // the other user sees the new conversation instantly without a reload.
    socket.on(SOCKET_EVENTS.NEW_CONVERSATION, ({ conversationId }: { conversationId: string }) => {
      socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, conversationId);
      optionsRef.current.onNewConversation?.();
    });

    // ── Contact request notifications ────────────────────────────
    socket.on(SOCKET_EVENTS.CONTACT_REQUEST, (data: unknown) => {
      console.log("[useSocket] CONTACT_REQUEST received!", data);
      optionsRef.current.onContactRequest?.();
    });

    socket.on(SOCKET_EVENTS.CONTACT_ACCEPTED, (data: { byUserName?: string }) => {
      optionsRef.current.onContactAccepted?.(data);
    });

    socket.on(SOCKET_EVENTS.CONTACT_DECLINED, (data: { byUserName?: string }) => {
      optionsRef.current.onContactDeclined?.(data);
    });

    // ── Message deleted for everyone ─────────────────────────────
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (data: { messageId: string; conversationId: string }) => {
      dispatch("socket:message_deleted", data);
    });

    // ── Translation refined (Claude smart translation) ───────────
    socket.on(SOCKET_EVENTS.TRANSLATION_REFINED, (data: { messageId: string; refined: string; conversationId: string }) => {
      dispatch("socket:translation_refined", data);
    });

    // ── Voice message processed (STT + translate + TTS) ───────────
    socket.on(SOCKET_EVENTS.VOICE_PROCESSED, (data: {
      messageId: string; conversationId: string;
      transcript: string; translatedText: string | null; translatedAudioUrl: string | null;
      engine?: "google" | "claude";
    }) => {
      dispatch("socket:voice_processed", data);
    });

    // ── Read receipts ─────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.MESSAGES_READ, (data: { conversationId: string; userId: string; readAt: string }) => {
      dispatch("socket:messages_read", data);
    });

    // ── Conversation left notification ───────────────────────────
    socket.on(SOCKET_EVENTS.CONVERSATION_LEFT, (data: { conversationId: string; userId: string }) => {
      optionsRef.current.onConversationLeft?.(data);
    });

    // ── Block / disconnect notifications ──────────────────────────
    socket.on(SOCKET_EVENTS.CONTACT_BLOCKED, (data: { byUserId: string; conversationId?: string }) => {
      console.log("[useSocket] CONTACT_BLOCKED received!", data);
      optionsRef.current.onContactBlocked?.(data);
    });

    socket.on(SOCKET_EVENTS.CONTACT_DISCONNECTED, (data: { byUserId: string; conversationId?: string }) => {
      console.log("[useSocket] CONTACT_DISCONNECTED received!", data);
      optionsRef.current.onContactDisconnected?.(data);
    });

    // ── Language change notification ──────────────────────────────
    socket.on(SOCKET_EVENTS.LANGUAGE_CHANGED, (data: { userId: string; language: string }) => {
      console.log("[useSocket] LANGUAGE_CHANGED received!", data);
      optionsRef.current.onLanguageChanged?.(data);
    });

    // ── Presence events ─────────────────────────────────────────
    socket.on(SOCKET_EVENTS.ONLINE_USERS, (userIds: string[]) => {
      optionsRef.current.onOnlineUsers?.(userIds);
    });

    socket.on(SOCKET_EVENTS.USER_ONLINE, ({ userId }: { userId: string }) => {
      optionsRef.current.onUserOnline?.(userId);
    });

    socket.on(SOCKET_EVENTS.USER_OFFLINE, ({ userId }: { userId: string }) => {
      optionsRef.current.onUserOffline?.(userId);
    });

    return () => {
      // Fix #2: Explicitly remove all listeners before disconnecting.
      // socket.off() with no arguments removes every registered handler,
      // preventing stale closures and phantom event firings on re-mount.
      socket.off();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  // ── Stable action callbacks ─────────────────────────────────────
  // All use socketRef so they never need to be recreated.
  const isConnected = useCallback(() => socketRef.current?.connected ?? false, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.JOIN_CONVERSATION, conversationId);
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string, tempId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.SEND_MESSAGE, { conversationId, content, tempId });
  }, []);

  const sendVoiceMessage = useCallback((conversationId: string, audioUrl: string, tempId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.SEND_VOICE_MESSAGE, { conversationId, audioUrl, tempId });
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.TYPING_START, conversationId);
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.TYPING_STOP, conversationId);
  }, []);

  // ── Contact notification relays ─────────────────────────────────
  // Emitted by the client AFTER the REST API succeeds, so the socket
  // server can reliably relay to the target user.

  const notifyContactRequest = useCallback((targetUserId: string) => {
    console.log(`[useSocket] notifyContactRequest called, targetUserId=${targetUserId}, socket connected=${socketRef.current?.connected}`);
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_CONTACT_REQUEST, { targetUserId });
  }, []);

  const notifyContactAccepted = useCallback((targetUserId: string, conversationId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_CONTACT_ACCEPTED, { targetUserId, conversationId });
  }, []);

  const notifyContactDeclined = useCallback((targetUserId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_CONTACT_DECLINED, { targetUserId });
  }, []);

  const notifyConversationRejoined = useCallback((targetUserId: string, conversationId: string) => {
    console.log(`[useSocket] notifyConversationRejoined, target=${targetUserId}, conv=${conversationId}`);
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_CONVERSATION_REJOINED, { targetUserId, conversationId });
  }, []);

  const notifyContactBlocked = useCallback((targetUserId: string, conversationId?: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_CONTACT_BLOCKED, { targetUserId, conversationId });
  }, []);

  const notifyContactDisconnected = useCallback((targetUserId: string, conversationId?: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_CONTACT_DISCONNECTED, { targetUserId, conversationId });
  }, []);

  const notifyMessageDeleted = useCallback((conversationId: string, messageId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_MESSAGE_DELETED, { conversationId, messageId });
  }, []);

  const notifyMessagesRead = useCallback((conversationId: string, readAt: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_MESSAGES_READ, { conversationId, readAt });
  }, []);

  const notifyLanguageChanged = useCallback((language: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.NOTIFY_LANGUAGE_CHANGED, { language });
  }, []);

  // Fix #useMemo: Stable object reference — prevents ChatWindow's useEffect
  // from re-running every time ChatPage re-renders due to state updates.
  // All callbacks have [] deps, so useMemo always returns the same object.
  return useMemo(
    () => ({
      isConnected, joinConversation, sendMessage, sendVoiceMessage, startTyping, stopTyping, connected,
      notifyContactRequest, notifyContactAccepted, notifyContactDeclined, notifyConversationRejoined,
      notifyContactBlocked, notifyContactDisconnected, notifyMessageDeleted, notifyMessagesRead,
      notifyLanguageChanged,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isConnected, joinConversation, sendMessage, sendVoiceMessage, startTyping, stopTyping, connected,
     notifyContactRequest, notifyContactAccepted, notifyContactDeclined, notifyConversationRejoined,
     notifyContactBlocked, notifyContactDisconnected, notifyMessageDeleted, notifyMessagesRead,
     notifyLanguageChanged]
  );
}

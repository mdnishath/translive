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
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      console.warn("[socket] connect error:", err.message);
      setConnected(false);
    });

    // ── Message events ──────────────────────────────────────────
    // Use window CustomEvents so deeply nested components (ChatWindow)
    // can subscribe without prop drilling.
    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, ({ message }: { message: Message }) => {
      optionsRef.current.onReceiveMessage?.(message);
      dispatch("socket:receive_message", { message });
    });

    socket.on(SOCKET_EVENTS.MESSAGE_SAVED, ({ tempId, message }: { tempId: string; message: Message }) => {
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

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.TYPING_START, conversationId);
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit(SOCKET_EVENTS.TYPING_STOP, conversationId);
  }, []);

  // Fix #useMemo: Stable object reference — prevents ChatWindow's useEffect
  // from re-running every time ChatPage re-renders due to state updates.
  // All 5 callbacks have [] deps, so useMemo always returns the same object.
  return useMemo(
    () => ({ isConnected, joinConversation, sendMessage, startTyping, stopTyping, connected }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isConnected, joinConversation, sendMessage, startTyping, stopTyping, connected]
  );
}

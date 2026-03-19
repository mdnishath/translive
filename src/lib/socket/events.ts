// Shared Socket.io event names
export const SOCKET_EVENTS = {
  // Client → Server
  JOIN_CONVERSATION: "join_conversation",
  SEND_MESSAGE: "send_message",
  SEND_VOICE_MESSAGE: "send_voice_message",
  TYPING_START: "typing_start",
  TYPING_STOP: "typing_stop",

  // Client → Server: relay contact notifications through the socket.
  // getIO() in Next.js API routes can return null when the route runs in a
  // different module context than server.ts, so the client emits these after
  // the API call succeeds and the server relays to the target user.
  NOTIFY_CONTACT_REQUEST: "notify_contact_request",
  NOTIFY_CONTACT_ACCEPTED: "notify_contact_accepted",
  NOTIFY_CONTACT_DECLINED: "notify_contact_declined",
  /** Client → Server: a conversation was reactivated (someone rejoined after leaving). */
  NOTIFY_CONVERSATION_REJOINED: "notify_conversation_rejoined",

  // Server → Client
  RECEIVE_MESSAGE: "receive_message",
  MESSAGE_SAVED: "message_saved",
  MESSAGE_ERROR: "message_error",
  USER_TYPING: "user_typing",
  USER_STOP_TYPING: "user_stop_typing",
  USER_ONLINE: "user_online",
  USER_OFFLINE: "user_offline",
  ONLINE_USERS: "online_users",
  /** Server → Client: a new conversation was created that involves this user. */
  NEW_CONVERSATION: "new_conversation",
  /** Server → Client: someone sent you a contact request. */
  CONTACT_REQUEST: "contact_request",
  /** Server → Client: your contact request was accepted. */
  CONTACT_ACCEPTED: "contact_accepted",
  /** Server → Client: your contact request was declined. */
  CONTACT_DECLINED: "contact_declined",
  /** Server → Client: a participant left a conversation. */
  CONVERSATION_LEFT: "conversation_left",
  /** Client → Server: user blocked a contact. */
  NOTIFY_CONTACT_BLOCKED: "notify_contact_blocked",
  /** Server → Client: you were blocked — remove conversation from sidebar. */
  CONTACT_BLOCKED: "contact_blocked",
  /** Client → Server: user disconnected a contact. */
  NOTIFY_CONTACT_DISCONNECTED: "notify_contact_disconnected",
  /** Server → Client: you were disconnected — remove conversation from sidebar. */
  CONTACT_DISCONNECTED: "contact_disconnected",
  /** Client → Server: a message was deleted for everyone. */
  NOTIFY_MESSAGE_DELETED: "notify_message_deleted",
  /** Server → Client: a message was deleted for everyone. */
  MESSAGE_DELETED: "message_deleted",
  /** Client → Server: user read messages in a conversation. */
  NOTIFY_MESSAGES_READ: "notify_messages_read",
  /** Server → Client: the other user read your messages. */
  MESSAGES_READ: "messages_read",
  /** Server → Client: a message's translation was refined by Claude. */
  TRANSLATION_REFINED: "translation_refined",
  /** Server → Client: voice message processing completed (STT + translation + TTS). */
  VOICE_PROCESSED: "voice_processed",
  /** Client → Server: user changed their language preference. */
  NOTIFY_LANGUAGE_CHANGED: "notify_language_changed",
  /** Server → Client: a contact changed their language preference. */
  LANGUAGE_CHANGED: "language_changed",
} as const;

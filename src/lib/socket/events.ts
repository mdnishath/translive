// Shared Socket.io event names
export const SOCKET_EVENTS = {
  // Client → Server
  JOIN_CONVERSATION: "join_conversation",
  SEND_MESSAGE: "send_message",
  TYPING_START: "typing_start",
  TYPING_STOP: "typing_stop",

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
} as const;

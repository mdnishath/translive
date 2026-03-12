/**
 * Global Socket.io instance accessor.
 *
 * server.ts creates the Socket.io Server and calls setIO() once at boot.
 * API routes (which run in the same Node.js process) call getIO() to emit
 * events without going through HTTP — e.g. notifying User B that a new
 * conversation was created for them.
 *
 * We store the reference on `global` so that Next.js hot-module replacement
 * in development mode doesn't reset it when modules are re-evaluated.
 */

import type { Server } from "socket.io";

declare global {
  // eslint-disable-next-line no-var
  var __socketIO: Server | undefined;
}

export function setIO(io: Server): void {
  global.__socketIO = io;
}

export function getIO(): Server | undefined {
  return global.__socketIO;
}

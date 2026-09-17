/**
 * @deprecated Use app/lib/db/* and app/lib/auth.js
 * Kept as a thin compatibility shim during migration.
 */
export { ensureDb as ensureSchema, getDb } from "./db/index.js";
export {
  hashPassword,
  verifyPassword,
  publicUser,
  getUserFromRequest,
  requireUser,
  createSessionForUser,
  destroySession,
  getSessionToken,
  setSessionCookie,
  clearSessionCookie
} from "./auth.js";

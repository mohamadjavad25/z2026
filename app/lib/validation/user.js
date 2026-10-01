import { z } from "zod";
import { isValidIranMobile } from "../auth.js";

/** POST /api/profile body.data shape. Every field optional (a partial
 *  update — repos/users.js's updateUser merges with the current row via
 *  `??`), but any field that IS present must be well-formed. phone was the
 *  confirmed gap: only registration validated it before this schema
 *  existed, so POST /api/profile could silently set phone to any string. */
export const profileUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().refine(isValidIranMobile, "شماره موبایل نامعتبر است.").optional(),
  area: z.string().trim().max(120).optional(),
  service: z.string().trim().max(120).optional(),
  email: z.string().trim().max(200).optional(),
  avatar: z.string().optional(),
  poster: z.string().optional(),
  avatarPosition: z.string().max(50).optional(),
  posterPosition: z.string().max(50).optional(),
  bio: z.string().trim().max(2000).optional(),
  experienceYears: z.string().max(20).optional(),
  managerName: z.string().trim().max(120).optional(),
  password: z.string().min(6).max(200).optional(),
  currentPassword: z.string().optional()
});

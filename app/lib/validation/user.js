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
  // The map pin of «ثبت لوکیشن»: null removes it. Plate / floor / unit go in addressDetail.
  geo: z.union([
    z.null(),
    z.object({
      lat: z.number().finite().min(-90).max(90),
      lng: z.number().finite().min(-180).max(180)
    })
  ]).optional(),
  addressDetail: z.string().trim().max(160).optional(),
  service: z.string().trim().max(120).optional(),
  email: z.string().trim().max(200).optional(),
  avatar: z.string().optional(),
  poster: z.string().optional(),
  avatarPosition: z.string().max(50).optional(),
  posterPosition: z.string().max(50).optional(),
  experienceYears: z.union([z.string(), z.number()]).transform((v) => String(v)).pipe(z.string().max(20)).optional(),
  managerName: z.string().trim().max(120).optional(),
  // "" means "not changing it" (the route ignores a falsy password).
  password: z.union([z.literal(""), z.string().min(6).max(200)]).optional(),
  currentPassword: z.string().optional()
});

/** The text fields of POST /api/auth/register, with the same ceilings as a profile edit. */
export const registerFieldsSchema = z.object({
  name: z.string().trim().max(120),
  area: z.string().trim().max(120),
  service: z.string().trim().max(120),
  email: z.string().trim().max(200)
});

/** Longest password accepted anywhere (a 30 MB "password" would otherwise be hashed in full). */
export const MAX_PASSWORD_LENGTH = 200;

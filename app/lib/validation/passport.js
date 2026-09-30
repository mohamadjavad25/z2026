import { z } from "zod";

/** POST /api/beauty-passport body. Matches the fields
 *  app/lib/db/repos/passport.js's savePassport reads (camelCase or
 *  snake_case, both accepted there) -- every field optional since the repo
 *  falls back to a sensible Persian default for each one. */
export const passportSchema = z.object({
  skinTone: z.string().trim().max(60).optional(),
  skin_tone: z.string().trim().max(60).optional(),
  undertone: z.string().trim().max(60).optional(),
  faceShape: z.string().trim().max(60).optional(),
  face_shape: z.string().trim().max(60).optional(),
  hairType: z.string().trim().max(60).optional(),
  hair_type: z.string().trim().max(60).optional(),
  signature: z.string().trim().max(120).optional(),
  summary: z.string().trim().max(2000).optional()
});

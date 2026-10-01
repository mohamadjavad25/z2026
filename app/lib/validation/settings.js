import { z } from "zod";

/** POST /api/profile/settings body. Matches DEFAULT_SETTINGS in
 *  app/lib/db/repos/userSettings.js -- the repo already only merges known
 *  keys (KNOWN_KEYS allowlist) and coerces every value to Boolean, so this
 *  schema is a defense-in-depth/early-400 layer, not the only guard. */
export const settingsPatchSchema = z.object({
  publicPortfolio: z.boolean().optional(),
  reservationAlerts: z.boolean().optional(),
  orderAlerts: z.boolean().optional(),
  shippingReady: z.boolean().optional(),
  smartSuggestions: z.boolean().optional(),
  showPrices: z.boolean().optional()
});

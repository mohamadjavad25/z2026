import { z } from "zod";
import { PLANS } from "../billing/plans.js";

/** POST /api/billing/checkout. forUserId: a salon paying for an artist on its team (optional). */
export const checkoutSchema = z.object({
  plan: z.enum(PLANS.map((plan) => plan.id), { message: "یه پلن انتخاب کن." }),
  forUserId: z.number().int().positive("یه آرتیست انتخاب کن.").optional()
});

/** PUT /api/admin/billing/settings */
export const billingSettingsSchema = z.object({
  enabled: z.boolean(),
  graceDays: z.number().int("مهلت باید عدد صحیح باشد.").min(0, "مهلت نمی‌تواند منفی باشد.").max(14, "مهلت حداکثر ۱۴ روز است."),
  // Switching on from off: every account's free month starts again from today (owner's decision 2026-10-28).
  restartFreeDays: z.boolean().optional()
});

/** POST /api/admin/billing/payments/:id { action: "refund" }: what went back to the payer and the days taken off. */
export const refundSchema = z.object({
  action: z.literal("refund"),
  amountToman: z.number().int("مبلغ باید عدد صحیح باشد.").min(1, "مبلغ بازپرداخت را بنویس.").max(1_000_000_000, "مبلغ بیش از حد است."),
  days: z.number().int("تعداد روز باید عدد صحیح باشد.").min(0, "روزها نمی‌تواند منفی باشد.").max(730, "حداکثر ۷۳۰ روز."),
  note: z.string().trim().min(3, "دلیل یا شمارهٔ پیگیری بازپرداخت را بنویس (حداقل ۳ حرف).").max(300, "توضیح حداکثر ۳۰۰ حرف است.")
});

/** POST /api/admin/billing/grant: days to add, and the toman taken outside the app (0 for a gift). */
export const grantSchema = z.object({
  userId: z.number().int().positive("حساب معتبر نیست."),
  days: z.number().int("تعداد روز باید عدد صحیح باشد.").min(1, "حداقل یک روز.").max(730, "حداکثر ۷۳۰ روز در هر بار."),
  amountToman: z.number().int("مبلغ باید عدد صحیح باشد.").min(0, "مبلغ نمی‌تواند منفی باشد.").max(1_000_000_000, "مبلغ بیش از حد است.").default(0),
  note: z.string().trim().min(3, "دلیل یا توضیح را بنویس (حداقل ۳ حرف).").max(300, "توضیح حداکثر ۳۰۰ حرف است.")
});

/** PUT /api/admin/billing/test-accounts: the owner's own numbers that are always free and never listed (owner's request 2026-10-28). */
export const testAccountsSchema = z.object({
  phones: z.array(z.string().trim().regex(/^09\d{9}$/, "شماره باید موبایل و با ۰۹ شروع شود، مثل ۰۹۱۲۳۴۵۶۷۸۹.")).max(10, "حداکثر ۱۰ شماره.")
});

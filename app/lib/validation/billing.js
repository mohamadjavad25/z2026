import { z } from "zod";
import { PLANS } from "../billing/plans.js";

/** POST /api/billing/checkout */
export const checkoutSchema = z.object({
  plan: z.enum(PLANS.map((plan) => plan.id), { message: "پلن انتخاب‌شده معتبر نیست." })
});

/** PUT /api/admin/billing/settings */
export const billingSettingsSchema = z.object({
  enabled: z.boolean(),
  graceDays: z.number().int("مهلت باید عدد صحیح باشد.").min(0, "مهلت نمی‌تواند منفی باشد.").max(14, "مهلت حداکثر ۱۴ روز است."),
  salonCoversArtists: z.boolean()
});

/** POST /api/admin/billing/grant: days to add, and the toman taken outside the app (0 for a gift). */
export const grantSchema = z.object({
  userId: z.number().int().positive("حساب معتبر نیست."),
  days: z.number().int("تعداد روز باید عدد صحیح باشد.").min(1, "حداقل یک روز.").max(730, "حداکثر ۷۳۰ روز در هر بار."),
  amountToman: z.number().int("مبلغ باید عدد صحیح باشد.").min(0, "مبلغ نمی‌تواند منفی باشد.").max(1_000_000_000, "مبلغ بیش از حد است.").default(0),
  note: z.string().trim().min(3, "دلیل یا توضیح را بنویس (حداقل ۳ حرف).").max(300, "توضیح حداکثر ۳۰۰ حرف است.")
});

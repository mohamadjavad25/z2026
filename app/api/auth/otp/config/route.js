import { json, withErrorHandling } from "../../../../lib/http.js";
import { otpConfig } from "../../../../lib/otp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tells the sign-up / forgot-password screens whether SMS codes exist (and whether sign-up needs one). */
async function _GET() {
  return json({ data: otpConfig() });
}

export const GET = withErrorHandling(_GET);

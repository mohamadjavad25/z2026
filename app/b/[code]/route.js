import { providerLinkPath } from "../../shared/lib/providerLink.js";

/** frfro.ir/b/<code> from the SMS: on to that salon's or artist's page; a broken code lands on the home page. */
export async function GET(_request, { params }) {
  const { code } = await params;
  return new Response(null, { status: 302, headers: { Location: providerLinkPath(code) || "/" } });
}

import { publicPathFromShort } from "../../shared/lib/shortLink.js";

// A relative address: behind nginx this app's own request URL says localhost, not frfro.ir.
export async function GET(_request, { params }) {
  const { id } = await params;
  return new Response(null, { status: 307, headers: { Location: publicPathFromShort("artist", id) } });
}

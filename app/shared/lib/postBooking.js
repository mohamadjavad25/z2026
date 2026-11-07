/**
 * The bridge between a post and the booking menu of the page behind it (owner, 2026-11-07): a work that is a sample of
 * a service shows that service in the post, and «همین رو می‌خوام» picks it in the menu. The public page's services menu
 * registers here, because a post can open from three different places; with no menu mounted (a saved post, a paused
 * page) a post simply shows no service.
 */
let current = null;

/** `booking` is { services, pick(service) }. Returns the call that removes it. */
export function setPostBooking(booking) {
  current = booking;
  return () => {
    if (current === booking) current = null;
  };
}

/** The bookable service this post is a sample of, as { service, book() }, or null. */
export function postBookingFor(postId) {
  const id = Number(postId);
  if (!current || !id) return null;
  const booking = current;
  const service = booking.services.find((item) => item.photos?.some((photo) => Number(photo.postId) === id));
  return service ? { service, book: () => booking.pick(service) } : null;
}

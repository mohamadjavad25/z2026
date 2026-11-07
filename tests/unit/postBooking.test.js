import { describe, expect, it, vi } from "vitest";
import { postBookingFor, setPostBooking } from "../../app/shared/lib/postBooking.js";

const services = [{ id: 1, name: "کوتاهی مو", photos: [{ postId: 31 }] }, { id: 2, name: "مانیکور", photos: [] }];

describe("a post that is a sample of a service", () => {
  it("finds the service and picks it in the menu", () => {
    const pick = vi.fn();
    const remove = setPostBooking({ services, pick });
    const found = postBookingFor("31");
    expect(found.service.name).toBe("کوتاهی مو");
    found.book();
    expect(pick).toHaveBeenCalledWith(services[0]);
    remove();
  });

  it("shows nothing for a post without a service, or with no menu on the page", () => {
    const remove = setPostBooking({ services, pick: () => {} });
    expect(postBookingFor(99)).toBeNull();
    remove();
    expect(postBookingFor(31)).toBeNull();
  });

  it("an old page leaving does not remove the newer page's menu", () => {
    const removeOld = setPostBooking({ services: [], pick: () => {} });
    const removeNew = setPostBooking({ services, pick: () => {} });
    removeOld();
    expect(postBookingFor(31)).not.toBeNull();
    removeNew();
  });
});

import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { formatPersianDateKey, resolveRollingPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { clientBookingDays } from "../../app/features/artist/constants.js";

vi.mock("../../app/features/profile/ProfileSheet.jsx", () => ({ ProfileSheet: () => null }));
const { SalonTeamRequests, mergeSalonWorks, teamWorkItems } = await import("../../app/features/salons/SalonTeamPostsPanel.jsx");
const { ProfileGallery } = await import("../../app/features/profile/ProfileGallery.jsx");

const DAY_MS = 24 * 60 * 60 * 1000;

// Owner, 2026-11-08: a client on an artist's page saw only seven days, and the day labels were read by weekday alone,
// so a longer list would have booked «شنبه ۲۴ آبان» on the coming Saturday instead.
describe("an artist's days for a client", () => {
  it("reach sixty days ahead, like a salon", () => {
    expect(clientBookingDays()).toHaveLength(61);
  });

  it("each label means its own date, not the next day with that weekday", () => {
    const from = new Date("2026-11-08T08:00:00Z");
    const days = clientBookingDays();
    const today = Date.now();
    days.forEach((label, index) => {
      expect(resolveRollingPersianDateKey(label)).toBe(formatPersianDateKey(new Date(today + index * DAY_MS)));
    });
    expect(resolveRollingPersianDateKey("یکشنبه ۲۴ آبان", from)).toBe("1405-08-24");
    expect(resolveRollingPersianDateKey("یکشنبه ۱ آذر", from)).toBe("1405-09-01");
    expect(resolveRollingPersianDateKey("شنبه", from)).toBe("1405-08-23");
  });

  it("a label whose weekday does not fit its date keeps the old weekday reading", () => {
    const from = new Date("2026-11-08T08:00:00Z");
    expect(resolveRollingPersianDateKey("جمعه ۱۰ آبان", from)).toBe("1405-08-22");
  });
});

// Owner, 2026-11-08: on the salon's «نمونه‌کار» tab the first work sat at the far left with a gap after
// «نمونه‌کار تازه», and the team's works had a big box of their own.
describe("the salon's works tab", () => {
  it("runs right to left from «نمونه‌کار تازه», like the artist's", () => {
    const legacy = readFileSync(new URL("../../app/styles/legacy/part-10.css", import.meta.url), "utf8");
    const portfolioGrid = legacy.slice(legacy.indexOf(".salonWorkspacePanel.is-portfolio .profileGalleryGrid.is-mosaic {"));
    expect(portfolioGrid.slice(0, 400)).not.toMatch(/direction:\s*ltr/);
    const add = readFileSync(new URL("../../app/styles/features/galleryAdd.css", import.meta.url), "utf8");
    expect(add).toMatch(/\.galleryAddTile \{ grid-row: 1; grid-column: 1; \}/);
    expect(add).not.toMatch(/grid-column: 3/);
  });

  it("mixes the team's works into the grid, newest first, with the salon's pinned work on top", () => {
    const salon = [
      { id: 1, title: "مو", createdAt: "2026-11-01T10:00:00Z" },
      { id: 2, title: "پین", featured: true, createdAt: "2026-10-01T10:00:00Z" }
    ];
    const team = teamWorkItems([{ postId: 9, artistName: "الهام نوری", image: "/x.jpg", createdAt: "2026-11-05T10:00:00Z" }]);
    expect(team[0]).toMatchObject({ id: "team-9", teamPostId: 9, teamArtistName: "الهام نوری", title: "" });
    expect(mergeSalonWorks(salon, team).map((item) => item.id)).toEqual([2, "team-9", 1]);
    expect(mergeSalonWorks(salon, [])).toBe(salon);
  });

  it("puts the artist's name on a team tile", () => {
    const html = renderToStaticMarkup(createElement(ProfileGallery, {
      label: "نمونه‌کارها",
      items: teamWorkItems([{ postId: 9, artistName: "الهام نوری", image: "/x.jpg" }])
    }));
    expect(html).toContain('<span class="profileGalleryCardBy">الهام نوری</span>');
  });

  it("shows waiting works as one row, and nothing when none wait", () => {
    const team = { requests: [{ postId: 1, artistName: "الهام", image: "/a.jpg" }, { postId: 2, artistName: "ترانه", image: "" }], busyId: null, decide: () => {} };
    const html = renderToStaticMarkup(createElement(SalonTeamRequests, { team }));
    expect(html).toContain("۲ نمونه‌کار منتظر جوابته");
    expect(html).not.toContain("پست");
    expect(renderToStaticMarkup(createElement(SalonTeamRequests, { team: { ...team, requests: [] } }))).toBe("");
  });
});

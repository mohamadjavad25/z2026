import { afterEach, describe, expect, it } from "vitest";
import { dismissNotice, getNotices, notify } from "../../app/shared/notice/noticeStore.js";

afterEach(() => {
  for (const notice of getNotices()) dismissNotice(notice.id);
});

describe("notice steps sheet", () => {
  it("shows the short title on top and the steps in one sheet", () => {
    notify({ title: "لینک کپی شد", steps: { title: "حالا توی اینستاگرام بذارش", items: ["یک", "دو"] } });
    const [top, sheet] = getNotices();
    expect(top.kind).toBe("island");
    expect(top.title).toBe("لینک کپی شد");
    expect(top.steps).toBeUndefined();
    expect(sheet.kind).toBe("steps");
    expect(sheet.items).toEqual(["یک", "دو"]);
    expect(sheet.timer).toBe(0);
  });

  it("keeps a single sheet and never drops it to make room on top", () => {
    notify({ title: "a", steps: { items: ["one"] } });
    notify({ title: "b", steps: { items: ["two"] } });
    for (const title of ["c", "d", "e", "f"]) notify(title);
    const notices = getNotices();
    const sheets = notices.filter((notice) => notice.kind === "steps");
    expect(sheets).toHaveLength(1);
    expect(sheets[0].items).toEqual(["two"]);
    expect(notices.filter((notice) => notice.kind !== "steps")).toHaveLength(3);
  });
});

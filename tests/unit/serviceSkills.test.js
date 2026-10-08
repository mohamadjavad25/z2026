import { describe, it, expect } from "vitest";
import {
  resolveServiceStaff,
  skillGroupsForService,
  skillGroupsForStaff,
  splitServiceStaffChoice,
  staffCanDoService
} from "../../app/shared/lib/serviceSkills.js";

const nails = { id: 1, name: "Sara", role: "ناخن‌کار" };
const colour = { id: 2, name: "Nima", artist_service: "رنگ و لایت" };
const allRound = { id: 3, name: "Me", role: "ناخن، میکاپ", is_owner: true };
const staff = [nails, colour, allRound];

describe("service skills", () => {
  it("reads a member's skills from their field of work, whatever the spacing", () => {
    expect(skillGroupsForStaff(nails)).toEqual(["nails"]);
    expect(skillGroupsForStaff({ role: "ابرو و پوست" })).toEqual(["brow_lash", "skin"]);
    expect(skillGroupsForStaff(allRound).sort()).toEqual(["makeup", "nails"]);
  });

  it("keeps close services apart", () => {
    expect(skillGroupsForService({ name: "کوتاهی مو" })).toEqual(["hair_cut_style"]);
    expect(skillGroupsForService({ name: "رنگ ریشه" })).toEqual(["hair_color"]);
    expect(skillGroupsForService({ name: "بوتاکس مو" })).toEqual(["hair_treatment"]);
    expect(skillGroupsForService({ name: "تزریق بوتاکس" })).toEqual(["clinic"]);
    expect(skillGroupsForService({ name: "اکستنشن مژه" })).toEqual(["brow_lash"]);
    expect(skillGroupsForService({ name: "پارافین و اسپای دست" })).toEqual(["nails"]);
    expect(staffCanDoService(colour, { name: "کوتاهی مو" })).toBe(false);
  });

  it("links matching members automatically, then honours hand-added and hand-removed ones", () => {
    const manicure = { name: "مانیکور", emoji: "manicure" };
    expect(resolveServiceStaff(manicure, staff, { manual: [], excluded: [] }).effective).toEqual(["1", "3"]);

    // The salon removes Sara and adds Nima by hand.
    const choice = splitServiceStaffChoice(manicure, staff, ["3", "2"]);
    expect(choice).toEqual({ manual: ["2"], excluded: ["1"] });
    expect(resolveServiceStaff(manicure, staff, choice).effective.sort()).toEqual(["2", "3"]);

    // A nail artist who joins later is picked up without anyone touching the service.
    const later = [...staff, { id: 4, name: "Lili", artist_service: "ناخن" }];
    expect(resolveServiceStaff(manicure, later, choice).effective.sort()).toEqual(["2", "3", "4"]);
  });

  it("drops hand-picked ids of members who left", () => {
    expect(resolveServiceStaff({ name: "مانیکور" }, [nails], { manual: ["9"], excluded: [] }).effective).toEqual(["1"]);
  });
});

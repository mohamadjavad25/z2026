import { useMemo } from "react";
import { buildExactBookingDateTabsCentered } from "../artist";

export function useSalonDerived({
  salonServiceList,
  safeSalonStaffList,
  selectedStaffName,
  salonAppointmentList,
  salonCollabRequestList,
  salonDirectory,
  createdProfile,
  salonPortfolioList,
  artistServiceList,
  salonHoursList
}) {
  // Post categories are exactly the services on this owner's menu.
  const salonWorkTagOptions = useMemo(
    () => Array.from(new Set(salonServiceList.map((item) => String(item.name || "").trim()).filter(Boolean))),
    [salonServiceList]
  );

  // Centered on today (3 days back, today, 3 days forward) rather than
  // today-forward-only, so the salon hero week strip can scroll both
  // directions with today in the middle. Kept to a single 7-day span so
  // weekday names (used as the select key elsewhere below) stay unique.
  const salonScheduleWeekTabs = useMemo(() => buildExactBookingDateTabsCentered(3, 3), []);

  const selectedSalonStaff = useMemo(() => {
    return safeSalonStaffList.find((person) => person.name === selectedStaffName) || safeSalonStaffList[0] || null;
  }, [safeSalonStaffList, selectedStaffName]);

  const selectedStaffAppointments = useMemo(() => {
    if (!selectedSalonStaff) return [];
    return salonAppointmentList.filter((item) => item.staff === selectedSalonStaff.name);
  }, [salonAppointmentList, selectedSalonStaff]);

  const activeStaffCount = useMemo(() => {
    return safeSalonStaffList.filter((person) => person.state !== "مرخصی").length;
  }, [safeSalonStaffList]);

  const salonDynamicMetrics = useMemo(() => ([
    { label: "رزرو", value: salonAppointmentList.length, hint: "از دیتابیس" },
    { label: "پرسنل", value: safeSalonStaffList.length, hint: "عضو فعال" },
    { label: "خدمات", value: salonServiceList.length, hint: "منوی واقعی" },
    { label: "همکاری", value: salonCollabRequestList.filter((item) => item.status === "آماده ارسال").length, hint: "پیشنهاد" }
  ]), [salonAppointmentList.length, safeSalonStaffList.length, salonServiceList.length, salonCollabRequestList]);

  const salonSocialStats = useMemo(() => {
    const ownSalon = salonDirectory.find((salon) => (
      String(salon.id) === String(createdProfile?.id)
      || String(salon.source_key) === String(createdProfile?.id)
      || salon.name === createdProfile?.data?.name
    ));
    return {
      followers: Number(ownSalon?.follower_count ?? ownSalon?.followerCount ?? createdProfile?.data?.follower_count ?? 0),
      following: Number(ownSalon?.following_count ?? ownSalon?.followingCount ?? createdProfile?.data?.following_count ?? 0),
      posts: salonPortfolioList.length
    };
  }, [salonDirectory, createdProfile, salonPortfolioList.length]);

  const activeServiceManagerList = createdProfile?.type === "salon" ? salonServiceList : artistServiceList;

  const activeSalonHours = salonHoursList.filter((hour) => hour.active);

  return {
    salonWorkTagOptions,
    salonScheduleWeekTabs,
    activeStaffCount,
    salonSocialStats,
    activeServiceManagerList,
    activeSalonHours
  };
}

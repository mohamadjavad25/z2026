"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Bell,
  BarChart3,
  Bookmark,
  CalendarCheck,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  Coffee,
  Crop,
  Crown,
  Eye,
  GripVertical,
  Heart,
  ImagePlus,
  LayoutGrid,
  LogIn,
  MapPin,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Package,
  Plus,
  Send,
  Share2,
  Palette,
  Pencil,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Timer,
  Trash2,
  Truck,
  Upload,
  UserPlus,
  UserRound,
  Wallet,
  WandSparkles,
  X
} from "lucide-react";
import { SegmentClock, toLatinDigits } from "../../components/SegmentClock";
import { BreakTimeWheel } from "../../components/BreakTimeWheel";
import { BookingSelect } from "../../components/BookingSelect";
import { MarbleRatingStars } from "../../components/MarbleRatingStars";
import { toPersianDigits } from "../../shared/lib/digits";
import { ensureShebaIR, formatShopPrice, formatToman, parseTomanAmount } from "../../shared/lib/money";
import { formatCount, formatRating, parseNumericRating } from "../../shared/lib/rating";
import {
  buildClockOptions,
  buildDayBookingSlots,
  buildPublicBookingSlots,
  buildUpcomingWeekDays,
  parseServiceDurationMinutes,
  SALON_HOUR_TIME_OPTIONS,
  shortPersianWeekday,
  timeLabelToMinutes
} from "../../shared/lib/time";
import { categories, shopCategories } from "../../shared/constants/categories";
import {
  artistSpecialties,
  profileRoleMeta,
  profileRoles,
  salonArtistRoleOptions,
  salonArtistStatusOptions,
  salonRegistrationServices,
  shopRegistrationCategories
} from "../../shared/constants/roles";
import { aiCreatorLooks, aiCreatorStyles } from "../ai-studio/constants";
import {
  artistAvailableSlots,
  artistBookingHistoryFilters,
  artistBookingHistoryRank,
  buildArtistBookingWeekTabs,
  filterArtistBookingsByHistory,
  getArtistBookingDayRank,
  getArtistBookingHistoryKey,
  getArtistBookingSortKey,
  getArtistBookingStatusKey,
  getArtistClientVisits,
  isArtistBookingOnSelectedDay,
  isPublicArtistSlotBlocked,
  mapArtistBooking,
  sortArtistBookingsNearest
} from "../artist/bookingUtils";
import { artistBookingDays, getPublicArtistServices, salonClientBookingDays } from "../artist/constants";
import {
  defaultArtistRailDock,
  getArtistRailDockStyle,
  readArtistRailDock,
  snapArtistRailDock
} from "../artist/railUtils";
import { AUTH_SESSION_KEY, normalizeProfile, readAuthSession, writeAuthSession } from "../auth/constants";
import { mapExplorePost, mapPortfolioItem } from "../explore/mappers";
import { salonOwnerInbox, salonServiceCatalog } from "../salons/constants";
import {
  getShopProductTone,
  mapShopCard,
  mapShopProduct,
  resolveShopProductBadge,
  shopChatQuickReplies,
  shopProductAspectPresets,
  shopProductBadges,
  shopProductEnhancePresets
} from "../shops/mappers";
import { renderShopProductCanvas } from "../shops/productImage";

const initialArtistServices = [];
const initialArtistPortfolioItems = [];
const initialArtistBookings = [];
const artistReviews = [];
const initialShopProducts = [];
const shopOrders = [];
const shopSalesInsights = [];
const shopFinanceSnapshot = [
  { label: "درآمد هفته", value: "۲۶.۴ م", hint: "+۹٪ رشد", icon: "trend" },
  { label: "تسویه در انتظار", value: "۳.۲ م", hint: "واریز تا ۲ روز", icon: "wallet" },
  { label: "قابل برداشت", value: "۸.۶ م", hint: "آماده انتقال", icon: "cash" }
];
const shopFinanceTransactions = [
  { id: "f1", title: "تسویه سفارش‌های دیروز", amount: "+۲.۴ م", time: "امروز ۰۹:۱۰", type: "in" },
  { id: "f2", title: "کارمزد ارسال فوری", amount: "-۱۸۰ ه", time: "دیروز ۱۸:۴۰", type: "out" },
  { id: "f3", title: "فروش مستقیم ZB-1042", amount: "+۹۶۰ ه", time: "امروز ۱۱:۲۲", type: "in" },
  { id: "f4", title: "بازگشت وجه ZB-1031", amount: "-۶۵۰ ه", time: "۳ روز پیش", type: "out" }
];
const salonDetailTeam = [];
const salonDetailPortfolio = [];
const explorePosts = [];
const exploreArtistCatalog = {};
const shopStorefrontCatalog = [];
const shopOwnerInbox = [];
const artistOwnerInbox = [];
const shopStorefrontReviews = [];
const cosmeticShops = [];
const profileBoards = {
  client: [
    { title: "فرنچ کروم رز", meta: "ذخیره‌شده از اکسپلور", tile: "tile1", tag: "ناخن" },
    { title: "بالیاژ کاراملی", meta: "مناسب تناژ گرم", tile: "tile3", tag: "مو" },
    { title: "میکاپ نود", meta: "برای تست بعدی AI", tile: "tile4", tag: "میکاپ" },
    { title: "ابروی طبیعی", meta: "مدل پیشنهادی", tile: "tile5", tag: "ابرو" }
  ],
  salon: [
    { title: "نمونه‌کار ناخن", meta: "آماده انتشار", tile: "tile1", tag: "ناخن" },
    { title: "رنگ موی لوکس", meta: "پست پیشنهادی هفته", tile: "tile3", tag: "مو" },
    { title: "میکاپ گلوئی", meta: "مناسب جذب رزرو", tile: "tile4", tag: "میکاپ" },
    { title: "جزئیات عروس", meta: "کالکشن ویژه", tile: "tile8", tag: "عروس" }
  ]
};
const myModelCards = [
  { title: "موی کوتاه فشن", meta: "نچرال، تمیز، دهه ۹۰", tile: "model1", tag: "مو" },
  { title: "ناخن دارک طرح‌دار", meta: "لوکس با جزئیات طلایی", tile: "model2", tag: "ناخن" },
  { title: "میکاپ نچرال", meta: "پوست شفاف و خط چشم نرم", tile: "model3", tag: "صورت" },
  { title: "استایل شب مینیمال", meta: "خاص، مدرن، آماده رزرو", tile: "model4", tag: "AI" }
];
const salonAppointments = [
  { time: "۱۰:۳۰", client: "نازی", service: "ژلیش دارک", staff: "مهسا", status: "تایید" },
  { time: "۱۳:۰۰", client: "رها", service: "رنگ ریشه", staff: "لنا", status: "در انتظار" },
  { time: "۱۶:۱۵", client: "سارا", service: "میکاپ نود", staff: "آوا", status: "VIP" }
];
const reservationRequests = [];
const salonStaff = [
  { name: "مهسا", role: "ناخن‌کار", booked: "۵ وقت", state: "فعال" },
  { name: "لنا", role: "رنگ و لایت", booked: "۳ وقت", state: "آزاد ۱۵:۳۰" },
  { name: "آوا", role: "میکاپ", booked: "۲ وقت", state: "فعال" }
];
const salonServices = [
  { name: "ناخن", price: "از ۶۵۰ ه", duration: "۹۰ دقیقه" },
  { name: "رنگ مو", price: "از ۱.۸ م", duration: "۱۸۰ دقیقه" },
  { name: "میکاپ", price: "از ۲.۴ م", duration: "۱۲۰ دقیقه" }
];
const salonLeads = [
  { name: "الهام", need: "بالیاژ کاراملی", match: "۹۱٪", source: "اکسپلور" },
  { name: "مینا", need: "ناخن دارک", match: "۸۸٪", source: "شناسنامه زیبایی" },
  { name: "ترانه", need: "میکاپ نود", match: "۸۴٪", source: "رزرو نزدیک" }
];
const salonInventory = [
  { item: "رنگ ۷.۳", level: "کم", tone: "warn" },
  { item: "ژل بیس", level: "خوب", tone: "ok" },
  { item: "اکسیدان ۶٪", level: "متوسط", tone: "mid" }
];
const salonTasks = [
  "تایید ۲ رزرو در انتظار",
  "آپلود ۳ نمونه‌کار هفته",
  "تنظیم ظرفیت مهسا برای پنجشنبه"
];

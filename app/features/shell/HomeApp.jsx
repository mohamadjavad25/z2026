"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Bookmark,
  CalendarClock,
  Crop,
  Eye,
  MapPin,
  Package,
  Palette,
  Pencil,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  Upload,
  UserRound,
  Wallet,
  Percent
} from "lucide-react";
import { BookingSelect } from "../../components/BookingSelect";
import { toPersianDigits } from "../../shared/lib/digits";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import {
  buildClockOptions,
  buildUpcomingWeekDays,
  getTodayPersianWeekday,
  parseServiceDurationMinutes,
  SALON_HOUR_TIME_OPTIONS,
  timeLabelToMinutes
} from "../../shared/lib/time";
import {
  formatRelativeBookingDayLabel,
  isPersianDateKey
} from "../../shared/lib/persianCalendar";
import {
  profileRoleMeta,
  salonArtistRoleOptions,
  salonArtistStatusOptions,
  shopRegistrationCategories
} from "../../shared/constants/roles";
import {
  ArtistBookingRail,
  ArtistBreakEditorModal,
  ArtistCollabBoard,
  ArtistOverviewReviews,
  ArtistServicesPanel,
  ArtistWorkPreviewModal,
  PublicArtistModal,
  buildExactBookingDateTabs,
  buildExactBookingDateTabsCentered,
  getArtistRailDockStyle,
  getBookingDateKey,
  getBookingDateOffsetDays,
  isArtistBookingOnExactDate,
  isArtistBookingOnSelectedDay,
  artistBookingDays,
  artistAvailableSlots,
  useArtistWorkspace,
  usePublicArtistProfile
} from "../artist";
import {
  AuthGateForms,
  createLogoutUiGapResets,
  normalizeProfile,
  useAuthSession
} from "../auth";
import {
  ExplorePage,
  ExplorePreviewModal,
  ExploreRatingModal,
  useExploreFeed
} from "../explore";
import {
  ClientBookingSettingsModal,
  ClientBookingsPanel,
  ClientOrdersPanel,
  ClientProfileOverview
} from "../client";
import { getMyShopOrders } from "../../shared/api/shops";
import { getSaves } from "../../shared/api/saves";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { ProfileGallery } from "../profile/ProfileGallery";
import { ProfileHero } from "../profile/ProfileHero";
import { ProfileModeRail } from "../profile/ProfileModeRail";
import { BookingCreateForm } from "../profile/BookingCreateForm";
import { BookingSheet } from "../profile/BookingSheet";
import {
  normalizeArtistScheduleBooking,
  normalizeSalonScheduleBooking,
  withScheduleTimeline
} from "../profile/ScheduleRow";
import { OwnerChatSheet } from "../profile/OwnerChatSheet";
import { ProfileSavedPosts } from "../profile/ProfileSavedPosts";
import { ProfileSettingsSheet } from "../profile/ProfileSettingsSheet";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceComposerModal } from "../profile/ServiceComposerModal";
import {
  SalonClientBookingModal,
  SalonClientPage,
  SalonCreateStaffModal,
  SalonNearbyInviteSheet,
  SalonServicesWorkspace,
  SalonStaffProfileModal,
  SalonStaffWorkspace,
  SalonToolSheets,
  salonServiceCatalog,
  useSalonDirectory,
  useSalonWorkspace,
  getVisibleSalonServiceItems
} from "../salons";
import {
  ArtistScheduleBoard,
  SalonScheduleDashboard,
  ScheduleBookingMenuModal
} from "../schedule";
import { WalletPage, useWalletWorkspace } from "../wallet";
import { AuthBootScreen } from "./AuthBootScreen";

import { BottomNav } from "./BottomNav";
import { ChatComposeFab } from "./ChatComposeFab";
import { ChatPage } from "./ChatPage";
import { ClientProfileModal } from "./ClientProfileModal";
import { MobileFloatingCta } from "./MobileFloatingCta";
import { useBookingCreateSheet } from "./useBookingCreateSheet";
import { useChat } from "../chat/useChat";
import { useProfileEditor } from "./useProfileEditor";
import { useScheduleBookingMenu } from "./useScheduleBookingMenu";
import { useServiceComposer } from "./useServiceComposer";
import { ProfileEditModal } from "./ProfileEditModal";
import { SalonClientFloatingDock } from "./SalonClientFloatingDock";
import {
  artistReviews,
  cosmeticShops,
  exploreArtistCatalog,
  explorePosts,
  initialArtistBookings,
  initialArtistPortfolioItems,
  initialArtistServices,
  initialShopProducts,
  profileBoards,
  salonAppointments,
  salonDetailPortfolio,
  salonDetailTeam,
  salonInventory,
  salonServices,
  salonStaff,
  salonTasks
} from "./mockData";
import { ShellSidebar } from "./ShellSidebar";
import {
  getShopProductTone,
  ShopCatalogPanel,
  ShopInsightsPanel,
  ShopOrdersPanel,
  ShopOwnerDock,
  ShopProductDetailModal,
  ShopProductEditorSheet,
  ShopProductsOverview,
  ShopStorefrontPage,
  ShopStoreDock,
  shopProductAspectPresets,
  shopProductBadges,
  shopProductEnhancePresets,
  useShopWorkspace
} from "../shops";
export function HomeApp() {
  const [activeTab, setActiveTab] = useState("profile");
  // True only while viewing the storefront via the owner's own "پیش‌نمایش
  // صفحه عمومی" button — makes "بازگشت" return to the shop's own dashboard
  // instead of the general shop directory, so the preview feels like a
  // self-contained round trip rather than dropping the owner into browsing.
  const [shopPreviewFromDashboard, setShopPreviewFromDashboard] = useState(false);
  const [chatPane, setChatPane] = useState("inbox");
  const [chatInitialPane, setChatInitialPane] = useState("inbox");
  // Bumped by the floating compose button (ChatComposeFab, rendered outside
  // ChatPage so it can sit fixed above the bottom nav) to tell ChatPage
  // "open the new-group picker" — see composerSignal in ChatPage.
  const [chatComposerSignal, setChatComposerSignal] = useState(0);
  // True only while the full chat tab was reached via "expand" from a shop's
  // own storefront mini-chat — lets exiting the conversation land back on
  // that shop page instead of the generic chat inbox.
  const [chatOpenedFromShop, setChatOpenedFromShop] = useState(false);
  const refreshExploreFeedRef = useRef(null);
  const refreshArtistWorkspaceRef = useRef(null);
  const notifyArtistBookingCreatedRef = useRef(null);
  const applySalonBookingsRef = useRef(null);
  const authCascadeRef = useRef({});
  const [appToast, setAppToast] = useState("");
  const [clientBookingSettings, setClientBookingSettings] = useState(null);
  const [beautyPassport, setBeautyPassport] = useState(null);
  const [followedArtists, setFollowedArtists] = useState([]);
  // Full card data for the "ذخیره‌شده‌ها" (saved) profile tab — from
  // GET /api/saves, refreshed alongside follows (see refreshSaves below).
  // savedSalonKeys/savedArtists (id-only, for button state) live in
  // useSalonDirectory / usePublicArtistProfile respectively and are seeded
  // from the same response's savedTargetIds.
  const [savedProfiles, setSavedProfiles] = useState({ salons: [], artists: [] });
  const [scheduleViewDay, setScheduleViewDay] = useState("");
  const [salonWeekHistoryOpen, setSalonWeekHistoryOpen] = useState(false);
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  // Client's own purchase history (buyer side) — see getMyShopOrders() /
  // GET /api/shop/orders. `clientOrdersLoaded` (not just "loading") is what
  // the empty state in ClientOrdersPanel keys off of, so a fetch still in
  // flight is never shown as "no orders yet".
  const [clientOrderList, setClientOrderList] = useState([]);
  const [clientOrdersLoaded, setClientOrdersLoaded] = useState(false);
  const [clientOrdersError, setClientOrdersError] = useState("");


  const {
    authChecked,
    createdProfile,
    setCreatedProfile,
    profileType,
    setProfileType,
    profileView,
    setProfileView,
    authMode,
    setAuthMode,
    signupStep,
    setSignupStep,
    authNotice,
    setAuthNotice,
    authBusy,
    sessionLockedRef,
    lockSession,
    writeAuthSession,
    handleLoginSubmit,
    handleProfileSubmit,
    logoutAccount
  } = useAuthSession({
    onEnterTab: setActiveTab,
    onShellNotice: setAppToast,
    onPublicBoot: async ({ isStale, salonsPayload }) => {
      const c = authCascadeRef.current;
      void c.refreshExploreFeed?.();
      void c.refreshShopDirectory?.();
      if (isStale()) return;
      c.setSalonDirectory?.(salonsPayload?.salons || salonsPayload?.data?.salons || []);
    },
    onGuestBoot: async () => {
      const c = authCascadeRef.current;
      c.resetWalletState?.();
      c.setWalletLoading?.(false);
      setBeautyPassport(null);
    },
    onAuthenticated: async (profile, { source, isStale }) => {
      const c = authCascadeRef.current;
      if (source === "login") {
        await c.refreshExploreFeed?.();
        await c.refreshShopDirectory?.();
        await c.refreshFollows?.();
        await c.refreshSaves?.();
        try {
          const [walletResponse, passportResponse, salonsResponse] = await Promise.all([
            fetch("/api/wallet"),
            fetch("/api/beauty-passport"),
            fetch("/api/salons")
          ]);
          const walletPayload = walletResponse.ok ? await walletResponse.json() : {};
          const passportPayload = passportResponse.ok ? await passportResponse.json() : {};
          const salonsPayload = await salonsResponse.json();
          c.applyWalletPayload?.(walletPayload);
          setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);
          c.setSalonDirectory?.(salonsPayload.salons || salonsPayload.data?.salons || []);
        } catch {
          // ignore secondary loads
        }
      } else if (source === "register") {
        await c.refreshExploreFeed?.();
        await c.refreshShopDirectory?.();
      } else if (source === "boot") {
        const [walletResponse, passportResponse] = await Promise.all([
          fetch("/api/wallet"),
          fetch("/api/beauty-passport")
        ]);
        if (isStale?.()) return;
        const walletPayload = walletResponse.ok ? await walletResponse.json() : {};
        const passportPayload = passportResponse.ok ? await passportResponse.json() : {};
        c.applyWalletPayload?.(walletPayload);
        setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);
        await c.refreshFollows?.();
        await c.refreshSaves?.();
        if (isStale?.()) return;
      }

      if (profile?.type === "salon") await c.refreshSalonSystemData?.();
      if (profile?.type === "artist") await c.refreshArtistWorkspace?.();
      if (profile?.type === "shop") {
        await c.refreshShopWorkspace?.();
        await c.refreshShopCategories?.();
        await c.refreshShopPromoCards?.();
      }
      if (source === "boot" && profile?.type === "client") await c.refreshClientBookings?.();
      // Orders is new (this pass) — unlike the boot-only bookings refresh
      // above (left untouched), fetch on login too so "خرید دوباره" data is
      // fresh right after signing in, not only after a full page boot.
      if ((source === "boot" || source === "login") && profile?.type === "client") {
        await c.refreshClientOrders?.();
      }
    },
    onLoggedOut: async () => {
      const c = authCascadeRef.current;
      c.resetExploreFeed?.();
      c.resetShopWorkspace?.();
      c.resetSalonClient?.();
      c.resetPublicArtistProfile?.();
      c.resetArtistWorkspace?.();
      c.resetSalonWorkspace?.();
      setFollowedArtists([]);
      c.setSavedArtists?.([]);
      setSavedProfiles({ salons: [], artists: [] });
      c.resetWalletState?.();
      setBeautyPassport(null);
      setClientOrderList([]);
      setClientOrdersLoaded(false);
      setClientOrdersError("");
      setProfileEditOpen(false);
      setProfileEditAvatar("");
      resetLogoutUiGaps();
      await c.refreshExploreFeed?.();
      await c.refreshShopDirectory?.();
    }
  });

  const {
    walletTransactions,
    walletAvailable,
    walletBankAccount,
    walletWithdrawals,
    walletBankDraft,
    setWalletBankDraft,
    walletWithdrawAmount,
    setWalletWithdrawAmount,
    walletCashMode,
    setWalletCashMode,
    walletBusy,
    walletLoading,
    setWalletLoading,
    applyWalletPayload,
    resetWalletState,
    refreshWallet,
    saveWalletBankAccount,
    requestWalletWithdraw,
    requestWalletCharge
  } = useWalletWorkspace({ onNotice: setAppToast });

  const {
    shopDirectory,
    setShopDirectory,
    shopCatalog,
    setShopCatalog,
    shopStockMovements,
    shopCategories,
    shopCategoryBusy,
    refreshShopCategories,
    addShopCategory,
    renameShopCategory,
    moveShopCategory,
    removeShopCategory,
    shopPromoCards,
    shopPromoCardBusy,
    refreshShopPromoCards,
    createShopPromoCardEntry,
    activateShopPromoCardEntry,
    removeShopPromoCard,
    shopOrderList,
    setShopOrderList,
    shopCategory,
    setShopCategory,
    selectedShop,
    setSelectedShop,
    shopStoreFilter,
    setShopStoreFilter,
    shopProductSheetOpen,
    editingShopProduct,
    viewingShopProduct,
    shopProductDefaultCategory,
    shopProductImage,
    shopProductImageOriginal,
    shopProductEnhanceTab,
    setShopProductEnhanceTab,
    shopProductEnhanceBusy,
    shopProductActiveEnhance,
    shopProductActiveAspect,
    shopCart,
    shopCartOpen,
    setShopCartOpen,
    shopProductsRef,
    shopReviewsRailRef,
    visibleShops,
    selectedShopCatalog,
    currentShopCart,
    shopCartSummary,
    refreshShopDirectory,
    refreshShopWorkspace,
    resetShopWorkspace,
    addToShopCart,
    updateShopCartQty,
    shopOrderBusy,
    submitShopOrder,
    closeShopStorefront,
    openShopProductSheet,
    closeShopProductSheet,
    handleShopProductImageUpload,
    clearShopProductImage,
    applyShopProductEnhance,
    applyShopProductAspect,
    resetShopProductImageEdits,
    saveShopProduct,
    openShopProductDetail,
    closeShopProductDetail,
    editShopProductFromDetail,
    deleteShopProduct,
    selectShop,
    applyFollowCount,
    bumpFollowOptimistic,
    shopWorkspaceLoading,
    shopStoreLoading,
    changeShopOrderStatus,
    shopOrderStatusBusyId
  } = useShopWorkspace({
    createdProfile,
    activeTab,
    onNotice: setAppToast
  });

  const {
    explorePostList,
    exploreCategory,
    setExploreCategory,
    exploreRatingPicker,
    selectedPost,
    setSelectedPost,
    selectedPostComments,
    selectExplorePost,
    visibleExplorePosts,
    savedExplorePosts,
    selectedPostIsSaved,
    selectedPostUserRating,
    refreshExploreFeed,
    resetExploreFeed,
    toggleSavedPost,
    openExploreRatingPicker,
    closeExploreRatingPicker,
    setExploreRatingHover,
    confirmExploreRating,
    shareExplorePost,
    exploreLoading
  } = useExploreFeed({
    createdProfile,
    onNotice: setAppToast
  });

  refreshExploreFeedRef.current = refreshExploreFeed;

  const {
    salonDirectory,
    setSalonDirectory,
    selectedSalon,
    setSelectedSalon,
    followedSalons,
    setFollowedSalons,
    savedSalonKeys,
    setSavedSalonKeys,
    salonClientTab,
    setSalonClientTab,
    salonClientReviews,
    salonClientBooking,
    salonClientBookingBusy,
    clientBookingList,
    savedSalonList,
    salonClientFreeTimes,
    isFollowingSelectedSalon,
    isSavedSelectedSalon,
    refreshSalonDirectory,
    refreshClientBookings,
    resetSalonClient,
    toggleFollowSalon,
    toggleSaveSalon,
    shareSalonProfile,
    openSalonClientBooking,
    closeSalonClientBooking,
    patchSalonClientBooking,
    confirmSalonClientBooking
  } = useSalonDirectory({
    createdProfile,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onOwnerBookingsSync: (bookings) => applySalonBookingsRef.current?.(bookings, { bump: true }),
    onLinkedArtistBooked: (id) => notifyArtistBookingCreatedRef.current?.(id)
  });

  const {
    artistReviewList,
    artistSocialStats,
    artistSalonInviteList,
    artistInviteRespondBusyId,
    artistBookingSubmitting,
    artistGalleryFilter,
    setArtistGalleryFilter,
    artistPortfolioItems,
    setArtistPortfolioItems,
    previewingArtistWorkId,
    setPreviewingArtistWorkId,
    editingArtistWork,
    setEditingArtistWork,
    artistWorkTagMenuOpen,
    setArtistWorkTagMenuOpen,
    artistBookingList,
    setArtistBookingList,
    artistServiceList,
    setArtistServiceList,
    artistBreakTime,
    setArtistBreakTime,
    artistBreakEditorOpen,
    setArtistBreakEditorOpen,
    artistBreakDraft,
    setArtistBreakDraft,
    artistBookingCreateOpen,
    setArtistBookingCreateOpen,
    artistCollabOffers,
    setArtistCollabOffers,
    artistCollabDraft,
    setArtistCollabDraft,
    artistBookingRailOpen,
    setArtistBookingRailOpen,
    artistBookingSettings,
    setArtistBookingSettings,
    artistBookingSelectedDay,
    setArtistBookingSelectedDay,
    artistHoursList,
    artistHoursOpen,
    setArtistHoursOpen,
    selectedArtistHourDay,
    setSelectedArtistHourDay,
    artistHoursPresets,
    activeArtistHoursPreset,
    activeArtistHoursPresetMeta,
    selectedArtistHour,
    artistHourTimeOptions,
    openArtistHoursDaysCount,
    weeklyArtistCapacityTotal,
    updateArtistHour,
    updateArtistHoursPreset,
    artistRailDock,
    setArtistRailDock,
    artistRailDragging,
    artistRailDragPos,
    artistRailSize,
    artistRailRef,
    artistRailDragRef,
    visibleArtistPortfolio,
    artistGalleryTags,
    artistGalleryItems,
    previewingArtistWork,
    artistReviewSummary,
    artistReplyingReviewId,
    artistReplyDraft,
    setArtistReplyDraft,
    artistReplySubmitting,
    openArtistReviewReply,
    closeArtistReviewReply,
    submitArtistReviewReply,
    artistWorkTagOptions,
    artistWorkVisibleTagOptions,
    nearestArtistBookings,
    artistBookingWeekTabs,
    artistScheduleDayLabel,
    pendingArtistSalonInvites,
    artistUnreadNoticeCount,
    refreshArtistWorkspace,
    notifyArtistBookingCreated,
    resetArtistWorkspace,
    onArtistRailHandlePointerDown,
    onArtistRailHandlePointerMove,
    onArtistRailHandlePointerUp,
    handleArtistBookingCreate,
    openArtistBreakEditor,
    closeArtistBreakEditor,
    saveArtistBreakTime,
    clearArtistBreakTime,
    deleteArtistService,
    upsertArtistOwnerService,
    addArtistCollabOffer,
    deleteArtistCollabOffer,
    openArtistWorkPreview,
    closeArtistWorkPreview,
    openArtistWorkModal,
    closeArtistWorkModal,
    handleArtistWorkImageUpload,
    clearArtistWorkImage,
    syncArtistWorkToExplore,
    saveArtistWork,
    deleteArtistWork,
    respondArtistSalonInvite,
    artistWorkspaceLoading
  } = useArtistWorkspace({
    createdProfile,
    activeTab,
    salonDirectory,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onExploreRefresh: () => refreshExploreFeedRef.current?.(),
    onCloseBookingSheet: () => {
      setBookingSheetOpen(false);
      setBookingSelectMenu("");
    }
  });
  refreshArtistWorkspaceRef.current = refreshArtistWorkspace;
  notifyArtistBookingCreatedRef.current = notifyArtistBookingCreated;

  const {
    salonTool,
    setSalonTool,
    salonWorkspace,
    setSalonWorkspace,
    salonHeroSheet,
    setSalonHeroSheet,
    salonToolSheetOpen,
    setSalonToolSheetOpen,
    settingsHoursOpen,
    setSettingsHoursOpen,
    salonAppointmentList,
    setSalonAppointmentList,
    reservationRequestList,
    salonCollabRequestList,
    setSalonCollabRequestList,
    salonArtistInviteList,
    setSalonArtistInviteList,
    salonStaffList,
    setSalonStaffList,
    salonServiceList,
    setSalonServiceList,
    salonPortfolioList,
    setSalonPortfolioList,
    salonHoursList,
    setSalonHoursList,
    selectedSalonHourDay,
    setSelectedSalonHourDay,
    selectedStaffName,
    setSelectedStaffName,
    selectedArtistProfile,
    setSelectedArtistProfile,
    selectedBookingClient,
    setSelectedBookingClient,
    artistCreateOpen,
    setArtistCreateOpen,
    artistInviteOpen,
    setArtistInviteOpen,
    nearbyArtists,
    setNearbyArtists,
    nearbyArtistsLoading,
    artistInviteBusyId,
    setArtistInviteBusyId,
    salonBookingSubmitting,
    scheduleBookingBusy,
    salonRequestBusyId,
    artistCreateRole,
    setArtistCreateRole,
    artistCreateStatus,
    setArtistCreateStatus,
    salonWorkDraft,
    setSalonWorkDraft,
    salonWorkTagMenuOpen,
    setSalonWorkTagMenuOpen,
    portfolioSaving,
    serviceArtistMenuId,
    setServiceArtistMenuId,
    safeSalonStaffList,
    salonStaffByName,
    pendingSalonArtistInvites,
    pendingSalonCollabRequests,
    salonUnreadNoticeCount,
    applySalonBookings,
    refreshSalonBookingsLive,
    refreshSalonSystemData,
    refreshSalonCollabRequests,
    openSalonWorkspace: openSalonWorkspaceFromHook,
    closeSalonWorkspace,
    closeSalonToolSheet,
    addSalonAppointment,
    patchSalonAppointment,
    approveReservationRequest,
    declineReservationRequest,
    updateSalonCollabRequest,
    addSalonStaff,
    openNearbyArtistInvite,
    inviteNearbyArtist,
    cancelSalonArtistInvite,
    updateSalonStaff,
    removeSalonStaff,
    updateSalonHour,
    updateSalonHoursPreset,
    addSalonService,
    assignSalonServiceArtist,
    toggleSalonServiceArtist,
    deleteSalonService,
    resetPortfolioComposer,
    openPortfolioComposer,
    handleSalonWorkImageUpload,
    clearSalonWorkImage,
    addSalonPortfolio,
    deleteSalonPortfolio,
    deleteSalonPortfolioFromComposer,
    upsertSalonOwnerService,
    resetSalonWorkspace,
    salonWorkspaceLoading
  } = useSalonWorkspace({
    createdProfile,
    onNotice: setAppToast,
    onShellNotice: setAppToast,
    onExploreRefresh: () => refreshExploreFeedRef.current?.(),
    onScheduleViewDay: setScheduleViewDay,
    onCloseBookingSheet: () => {
      setBookingSheetOpen(false);
      setBookingSelectMenu("");
    },
    onLinkedArtistBooked: (id) => notifyArtistBookingCreatedRef.current?.(id),
    onArtistCollabOffersPatch: setArtistCollabOffers,
    onSalonDirectorySync: setSalonDirectory,
    onSelectedSalonSync: setSelectedSalon,
    onBookingDefaults: ({ staffName, serviceName, date }) => {
      if (staffName) setBookingStaffName((current) => current || staffName);
      if (serviceName) setBookingServiceName((current) => current || serviceName);
      if (date) setBookingDate((current) => current || date);
    },
    salonArtistRoleOptions,
    salonArtistStatusOptions
  });
  applySalonBookingsRef.current = applySalonBookings;

  const {
    profileEditOpen,
    setProfileEditOpen,
    profileEditAvatar,
    setProfileEditAvatar,
    profileLocationSaving,
    profileSettings,
    updateRegisteredProfile,
    saveProfileLocation,
    openProfileEdit,
    handleProfileAvatarUpload,
    toggleProfileSetting
  } = useProfileEditor({
    createdProfile,
    setCreatedProfile,
    setProfileType,
    setProfileView,
    setSalonHeroSheet,
    lockSession,
    writeAuthSession,
    onNotice: setAppToast
  });

  function openSalonWorkspace(tool) {
    setProfileView("overview");
    openSalonWorkspaceFromHook(tool);
  }

  const {
    selectedPublicArtist,
    setSelectedPublicArtist,
    publicArtistReviews,
    publicArtistUserRating,
    publicArtistRatingHover,
    setPublicArtistRatingHover,
    publicArtistView,
    setPublicArtistView,
    publicArtistGalleryFilter,
    setPublicArtistGalleryFilter,
    publicArtistBookingDay,
    setPublicArtistBookingDay,
    publicArtistBookingSlot,
    setPublicArtistBookingSlot,
    publicArtistSelectedServiceId,
    publicArtistBookingBusy,
    publicArtistPortfolio,
    publicArtistGalleryTags,
    publicArtistFeatured,
    publicArtistGalleryRest,
    publicArtistServices,
    isFollowingPublicArtist,
    isSavedPublicArtist,
    setSavedArtists,
    publicArtistHeroImage,
    openPublicArtistProfile,
    closePublicArtistProfile,
    confirmPublicArtistRating,
    toggleLikePublicArtistReview,
    confirmPublicArtistBooking,
    toggleFollowPublicArtist,
    toggleSavePublicArtist,
    shareArtistProfile,
    openPublicArtistWork,
    selectPublicArtistService,
    resetPublicArtistProfile
  } = usePublicArtistProfile({
    createdProfile,
    explorePostList,
    followedArtists,
    setFollowedArtists,
    setFollowedSalons,
    onNotice: setAppToast,
    onSelectExplorePost: setSelectedPost,
    onBeforeOpen: () => {
      setSelectedArtistProfile(null);
      setSelectedSalon(null);
    },
    onArtistBookingCreated: notifyArtistBookingCreated
  });

  const chat = useChat({
    myUserId: createdProfile?.id || null,
    onNotice: setAppToast
  });
  const [floatingChatOpen, setFloatingChatOpen] = useState(false);
  const [shopChatSheetOpen, setShopChatSheetOpen] = useState(false);

  /** Opens the floating quick-chat sheet on a conversation (or just the inbox list if none given). */
  function openOwnerChat(conversationId = null) {
    setFloatingChatOpen(true);
    if (conversationId) chat.openConversation(conversationId);
  }
  function closeOwnerChat() {
    setFloatingChatOpen(false);
  }

  const {
    artistServiceCreateOpen,
    setArtistServiceCreateOpen,
    artistServiceCreateMode,
    setArtistServiceCreateMode,
    artistServiceDraft,
    setArtistServiceDraft,
    addArtistService,
    addArtistServicePreset,
    openArtistServiceCreate,
    openSalonServiceCreate,
    closeArtistServiceCreate,
    editArtistService
  } = useServiceComposer({
    createdProfile,
    artistServiceList,
    salonServiceList,
    upsertArtistOwnerService,
    upsertSalonOwnerService,
    onNotice: setAppToast
  });

  const {
    scheduleBookingMenu,
    setScheduleBookingMenu,
    scheduleBookingView,
    setScheduleBookingView,
    openScheduleBookingMenu,
    closeScheduleBookingMenu,
    changeScheduleBookingTime,
    changeScheduleBookingStaff,
    cancelScheduleBooking
  } = useScheduleBookingMenu({
    artistBookingList,
    salonAppointmentList,
    setSelectedBookingClient,
    patchSalonAppointment
  });

  useEffect(() => {
    if (
      activeTab === "profile"
      && createdProfile?.type === "shop"
      && createdProfile.type === profileType
      && profileView === "messages"
    ) {
      setProfileView("overview");
      setChatPane("inbox");
      setActiveTab("chat");
    }
  }, [activeTab, createdProfile?.type, profileType, profileView, setProfileView]);

  const activeRoleMeta = profileRoleMeta[profileType] || profileRoleMeta.client;
  const activeCreatedMeta = createdProfile ? (profileRoleMeta[createdProfile.type] || profileRoleMeta.client) : null;

  const salonWorkTagOptions = useMemo(() => {
    const defaults = ["ناخن", "مو", "میکاپ", "عروس"];
    const fromList = Array.from(new Set(salonPortfolioList.map((item) => item.tag).filter(Boolean)));
    return Array.from(new Set([...defaults, ...fromList]));
  }, [salonPortfolioList]);

  const salonWorkVisibleTagOptions = useMemo(() => {
    const query = String(salonWorkDraft?.tag || "").trim();
    if (!query) return salonWorkTagOptions;
    const filtered = salonWorkTagOptions.filter((tag) => tag.includes(query));
    return filtered.length ? filtered : salonWorkTagOptions;
  }, [salonWorkTagOptions, salonWorkDraft?.tag]);

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
    const ratingValue = ownSalon?.rating || createdProfile?.data?.rating || "۰";
    return {
      rating: toPersianDigits(ratingValue || "۰"),
      followers: Number(ownSalon?.follower_count ?? ownSalon?.followerCount ?? createdProfile?.data?.follower_count ?? 0),
      following: Number(ownSalon?.following_count ?? ownSalon?.followingCount ?? createdProfile?.data?.following_count ?? 0),
      posts: salonPortfolioList.length
    };
  }, [salonDirectory, createdProfile, salonPortfolioList.length]);

  const activeServiceManagerList = createdProfile?.type === "salon" ? salonServiceList : artistServiceList;

  const activeSalonHours = salonHoursList.filter((hour) => hour.active);

  const {
    bookingSheetOpen,
    setBookingSheetOpen,
    setBookingStaffName,
    bookingServiceName,
    setBookingServiceName,
    bookingDate,
    setBookingDate,
    bookingTime,
    setBookingTime,
    bookingSelectMenu,
    setBookingSelectMenu,
    bookingServiceOptions,
    bookingStaffOptions,
    selectedBookingStaff,
    bookingDateForSlots,
    selectedBookingService,
    bookingDaySlots,
    bookingFreeSlots,
    openBookingSheet,
    closeBookingSheet
  } = useBookingCreateSheet({
    createdProfile,
    safeSalonStaffList,
    salonServiceList,
    artistServiceList,
    salonAppointmentList,
    salonScheduleWeekTabs,
    activeSalonHours,
    salonWorkspace,
    salonToolSheetOpen,
    salonTool,
    setActiveTab,
    setShopOwnerChatOpen: setFloatingChatOpen,
    setArtistBookingRailOpen,
    setArtistBookingCreateOpen,
    setSalonHeroSheet,
    setSalonToolSheetOpen,
    setSalonWorkspace
  });

  const resetLogoutUiGaps = createLogoutUiGapResets({
    setBookingSheetOpen,
    setScheduleBookingMenu,
    setScheduleBookingView,
    setFloatingChatOpen,
    setShopChatSheetOpen,
    setClientBookingSettings,
    setArtistServiceCreateOpen,
    setArtistServiceCreateMode,
    setArtistServiceDraft,
    setBookingStaffName,
    setBookingServiceName,
    setBookingDate,
    setBookingTime,
    setBookingSelectMenu
  });

  const salonHoursPresets = [
    { id: "standard", label: "معمولی", detail: "شنبه تا چهارشنبه · ۱۰ تا ۲۰ · ظرفیت ۸" },
    { id: "extended", label: "پرفشار", detail: "همه روزها باز · ۱۰ تا ۲۲ · ظرفیت ۱۲" },
    { id: "weekend", label: "آخر هفته", detail: "پنجشنبه و جمعه · ۱۲ تا ۱۸ · ظرفیت ۵" }
  ];
  const activeHoursPreset = useMemo(() => {
    if (!salonHoursList.length) return null;
    const weekendDays = new Set(["پنجشنبه", "جمعه"]);
    const matches = (predicate) => salonHoursList.every(predicate);
    if (matches((hour) => {
      const isWeekend = weekendDays.has(hour.day);
      return hour.open_time === "۱۰:۰۰" && hour.close_time === "۲۰:۰۰" && Number(hour.capacity) === 8 && Boolean(hour.active) === !isWeekend;
    })) return "standard";
    if (matches((hour) => hour.open_time === "۱۰:۰۰" && hour.close_time === "۲۲:۰۰" && Number(hour.capacity) === 12 && Boolean(hour.active))) return "extended";
    if (matches((hour) => {
      const isWeekend = weekendDays.has(hour.day);
      return hour.open_time === "۱۲:۰۰" && hour.close_time === "۱۸:۰۰" && Number(hour.capacity) === 5 && Boolean(hour.active) === isWeekend;
    })) return "weekend";
    return null;
  }, [salonHoursList]);
  const activeHoursPresetMeta = salonHoursPresets.find((preset) => preset.id === activeHoursPreset) || null;
  const weeklyCapacityTotal = activeSalonHours.reduce((total, item) => total + Number(item.capacity || 0), 0);
  const selectedSalonHour = useMemo(() => {
    if (!salonHoursList.length) return null;
    return salonHoursList.find((hour) => hour.day === selectedSalonHourDay)
      || salonHoursList.find((hour) => hour.active)
      || salonHoursList[0]
      || null;
  }, [salonHoursList, selectedSalonHourDay]);
  const salonHourTimeOptions = useMemo(() => {
    const options = [...SALON_HOUR_TIME_OPTIONS];
    [selectedSalonHour?.open_time, selectedSalonHour?.close_time].forEach((value) => {
      if (value && !options.includes(value)) options.push(value);
    });
    return options;
  }, [selectedSalonHour]);
  const scheduleDayOptions = useMemo(() => {
    const fromHours = salonHoursList.map((hour) => hour.day).filter(Boolean);
    const fromBookings = salonAppointmentList
      .filter((item) => item.status !== "لغو")
      .map((item) => item.booking_date || item.date || "امروز")
      .filter(Boolean);
    const unique = [];
    [...fromHours, ...fromBookings].forEach((day) => {
      if (!unique.includes(day)) unique.push(day);
    });
    return unique.length ? unique : ["امروز"];
  }, [salonHoursList, salonAppointmentList]);

  const salonHistoryAppointments = useMemo(() => (
    salonAppointmentList
      .filter((item) => item.status !== "لغو")
      .map((item) => ({
        ...item,
        date: item.booking_date || item.date || "امروز",
        dateKey: getBookingDateKey(item.booking_date || item.date || "امروز")
      }))
  ), [salonAppointmentList]);

  // Unrestricted-scroll range for the salon hero week strip: `daysBefore`
  // reaches back several months by default (extended further if an older
  // booking actually exists), while `daysAfter` only reaches as far into
  // the future as the salon's own bookings go — there's nothing useful to
  // scroll to on an empty future day. Both are capped so the rail never
  // has to render an unbounded number of cells.
  const SALON_HERO_MIN_PAST_DAYS = 180;
  const SALON_HERO_MAX_PAST_DAYS = 365;
  const SALON_HERO_MAX_FUTURE_DAYS = 365;
  const salonHeroWeekRangeBounds = useMemo(() => {
    let pastDays = SALON_HERO_MIN_PAST_DAYS;
    let futureDays = 0;
    salonHistoryAppointments.forEach((item) => {
      if (!item.dateKey) return;
      const offset = getBookingDateOffsetDays(item.dateKey);
      if (offset < 0) {
        pastDays = Math.min(SALON_HERO_MAX_PAST_DAYS, Math.max(pastDays, -offset));
      } else if (offset > futureDays) {
        futureDays = Math.min(SALON_HERO_MAX_FUTURE_DAYS, offset);
      }
    });
    return { pastDays, futureDays };
  }, [salonHistoryAppointments]);

  const salonHeroWeekRange = useMemo(
    () => buildExactBookingDateTabsCentered(salonHeroWeekRangeBounds.pastDays, salonHeroWeekRangeBounds.futureDays),
    [salonHeroWeekRangeBounds]
  );

  const activeScheduleDay = useMemo(() => {
    const weekDays = salonScheduleWeekTabs.map((item) => item.day);
    // An explicit selection from the wide-range hero strip arrives as an
    // absolute dateKey ("1404-06-11"), not a weekday name — accept it
    // directly rather than requiring it show up in the narrow (7-tab)
    // weekDays/scheduleDayOptions lists below, which only ever cover a
    // single week and would otherwise silently discard it back to today.
    if (scheduleViewDay && isPersianDateKey(scheduleViewDay)) return scheduleViewDay;
    if (scheduleViewDay && weekDays.includes(scheduleViewDay)) return scheduleViewDay;
    if (scheduleViewDay && scheduleDayOptions.includes(scheduleViewDay)) {
      const selectedDateKey = getBookingDateKey(scheduleViewDay);
      const matched = salonScheduleWeekTabs.find((item) => item.dateKey === selectedDateKey)?.day
        || weekDays.find((day) => isArtistBookingOnSelectedDay({ date: scheduleViewDay }, day));
      if (matched) return matched;
    }
    // Default (no explicit selection yet): today. salonScheduleWeekTabs is
    // now centered on today (not today-first), so find it explicitly rather
    // than assuming index 0 — and do NOT prefer "the first day that happens
    // to have a booking" here, that silently jumps the view away from today
    // whenever today is empty.
    const todayTab = salonScheduleWeekTabs.find((item) => item.label === "امروز");
    return todayTab?.day || weekDays[0] || scheduleDayOptions[0] || "امروز";
  }, [scheduleViewDay, salonScheduleWeekTabs, scheduleDayOptions]);

  const activeScheduleDayLabel = useMemo(() => {
    const narrowLabel = salonScheduleWeekTabs.find((item) => item.day === activeScheduleDay)?.label;
    if (narrowLabel) return narrowLabel;
    if (isPersianDateKey(activeScheduleDay)) return formatRelativeBookingDayLabel(activeScheduleDay);
    return activeScheduleDay;
  }, [salonScheduleWeekTabs, activeScheduleDay]);

  // Absolute dateKey for whichever day is actually selected, regardless of
  // whether activeScheduleDay is a narrow-window weekday name (default /
  // dashboard-tab selections) or already an absolute dateKey (wide-range
  // hero strip selections) — this is what the hero strip itself needs to
  // know which of its (dateKey-identified) cells to highlight.
  const activeScheduleDateKey = useMemo(() => (
    salonScheduleWeekTabs.find((tab) => tab.day === activeScheduleDay)?.dateKey || getBookingDateKey(activeScheduleDay)
  ), [salonScheduleWeekTabs, activeScheduleDay]);

  // Real (non-hardcoded) day tabs for the profile-hero week strip: built
  // from the same rolling-week tabs and exact-date booking counts as the
  // schedule dashboard below, so both stay in sync and "today" is whichever
  // tab actually has today's real dateKey — never a fixed guess.
  const salonHeroWeekTabs = useMemo(() => (
    salonHeroWeekRange.map((tab) => {
      const count = salonHistoryAppointments.filter((item) => (
        isArtistBookingOnExactDate(item, tab.dateKey)
      )).length;
      const isToday = tab.dateKey === getBookingDateKey("امروز");
      return {
        // `day` carries the dateKey (not the bare weekday name): this range
        // spans many weeks, so weekday names repeat and can't uniquely
        // identify a cell. ProfileHeroWeekStrip falls back to `day` as its
        // click/key value when `id` isn't set, so this makes every cell in
        // the wide range uniquely selectable and directly comparable with
        // activeScheduleDateKey below.
        day: tab.dateKey,
        label: tab.day,
        meta: isToday ? "امروز" : tab.sub,
        state: count > 0 ? `${toPersianDigits(count)} نوبت` : "بدون نوبت",
        isToday,
        dateKey: tab.dateKey
      };
    })
  ), [salonHeroWeekRange, salonHistoryAppointments]);

  // Same ProfileHeroWeekStrip, same wide unrestricted-scroll range, for the
  // artist's bookings tab (ArtistScheduleBoard) — mirrors salonHeroWeekRange*
  // above exactly, just keyed off artistBookingList. Unlike the salon side,
  // there's no separate narrow (weekday-name) widget to reconcile with here
  // (ArtistScheduleBoard has only this one day-picker), so the selection
  // logic below is simpler than activeScheduleDay/activeScheduleDateKey.
  const artistWeekRangeBounds = useMemo(() => {
    let pastDays = SALON_HERO_MIN_PAST_DAYS;
    let futureDays = 0;
    artistBookingList.forEach((item) => {
      if (!item.dateKey) return;
      const offset = getBookingDateOffsetDays(item.dateKey);
      if (offset < 0) {
        pastDays = Math.min(SALON_HERO_MAX_PAST_DAYS, Math.max(pastDays, -offset));
      } else if (offset > futureDays) {
        futureDays = Math.min(SALON_HERO_MAX_FUTURE_DAYS, offset);
      }
    });
    return { pastDays, futureDays };
  }, [artistBookingList]);

  const artistWeekRange = useMemo(
    () => buildExactBookingDateTabsCentered(artistWeekRangeBounds.pastDays, artistWeekRangeBounds.futureDays),
    [artistWeekRangeBounds]
  );

  // artistBookingSelectedDay starts out as a bare weekday name (today's,
  // from useArtistWorkspace's initial state) and becomes an absolute
  // dateKey once the user picks any cell from this wide-range strip —
  // getBookingDateKey resolves either shape to a real dateKey.
  const activeArtistScheduleDateKey = useMemo(
    () => getBookingDateKey(artistBookingSelectedDay),
    [artistBookingSelectedDay]
  );

  const activeArtistScheduleDayLabel = useMemo(
    () => formatRelativeBookingDayLabel(activeArtistScheduleDateKey),
    [activeArtistScheduleDateKey]
  );

  const artistBookingsWeekTabs = useMemo(() => (
    artistWeekRange.map((tab) => {
      const count = artistBookingList.filter((item) => (
        isArtistBookingOnExactDate(item, tab.dateKey)
      )).length;
      const isToday = tab.dateKey === getBookingDateKey("امروز");
      return {
        // dateKey, not the bare weekday name, for the same reason as the
        // salon version above: this range spans many weeks, so weekday
        // names repeat and can't uniquely identify a cell.
        day: tab.dateKey,
        label: tab.day,
        meta: isToday ? "امروز" : tab.sub,
        state: count > 0 ? `${toPersianDigits(count)} نوبت` : "بدون نوبت",
        isToday,
        dateKey: tab.dateKey
      };
    })
  ), [artistWeekRange, artistBookingList]);

  // Real bookings not yet accepted/declined, for the artist notifications
  // sheet below. Unlike the salon panel's reservationRequestList (still
  // backed by shell/mockData — a separate, pre-existing issue, not fixed
  // here), this reads real artistBookingList. "تازه"/"درخواست" = not yet
  // reviewed; "لغو" (cancelled) never counts as pending.
  const pendingArtistBookingRequests = useMemo(() => (
    artistBookingList.filter((item) => item.status === "تازه" || item.status === "درخواست")
  ), [artistBookingList]);

  const scheduleDayAppointments = useMemo(() => (
    salonHistoryAppointments
      .filter((item) => isArtistBookingOnExactDate(item, activeScheduleDateKey))
      .map((item) => normalizeSalonScheduleBooking(item, salonStaffByName, salonServiceList))
      .map((item) => withScheduleTimeline(item, {
        // Deliberately activeScheduleDay (not activeScheduleDateKey) here:
        // the timeline phase logic (live/done/upcoming) only special-cases
        // "today" via getArtistBookingDayRank, which recognizes both
        // weekday names/"امروز" AND an absolute dateKey that resolves to
        // today — either shape works, and activeScheduleDay is what's
        // already in scope from a real user selection.
        selectedDay: activeScheduleDay,
        now: scheduleNow
      }))
      .sort((a, b) => timeLabelToMinutes(a.time) - timeLabelToMinutes(b.time))
  ), [salonHistoryAppointments, activeScheduleDay, activeScheduleDateKey, salonStaffByName, salonServiceList, scheduleNow]);

  const artistScheduleDayRows = useMemo(() => (
    artistBookingList
      .filter((booking) => isArtistBookingOnExactDate(booking, activeArtistScheduleDateKey))
      .map((booking) => normalizeArtistScheduleBooking(booking, artistServiceList))
      .map((booking) => withScheduleTimeline(booking, {
        selectedDay: activeArtistScheduleDateKey,
        now: scheduleNow
      }))
      .sort((a, b) => timeLabelToMinutes(a.time) - timeLabelToMinutes(b.time))
  ), [artistBookingList, activeArtistScheduleDateKey, artistServiceList, scheduleNow]);

function getPassportMatch(post) {
    if (!beautyPassport?.active) return null;
    const scores = {
      "ناخن": "۹۲٪",
      "مو": "۸۸٪",
      "میکاپ": "۹۰٪",
      "ابرو": "۸۶٪",
      "پوست": "۸۴٪",
      "صورت": "۸۷٪",
      "عروس": "۸۳٪"
    };
    return scores[post.tag] || "۸۵٪";
  }

  function getPortfolioCardStyle(item) {
    return item.image
      ? { backgroundImage: `linear-gradient(180deg, rgba(12, 14, 16, 0.04) 0%, transparent 46%, rgba(12, 14, 16, 0.68) 100%), url("${item.image}")` }
      : undefined;
  }


  async function refreshFollows() {
    try {
      const response = await fetch("/api/follows");
      if (!response.ok) return;
      const payload = await response.json();
      const ids = (payload.data?.followingIds || []).map(String);
      setFollowedArtists(ids);
      setFollowedSalons(ids);
    } catch {
      // ignore
    }
  }

  // Seeds real saved-salon/saved-artist state from the server — mirrors
  // refreshFollows above (same "one id list feeds both salon + artist local
  // state" shape, since a save target can be either type). Also stashes the
  // full card arrays for the "ذخیره‌شده‌ها" profile tab so it doesn't have to
  // derive from whatever's currently loaded in salonDirectory.
  async function refreshSaves() {
    try {
      const { ok, data } = await getSaves();
      if (!ok) return;
      const ids = (data?.savedTargetIds || []).map(String);
      setSavedSalonKeys(ids);
      setSavedArtists(ids);
      setSavedProfiles({ salons: data?.salons || [], artists: data?.artists || [] });
    } catch {
      // ignore
    }
  }

  // toggleSaveSalon/toggleSavePublicArtist only update the id-only
  // savedSalonKeys/savedArtists lists (for button state elsewhere) — they
  // don't know about savedProfiles' full card arrays, which only the
  // "ذخیره‌شده‌ها" tab renders. Without this, removing a card from that tab
  // toggled the DB correctly but left the stale card on screen until the
  // next full refreshSaves() (e.g. a reload) — DB and UI silently diverged.
  function removeSavedSalon(salon) {
    toggleSaveSalon(salon);
    const key = String(salon.id || salon.source_key || salon.name);
    setSavedProfiles((prev) => ({
      ...prev,
      salons: prev.salons.filter((item) => String(item.id || item.source_key || item.name) !== key)
    }));
  }

  function removeSavedArtist(artist) {
    toggleSavePublicArtist(artist);
    const key = String(artist.id || artist.name);
    setSavedProfiles((prev) => ({
      ...prev,
      artists: prev.artists.filter((item) => String(item.id || item.name) !== key)
    }));
  }

  async function refreshClientOrders() {
    try {
      const { ok, data } = await getMyShopOrders();
      if (ok) {
        setClientOrderList(data?.orders || []);
        setClientOrdersError("");
      } else {
        setClientOrdersError("خریدها بارگذاری نشد.");
      }
    } catch {
      setClientOrdersError("خریدها بارگذاری نشد؛ اتصال را بررسی کن.");
    } finally {
      setClientOrdersLoaded(true);
    }
  }

  authCascadeRef.current = {
    refreshExploreFeed,
    refreshShopDirectory,
    setSalonDirectory,
    refreshFollows,
    refreshSaves,
    refreshSalonSystemData,
    refreshArtistWorkspace,
    refreshShopWorkspace,
    refreshShopCategories,
    refreshShopPromoCards,
    refreshClientBookings,
    refreshClientOrders,
    resetExploreFeed,
    resetShopWorkspace,
    resetSalonClient,
    resetPublicArtistProfile,
    resetArtistWorkspace,
    resetSalonWorkspace,
    applyWalletPayload,
    resetWalletState,
    setWalletLoading,
    setSavedArtists
  };

  useEffect(() => {
    if (createdProfile?.type !== "salon" && createdProfile?.type !== "artist") return undefined;
    setScheduleNow(new Date());
    const timer = window.setInterval(() => setScheduleNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [createdProfile?.type]);

  useEffect(() => {
    if (!serviceArtistMenuId) return undefined;
    const onPointerDown = (event) => {
      const openPick = document.querySelector(".is-pickingArtist .serviceArtistPick");
      if (openPick && openPick.contains(event.target)) return;
      setServiceArtistMenuId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [serviceArtistMenuId]);

  useEffect(() => {
    if (!appToast) return undefined;
    const timer = window.setTimeout(() => setAppToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [appToast]);



  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const resetPageScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll(".workspace, .contentGrid, .mobilePage.is-active, .profilePanel.is-active, .salonPanel.is-active, .shopsPanel.is-active, .feedPanel.is-active").forEach((node) => {
        node.scrollTop = 0;
      });
    };
    resetPageScroll();
    const frame = window.requestAnimationFrame(resetPageScroll);
    const timer = window.setTimeout(resetPageScroll, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [
    activeTab,
    profileView,
    salonTool,
    salonWorkspace,
    selectedSalon?.id,
    selectedSalon?.source_key,
    selectedShop?.id,
    selectedShop?.name,
    selectedPublicArtist?.id
  ]);

  function goToTab(tab) {
    if (!createdProfile) {
      setActiveTab("profile");
      return;
    }
    if (tab === "chat") {
      setFloatingChatOpen(false);
      setSelectedSalon(null);
      setChatInitialPane("inbox");
      setChatOpenedFromShop(false);
      setChatPane("inbox");
      setActiveTab("chat");
      return;
    }
    if (tab !== "shops" && selectedShop) {
      setShopCartOpen(false);
      setShopChatSheetOpen(false);
      setShopPreviewFromDashboard(false);
    }
    setActiveTab(tab);
  }

  async function openSalonPublicChat(salon) {
    if (!salon) return;
    const salonId = String(salon.id || "");
    const salonSourceKey = String(salon.source_key || "");
    const profileId = String(createdProfile?.id || "");
    const profileName = createdProfile?.data?.name || "";
    const isOwnerSalon = createdProfile?.type === "salon" && (
      (profileId && (salonId === profileId || salonSourceKey === profileId))
      || (profileName && salon.name === profileName)
    );

    setFloatingChatOpen(false);
    setSelectedSalon(null);

    if (isOwnerSalon) {
      setChatInitialPane("inbox");
      setChatPane("inbox");
      setActiveTab("chat");
      return;
    }

    setChatInitialPane("conversation");
    setChatPane("conversation");
    setActiveTab("chat");
    await chat.startDirectChat(salon.id);
  }

  function resolveExploreArtist(post) {
    if (!post) return null;
    const fromDirectory = salonDirectory.find((salon) => (
      salon.name === post.salon
      || String(salon.id) === String(post.ownerUserId)
      || String(salon.source_key) === String(post.ownerUserId)
    ));
    const isOwnPost = Boolean(
      createdProfile
      && (createdProfile.type === "artist" || createdProfile.type === "salon")
      && (
        String(post.ownerUserId) === String(createdProfile.id)
        || createdProfile.data?.name === post.salon
      )
    );

    if (isOwnPost) {
      return {
        id: createdProfile.id,
        name: createdProfile.data.name,
        area: createdProfile.data.area || post.area || "",
        role: createdProfile.data.service || post.tag || (createdProfile.type === "salon" ? "سالن زیبایی" : "آرتیست"),
        rating: post.rating || "",
        bio: createdProfile.data.bio || post.meta || "",
        source: createdProfile.type === "salon"
          ? (fromDirectory || null)
          : createdProfile,
        kind: "self",
        entityType: createdProfile.type
      };
    }

    if (post.ownerType === "salon" || fromDirectory) {
      return {
        id: fromDirectory?.id || post.ownerUserId,
        name: fromDirectory?.name || post.salon || "سالن",
        area: fromDirectory?.area || post.area || "",
        role: fromDirectory?.tag || post.tag || "سالن زیبایی",
        rating: fromDirectory?.rating || post.rating || "",
        bio: fromDirectory?.bio || post.meta || "",
        source: fromDirectory || null,
        kind: "salon",
        entityType: "salon"
      };
    }

    return {
      id: post.ownerUserId,
      name: post.salon || "آرتیست",
      area: post.area || "",
      role: post.ownerService ? `آرتیست ${post.ownerService}` : (post.tag || "آرتیست"),
      rating: post.rating || "",
      bio: post.ownerBio || post.meta || "",
      source: null,
      kind: "artist",
      entityType: "artist"
    };
  }

  function buildOwnPublicSalon() {
    const ownStoryVideo = createdProfile?.data?.storyVideo || createdProfile?.data?.story_video || createdProfile?.data?.introVideo || createdProfile?.data?.intro_video || "";
    const ownStoryPoster = createdProfile?.data?.storyPoster || createdProfile?.data?.story_poster || createdProfile?.data?.introPoster || createdProfile?.data?.intro_poster || "";
    const ownStoryFields = {
      ...(ownStoryVideo ? {
        storyVideo: ownStoryVideo,
        story_video: ownStoryVideo,
        introVideo: ownStoryVideo,
        intro_video: ownStoryVideo
      } : {}),
      ...(ownStoryPoster ? {
        storyPoster: ownStoryPoster,
        story_poster: ownStoryPoster,
        introPoster: ownStoryPoster,
        intro_poster: ownStoryPoster
      } : {})
    };
    const fromDirectory = salonDirectory.find((salon) => (
      String(salon.id) === String(createdProfile?.id)
      || String(salon.source_key) === String(createdProfile?.id)
      || salon.name === createdProfile?.data?.name
    ));
    if (fromDirectory) {
      return {
        ...fromDirectory,
        ...ownStoryFields,
        portfolio: fromDirectory.portfolio?.length ? fromDirectory.portfolio : salonPortfolioList,
        staff: fromDirectory.staff?.length ? fromDirectory.staff : salonStaffList,
        services: fromDirectory.services?.length ? fromDirectory.services : salonServiceList
      };
    }
    if (createdProfile?.type !== "salon") return null;
    return {
      id: createdProfile.id,
      source_key: String(createdProfile.id),
      name: createdProfile.data?.name || "سالن",
      area: createdProfile.data?.area || "",
      tag: createdProfile.data?.tag || createdProfile.data?.service || "سالن زیبایی",
      rating: createdProfile.data?.rating || "",
      open: createdProfile.data?.open || "امروز",
      bio: createdProfile.data?.bio || "",
      avatar: createdProfile.data?.avatar || "",
      ...ownStoryFields,
      post_count: salonPortfolioList.length,
      follower_count: Number(createdProfile.data?.follower_count || 0),
      following_count: Number(createdProfile.data?.following_count || 0),
      portfolio: salonPortfolioList,
      staff: salonStaffList,
      services: salonServiceList
    };
  }

  function buildOwnStoryFields() {
    const data = createdProfile?.data || {};
    const video = data.storyVideo || data.story_video || data.introVideo || data.intro_video || "";
    const poster = data.storyPoster || data.story_poster || data.introPoster || data.intro_poster || "";
    if (!video && !poster) return null;
    return {
      ...(video ? {
        storyVideo: video,
        story_video: video,
        introVideo: video,
        intro_video: video
      } : {}),
      ...(poster ? {
        storyPoster: poster,
        story_poster: poster,
        introPoster: poster,
        intro_poster: poster
      } : {})
    };
  }

  const STORY_TYPE_LABELS = { salon: "سالن", shop: "فروشگاه", artist: "آرتیست" };

  async function saveProfileStory(storyPayload) {
    const storyVideo = typeof storyPayload === "string" ? storyPayload : storyPayload?.video;
    const storyPoster = typeof storyPayload === "string" ? "" : storyPayload?.poster;
    if (!createdProfile || !STORY_TYPE_LABELS[createdProfile.type] || (!storyVideo && !storyPoster)) return;
    let persisted = false;
    let serverError = "";
    try {
      const response = await fetch("/api/profile/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: storyVideo, poster: storyPoster })
      });
      persisted = response.ok;
      if (!response.ok) {
        try {
          const errorBody = await response.json();
          serverError = errorBody?.error || "";
        } catch {
          serverError = "";
        }
      }
    } catch {
      persisted = false;
    }
    if (!persisted) {
      setAppToast(serverError || "ذخیره استوری در سرور انجام نشد؛ دوباره امتحان کن.");
      return;
    }
    const storyFields = {
      ...(storyVideo ? {
        storyVideo,
        story_video: storyVideo,
        introVideo: storyVideo,
        intro_video: storyVideo
      } : {}),
      ...(storyPoster ? {
        storyPoster,
        story_poster: storyPoster,
        introPoster: storyPoster,
        intro_poster: storyPoster
      } : {})
    };
    const nextProfile = {
      ...createdProfile,
      data: {
        ...createdProfile.data,
        ...storyFields
      }
    };
    const ownId = String(createdProfile.id || "");
    const ownName = createdProfile.data?.name || "";
    const matchesOwnSalon = (salon) => (
      String(salon.id || "") === ownId
      || String(salon.source_key || "") === ownId
      || (ownName && salon.name === ownName)
    );

    lockSession();
    writeAuthSession(nextProfile);
    setCreatedProfile(nextProfile);
    setSelectedSalon((current) => (current && matchesOwnSalon(current) ? { ...current, ...storyFields } : current));
    setSelectedShop((current) => (current && String(current.id || "") === ownId ? { ...current, ...storyFields } : current));
    setSelectedPublicArtist((current) => (current && String(current.id || "") === ownId ? { ...current, ...storyFields } : current));
    setSalonDirectory((current) => current.map((salon) => (matchesOwnSalon(salon) ? { ...salon, ...storyFields } : salon)));
    setAppToast(storyVideo ? `استوری معرفی ${STORY_TYPE_LABELS[createdProfile.type]} ذخیره شد.` : `پوستر استوری ${STORY_TYPE_LABELS[createdProfile.type]} ذخیره شد.`);
  }

  async function deleteProfileStory() {
    if (!createdProfile || !STORY_TYPE_LABELS[createdProfile.type]) return;
    try {
      const response = await fetch("/api/profile/story", { method: "DELETE" });
      if (!response.ok) {
        setAppToast("حذف استوری انجام نشد؛ دوباره امتحان کن.");
        return;
      }
    } catch {
      setAppToast("حذف استوری انجام نشد؛ دوباره امتحان کن.");
      return;
    }
    const STORY_KEYS = ["storyVideo", "story_video", "introVideo", "intro_video", "storyPoster", "story_poster", "introPoster", "intro_poster"];
    const stripStoryFields = (entity) => {
      if (!entity) return entity;
      const next = { ...entity };
      for (const key of STORY_KEYS) delete next[key];
      return next;
    };
    const ownId = String(createdProfile.id || "");
    const ownName = createdProfile.data?.name || "";
    const matchesOwnSalon = (salon) => (
      String(salon.id || "") === ownId
      || String(salon.source_key || "") === ownId
      || (ownName && salon.name === ownName)
    );
    const nextProfile = { ...createdProfile, data: stripStoryFields(createdProfile.data) };
    lockSession();
    writeAuthSession(nextProfile);
    setCreatedProfile(nextProfile);
    setSelectedSalon((current) => (current && matchesOwnSalon(current) ? stripStoryFields(current) : current));
    setSelectedShop((current) => (current && String(current.id || "") === ownId ? stripStoryFields(current) : current));
    setSelectedPublicArtist((current) => (current && String(current.id || "") === ownId ? stripStoryFields(current) : current));
    setSalonDirectory((current) => current.map((salon) => (matchesOwnSalon(salon) ? stripStoryFields(salon) : salon)));
    setAppToast(`استوری ${STORY_TYPE_LABELS[createdProfile.type]} حذف شد.`);
  }

  // Hoisted out of openExploreArtistProfile (below) so it can also be reused
  // as the "رزرو دوباره" (book again) navigation from the client's own
  // bookings/orders activity view — see rebookSalonFromBooking.
  const openSalonProfile = async (salonLike) => {
      closePublicArtistProfile();
      setSalonClientTab("gallery");

      const matchesSalon = (salon) => (
        String(salon.id || "") === String(salonLike.id || "")
        || String(salon.source_key || "") === String(salonLike.id || "")
        || String(salon.id || "") === String(salonLike.source_key || "")
        || salon.name === salonLike.name
      );
      const fallbackSalon = salonLike.source || {
        id: salonLike.id,
        source_key: salonLike.source_key || String(salonLike.id || ""),
        name: salonLike.name,
        area: salonLike.area,
        tag: salonLike.role || salonLike.tag,
        rating: salonLike.rating,
        open: salonLike.open || "امروز",
        bio: salonLike.bio || "",
        avatar: salonLike.avatar || "",
        post_count: salonLike.post_count || 0,
        follower_count: salonLike.follower_count || 0,
        following_count: salonLike.following_count || 0,
        portfolio: salonLike.portfolio || [],
        services: salonLike.services || [],
        staff: salonLike.staff || []
      };

      let nextSalon = salonDirectory.find(matchesSalon) || fallbackSalon;
      try {
        const response = await fetch("/api/salons");
        if (response.ok) {
          const payload = await response.json();
          const list = payload.salons || payload.data?.salons || [];
          if (list.length) {
            setSalonDirectory(list);
            nextSalon = list.find(matchesSalon) || nextSalon;
          }
        }
      } catch {
        // keep the resolved salon from the current post/directory
      }

      // The list stays light (no story video); pull the full detail for the public page.
      if (nextSalon?.id) {
        try {
          const detailResponse = await fetch("/api/salons/" + encodeURIComponent(nextSalon.id));
          if (detailResponse.ok) {
            const detailPayload = await detailResponse.json();
            const detail = detailPayload.salon || detailPayload;
            if (detail && typeof detail === "object") {
              nextSalon = { ...nextSalon, ...detail };
            }
          }
        } catch {
          // keep the resolved salon from the list/directory
        }
      }

      setSelectedSalon(nextSalon);
      goToTab("salons");
  };

  // "رزرو دوباره" — reopens the salon a past booking was made with, using the
  // salon fields the booking row already carries (see listClientSalonBookings
  // in app/lib/db/repos/salons/bookings.js: salon_user_id/salonName/etc).
  function rebookSalonFromBooking(booking) {
    if (!booking) return;
    const salonId = booking.salon_user_id || booking.sourceSalonUserId || booking.salonUserId || "";
    if (!salonId) {
      setAppToast("این رزرو به یک حساب سالن وصل نیست.");
      return;
    }
    openSalonProfile({
      id: salonId,
      source_key: String(salonId),
      name: booking.salonName || booking.salon_name || "",
      area: booking.salonArea || booking.salon_area || "",
      avatar: booking.salonAvatar || booking.salon_avatar || ""
    });
  }

  // "رزرو دوباره" for a direct-artist booking (see listClientArtistBookings
  // in app/lib/db/repos/artists.js) — opens the artist's own public
  // profile (PublicArtistModal), not a salon page. The row's name/area/
  // avatar are reused under salonName/salonArea/salonAvatar for display,
  // but the routing id is its own artistUserId/sourceArtistUserId field
  // — never aliased to salon_user_id, so this never gets confused with
  // rebookSalonFromBooking above.
  function rebookArtistFromBooking(booking) {
    if (!booking) return;
    const artistId = booking.artistUserId || booking.sourceArtistUserId || "";
    if (!artistId) {
      setAppToast("این رزرو به یک حساب آرتیست وصل نیست.");
      return;
    }
    openPublicArtistProfile({
      id: artistId,
      name: booking.salonName || booking.salon_name || "",
      area: booking.salonArea || booking.salon_area || "",
      avatar: booking.salonAvatar || booking.salon_avatar || ""
    });
  }

  // Client's own bookings/activity view ("فعالیت من") mixes salon bookings
  // and direct-artist bookings in one list (see refreshClientBookings in
  // useSalonDirectory.js). "رزرو دوباره" on a merged row must route to the
  // right profile type per row, not assume salon — dispatch on
  // bookingSource here rather than in ClientBookingsPanel/
  // ClientBookingSettingsModal (presentational; no data-shape branching there).
  function rebookFromBooking(booking) {
    if (!booking) return;
    if (booking.bookingSource === "artist") {
      rebookArtistFromBooking(booking);
      return;
    }
    rebookSalonFromBooking(booking);
  }

  async function openExploreArtistProfile(post) {
    const artist = resolveExploreArtist(post);
    setSelectedPost(null);
    if (!artist) return;

    if (artist.kind === "self" && artist.entityType === "salon") {
      const ownSalon = artist.source || buildOwnPublicSalon();
      if (ownSalon) {
        await openSalonProfile(ownSalon);
        return;
      }
    }

    if (artist.kind === "self" && artist.entityType === "artist") {
      await openPublicArtistProfile({
        ...artist,
        kind: "artist",
        entityType: "artist"
      });
      const ownStory = buildOwnStoryFields();
      if (ownStory) {
        setSelectedPublicArtist((current) => (current ? { ...current, ...ownStory } : current));
      }
      return;
    }

    if (artist.kind === "self") {
      goToTab("profile");
      return;
    }

    if (artist.kind === "salon") {
      await openSalonProfile(artist);
      return;
    }

    await openPublicArtistProfile(artist);
  }

  function openSalonStaffPublicProfile(person) {
    if (!person) return;
    const artistId = Number(person.artist_user_id || 0) || null;
    if (!artistId && !person.has_artist_profile) {
      setSelectedArtistProfile(person);
      return;
    }
    openPublicArtistProfile({
      id: artistId,
      name: person.artist_name || person.name,
      area: person.artist_area || "",
      role: person.role || person.artist_service || "آرتیست",
      bio: person.artist_bio || person.bio || "",
      avatar: person.avatar || person.staff_avatar || "",
      phone: person.artist_phone || person.phone || "",
      kind: "artist",
      entityType: "artist"
    });
  }

  async function toggleFollowShop(shop) {
    if (!shop?.id) return;
    const key = String(shop.id);
    const previousFollowed = followedArtists.includes(key) || followedSalons.includes(key);
    const nextFollowed = !previousFollowed;

    function applyFollowed(followed) {
      setFollowedArtists((items) => (
        followed ? [...items.filter((item) => item !== key), key] : items.filter((item) => item !== key)
      ));
      setFollowedSalons((items) => (
        followed ? [...items.filter((item) => item !== key), key] : items.filter((item) => item !== key)
      ));
    }

    applyFollowed(nextFollowed);
    bumpFollowOptimistic(shop.id, nextFollowed ? 1 : -1);
    try {
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: shop.id })
      });
      const payload = await response.json();
      if (!response.ok) {
        applyFollowed(previousFollowed);
        bumpFollowOptimistic(shop.id, nextFollowed ? -1 : 1);
        setAppToast(payload.error || "فالو فروشگاه ذخیره نشد.");
        return;
      }
      const followerCount = payload.data?.followerCount ?? payload.data?.follower_count;
      if (followerCount != null) {
        applyFollowCount(shop.id, followerCount);
      }
      setAppToast(
        nextFollowed
          ? `فروشگاه «${shop.name}» را دنبال کردی.`
          : `دنبال کردن «${shop.name}» لغو شد.`
      );
    } catch {
      applyFollowed(previousFollowed);
      bumpFollowOptimistic(shop.id, nextFollowed ? -1 : 1);
      setAppToast("فالو فروشگاه ذخیره نشد.");
    }
  }


  async function shareSalonOwnerProfile() {
    await shareSalonProfile(createdProfile?.data?.name || "سالن");
  }

  const renderWalletPage = () => (
    <WalletPage
      profileType={profileType}
      walletAvailable={walletAvailable}
      walletBankAccount={walletBankAccount}
      walletBankDraft={walletBankDraft}
      setWalletBankDraft={setWalletBankDraft}
      walletBusy={walletBusy}
      walletLoading={walletLoading}
      walletCashMode={walletCashMode}
      setWalletCashMode={setWalletCashMode}
      walletWithdrawAmount={walletWithdrawAmount}
      setWalletWithdrawAmount={setWalletWithdrawAmount}
      walletWithdrawals={walletWithdrawals}
      walletTransactions={walletTransactions}
      onSaveBankAccount={saveWalletBankAccount}
      onCharge={requestWalletCharge}
      onWithdraw={requestWalletWithdraw}
    />
  );

  const renderSavedPosts = () => (
    <ProfileSavedPosts
      posts={savedExplorePosts}
      salons={savedProfiles.salons}
      artists={savedProfiles.artists}
      onSelectPost={selectExplorePost}
      onRemovePost={(item) => toggleSavedPost(item.title, item)}
      onSelectSalon={selectSalonWithStory}
      onRemoveSalon={removeSavedSalon}
      onSelectArtist={openPublicArtistProfile}
      onRemoveArtist={removeSavedArtist}
    />
  );

  const selectedExploreArtist = selectedPost ? resolveExploreArtist(selectedPost) : null;

  const selectSalonWithStory = async (salon) => {
    if (!salon) return;
    setSalonClientTab("gallery");
    setSelectedSalon(salon);
    try {
      const response = await fetch("/api/salons/" + encodeURIComponent(salon.id));
      if (response.ok) {
        const payload = await response.json();
        const detail = payload.salon || payload;
        if (detail && typeof detail === "object") {
          setSelectedSalon((current) => (
            current && String(current.id) === String(salon.id)
              ? { ...current, ...detail }
              : { ...salon, ...detail }
          ));
          if (typeof detail.isSaved === "boolean") {
            const salonKey = String(salon.id || salon.source_key || salon.name);
            setSavedSalonKeys((items) => {
              if (detail.isSaved) return items.includes(salonKey) ? items : [...items, salonKey];
              return items.includes(salonKey) ? items.filter((item) => item !== salonKey) : items;
            });
          }
        }
      }
    } catch {
      // keep the list row
    }
  };

  const selectShopWithStory = async (shop, fetchDetails = false) => {
    await selectShop(shop, fetchDetails);
    const ownStory = (createdProfile?.type === "shop" && shop && String(shop.id) === String(createdProfile?.id)) ? buildOwnStoryFields() : null;
    if (ownStory) {
      setSelectedShop((current) => (current && String(current.id) === String(createdProfile?.id) ? { ...current, ...ownStory } : current));
    }
  };
  // Hydrate the owner profile with persisted story fields (poster/video) from the server.
  useEffect(() => {
    if (!createdProfile?.id) return;
    let cancelled = false;
    fetch("/api/profile/story")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.story) return;
        const video = String(payload.story.video || "");
        const poster = String(payload.story.poster || "");
        if (!video && !poster) return;
        setCreatedProfile((current) => {
          if (!current) return current;
          return {
            ...current,
            data: {
              ...current.data,
              ...(video ? { storyVideo: video, story_video: video, introVideo: video, intro_video: video } : {}),
              ...(poster ? { storyPoster: poster, story_poster: poster, introPoster: poster, intro_poster: poster } : {})
            }
          };
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [createdProfile?.id]);


  // "inbox" is the only chat pane the floating owner dock/dock-space CSS
  // should coexist with — details/new-group/add-members/conversation are
  // all full-screen sub-views of the chat tab.
  const chatPaneIsFullScreen = chatPane !== "inbox";

  return (
    <main className={`appShell ${activeTab === "chat" ? "is-chat" : ""} ${activeTab === "chat" && chatPaneIsFullScreen ? "is-chat-conversation" : ""} ${!createdProfile ? "is-auth-gate" : ""} ${(activeTab === "profile" || activeTab === "chat") && createdProfile?.type === "shop" && createdProfile.type === profileType ? "is-shop-owner" : ""} ${selectedShop && activeTab === "shops" ? "is-shop-store" : ""} ${selectedSalon && activeTab === "salons" ? "is-salon-client" : ""} ${selectedPublicArtist ? "is-artist-public" : ""} ${!authChecked ? "is-auth-loading" : ""}`}>
      {!authChecked ? <AuthBootScreen /> : null}
      <ShellSidebar activeTab={activeTab} onNavigate={goToTab} />

      <section className="workspace">
        {!createdProfile ? (
          <div className="authGateBg" aria-hidden="true">
            <video
              className="authGateVideo"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/profile-icon.png"
              onLoadedMetadata={(event) => {
                event.currentTarget.playbackRate = 0.45;
              }}
              onPlay={(event) => {
                event.currentTarget.playbackRate = 0.45;
              }}
            >
              <source src="/auth-gate-bg.mp4" type="video/mp4" />
            </video>
            <span className="authGateScrim" />
          </div>
        ) : null}

        <section className="contentGrid">
          <ExplorePage
            active={activeTab === "feed"}
            exploreCategory={exploreCategory}
            posts={visibleExplorePosts}
            loading={exploreLoading}
            onCategoryChange={setExploreCategory}
            onPostSelect={selectExplorePost}
          />

          <SalonClientPage
            active={activeTab === "salons"}
            selectedSalon={selectedSalon}
            salons={salonDirectory}
            tab={salonClientTab}
            reviews={salonClientReviews}
            isFollowing={isFollowingSelectedSalon}
            isSaved={isSavedSelectedSalon}
            getVisibleServices={getVisibleSalonServiceItems}
            getPortfolioCardStyle={getPortfolioCardStyle}
            onBack={() => setSelectedSalon(null)}
            onFollow={toggleFollowSalon}
            onSave={toggleSaveSalon}
            onShare={shareSalonProfile}
            onTabChange={setSalonClientTab}
            onOpenBooking={openSalonClientBooking}
            onOpenChat={openSalonPublicChat}
            onSelectSalon={selectSalonWithStory}
          />

          <ChatPage
            active={activeTab === "chat"}
            myUserId={createdProfile?.id}
            connected={chat.connected}
            conversations={chat.conversations}
            conversationsLoading={chat.conversationsLoading}
            activeConversationId={chat.activeConversationId}
            activeConversation={chat.activeConversation}
            activeMessages={chat.activeMessages}
            activeMessagesLoading={chat.activeMessagesLoading}
            hasMoreMessages={chat.hasMoreMessages}
            sendBusy={chat.sendBusy}
            onOpenConversation={chat.openConversation}
            onLoadMore={chat.loadMoreMessages}
            onSend={chat.sendMessage}
            onCreateGroup={chat.createGroup}
            onAddMembers={chat.addGroupMembers}
            onRenameGroup={chat.renameGroup}
            onRemoveMember={chat.removeGroupMember}
            onLeaveGroup={chat.leaveConversation}
            onPaneChange={setChatPane}
            composerSignal={chatComposerSignal}
            onBack={() => {
              if (!chatOpenedFromShop) return;
              setChatOpenedFromShop(false);
              setActiveTab("shops");
            }}
            title={
              createdProfile?.type === "shop" ? "پیام‌های فروشگاه"
                : createdProfile?.type === "artist" ? "پیام‌های آرتیست"
                : createdProfile?.type === "salon" ? "پیام‌های سالن"
                : "پیام‌ها"
            }
            initialPane={chatInitialPane}
          />
        </section>

        <ChatComposeFab
          open={activeTab === "chat" && chatPane === "inbox"}
          onClick={() => setChatComposerSignal((n) => n + 1)}
        />

        {activeTab === "salons" && (
          <SalonClientBookingModal
            open={Boolean(selectedSalon && salonClientBooking.open)}
            salon={selectedSalon}
            booking={salonClientBooking}
            freeTimes={salonClientFreeTimes}
            busy={salonClientBookingBusy}
            onClose={closeSalonClientBooking}
            onChange={patchSalonClientBooking}
            onConfirm={confirmSalonClientBooking}
          />
        )}

        <SalonClientFloatingDock
          open={activeTab === "salons" && Boolean(selectedSalon)}
          onBook={() => {
            setSalonClientTab("services");
            setAppToast("اول نوع خدمت را انتخاب کن.");
          }}
          onMessage={() => openSalonPublicChat(selectedSalon)}
        />

        <ShopStorefrontPage
          active={activeTab === "shops"}
          selectedShop={selectedShop}
          visibleShops={visibleShops}
          shopCategory={shopCategory}
          shopStoreFilter={shopStoreFilter}
          catalog={selectedShopCatalog}
          cartItems={currentShopCart}
          reviews={selectedShop?.reviews || []}
          loading={shopStoreLoading}
          productsRef={shopProductsRef}
          reviewsRef={shopReviewsRailRef}
          followingShop={Boolean(selectedShop && (followedArtists.includes(String(selectedShop.id)) || followedSalons.includes(String(selectedShop.id))))}
          isOwnShop={Boolean(selectedShop && createdProfile?.type === "shop" && String(selectedShop.id) === String(createdProfile.id))}
          onBack={() => {
            closeShopStorefront();
            if (shopPreviewFromDashboard) {
              setShopPreviewFromDashboard(false);
              goToTab("profile");
            }
          }}
          onFollowShop={toggleFollowShop}
          onAddToCart={addToShopCart}
          onFilterChange={setShopStoreFilter}
          onCategoryChange={setShopCategory}
          onShopSelect={selectShopWithStory}
          onNotice={setAppToast}
        />

        <section className={`profilePanel mobilePage page-profile ${profileType === "salon" ? "is-salon-profile" : ""} ${!createdProfile || activeTab === "profile" ? "is-active" : ""} ${createdProfile && createdProfile.type === profileType ? "has-floating-cta" : ""}`} id="profile">
          {!createdProfile ? (
            <AuthGateForms
              authMode={authMode}
              signupStep={signupStep}
              authNotice={authNotice}
              authBusy={authBusy}
              profileType={profileType}
              activeRoleMeta={activeRoleMeta}
              onSelectRole={(roleId) => {
                setProfileType(roleId);
                setSignupStep("form");
                setAuthNotice("");
              }}
              onSwitchToLogin={() => { setAuthMode("login"); setAuthNotice(""); }}
              onSwitchToSignup={() => { setAuthMode("signup"); setSignupStep("role"); setAuthNotice(""); }}
              onBackToRole={() => setSignupStep("role")}
              onLoginSubmit={handleLoginSubmit}
              onProfileSubmit={handleProfileSubmit}
            />
          ) : (
            <>
            <ProfileHero
              profile={createdProfile}
              heroClass={activeCreatedMeta?.heroClass || ""}
              kicker={activeCreatedMeta?.kicker || ""}
              desc={activeCreatedMeta?.desc || ""}
              salonStats={salonSocialStats}
              artistStats={{
                rating: artistSocialStats.rating,
                followers: artistSocialStats.followers,
                portfolioCount: visibleArtistPortfolio.length,
                bookingCount: artistBookingList.length
              }}
              shopStats={{
                productCount: shopCatalog.length,
                newOrderCount: shopOrderList.filter((order) => order.status === "جدید").length,
                featuredCount: shopCatalog.filter((item) => item.featured && item.tone !== "off").length
              }}
              activePanel={createdProfile?.type === "salon" ? salonHeroSheet : profileView}
              onOpenSaved={() => {
                if (createdProfile?.type === "salon") {
                  setSalonHeroSheet((prev) => (prev === "saved" ? null : "saved"));
                } else {
                  setProfileView((prev) => (prev === "saved" ? "overview" : "saved"));
                }
              }}
              onOpenNotifications={() => {
                if (createdProfile?.type === "salon") {
                  setSalonHeroSheet((prev) => (prev === "notifications" ? null : "notifications"));
                } else if (createdProfile?.type === "artist") {
                  setProfileView((prev) => (prev === "notifications" ? "overview" : "notifications"));
                }
              }}
              notificationCount={
                createdProfile?.type === "salon"
                  ? salonUnreadNoticeCount
                  : createdProfile?.type === "artist"
                    ? pendingArtistBookingRequests.length + pendingArtistSalonInvites.length
                    : 0
              }
              onOpenSettings={() => {
                if (createdProfile?.type === "salon") {
                  setSalonHeroSheet((prev) => (prev === "settings" ? null : "settings"));
                } else if (createdProfile?.type === "shop") {
                  setProfileView("insights");
                } else {
                  setProfileView((prev) => (prev === "settings" ? "overview" : "settings"));
                }
              }}
              onOpenWallet={() => {
                refreshWallet();
                if (createdProfile?.type === "salon") {
                  setSalonHeroSheet((prev) => (prev === "wallet" ? null : "wallet"));
                } else {
                  setProfileView((prev) => (prev === "wallet" ? "overview" : "wallet"));
                }
              }}
              onOpenWeekHistory={() => setSalonWeekHistoryOpen(true)}
              onSelectSalonWeekDay={setScheduleViewDay}
              selectedSalonWeekDay={activeScheduleDateKey}
              salonWeekTabs={salonHeroWeekTabs}
              showSalonWeekStrip={!salonWorkspace && profileView === "overview"}
              onShare={shareSalonOwnerProfile}
              showShare={createdProfile?.type === "salon"}
              onStorySave={saveProfileStory}
              onStoryDelete={deleteProfileStory}
              onPreviewPublic={() => {
                if (createdProfile?.type === "artist" && createdProfile.id) {
                  openPublicArtistProfile({
                    id: createdProfile.id,
                    name: createdProfile.data?.name || "",
                    avatar: createdProfile.data?.avatar || "",
                    area: createdProfile.data?.area || ""
                  });
                }
              }}
            />

            <ProfileModeRail
              placement="panel"
              profileType={profileType}
              profileView={profileView}
              salonWorkspace={salonWorkspace}
              activeRoleMeta={activeRoleMeta}
              onOverview={() => {
                closeSalonWorkspace();
                setProfileView("overview");
              }}
              onSalonWorkspace={openSalonWorkspace}
              onProfileView={setProfileView}
              onWallet={() => {
                setProfileView((prev) => (prev === "wallet" ? "overview" : "wallet"));
                refreshWallet();
              }}
            />

          {createdProfile.type === profileType ? (
            <div className={`createdProfile ${activeRoleMeta.heroClass || ""}`}>
              {profileView === "overview" && (
                <>
                  {profileType === "salon" ? (
                    salonWorkspace ? (
                      <div className={`salonWorkspacePanel is-${salonWorkspace}`} aria-label="ورک‌اسپیس سالن">
                      {salonWorkspace === "staff" && (
                        <SalonStaffWorkspace
                          activeStaffCount={activeStaffCount}
                          pendingInvites={pendingSalonArtistInvites}
                          staffList={safeSalonStaffList}
                          onCreateStaff={() => {
                            setArtistCreateRole(salonArtistRoleOptions[0]);
                            setArtistCreateStatus(salonArtistStatusOptions[0]);
                            setArtistCreateOpen(true);
                          }}
                          onInviteNearby={openNearbyArtistInvite}
                          onCancelInvite={cancelSalonArtistInvite}
                          onOpenStaffPublic={openSalonStaffPublicProfile}
                          onManageStaff={setSelectedArtistProfile}
                        />
                      )}

                      {salonWorkspace === "hours" && (
                        <SalonServicesWorkspace
                          services={salonServiceList}
                          staffList={safeSalonStaffList}
                          serviceArtistMenuId={serviceArtistMenuId}
                          onMenuToggle={setServiceArtistMenuId}
                          onCreate={openSalonServiceCreate}
                          onToggleArtist={toggleSalonServiceArtist}
                          onClearArtists={(service) => assignSalonServiceArtist(service, null)}
                          onEdit={editArtistService}
                          onDelete={deleteSalonService}
                        />
                      )}

                      {salonWorkspace === "portfolio" && (
                        <ProfileGallery
                          label="گالری پست‌ها"
                          items={salonPortfolioList}
                          onAdd={() => openPortfolioComposer()}
                          addLabel="افزودن پست جدید"
                          getFallbackStyle={getPortfolioCardStyle}
                          editingId={salonWorkDraft && salonWorkDraft.id !== "new" ? salonWorkDraft.id : null}
                          onItemClick={(item) => openPortfolioComposer(item)}
                          composeValue={salonWorkDraft}
                          onComposeChange={setSalonWorkDraft}
                          onComposeClose={resetPortfolioComposer}
                          onComposeSubmit={addSalonPortfolio}
                          onComposeDelete={deleteSalonPortfolioFromComposer}
                          onComposeImageUpload={handleSalonWorkImageUpload}
                          onComposeImageClear={clearSalonWorkImage}
                          composeTagOptions={salonWorkTagOptions}
                          composeVisibleTagOptions={salonWorkVisibleTagOptions}
                          composeTagMenuOpen={salonWorkTagMenuOpen}
                          onComposeTagMenuOpenChange={setSalonWorkTagMenuOpen}
                          composeSaving={portfolioSaving}
                          composeAriaLabel={salonWorkDraft?.id === "new" ? "پست جدید" : "ویرایش پست"}
                          composeSubmitLabel={salonWorkDraft?.id === "new" ? "انتشار در اکسپلور" : "ذخیره تغییرات"}
                          composeShowFeaturedToggle={false}
                        />
                      )}
                      </div>
                    ) : (
                    <SalonScheduleDashboard
                      pendingCollabRequests={pendingSalonCollabRequests}
                      onApproveCollab={(id) => updateSalonCollabRequest(id, "تایید شد")}
                      onDeclineCollab={(id) => updateSalonCollabRequest(id, "رد شد")}
                      reservationRequests={reservationRequestList}
                      bookingDateForSlots={bookingDateForSlots}
                      onApproveRequest={approveReservationRequest}
                      onDeclineRequest={declineReservationRequest}
                      requestBusyId={salonRequestBusyId}
                      weekTabs={salonScheduleWeekTabs}
                      selectedDay={activeScheduleDay}
                      onSelectDay={setScheduleViewDay}
                      historyBookings={salonHistoryAppointments}
                      dayAppointments={scheduleDayAppointments}
                      emptyDayLabel={activeScheduleDayLabel}
                      staffList={safeSalonStaffList}
                      loading={salonWorkspaceLoading}
                      onOpenClient={(booking) => openScheduleBookingMenu(booking)}
                      onOpenBookingMenu={openScheduleBookingMenu}
                      historyOpen={salonWeekHistoryOpen}
                      onHistoryOpenChange={setSalonWeekHistoryOpen}
                    />
                    )
                  ) : profileType === "shop" ? (
                    <ShopProductsOverview
                      profile={createdProfile}
                      products={shopCatalog}
                      categories={shopCategories}
                      onCreateCategory={addShopCategory}
                      onRenameCategory={renameShopCategory}
                      onMoveCategory={moveShopCategory}
                      onDeleteCategory={removeShopCategory}
                      categoryBusy={shopCategoryBusy}
                      promoCards={shopPromoCards}
                      promoCardBusy={shopPromoCardBusy}
                      onCreatePromoCard={createShopPromoCardEntry}
                      onActivatePromoCard={activateShopPromoCardEntry}
                      onDeletePromoCard={removeShopPromoCard}
                      orders={shopOrderList}
                      loading={shopWorkspaceLoading}
                      onOpenProduct={openShopProductDetail}
                      onCreateProduct={(category) => {
                        closeOwnerChat();
                        openShopProductSheet(null, category || "");
                      }}
                      onOpenOrders={() => setProfileView("orders")}
                      onOpenInsights={() => setProfileView("insights")}
                      onOpenSettings={() => setProfileView("settings")}
                      onPreviewPublic={() => {
                        if (createdProfile?.type === "shop" && createdProfile.id) {
                          setShopPreviewFromDashboard(true);
                          selectShopWithStory({ id: createdProfile.id, name: createdProfile.data?.name || "" }, true);
                          goToTab("shops");
                        }
                      }}
                      onStorySave={saveProfileStory}
                      onStoryDelete={deleteProfileStory}
                    />
                  ) : profileType === "artist" ? (
                    <ArtistOverviewReviews
                      galleryItems={artistGalleryItems}
                      galleryTags={artistGalleryTags}
                      galleryFilter={artistGalleryFilter}
                      onGalleryFilterChange={setArtistGalleryFilter}
                      onAddWork={() => openArtistWorkModal({
                        id: "new",
                        title: "",
                        tag: "میکاپ",
                        caption: "",
                        image: "",
                        saves: "۰",
                        views: "۰",
                        rating: "",
                        inExplore: true,
                        featured: true
                      })}
                      onItemClick={openArtistWorkPreview}
                      composeValue={editingArtistWork}
                      onComposeChange={setEditingArtistWork}
                      onComposeClose={closeArtistWorkModal}
                      onComposeSubmit={saveArtistWork}
                      onComposeDelete={deleteArtistWork}
                      onComposeImageUpload={handleArtistWorkImageUpload}
                      onComposeImageClear={clearArtistWorkImage}
                      composeTagOptions={artistWorkTagOptions}
                      composeVisibleTagOptions={artistWorkVisibleTagOptions}
                      composeTagMenuOpen={artistWorkTagMenuOpen}
                      onComposeTagMenuOpenChange={setArtistWorkTagMenuOpen}
                      reviewSummary={artistReviewSummary}
                      reviews={artistReviewList}
                      artistAvatar={createdProfile?.data?.avatar || ""}
                      replyingReviewId={artistReplyingReviewId}
                      replyDraft={artistReplyDraft}
                      onReplyDraftChange={setArtistReplyDraft}
                      replySubmitting={artistReplySubmitting}
                      onOpenReply={openArtistReviewReply}
                      onCloseReply={closeArtistReviewReply}
                      onSubmitReply={submitArtistReviewReply}
                      onOpenReviewer={(review) => {
                        if (!review) return;
                        if (review.author_type === "artist" && review.author_user_id) {
                          openPublicArtistProfile({
                            id: review.author_user_id,
                            name: review.name,
                            avatar: review.author_avatar || ""
                          });
                          return;
                        }
                        setSelectedBookingClient({
                          id: review.author_user_id || null,
                          name: review.name || "کاربر",
                          avatar: review.author_avatar || "",
                          area: review.author_area || "",
                          type: review.author_type || "client",
                          kicker: "پروفایل نظردهنده",
                          bio: "",
                          phone: "",
                          bookingCount: 1,
                          bookings: [],
                          lastBooking: null
                        });
                      }}
                    />
                  ) : profileType === "client" ? (
                    <ClientProfileOverview
                      profile={createdProfile}
                      onEditProfile={openProfileEdit}
                      onOpenBookings={() => setProfileView("bookings")}
                      onOpenSaved={() => setProfileView("saved")}
                      profileSettings={profileSettings}
                      onToggleSetting={toggleProfileSetting}
                      onLogout={logoutAccount}
                    />
                  ) : null}
                </>
              )}

              {profileView === "bookings" && profileType === "client" && (
                <div className="clientActivityStack" aria-label="فعالیت من">
                  <ClientBookingsPanel
                    bookings={clientBookingList}
                    onOpenSettings={setClientBookingSettings}
                    onRebook={rebookFromBooking}
                  />
                  <ClientOrdersPanel
                    orders={clientOrderList}
                    loaded={clientOrdersLoaded}
                    error={clientOrdersError}
                    onBuyAgain={(order) => {
                      if (!order?.shop_user_id) {
                        setAppToast("این سفارش به یک حساب فروشگاه وصل نیست.");
                        return;
                      }
                      selectShopWithStory({ id: order.shop_user_id, name: order.shop_name || "" }, true);
                      goToTab("shops");
                    }}
                  />
                </div>
              )}

              {profileView === "bookings" && profileType === "artist" && (
                <ArtistScheduleBoard
                  breakTime={artistBreakTime}
                  onOpenBreakEditor={openArtistBreakEditor}
                  weekTabs={artistBookingsWeekTabs}
                  selectedDay={activeArtistScheduleDateKey}
                  onSelectDay={setArtistBookingSelectedDay}
                  bookings={artistBookingList}
                  dayRows={artistScheduleDayRows}
                  dayLabel={activeArtistScheduleDayLabel}
                  loading={artistWorkspaceLoading}
                  onOpenClient={(booking) => openScheduleBookingMenu(booking, "artist")}
                  onOpenBookingMenu={(booking) => openScheduleBookingMenu(booking, "artist")}
                />
              )}

              {profileView === "services" && profileType === "artist" && (
                <ArtistServicesPanel
                  services={artistServiceList}
                  onCreate={openArtistServiceCreate}
                  onEdit={editArtistService}
                  onDelete={deleteArtistService}
                />
              )}

              {profileView === "collabs" && profileType === "artist" && (
                <ArtistCollabBoard
                  salons={salonDirectory}
                  offers={artistCollabOffers}
                  invites={artistSalonInviteList}
                  inviteRespondBusyId={artistInviteRespondBusyId}
                  draft={artistCollabDraft}
                  onDraftChange={(patch) => setArtistCollabDraft((draft) => ({ ...draft, ...patch }))}
                  onSubmit={addArtistCollabOffer}
                  onDelete={deleteArtistCollabOffer}
                  onInviteRespond={respondArtistSalonInvite}
                />
              )}

              {(profileView === "products" || profileView === "discounts") && profileType === "shop" && (
                <ShopCatalogPanel
                  products={shopCatalog}
                  loading={shopWorkspaceLoading}
                  onBack={() => setProfileView("overview")}
                  onOpenProduct={openShopProductDetail}
                  onCreateProduct={() => {
                    closeOwnerChat();
                    openShopProductSheet();
                  }}
                  onEditProduct={(product) => {
                    closeOwnerChat();
                    openShopProductSheet(product);
                  }}
                />
              )}

              {profileView === "insights" && profileType === "shop" && (
                <ShopInsightsPanel
                  orders={shopOrderList}
                  products={shopCatalog}
                  stockMovements={shopStockMovements}
                  onBack={() => setProfileView("overview")}
                  onOpenOrders={() => setProfileView("orders")}
                />
              )}

              {profileView === "orders" && profileType === "shop" && (
                <ShopOrdersPanel
                  orders={shopOrderList}
                  busyOrderId={shopOrderStatusBusyId}
                  onChangeStatus={changeShopOrderStatus}
                />
              )}

            </div>
          ) : null}
            </>
          )}

        </section>

        <ScheduleBookingMenuModal
          open={Boolean(
            scheduleBookingMenu
            && (createdProfile?.type === "salon" || createdProfile?.type === "artist")
          )}
          booking={scheduleBookingMenu}
          clientProfile={selectedBookingClient}
          view={scheduleBookingView}
          onViewChange={setScheduleBookingView}
          timeSlots={bookingDaySlots}
          staffOptions={safeSalonStaffList.length ? safeSalonStaffList : bookingStaffOptions}
          onClose={closeScheduleBookingMenu}
          onChangeTime={changeScheduleBookingTime}
          onChangeStaff={changeScheduleBookingStaff}
          onCancel={cancelScheduleBooking}
          busy={scheduleBookingBusy}
          onMessage={(peerUserId) => {
            openOwnerChat();
            chat.startDirectChat(peerUserId);
            closeScheduleBookingMenu();
          }}
        />

        <ProfileSettingsSheet
          open={Boolean(
            createdProfile && (
              (createdProfile.type === "salon" && salonHeroSheet === "settings")
              || (createdProfile.type !== "salon" && profileView === "settings")
            )
          )}
          profile={createdProfile}
          kicker={activeCreatedMeta?.kicker || "پروفایل"}
          locationSaving={profileLocationSaving}
          onSaveLocation={saveProfileLocation}
          onEditProfile={openProfileEdit}
          onClose={() => {
            if (createdProfile?.type === "salon") setSalonHeroSheet(null);
            else setProfileView("overview");
          }}
          profileSettings={profileSettings}
          onToggleSetting={toggleProfileSetting}
          artistBookingSettings={artistBookingSettings}
          onArtistBookingChange={setArtistBookingSettings}
          savedPostsCount={savedExplorePosts.length}
          savedSalonsCount={savedSalonList.length}
          onOpenSaved={() => {
            if (createdProfile?.type === "salon") setSalonHeroSheet("saved");
            else setProfileView("saved");
          }}
          onLogout={logoutAccount}
          hoursOpen={settingsHoursOpen}
          onToggleHoursOpen={() => setSettingsHoursOpen((open) => !open)}
          hoursPresets={createdProfile?.type === "artist" ? artistHoursPresets : salonHoursPresets}
          activeHoursPresetId={createdProfile?.type === "artist" ? activeArtistHoursPreset : activeHoursPreset}
          activeHoursPresetMeta={createdProfile?.type === "artist" ? activeArtistHoursPresetMeta : activeHoursPresetMeta}
          hoursList={createdProfile?.type === "artist" ? artistHoursList : salonHoursList}
          selectedHour={createdProfile?.type === "artist" ? selectedArtistHour : selectedSalonHour}
          hourTimeOptions={createdProfile?.type === "artist" ? artistHourTimeOptions : salonHourTimeOptions}
          openDaysCount={createdProfile?.type === "artist" ? openArtistHoursDaysCount : activeSalonHours.length}
          weeklyCapacityTotal={createdProfile?.type === "artist" ? weeklyArtistCapacityTotal : weeklyCapacityTotal}
          onSelectHoursPreset={createdProfile?.type === "artist" ? updateArtistHoursPreset : updateSalonHoursPreset}
          onSelectHourDay={createdProfile?.type === "artist" ? setSelectedArtistHourDay : setSelectedSalonHourDay}
          onUpdateHour={createdProfile?.type === "artist" ? updateArtistHour : updateSalonHour}
        />

        {createdProfile?.type === "salon" && salonHeroSheet === "notifications" && (
          <ProfileSheet
            title="اعلان‌ها"
            label="اعلان‌ها"
            kicker="داشبورد سالن"
            panelClassName="salonNotificationsSheetPanel"
            open
            onClose={() => setSalonHeroSheet(null)}
          >
            <div className="salonNotificationsPanel">
              <article>
                <span><BellRing size={18} /></span>
                <div>
                  <b>اطلاع‌رسانی رزروها</b>
                  <small>{reservationRequestList.length ? `${toPersianDigits(reservationRequestList.length)} درخواست رزرو در انتظار بررسی است.` : "درخواست رزرو تازه‌ای ثبت نشده است."}</small>
                </div>
                <em>{toPersianDigits(reservationRequestList.length)}</em>
              </article>
              <article>
                <span><UserRound size={18} /></span>
                <div>
                  <b>همکاری و پرسنل</b>
                  <small>{pendingSalonCollabRequests.length ? `${toPersianDigits(pendingSalonCollabRequests.length)} درخواست همکاری نیاز به پاسخ دارد.` : "درخواست همکاری تازه‌ای نداری."}</small>
                </div>
                <em>{toPersianDigits(pendingSalonCollabRequests.length)}</em>
              </article>
              <article>
                <span><CalendarClock size={18} /></span>
                <div>
                  <b>برنامه امروز</b>
                  <small>{salonAppointmentList.length ? `${toPersianDigits(salonAppointmentList.length)} نوبت در برنامه سالن ثبت شده است.` : "برنامه امروز خالی است."}</small>
                </div>
                <em>{toPersianDigits(salonAppointmentList.length)}</em>
              </article>
            </div>
          </ProfileSheet>
        )}

        {createdProfile?.type === "artist" && profileView === "notifications" && (
          <ProfileSheet
            title="اعلان‌ها"
            label="اعلان‌ها"
            kicker="داشبورد آرتیست"
            panelClassName="salonNotificationsSheetPanel"
            open
            onClose={() => setProfileView("overview")}
          >
            <div className="salonNotificationsPanel">
              <article>
                <span><BellRing size={18} /></span>
                <div>
                  <b>نوبت‌های تازه</b>
                  <small>{pendingArtistBookingRequests.length ? `${toPersianDigits(pendingArtistBookingRequests.length)} نوبت تازه هنوز بررسی نشده است.` : "نوبت تازه‌ای ثبت نشده است."}</small>
                </div>
                <em>{toPersianDigits(pendingArtistBookingRequests.length)}</em>
              </article>
              <article>
                <span><UserRound size={18} /></span>
                <div>
                  <b>دعوت همکاری سالن‌ها</b>
                  <small>{pendingArtistSalonInvites.length ? `${toPersianDigits(pendingArtistSalonInvites.length)} دعوت همکاری نیاز به پاسخ دارد.` : "دعوت همکاری تازه‌ای نداری."}</small>
                </div>
                <em>{toPersianDigits(pendingArtistSalonInvites.length)}</em>
              </article>
              <article>
                <span><CalendarClock size={18} /></span>
                <div>
                  <b>برنامه نوبت‌ها</b>
                  <small>{artistBookingList.length ? `${toPersianDigits(artistBookingList.length)} نوبت در برنامه‌ات ثبت شده است.` : "برنامه نوبت‌ها خالی است."}</small>
                </div>
                <em>{toPersianDigits(artistBookingList.length)}</em>
              </article>
            </div>
          </ProfileSheet>
        )}

        {createdProfile && (
          (createdProfile.type === "salon" && salonHeroSheet === "saved")
          || (createdProfile.type !== "salon" && profileView === "saved")
        ) && (
          <ProfileSheet
            title="ذخیره‌شده‌ها"
            label="ذخیره‌شده‌ها"
            kicker={activeCreatedMeta?.kicker || "پروفایل"}
            open
            onClose={() => {
              if (createdProfile.type === "salon") setSalonHeroSheet(null);
              else setProfileView("overview");
            }}
          >
            {renderSavedPosts()}
          </ProfileSheet>
        )}

        {createdProfile && (
          (createdProfile.type === "salon" && salonHeroSheet === "wallet")
          || (createdProfile.type !== "salon" && profileView === "wallet")
        ) && (
          <ProfileSheet
            title="کیف پول"
            label="کیف پول"
            panelClassName="salonWalletSheetPanel"
            hideHeader
            open
            onClose={() => {
              if (createdProfile.type === "salon") setSalonHeroSheet(null);
              else setProfileView("overview");
            }}
          >
            {renderWalletPage()}
          </ProfileSheet>
        )}

        <ClientBookingSettingsModal
          booking={clientBookingSettings}
          onClose={() => setClientBookingSettings(null)}
          onMessageSalon={(booking) => {
            // Artist-sourced rows (see listClientArtistBookings) never carry
            // salonUserId/salon_user_id — route those to the artist's own
            // user id instead, so "پیام به سالن" also works for a direct
            // artist booking, not just salon ones.
            const targetUserId = booking.bookingSource === "artist"
              ? Number(booking.artistUserId || booking.sourceArtistUserId) || null
              : Number(booking.salonUserId || booking.salon_user_id) || null;
            setClientBookingSettings(null);
            if (!targetUserId) {
              setAppToast("این رزرو به یک حساب کاربری وصل نیست.");
              return;
            }
            openOwnerChat();
            chat.startDirectChat(targetUserId);
          }}
          onRebookSalon={(booking) => {
            setClientBookingSettings(null);
            rebookFromBooking(booking);
          }}
        />

        <ShopOwnerDock
          open={Boolean(
            (activeTab === "profile" || activeTab === "chat")
            && createdProfile?.type === "shop"
            && createdProfile.type === profileType
            && !shopProductSheetOpen
            && !floatingChatOpen
            && !viewingShopProduct
            && !(activeTab === "chat" && chatPaneIsFullScreen)
            && !["saved", "settings"].includes(profileView)
          )}
          activeView={activeTab === "chat" ? "messages" : profileView}
          unreadCount={chat.totalUnread}
          homeLogo={createdProfile?.data?.avatar || createdProfile?.avatar || ""}
          onNavigate={(view) => {
            closeShopProductSheet();
            setFloatingChatOpen(false);
            if (view === "overview") {
              setActiveTab("profile");
              setProfileView("overview");
              return;
            }
            if (view === "messages") {
              setProfileView("overview");
              setChatPane("inbox");
              setActiveTab("chat");
              return;
            }
            if (view === "wallet") {
              refreshWallet();
              setActiveTab("profile");
              setProfileView("wallet");
              return;
            }
            setActiveTab("profile");
            setProfileView(view);
          }}
        />

        <MobileFloatingCta
          open={
            activeTab === "profile"
            && Boolean(createdProfile)
            && createdProfile.type === profileType
            && !["shop", "client"].includes(createdProfile.type)
          }
          profileType={createdProfile?.type}
          sheetOpen={Boolean(
            floatingChatOpen || shopProductSheetOpen
            || artistServiceCreateOpen || artistBreakEditorOpen || bookingSheetOpen
          )}
          shopProductCount={shopCatalog.length}
          shopUnreadCount={chat.totalUnread}
          bookingSheetOpen={bookingSheetOpen}
          modeRail={
            createdProfile?.type === "salon" ? (
              <ProfileModeRail
                placement="dock"
                profileType={profileType}
                profileView={profileView}
                salonWorkspace={salonWorkspace}
                activeRoleMeta={activeRoleMeta}
                onOverview={() => {
                  closeSalonWorkspace();
                  setProfileView("overview");
                }}
                onSalonWorkspace={openSalonWorkspace}
                onProfileView={setProfileView}
                onWallet={() => {
                  setProfileView((prev) => (prev === "wallet" ? "overview" : "wallet"));
                  refreshWallet();
                }}
              />
            ) : null
          }
          onCreateProduct={() => {
            setFloatingChatOpen(false);
            openShopProductSheet();
          }}
          onOpenShopChat={() => {
            closeShopProductSheet();
            openOwnerChat();
          }}
          onToggleBooking={() => {
            if (bookingSheetOpen) {
              closeBookingSheet();
              return;
            }
            openBookingSheet();
          }}
          onOpenClientChat={() => openOwnerChat()}
        />

        {createdProfile?.type === "artist" && activeTab === "profile" && (
          <ArtistBookingRail
            ref={artistRailRef}
            className={`artistBookingRail is-wall-${artistRailDock.wall} ${artistBookingRailOpen ? "is-open" : "is-collapsed"} ${artistRailDragging ? "is-dragging" : ""}`}
            style={artistRailDragging && artistRailDragPos
              ? { left: artistRailDragPos.x, top: artistRailDragPos.y, right: "auto", bottom: "auto" }
              : getArtistRailDockStyle(artistRailDock, artistRailSize.w, artistRailSize.h, {
                  tucked: !artistBookingRailOpen
                })}
            isOpen={artistBookingRailOpen}
            isDragging={artistRailDragging}
            bookings={nearestArtistBookings}
            services={artistServiceList}
            createOpen={artistBookingCreateOpen}
            onHandlePointerDown={onArtistRailHandlePointerDown}
            onHandlePointerMove={onArtistRailHandlePointerMove}
            onHandlePointerUp={onArtistRailHandlePointerUp}
            shouldIgnoreClick={() => artistRailDragRef.current.moved || artistRailDragging}
            onToggle={() => {
              setArtistBookingRailOpen((open) => {
                if (open) setArtistBookingCreateOpen(false);
                return !open;
              });
            }}
            onOpen={() => setArtistBookingRailOpen(true)}
            onShowAll={() => {
              setProfileView("bookings");
              setArtistBookingRailOpen(false);
              setArtistBookingCreateOpen(false);
              closeBookingSheet();
            }}
            onCreateOpen={() => setArtistBookingCreateOpen(true)}
            onCreateClose={() => setArtistBookingCreateOpen(false)}
            onCreateSubmit={handleArtistBookingCreate}
            createSubmitting={artistBookingSubmitting}
          />
        )}

        <OwnerChatSheet
          open={floatingChatOpen}
          myUserId={createdProfile?.id}
          activeConversation={chat.activeConversation}
          messages={chat.activeMessages}
          threads={chat.conversations}
          sendBusy={chat.sendBusy}
          onClose={closeOwnerChat}
          onSelectThread={chat.openConversation}
          onSend={(body, attachment) => chat.sendMessage({ body, attachment })}
        />

        {createdProfile?.type === "salon" && (
          <SalonToolSheets
            open={salonToolSheetOpen}
            tool={salonTool}
            inventory={salonInventory}
            tasks={salonTasks}
            onClose={closeSalonToolSheet}
            onNotice={setAppToast}
          />
        )}
        <SalonStaffProfileModal
          staff={selectedArtistProfile}
          roleOptions={salonArtistRoleOptions}
          onClose={() => setSelectedArtistProfile(null)}
          onUpdate={(person, patch, notice) => {
            updateSalonStaff(person.name, patch, notice);
            setSelectedArtistProfile({ ...person, ...patch });
          }}
          onRemove={(person) => {
            removeSalonStaff(person.name);
            setSelectedArtistProfile(null);
          }}
          onOpenPublic={openSalonStaffPublicProfile}
        />
        <ClientProfileModal
          client={scheduleBookingMenu ? null : selectedBookingClient}
          onClose={() => setSelectedBookingClient(null)}
          onMessage={(client) => {
            setSelectedBookingClient(null);
            if (!client.id) {
              setAppToast("این مشتری به یک حساب کاربری وصل نیست.");
              return;
            }
            openOwnerChat();
            chat.startDirectChat(client.id);
          }}
        />
        <BookingSheet
          open={bookingSheetOpen && (createdProfile?.type === "salon" || createdProfile?.type === "artist")}
          role={createdProfile?.type === "artist" ? "artist" : "salon"}
          title="ایجاد رزرو"
          onClose={closeBookingSheet}
        >
          <BookingCreateForm
            role={createdProfile?.type === "artist" ? "artist" : "salon"}
            onSubmit={(event) => {
              if (createdProfile?.type === "artist") {
                handleArtistBookingCreate(event);
                return;
              }
              addSalonAppointment(event, { bookingDateForSlots, selectedBookingStaff });
            }}
            serviceOptions={(createdProfile?.type === "artist" ? artistServiceList : bookingServiceOptions).map((item) => ({
              value: item.name,
              label: item.name,
              meta: [item.price, item.duration].filter(Boolean).join(" · ")
            }))}
            serviceValue={
              createdProfile?.type === "artist"
                ? (bookingServiceName || artistServiceList[0]?.name || "")
                : (selectedBookingService?.name || "")
            }
            serviceMenuOpen={bookingSelectMenu === "service"}
            onServiceMenuOpenChange={(next) => setBookingSelectMenu(next ? "service" : "")}
            onServiceChange={setBookingServiceName}
            staffOptions={bookingStaffOptions.map((person) => ({
              value: person.name,
              label: person.name,
              meta: person.role || ""
            }))}
            staffValue={selectedBookingStaff}
            staffMenuOpen={bookingSelectMenu === "staff"}
            onStaffMenuOpenChange={(next) => setBookingSelectMenu(next ? "staff" : "")}
            onStaffChange={setBookingStaffName}
            dayOptions={
              createdProfile?.type === "artist"
                ? artistBookingDays
                : salonScheduleWeekTabs
                  .filter((tab) => {
                    const hour = salonHoursList.find((item) => item.day === tab.day);
                    return hour ? Boolean(hour.active) : true;
                  })
                  .map((tab) => ({
                    value: tab.dateKey,
                    label: `${tab.label} ${tab.sub || ""}`.trim()
                  }))
            }
            dayValue={
              createdProfile?.type === "artist"
                ? (artistBookingDays.includes(bookingDate) ? bookingDate : (artistBookingDays[0] || "امروز"))
                : bookingDateForSlots
            }
            onDayChange={setBookingDate}
            timeOptions={createdProfile?.type === "artist" ? artistAvailableSlots : bookingFreeSlots}
            timeValue={bookingTime}
            onTimeChange={setBookingTime}
            submitting={
              createdProfile?.type === "artist"
                ? artistBookingSubmitting
                : salonBookingSubmitting
            }
            submitDisabled={
              createdProfile?.type === "artist"
                ? !artistServiceList.length
                : !salonServiceList.length
            }
          />
        </BookingSheet>
        <SalonNearbyInviteSheet
          open={artistInviteOpen}
          loading={nearbyArtistsLoading}
          artists={nearbyArtists}
          busyId={artistInviteBusyId}
          onClose={() => {
            setArtistInviteOpen(false);
            setArtistInviteBusyId("");
          }}
          onInvite={inviteNearbyArtist}
        />

        <SalonCreateStaffModal
          open={artistCreateOpen}
          role={artistCreateRole}
          status={artistCreateStatus}
          roleOptions={salonArtistRoleOptions}
          statusOptions={salonArtistStatusOptions}
          onClose={() => setArtistCreateOpen(false)}
          onRoleChange={setArtistCreateRole}
          onStatusChange={setArtistCreateStatus}
          onSubmit={addSalonStaff}
        />
        <ProfileEditModal
          open={profileEditOpen && Boolean(createdProfile)}
          profile={createdProfile}
          avatarDraft={profileEditAvatar}
          onClose={() => { setProfileEditOpen(false); setProfileEditAvatar(""); }}
          onAvatarUpload={handleProfileAvatarUpload}
          onClearAvatar={() => setProfileEditAvatar("")}
          onSubmit={updateRegisteredProfile}
        />
        <ArtistWorkPreviewModal
          work={previewingArtistWork}
          onClose={closeArtistWorkPreview}
          onEdit={openArtistWorkModal}
        />
        <ArtistBreakEditorModal
          open={artistBreakEditorOpen}
          draft={artistBreakDraft}
          hasBreak={Boolean(artistBreakTime)}
          onDraftChange={setArtistBreakDraft}
          onSave={saveArtistBreakTime}
          onClear={clearArtistBreakTime}
          onClose={closeArtistBreakEditor}
        />
        <ServiceComposerModal
          open={artistServiceCreateOpen}
          mode={artistServiceCreateMode}
          draft={artistServiceDraft}
          catalog={salonServiceCatalog}
          existingServices={activeServiceManagerList}
          onClose={closeArtistServiceCreate}
          onModeChange={setArtistServiceCreateMode}
          onDraftChange={(patch) => setArtistServiceDraft((prev) => ({ ...prev, ...patch }))}
          onSubmitCustom={addArtistService}
          onPickPreset={addArtistServicePreset}
        />
        <ShopProductDetailModal
          product={viewingShopProduct ? (shopCatalog.find((item) => item.id === viewingShopProduct.id) || viewingShopProduct) : null}
          onClose={closeShopProductDetail}
          onEdit={editShopProductFromDetail}
          onDelete={deleteShopProduct}
        />
        <ShopProductEditorSheet
          open={shopProductSheetOpen}
          editingProduct={editingShopProduct}
          image={shopProductImage}
          enhanceBusy={shopProductEnhanceBusy}
          enhanceTab={shopProductEnhanceTab}
          activeEnhance={shopProductActiveEnhance}
          activeAspect={shopProductActiveAspect}
          enhancePresets={shopProductEnhancePresets}
          aspectPresets={shopProductAspectPresets}
          categories={shopCategories.length ? shopCategories.map((category) => category.name) : shopRegistrationCategories}
          defaultCategory={shopProductDefaultCategory}
          badges={shopProductBadges}
          onClose={closeShopProductSheet}
          onSubmit={saveShopProduct}
          onImageUpload={handleShopProductImageUpload}
          onImageClear={clearShopProductImage}
          onEnhanceTabChange={setShopProductEnhanceTab}
          onApplyEnhance={applyShopProductEnhance}
          onApplyAspect={applyShopProductAspect}
          onResetEdits={resetShopProductImageEdits}
          onDelete={deleteShopProduct}
        />
        {appToast && (
          <div className="appToast" role="status" aria-live="polite">
            <ShieldCheck size={17} />
            <span>{appToast}</span>
          </div>
        )}

        {selectedShop && activeTab === "shops" && !(createdProfile?.type === "shop" && String(selectedShop.id) === String(createdProfile.id)) && (
          <ShopStoreDock
            shop={selectedShop}
            myUserId={createdProfile?.id}
            cartOpen={shopCartOpen}
            chatOpen={shopChatSheetOpen}
            cartSummary={shopCartSummary}
            cartItems={currentShopCart}
            chatMessages={chat.activeMessages}
            chatLoading={chat.activeMessagesLoading}
            onOpenCart={() => { setShopCartOpen(true); setShopChatSheetOpen(false); }}
            onCloseCart={() => setShopCartOpen(false)}
            onOpenChat={() => { setShopChatSheetOpen(true); setShopCartOpen(false); chat.startDirectChat(selectedShop.id); }}
            onCloseChat={() => setShopChatSheetOpen(false)}
            onExpandChat={() => {
              setShopChatSheetOpen(false);
              setShopCartOpen(false);
              setChatOpenedFromShop(true);
              setChatInitialPane("conversation");
              setActiveTab("chat");
            }}
            onCloseSheets={() => { setShopCartOpen(false); setShopChatSheetOpen(false); }}
            onUpdateCartQty={updateShopCartQty}
            onCheckout={submitShopOrder}
            checkoutBusy={shopOrderBusy}
            onShowProducts={() => {
              setShopCartOpen(false);
              shopProductsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onSendChatMessage={(body, attachment) => chat.sendMessage({ body, attachment })}
          />
        )}

        {(activeTab !== "chat" || chatPane === "inbox") && !(
          (activeTab === "profile" || activeTab === "chat")
          && createdProfile?.type === "shop"
          && createdProfile.type === profileType
        ) && !(
          // The shop storefront has its own floating cart+chat dock
          // (ShopStoreDock, right above) — the generic tab bar underneath it
          // is redundant there.
          selectedShop && activeTab === "shops" && !(createdProfile?.type === "shop" && String(selectedShop.id) === String(createdProfile.id))
        ) && (
          <BottomNav
            activeTab={activeTab}
            createdProfile={createdProfile}
            chatOpen={floatingChatOpen}
            onTabChange={goToTab}
          />
        )}
        <PublicArtistModal
          artist={selectedPublicArtist}
          heroImage={publicArtistHeroImage}
          view={publicArtistView}
          portfolio={publicArtistPortfolio}
          services={publicArtistServices}
          reviews={publicArtistReviews}
          userRating={publicArtistUserRating}
          ratingHover={publicArtistRatingHover}
          following={isFollowingPublicArtist}
          galleryTags={publicArtistGalleryTags}
          galleryFilter={publicArtistGalleryFilter}
          featuredWork={publicArtistFeatured}
          galleryRest={publicArtistGalleryRest}
          selectedServiceId={publicArtistSelectedServiceId}
          bookingDay={publicArtistBookingDay}
          bookingSlot={publicArtistBookingSlot}
          parseDuration={parseServiceDurationMinutes}
          getCardStyle={getPortfolioCardStyle}
          onClose={closePublicArtistProfile}
          onShare={shareArtistProfile}
          saved={isSavedPublicArtist}
          onSave={() => selectedPublicArtist && toggleSavePublicArtist(selectedPublicArtist)}
          onRatingHover={setPublicArtistRatingHover}
          onConfirmRating={confirmPublicArtistRating}
          onToggleReviewLike={toggleLikePublicArtistReview}
          viewerUserId={createdProfile?.id}
          onFollow={() => selectedPublicArtist && toggleFollowPublicArtist(selectedPublicArtist)}
          onMessage={async () => {
            if (!selectedPublicArtist?.id) return;
            const peerId = selectedPublicArtist.id;
            closePublicArtistProfile();
            setChatInitialPane("conversation");
            setChatPane("conversation");
            setActiveTab("chat");
            await chat.startDirectChat(peerId);
          }}
          onViewChange={setPublicArtistView}
          onGalleryFilterChange={setPublicArtistGalleryFilter}
          onOpenWork={openPublicArtistWork}
          onSelectService={selectPublicArtistService}
          onBookingDayChange={setPublicArtistBookingDay}
          onBookingSlotChange={setPublicArtistBookingSlot}
          onConfirmBooking={confirmPublicArtistBooking}
          bookingBusy={publicArtistBookingBusy}
        />
        <ExplorePreviewModal
          post={selectedPost}
          exploreArtist={selectedExploreArtist}
          isSaved={selectedPostIsSaved}
          userRating={selectedPostUserRating}
          comments={selectedPostComments}
          beautyPassport={beautyPassport}
          passportMatch={selectedPost ? getPassportMatch(selectedPost) : ""}
          onClose={() => setSelectedPost(null)}
          onToggleSaved={() => selectedPost && toggleSavedPost(selectedPost.title, selectedPost)}
          onOpenRating={() => selectedPost && openExploreRatingPicker(selectedPost)}
          onShare={() => selectedPost && shareExplorePost(selectedPost)}
          onOpenArtistProfile={() => selectedPost && openExploreArtistProfile(selectedPost)}
        />
        <ExploreRatingModal
          picker={exploreRatingPicker}
          onClose={closeExploreRatingPicker}
          onHover={setExploreRatingHover}
          onConfirm={confirmExploreRating}
        />
      </section>
    </main>
  );
}

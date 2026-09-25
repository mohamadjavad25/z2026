# Feature Tree

The app is organized by product area. Shared primitives stay in `app/components`, cross-feature helpers stay in `app/shared`, and each product area owns its UI, hooks, constants, and mappers.

```text
app/
  components/              shared visual primitives
  shared/
    api/                   client API wrappers
    constants/             cross-feature option lists
    hooks/                 shared React hooks
    lib/                   shared formatting and date helpers
  features/
    artist/                artist workspace, booking rail, public booking/services panels, helpers
    auth/                  auth/session constants and hooks
    explore/               saved-post preview modal, mapping, state (feed browsing removed — see settings/)
    profile/               reusable profile panels/forms/gallery
    salons/                salon directory constants, client page, booking modal, and state
    schedule/               shared booking-menu/schedule board components
    settings/              top-level "تنظیمات" tab (replaces the old Explore tab)
    shell/                 app orchestration, chrome, navigation, mock data
```

Current shell split:

```text
features/shell/
  HomeApp.jsx              orchestration and legacy page composition
  BottomNav.jsx            mobile tab navigation
  mockData.js              static/demo data used by HomeApp
  index.js                 public exports for the shell feature
```

Extracted feature UI:

```text
features/explore/
  ExplorePreviewModal.jsx
  index.js

features/settings/
  SettingsPage.jsx
  index.js

features/profile/
  ProfileAuthModeSwitch.jsx
  ProfileEmptyState.jsx
  ProfileGallery.jsx
  ProfileHeroActions.jsx
  ProfileLocationSettings.jsx
  ProfileModeRail.jsx
  ProfilePanel.jsx
  ProfilePostComposer.jsx
  ProfileRoleGrid.jsx
  ProfileSavedPosts.jsx
  ProfileSettingsPanel.jsx
  ProfileSheet.jsx
  ProfileSignupSteps.jsx

features/salons/
  SalonClientBookingModal.jsx
  SalonClientPage.jsx
  index.js

features/artist/
  PublicArtistAboutPanel.jsx
  PublicArtistBookingPanel.jsx
  PublicArtistGalleryPanel.jsx
  PublicArtistModal.jsx
  PublicArtistReviewsPanel.jsx
  PublicArtistServicesPanel.jsx
  index.js
```

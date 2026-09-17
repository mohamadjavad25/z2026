// Removed as dead code during the 2026-09 cleanup pass:
// nothing in the app imports this hook — verified with a project-wide
// search for "useToast" outside this file. The app's actual toast
// mechanism is a hand-rolled `appToast`/`setAppToast` state + a
// `useEffect` auto-clear timer, duplicated inline inside HomeApp.jsx.
// This hook is the "correct" reusable version of that same pattern but
// was never wired up. Left unused rather than force-migrated in this
// pass: HomeApp.jsx calls `setAppToast(...)` directly at ~50 call
// sites, and this hook only auto-clears through its own `showToast(...)`
// helper — swapping it in without also migrating every call site would
// make toast messages stop disappearing. A worthwhile follow-up, but a
// separate, deliberate change rather than a drive-by deletion.
// Safe to delete this file entirely.

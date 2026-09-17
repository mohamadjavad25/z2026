// Removed as dead code during the 2026-09 cleanup pass:
// nothing in the app imports this module (verified: no file imports
// "shared/api/wallet" or a relative "./wallet"/"../api/wallet" pointing
// here). The wallet UI (HomeApp.jsx) talks to /api/wallet with its own
// inline fetch calls instead of through this wrapper. Safe to delete
// this file entirely.

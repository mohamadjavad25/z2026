/**
 * Pure race-guard helpers mirroring useAuthSession boot/login interaction.
 * Used by isolated auth tests — keep behavior identical to the hook.
 */

export function createAuthRaceGuards() {
  let bootGeneration = 0;
  let sessionLocked = false;
  let createdProfile = null;

  return {
    get bootGeneration() {
      return bootGeneration;
    },
    get sessionLocked() {
      return sessionLocked;
    },
    get createdProfile() {
      return createdProfile;
    },
    beginBoot() {
      bootGeneration += 1;
      return bootGeneration;
    },
    isStale(bootId) {
      return bootId !== bootGeneration;
    },
    enterAuthenticated(profile) {
      sessionLocked = true;
      createdProfile = profile;
    },
    clearSession() {
      sessionLocked = false;
      createdProfile = null;
    },
    /**
     * Apply /api/auth/me result only if this boot is current and session is not locked.
     * Returns "applied" | "skipped-stale" | "skipped-locked" | "guest"
     */
    applyMeResult(bootId, rawProfile, normalize) {
      if (bootId !== bootGeneration) return "skipped-stale";
      if (sessionLocked) return "skipped-locked";
      const profile = normalize(rawProfile);
      if (profile) {
        sessionLocked = true;
        createdProfile = profile;
        return "applied";
      }
      createdProfile = null;
      return "guest";
    }
  };
}

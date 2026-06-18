export const getRatingOnboardingCacheKey = (userId: string) =>
  `aceplay-onboarding-done-${userId}`;

export const hasCachedRatingOnboarding = (userId: string) => {
  try {
    return sessionStorage.getItem(getRatingOnboardingCacheKey(userId)) === "1";
  } catch {
    return false;
  }
};

export const markRatingOnboardingDone = (userId: string) => {
  try {
    sessionStorage.setItem(getRatingOnboardingCacheKey(userId), "1");
  } catch {
    // ignore storage failures in private mode or restricted browsers
  }
};
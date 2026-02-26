let isAuthRedirectLocked = false;

export function setAuthRedirectLock(nextValue) {
  isAuthRedirectLocked = Boolean(nextValue);
}

export function isAuthRedirectLockActive() {
  return isAuthRedirectLocked;
}

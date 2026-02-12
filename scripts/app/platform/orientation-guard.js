export function registerOrientationGuard() {
  if (typeof window === 'undefined' || !document.body) {
    return;
  }

  const hasMatchMedia = typeof window.matchMedia === 'function';
  const landscapeMedia = hasMatchMedia ? window.matchMedia('(orientation: landscape)') : null;
  const coarsePointerMedia = hasMatchMedia ? window.matchMedia('(pointer: coarse)') : null;
  const standaloneMedia = hasMatchMedia ? window.matchMedia('(display-mode: standalone)') : null;
  const isLegacyStandalone = window.navigator.standalone === true;

  let lockAttempted = false;
  let blocker = document.querySelector('.orientation-blocker');

  if (!blocker) {
    blocker = document.createElement('div');
    blocker.className = 'orientation-blocker';
    blocker.hidden = true;
    blocker.setAttribute('aria-live', 'polite');
    blocker.innerHTML = '<p class="orientation-blocker__text">Поверните устройство в портрет</p>';
    document.body.appendChild(blocker);
  }

  function bindMediaChange(mediaQueryList, handler) {
    if (!mediaQueryList) {
      return;
    }

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handler);
      return;
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(handler);
    }
  }

  async function tryLockPortrait() {
    if (lockAttempted) {
      return;
    }

    const orientation = window.screen && window.screen.orientation;
    if (!orientation || typeof orientation.lock !== 'function') {
      return;
    }

    const isStandalone = Boolean((standaloneMedia && standaloneMedia.matches) || isLegacyStandalone);
    if (!isStandalone) {
      return;
    }

    lockAttempted = true;
    try {
      await orientation.lock('portrait');
    } catch (_error) {
      // Orientation lock is best-effort and often unavailable by platform policy.
    }
  }

  function isMobileOrTouchScope() {
    const hasCoarsePointer = coarsePointerMedia ? coarsePointerMedia.matches : (window.navigator.maxTouchPoints || 0) > 0;
    return hasCoarsePointer || window.innerWidth <= 900;
  }

  function isLandscape() {
    if (landscapeMedia) {
      return landscapeMedia.matches;
    }
    return window.innerWidth > window.innerHeight;
  }

  function syncOrientationGuard() {
    const shouldBlock = isMobileOrTouchScope() && isLandscape();
    document.body.classList.toggle('is-landscape-blocked', shouldBlock);
    if (blocker) {
      blocker.hidden = !shouldBlock;
    }
    void tryLockPortrait();
  }

  bindMediaChange(landscapeMedia, syncOrientationGuard);
  bindMediaChange(coarsePointerMedia, syncOrientationGuard);
  bindMediaChange(standaloneMedia, syncOrientationGuard);
  window.addEventListener('resize', syncOrientationGuard);
  window.addEventListener('orientationchange', syncOrientationGuard);

  syncOrientationGuard();
}

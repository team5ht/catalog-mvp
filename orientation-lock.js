(function() {
    const ORIENTATION_TYPE = 'portrait';

    const hasNewAPI = () => !!(screen.orientation && typeof screen.orientation.lock === 'function');
    const legacyLock = type => {
        const legacy = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;
        if (typeof legacy === 'function') {
            try {
                return legacy.call(screen, type);
            } catch (error) {
                console.warn('Не удалось заблокировать ориентацию (legacy API):', error);
            }
        }
        return false;
    };

    const ensureFallbackOverlay = () => {
        let overlay = document.getElementById('orientation-lock-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'orientation-lock-overlay';
            overlay.innerHTML = '<div class="orientation-lock-message">\n                <p>Пожалуйста, поверните устройство в портретную ориентацию.</p>\n            </div>';
            document.body.appendChild(overlay);
        }
        return overlay;
    };

    const updateFallbackState = () => {
        if (!document.documentElement.classList.contains('force-portrait')) {
            return;
        }

        const isLandscape = window.matchMedia('(orientation: landscape)').matches;
        document.documentElement.classList.toggle('force-portrait-landscape', isLandscape);

        const overlay = ensureFallbackOverlay();
        overlay.style.display = isLandscape ? 'flex' : 'none';
    };

    const enableFallback = () => {
        document.documentElement.classList.add('force-portrait');
        updateFallbackState();
    };

    const disableFallback = () => {
        document.documentElement.classList.remove('force-portrait', 'force-portrait-landscape');
        const overlay = document.getElementById('orientation-lock-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    };

    const tryLockOrientation = async () => {
        if (hasNewAPI()) {
            try {
                await screen.orientation.lock(ORIENTATION_TYPE);
                disableFallback();
                return true;
            } catch (error) {
                console.warn('Не удалось заблокировать ориентацию:', error);
            }
        } else if (legacyLock(ORIENTATION_TYPE)) {
            disableFallback();
            return true;
        }

        enableFallback();
        return false;
    };

    const maintainOrientation = () => {
        if (hasNewAPI()) {
            if (!screen.orientation.type.startsWith(ORIENTATION_TYPE)) {
                tryLockOrientation();
            }
        } else {
            tryLockOrientation();
        }
    };

    window.addEventListener('load', tryLockOrientation);
    window.addEventListener('focus', maintainOrientation);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            maintainOrientation();
        }
    });

    if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
        screen.orientation.addEventListener('change', maintainOrientation);
    } else {
        window.addEventListener('orientationchange', maintainOrientation);
    }

    if (window.matchMedia) {
        const mql = window.matchMedia('(orientation: landscape)');
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', updateFallbackState);
        } else if (typeof mql.addListener === 'function') {
            mql.addListener(updateFallbackState);
        }
    }
})();

(function(global) {
  const REDIRECT_STORAGE_KEY = 'authRedirectUrl';

  function isAuthenticated() {
    return false;
  }

  function setRedirectUrl(url) {
    try {
      if (typeof url === 'string') {
        localStorage.setItem(REDIRECT_STORAGE_KEY, url);
      }
    } catch (err) {
      console.warn('Не удалось сохранить redirect URL', err);
    }
  }

  function getRedirectUrl() {
    try {
      const url = localStorage.getItem(REDIRECT_STORAGE_KEY);
      if (url) {
        localStorage.removeItem(REDIRECT_STORAGE_KEY);
      }
      return url;
    } catch (err) {
      console.warn('Не удалось получить redirect URL', err);
      return null;
    }
  }

  global.AuthState = {
    isAuthenticated,
    setRedirectUrl,
    getRedirectUrl
  };
})(window);

import { HOME_HASH } from '../constants.js';
import { getBottomNav, getSpaRoot } from '../dom.js';
import { navigateTo } from '../routing/navigation.js';

export function updateBottomNavActive(routeName) {
  const navHome = document.getElementById('nav-home');
  const navCatalog = document.getElementById('nav-catalog');
  const navAccount = document.getElementById('nav-account');

  [navHome, navCatalog, navAccount].forEach((button) => {
    if (button) {
      button.classList.remove('bottom-nav__button--active');
    }
  });

  if (routeName === 'home' && navHome) {
    navHome.classList.add('bottom-nav__button--active');
  }

  if (routeName === 'catalog' && navCatalog) {
    navCatalog.classList.add('bottom-nav__button--active');
  }

  if ((routeName === 'account' || routeName === 'auth') && navAccount) {
    navAccount.classList.add('bottom-nav__button--active');
  }
}

export function applyShellState(routeName) {
  const root = getSpaRoot();
  const nav = getBottomNav();

  if (!root) {
    return;
  }

  if (routeName === 'auth') {
    document.body.classList.add('fullscreen-static');
    root.className = '';
    return;
  }

  document.body.classList.remove('fullscreen-static');
  if (nav) {
    nav.hidden = false;
  }

  if (routeName === 'material') {
    root.className = 'material-page app-container';
    return;
  }

  if (routeName === 'account') {
    root.className = 'app-container account-page';
    return;
  }

  root.className = 'app-container';
}

export function bindStaticNav() {
  const navHome = document.getElementById('nav-home');
  const navCatalog = document.getElementById('nav-catalog');

  if (navHome) {
    navHome.addEventListener('click', (event) => {
      event.preventDefault();
      navigateTo(HOME_HASH);
    });
  }

  if (navCatalog) {
    navCatalog.addEventListener('click', (event) => {
      event.preventDefault();
      navigateTo('#/catalog');
    });
  }
}

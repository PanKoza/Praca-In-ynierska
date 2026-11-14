import { useSyncExternalStore } from 'react';

function subscribe(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function snapshot() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/* Current theme name for the few places (canvas effects) that cannot read CSS variables. */
export function useThemeName() {
  return useSyncExternalStore(subscribe, snapshot, () => 'light');
}

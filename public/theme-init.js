/*
 * Runs before the first paint (blocking <script> in <head>, before any CSS) so the page never flashes the
 * wrong theme. Mirrors src/lib/theme.tsx — keep the storage key and colors in sync with it.
 */
(function () {
  var COLORS = { light: '#f5f5f7', dark: '#000000' };
  var preference = 'system';
  try {
    var stored = window.localStorage.getItem('loopin.theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') preference = stored;
  } catch (error) {
    // Storage can be unavailable (private mode, blocked site data); fall back to the system theme.
  }

  var systemDark = false;
  try {
    systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (error) {
    // Very old engines without matchMedia: stay light.
  }

  var resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  var root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;

  // The two theme-color metas follow the system theme via their media queries; an explicit choice overrides both.
  if (preference !== 'system') {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', COLORS[resolved]);
  }
})();

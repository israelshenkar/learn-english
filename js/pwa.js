// Registers the service worker (sw.js) so the site installs to the home screen and opens offline.
// Loaded as its own module from index.html, so it never delays the app itself.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', async () => {
    try {
      // Relative URL: works at the site root (GitHub Pages custom domain) and under a sub-path alike.
      const reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      // Give the app a moment to finish loading (Firebase SDK, fonts), then tell the worker which files to keep.
      setTimeout(() => {
        const urls = [location.href, ...performance.getEntriesByType('resource').map(e => e.name)];
        (navigator.serviceWorker.controller || reg.active)?.postMessage({ type: 'cache-urls', urls });
      }, 3000);
    } catch (err) {
      console.warn('[mec] offline mode unavailable', err);
    }
  });
}

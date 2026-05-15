(function () {
  const PAGEVIEW_CAPTURED_KEY = '__scholaraiPageviewCaptured';
  const hasPostHog = () => typeof window.posthog !== 'undefined';

  function capture(eventName, properties) {
    try {
      if (hasPostHog()) window.posthog.capture(eventName, properties || {});
    } catch (error) {}
  }

  function capturePageview() {
    try {
      if (!hasPostHog() || window[PAGEVIEW_CAPTURED_KEY]) return;
      window[PAGEVIEW_CAPTURED_KEY] = true;
      window.posthog.capture('$pageview');
    } catch (error) {}
  }

  function capturePageviewAfterLoad() {
    if (document.readyState === 'complete') {
      capturePageview();
      return;
    }
    window.addEventListener('load', capturePageview, { once: true });
  }

  function identifyFirebaseUser(user) {
    if (!user) return;
    try {
      if (!hasPostHog()) return;
      window.posthog.identify(user.uid, {
        email: user.email || undefined,
        name: user.displayName || undefined
      });
    } catch (error) {}
  }

  function reset() {
    try {
      if (hasPostHog()) window.posthog.reset();
    } catch (error) {}
  }

  window.ScholarAnalytics = {
    capture,
    identifyFirebaseUser,
    reset
  };

  capturePageviewAfterLoad();
})();

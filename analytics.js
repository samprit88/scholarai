(function () {
  const hasPostHog = () => typeof window.posthog !== 'undefined';

  function capture(eventName, properties) {
    try {
      if (hasPostHog()) window.posthog.capture(eventName, properties || {});
    } catch (error) {}
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
})();

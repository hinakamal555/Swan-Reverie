(() => {
  "use strict";

  let clerkPromise = null;

  async function loadClerk() {
    if (clerkPromise) return clerkPromise;

    clerkPromise = (async () => {
      const response = await fetch("/api/config", { credentials: "include" });
      const config = await response.json().catch(() => ({}));
      const publishableKey = config.clerkPublishableKey;
      if (!publishableKey) {
        throw new Error("Clerk is not configured. Add CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to your environment.");
      }

      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.async = true;
        script.crossOrigin = "anonymous";
        script.dataset.clerkPublishableKey = publishableKey;
        script.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Could not load Clerk."));
        document.head.appendChild(script);
      });

      await window.Clerk.load({ publishableKey });
      return window.Clerk;
    })();

    return clerkPromise;
  }

  window.ClerkAuth = {
    load: loadClerk,
    async getToken() {
      const clerk = await loadClerk();
      if (!clerk.session) return null;
      return clerk.session.getToken();
    },
    async getUser() {
      const clerk = await loadClerk();
      return clerk.user || null;
    },
    async requireUser() {
      const clerk = await loadClerk();
      if (clerk.user) return clerk.user;
      return new Promise((resolve) => {
        const unsubscribe = clerk.addListener(({ user }) => {
          if (user) {
            unsubscribe();
            resolve(user);
          }
        });
      });
    },
    async mountSignIn(element, options = {}) {
      const clerk = await loadClerk();
      return clerk.mountSignIn(element, {
        routing: "hash",
        ...options,
      });
    },
    async mountUserButton(element, options = {}) {
      const clerk = await loadClerk();
      return clerk.mountUserButton(element, {
        afterSignOutUrl: "/",
        ...options,
      });
    },
    async signOut() {
      const clerk = await loadClerk();
      await clerk.signOut({ redirectUrl: "/" });
    },
  };
})();

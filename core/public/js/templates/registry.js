(() => {
  "use strict";

  const registry = {};

  function templateId() {
    return window.__INVITE_TEMPLATE_ID__ || "";
  }

  window.InvitationTemplates = {
    register(id, definition) {
      registry[id] = definition;
    },
    get(id) {
      const key = String(id || templateId());
      const found = registry[key];
      if (!found) {
        throw new Error(`Template unavailable: ${key || "(missing id)"}`);
      }
      return found;
    },
    render(root, invitation, options) {
      return this.get(invitation.templateId).render(root, invitation, options || {});
    },
  };
})();

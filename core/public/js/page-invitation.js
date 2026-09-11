(() => {
  "use strict";

  const root = document.getElementById("invite-root");
  const status = document.getElementById("inviteStatus");
  const path = window.location.pathname;
  const preview = path.startsWith("/preview/");
  const publicMatch = path.match(/^\/i\/([^/]+)/);
  const previewMatch = path.match(/^\/preview\/([^/]+)/);

  document.documentElement.classList.add("invite-html");

  load();

  async function load() {
    try {
      let invitation;
      if (preview) {
        const id = previewMatch && previewMatch[1];
        const data = await window.InviteLib.api.getInvitation(id);
        invitation = data.invitation;
      } else if (publicMatch) {
        const data = await window.InviteLib.api.publicInvitation(publicMatch[1]);
        invitation = data.invitation;
      } else {
        throw new Error("Invitation not found.");
      }

      const couple = invitation.content && invitation.content.couple || {};
      document.title = `${couple.brideName || "Wedding"} & ${couple.groomName || "Invitation"}`;
      status.hidden = true;
      window.InviteRuntime.mount(root, invitation, { embedded: false });
    } catch (error) {
      status.hidden = false;
      status.textContent = error.message || "This invitation is not available.";
    }
  }
})();

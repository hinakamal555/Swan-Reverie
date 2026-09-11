(() => {
  "use strict";

  const { api } = window.InviteLib;
  const loadingView = document.getElementById("loadingView");
  const authGate = document.getElementById("authGate");
  const dashboard = document.getElementById("dashboard");
  const openError = document.getElementById("openError");
  const dashError = document.getElementById("dashError");
  const dashEmpty = document.getElementById("dashEmpty");
  const inviteList = document.getElementById("inviteList");
  const createBtn = document.getElementById("createBtn");
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");

  createBtn.addEventListener("click", createInvitation);

  boot();

  async function boot() {
    window.InviteLib.applyBrandLabels();
    window.InviteLib.applySiteTitle();
    showLoading();

    try {
      await window.ClerkAuth.load();
      const user = await window.ClerkAuth.getUser();
      if (!user) {
        showAuthGate();
        await window.ClerkAuth.mountSignIn(document.getElementById("signInRoot"));
        await window.ClerkAuth.requireUser();
      }

      if (returnTo && returnTo.startsWith("/")) {
        window.location.replace(returnTo);
        return;
      }

      await showDashboard();
    } catch (error) {
      showAuthGate();
      openError.hidden = false;
      openError.textContent = error.message || "Could not open the studio.";
    }
  }

  function showLoading() {
    document.body.classList.remove("studio--auth", "studio--dashboard");
    loadingView.hidden = false;
    authGate.hidden = true;
    dashboard.hidden = true;
  }

  function showAuthGate() {
    document.body.classList.add("studio--auth");
    document.body.classList.remove("studio--dashboard");
    loadingView.hidden = true;
    authGate.hidden = false;
    dashboard.hidden = true;
  }

  async function showDashboard() {
    document.body.classList.add("studio--dashboard");
    document.body.classList.remove("studio--auth");
    loadingView.hidden = true;
    authGate.hidden = true;
    dashboard.hidden = false;

    await window.ClerkAuth.mountUserButton(document.getElementById("userButton"));
    await loadInvitations();
  }

  async function loadInvitations() {
    dashError.hidden = true;

    try {
      const data = await api.listInvitations();
      const invitations = Array.isArray(data.invitations) ? data.invitations : [];
      renderInvitations(invitations);
    } catch (error) {
      dashError.hidden = false;
      dashError.textContent = error.message || "Could not load invitations.";
      inviteList.innerHTML = "";
      dashEmpty.hidden = true;
    }
  }

  function renderInvitations(invitations) {
    inviteList.innerHTML = "";
    const hasInvitations = invitations.length > 0;
    dashEmpty.hidden = hasInvitations;

    invitations.forEach((invitation) => {
      const item = document.createElement("li");
      item.className = "invite-card-item";

      const card = document.createElement("article");
      card.className = "invite-card";

      const title = document.createElement("strong");
      title.textContent = invitation.label || "Unnamed invitation";
      card.append(title);

      if (invitation.coupleLabel) {
        const subtitle = document.createElement("span");
        subtitle.className = "invite-subtitle";
        subtitle.textContent = invitation.coupleLabel;
        card.append(subtitle);
      }

      const status = document.createElement("span");
      status.className = "invite-status";
      status.textContent = invitation.status === "published" ? "Published" : "Draft";

      const meta = document.createElement("span");
      meta.className = "invite-meta";
      const updated = invitation.updatedAt ? new Date(invitation.updatedAt).toLocaleDateString() : "";
      const replies = Number(invitation.rsvpCount || 0);
      meta.textContent = `${replies} RSVP${replies === 1 ? "" : "s"}${updated ? ` · Updated ${updated}` : ""}`;

      const actions = document.createElement("div");
      actions.className = "invite-card-actions";

      const openBtn = document.createElement("a");
      openBtn.className = "primary-btn invite-open-btn";
      openBtn.href = `/editor/${invitation.id}`;
      openBtn.textContent = "Open editor";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "ghost-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => deleteInvitation(invitation, deleteBtn));

      actions.append(openBtn, deleteBtn);
      card.append(status, meta, actions);
      item.append(card);
      inviteList.append(item);
    });
  }

  async function createInvitation() {
    createBtn.disabled = true;
    dashError.hidden = true;

    try {
      const data = await api.createInvitation();
      window.location.href = `/editor/${data.invitation.id}`;
    } catch (error) {
      dashError.hidden = false;
      dashError.textContent = error.message || "Could not create an invitation.";
      createBtn.disabled = false;
    }
  }

  async function deleteInvitation(invitation, button) {
    const label = invitation.label || "this invitation";
    if (!window.confirm(`Delete ${label}? This also removes its RSVP replies.`)) return;

    button.disabled = true;
    dashError.hidden = true;

    try {
      await api.deleteInvitation(invitation.id);
      await loadInvitations();
    } catch (error) {
      dashError.hidden = false;
      dashError.textContent = error.message || "Could not delete the invitation.";
      button.disabled = false;
    }
  }
})();

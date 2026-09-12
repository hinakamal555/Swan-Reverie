(() => {
  "use strict";

  const { api } = window.InviteLib;
  const TEXT_FIELDS = [
    ["heroLabel", "Line above names"],
    ["heroLocation", "Location line"],
    ["scrollLabel", "Scroll button"],
    ["introHeading", "Intro heading"],
    ["introBody", "Intro paragraph"],
    ["familyLabel", "Family label"],
    ["saveTheDateHeading", "Countdown heading"],
    ["saveTheDateBody", "Countdown introduction"],
    ["mapsButtonLabel", "Maps button"],
    ["rsvpHeading", "RSVP heading"],
    ["rsvpBody", "RSVP introduction"],
    ["rsvpNameLabel", "RSVP name label"],
    ["rsvpMessageLabel", "RSVP message label"],
    ["rsvpSubmitLabel", "RSVP button"],
    ["closingText", "Closing line"],
  ];

  const ALL_SECTIONS = {
    couple: "Couple",
    cover: "Cover",
    intro: "Intro",
    when: "Countdown",
    events: "Events",
    journey: "Journey",
    media: "Music",
    rsvp: "RSVP",
    closing: "Closing",
    publish: "Publish",
  };

  function resolveSections() {
    const editor = window.__INVITE_EDITOR__ || {};
    const ids = Array.isArray(editor.sections) && editor.sections.length
      ? editor.sections.slice()
      : Object.keys(ALL_SECTIONS);
    if (!ids.includes("publish")) ids.push("publish");
    const seen = new Set();
    const sections = [];
    for (const id of ids) {
      if (ALL_SECTIONS[id] && !seen.has(id)) {
        sections.push([id, ALL_SECTIONS[id]]);
        seen.add(id);
      }
    }
    return sections.length ? sections : Object.entries(ALL_SECTIONS);
  }

  const SECTIONS = resolveSections();

  function applySectionVisibility() {
    const active = new Set(SECTIONS.map(([id]) => id));
    document.querySelectorAll(".ed-section").forEach((section) => {
      if (section.classList.contains("ed-section--meta")) {
        section.hidden = false;
        return;
      }
      const id = section.id.replace(/^sec-/, "");
      section.hidden = !active.has(id);
    });
  }

  const ZONES = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Karachi",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];

  const form = document.getElementById("editorForm");
  const previewRoot = document.getElementById("previewRoot");
  const saveState = document.getElementById("saveState");
  const invitationId = window.location.pathname.split("/").pop();
  let invitation = null;
  let saveTimer = null;
  let dirty = false;
  let rsvpReplies = [];

  document.getElementById("sectionNav").innerHTML = [
    `<a href="#sec-invitation-name">Name</a>`,
    ...SECTIONS.map(([id, label]) => `<a href="#sec-${id}">${label}</a>`),
  ].join("");
  applySectionVisibility();

  const tzSelect = document.getElementById("timezoneSelect");
  tzSelect.innerHTML = ZONES.map((zone) => `<option value="${zone}">${zone}</option>`).join("");

  const repliesPane = document.getElementById("repliesPane");
  const toggleRepliesBtn = document.getElementById("toggleRepliesBtn");
  const closeRepliesBtn = document.getElementById("closeRepliesBtn");

  function isMobileLayout() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function setRepliesOpen(open) {
    document.body.classList.toggle("replies-open", open);
    if (repliesPane) repliesPane.setAttribute("aria-hidden", open ? "false" : "true");
    if (toggleRepliesBtn) toggleRepliesBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) loadRsvpReplies();
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  function setMobilePane(pane) {
    document.getElementById("formPane").classList.toggle("is-hidden-mobile", pane !== "form");
    const previewPane = document.getElementById("previewPane");
    previewPane.classList.toggle("is-visible-mobile", pane === "preview");
    previewPane.classList.toggle("is-hidden-mobile", pane !== "preview");
    if (repliesPane) repliesPane.classList.toggle("is-visible-mobile", pane === "replies");
    if (pane === "replies") loadRsvpReplies();
  }

  document.querySelectorAll(".mobile-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mobile-tabs button").forEach((item) => item.classList.toggle("is-on", item === button));
      setMobilePane(button.dataset.pane);
    });
  });

  if (toggleRepliesBtn) {
    toggleRepliesBtn.addEventListener("click", () => setRepliesOpen(true));
  }
  if (closeRepliesBtn) {
    closeRepliesBtn.addEventListener("click", () => setRepliesOpen(false));
  }

  window.addEventListener("resize", () => {
    if (isMobileLayout()) {
      setRepliesOpen(false);
    } else if (repliesPane) {
      repliesPane.classList.remove("is-visible-mobile");
    }
  });

  form.addEventListener("input", onFormChange);
  form.addEventListener("change", onFormChange);
  document.getElementById("addCardBtn").addEventListener("click", () => {
    const date = (invitation.content.weddingDateTime && invitation.content.weddingDateTime.date) || "";
    const day = date.split("-")[2] ? String(Number(date.split("-")[2])) : "14";
    invitation.content.scratch.cards.push({
      id: `card-${Math.random().toString(16).slice(2, 10)}`,
      hiddenText: "SCRATCH",
      revealText: day,
    });
    renderScratch();
    afterChange();
  });
  document.getElementById("addEventBtn").addEventListener("click", () => {
    invitation.content.events.push({
      id: `evt-${Math.random().toString(16).slice(2, 10)}`,
      type: "event",
      title: "Bridal shower",
      kicker: "Brunch · blush and cream",
      venue: "",
      address: "",
      date: invitation.content.weddingDateTime.date,
      startTime: "12:00",
      endTime: "15:00",
      mapsUrl: (invitation.content.events[0] && invitation.content.events[0].mapsUrl) || "",
      colors: ["#c4a35a", "#7a8b68", "#f3ece1"],
    });
    renderEvents();
    afterChange();
  });

  document.getElementById("saveBtn").addEventListener("click", () => save("manual"));
  document.getElementById("publishBtn").addEventListener("click", publish);
  document.getElementById("previewBtn").addEventListener("click", async () => {
    await save("manual");
    window.open(`/preview/${invitation.id}`, "_blank", "noopener");
  });
  const copyBtn = document.getElementById("copyBtn");
  const COPY_LINK_LABEL = "Copy link";

  document.getElementById("copyBtn").addEventListener("click", async () => {
    const url = `${window.location.origin}/i/${invitation.publicId}`;
    try {
      await navigator.clipboard.writeText(url);
      showCopyFeedback();
    } catch {
      try {
        const helper = document.createElement("textarea");
        helper.value = url;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.left = "-9999px";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
        showCopyFeedback();
      } catch {
        setState("Could not copy link", true);
      }
    }
  });

  function showCopyFeedback() {
    if (!copyBtn) return;
    copyBtn.textContent = "Link copied!";
    copyBtn.classList.add("is-success");
    copyBtn.disabled = true;
    setState("Link copied");
    window.clearTimeout(showCopyFeedback._timer);
    showCopyFeedback._timer = window.setTimeout(() => {
      copyBtn.textContent = COPY_LINK_LABEL;
      copyBtn.classList.remove("is-success");
      copyBtn.disabled = false;
      if (invitation && invitation.status === "published") setState("Published");
    }, 2200);
  }

  form.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-clear-media]");
    if (!clear) return;
    const field = clear.dataset.clearMedia;
    if (field === "musicUrl") {
      form.elements.musicUrl.value = "";
      invitation.content.media = invitation.content.media || {};
      invitation.content.media.musicUrl = "";
      const upload = document.getElementById("musicUploadInput");
      if (upload) upload.value = "";
      setMusicUploadError("");
    }
    afterChange();
  });

  const musicUploadInput = document.getElementById("musicUploadInput");
  const useDefaultMusicBtn = document.getElementById("useDefaultMusicBtn");
  const musicDefaultHint = document.getElementById("musicDefaultHint");
  const MAX_MUSIC_BYTES = 10 * 1024 * 1024;
  if (musicUploadInput) {
    musicUploadInput.addEventListener("change", () => uploadMusicFile(musicUploadInput));
  }

  function defaultMusicUrl() {
    return String(window.__INVITE_DEFAULT_MUSIC_URL__ || "").trim();
  }

  function syncDefaultMusicUi() {
    const defaultUrl = defaultMusicUrl();
    if (!useDefaultMusicBtn) return;
    if (!defaultUrl) {
      useDefaultMusicBtn.hidden = true;
      if (musicDefaultHint) musicDefaultHint.hidden = true;
      return;
    }
    useDefaultMusicBtn.hidden = false;
    if (musicDefaultHint) musicDefaultHint.hidden = false;
    const current = String(form.elements.musicUrl?.value || "").trim();
    const usingDefault = current === defaultUrl;
    useDefaultMusicBtn.disabled = usingDefault;
    useDefaultMusicBtn.textContent = usingDefault ? "Using template music" : "Use template music";
  }

  if (useDefaultMusicBtn) {
    useDefaultMusicBtn.addEventListener("click", () => {
      const defaultUrl = defaultMusicUrl();
      if (!defaultUrl) return;
      form.elements.musicUrl.value = defaultUrl;
      invitation.content.media = invitation.content.media || {};
      invitation.content.media.musicUrl = defaultUrl;
      if (musicUploadInput) musicUploadInput.value = "";
      setMusicUploadError("");
      syncDefaultMusicUi();
      afterChange();
    });
  }

  async function uploadMusicFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    setMusicUploadError("");
    if (!/\.mp3$/i.test(file.name) && !String(file.type || "").startsWith("audio/")) {
      setMusicUploadError("Please choose an MP3 file.");
      input.value = "";
      return;
    }
    if (file.size > MAX_MUSIC_BYTES) {
      setMusicUploadError(`This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Music must be 10MB or smaller.`);
      input.value = "";
      return;
    }
    try {
      setState("Uploading music…");
      const { url } = await api.uploadMedia(invitation.id, file);
      form.elements.musicUrl.value = url;
      invitation.content.media = invitation.content.media || {};
      invitation.content.media.musicUrl = url;
      input.value = "";
      syncDefaultMusicUi();
      window.clearTimeout(saveTimer);
      renderPreview();
      await save("manual");
      setMusicUploadError("");
      setState("Music uploaded");
    } catch (error) {
      setMusicUploadError(error.message || "Upload failed.");
      setState(error.message || "Upload failed.", true);
      input.value = "";
    }
  }

  function setMusicUploadError(message) {
    const node = document.getElementById("musicUploadError");
    if (!node) return;
    if (message) {
      node.textContent = message;
      node.hidden = false;
    } else {
      node.textContent = "";
      node.hidden = true;
    }
  }

  document.getElementById("refreshRsvpsBtn").addEventListener("click", () => loadRsvpReplies());
  document.getElementById("exportRsvpsBtn").addEventListener("click", exportRsvpCsv);

  boot();

  async function boot() {
    try {
      window.InviteLib.applyBrandLabels();
      window.InviteLib.applySiteTitle();
      await window.ClerkAuth.load();
      const user = await window.ClerkAuth.getUser();
      if (!user) {
        window.location.replace(`/?returnTo=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      await window.ClerkAuth.mountUserButton(document.getElementById("userButton"));
      const data = await api.getInvitation(invitationId);
      invitation = data.invitation;
      fillForm();
      renderPreview();
      updatePublish();
      updateRsvpCountLabel(invitation.rsvpCount || 0);
      await loadRsvpReplies();
      await save("auto");
      setState(invitation.status === "published" ? "Published" : "Saved draft");
    } catch (error) {
      if (error.status === 401) {
        window.location.replace(`/?returnTo=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (error.status === 403) {
        setState("You do not have access to this invitation.", true);
        return;
      }
      setState(error.message, true);
    }
  }

  function fillForm() {
    const c = invitation.content;
    normalizeScratchCards(c);
    normalizeEnglishDefaults(c);
    form.elements.invitationTitle.value = invitation.title || "";
    form.elements.brideName.value = c.couple.brideName || "";
    form.elements.groomName.value = c.couple.groomName || "";
    form.elements.weddingDate.value = c.weddingDateTime.date || "";
    form.elements.weddingTime.value = c.weddingDateTime.startTime || "";
    if (c.weddingDateTime.timezone && !Array.from(tzSelect.options).some((opt) => opt.value === c.weddingDateTime.timezone)) {
      const option = document.createElement("option");
      option.value = c.weddingDateTime.timezone;
      option.textContent = c.weddingDateTime.timezone;
      tzSelect.append(option);
    }
    form.elements.timezone.value = c.weddingDateTime.timezone || "UTC";
    TEXT_FIELDS.forEach(([name]) => {
      const field = form.elements[`text.${name}`];
      if (field) field.value = c.text[name] || "";
    });
    form.elements.scratchEnabled.checked = c.scratch.enabled !== false;
    form.elements.scratchPrompt.value = c.text.scratchPrompt || "";
    form.elements.scratchCompletion.value = c.scratch.completionText || c.text.scratchCompletionText || "";
    form.elements.journeyEnabled.checked = c.journey.enabled !== false;
    form.elements.journeyTitle.value = c.journey.title || "";
    form.elements.journeySubtitle.value = c.journey.subtitle || "";
    form.elements.journeyDepart.value = c.journey.departLine || "";
    form.elements.journeySeat.value = c.journey.seatNote || "";
    form.elements.journeyMeetHeading.value = c.journey.meetHeading || "";
    form.elements.journeyMeetLine.value = c.journey.meetLine || "";
    form.elements.journeyStop.value = c.journey.stopNote || "";
    form.elements.journeyArrivalHeading.value = c.journey.arrivalHeading || "";
    form.elements.journeyArrivalLine.value = c.journey.arrivalLine || "";
    form.elements.journeyExtra.value = c.journey.extraNote || "";
    form.elements.journeyMaps.value = c.journey.mapsUrl || "";
    form.elements.musicUrl.value = c.media.musicUrl || "";
    form.elements.rsvpEnabled.checked = c.rsvp.enabled !== false;
    form.elements.rsvpDeadline.value = c.rsvp.deadline || "";
    form.elements.optYes.checked = (c.rsvp.attendanceOptions || []).includes("yes");
    form.elements.optNo.checked = (c.rsvp.attendanceOptions || []).includes("no");
    form.elements.optMaybe.checked = (c.rsvp.attendanceOptions || []).includes("maybe");
    c.language = "en";
    renderScratch();
    renderEvents();
    syncDefaultMusicUi();
  }

  function readInvitationTitle() {
    return form.elements.invitationTitle.value.trim();
  }

  function readForm() {
    const c = invitation.content;
    invitation.title = readInvitationTitle();
    c.couple.brideName = form.elements.brideName.value;
    c.couple.groomName = form.elements.groomName.value;
    c.weddingDateTime.date = form.elements.weddingDate.value;
    c.weddingDateTime.startTime = form.elements.weddingTime.value;
    c.weddingDateTime.timezone = form.elements.timezone.value;
    TEXT_FIELDS.forEach(([name]) => {
      const field = form.elements[`text.${name}`];
      if (field) c.text[name] = field.value;
    });
    c.scratch.enabled = form.elements.scratchEnabled.checked;
    c.text.scratchPrompt = form.elements.scratchPrompt.value;
    c.scratch.completionText = form.elements.scratchCompletion.value;
    c.text.scratchCompletionText = form.elements.scratchCompletion.value;
    c.location = c.location || {};
    c.location.address = (form.elements["text.heroLocation"] && form.elements["text.heroLocation"].value) || c.location.address || "";
    c.journey.enabled = form.elements.journeyEnabled.checked;
    c.journey.title = form.elements.journeyTitle.value;
    c.journey.subtitle = form.elements.journeySubtitle.value;
    c.journey.departLine = form.elements.journeyDepart.value;
    c.journey.seatNote = form.elements.journeySeat.value;
    c.journey.meetHeading = form.elements.journeyMeetHeading.value;
    c.journey.meetLine = form.elements.journeyMeetLine.value;
    c.journey.stopNote = form.elements.journeyStop.value;
    c.journey.arrivalHeading = form.elements.journeyArrivalHeading.value;
    c.journey.arrivalLine = form.elements.journeyArrivalLine.value;
    c.journey.extraNote = form.elements.journeyExtra.value;
    c.journey.mapsUrl = form.elements.journeyMaps.value;
    c.media.musicUrl = form.elements.musicUrl.value;
    c.media.gallery = [];
    c.rsvp.enabled = form.elements.rsvpEnabled.checked;
    c.rsvp.deadline = form.elements.rsvpDeadline.value;
    c.rsvp.attendanceOptions = [
      form.elements.optYes.checked ? "yes" : null,
      form.elements.optNo.checked ? "no" : null,
      form.elements.optMaybe.checked ? "maybe" : null,
    ].filter(Boolean);
    c.language = "en";
    c.scratch.cards = Array.from(document.querySelectorAll("[data-card]")).map((card) => ({
      id: card.dataset.card,
      hiddenText: card.querySelector("[data-hidden]").value,
      revealText: card.querySelector("[data-reveal]").value,
    }));
    c.events = Array.from(document.querySelectorAll("[data-event]")).map((card) => {
      const previous = (invitation.content.events || []).find((item) => item.id === card.dataset.event) || {};
      return {
        id: card.dataset.event,
        type: previous.type || "event",
        title: card.querySelector("[data-title]").value,
        kicker: card.querySelector("[data-kicker]").value,
        venue: card.querySelector("[data-venue]").value,
        address: card.querySelector("[data-address]").value,
        date: card.querySelector("[data-date]").value,
        startTime: card.querySelector("[data-start]").value,
        endTime: card.querySelector("[data-end]").value,
        mapsUrl: card.querySelector("[data-maps]").value,
        description: previous.description || "",
        colors: [0, 1, 2].map((index) => card.querySelector(`[data-event-hex="${index}"]`).value).filter(Boolean),
      };
    });
  }

  function renderScratch() {
    const cards = invitation.content.scratch.cards || [];
    document.getElementById("scratchCards").innerHTML = cards.map((card, index) => `
      <div class="mini-card" data-card="${card.id}">
        <header><strong>Card ${index + 1}</strong>
          ${cards.length > 1 ? `<button type="button" class="ghost-btn" data-remove-card="${card.id}">Remove</button>` : ""}
        </header>
        <label>Cover label <input data-hidden value="${escapeAttr(card.hiddenText)}" maxlength="24"></label>
        <label>Revealed date <input data-reveal value="${escapeAttr(card.revealText)}" maxlength="40"></label>
      </div>
    `).join("");
    document.querySelectorAll("[data-remove-card]").forEach((button) => {
      button.addEventListener("click", () => {
        invitation.content.scratch.cards = invitation.content.scratch.cards.filter((card) => card.id !== button.dataset.removeCard);
        renderScratch();
        afterChange();
      });
    });
  }

  function eventPalette(event) {
    const fallback = ["#c4a35a", "#7a8b68", "#f3ece1"];
    const colors = Array.isArray(event.colors) && event.colors.length ? event.colors : fallback;
    return [0, 1, 2].map((index) => colors[index] || fallback[index]);
  }

  function renderEvents() {
    const events = invitation.content.events || [];
    document.getElementById("eventList").innerHTML = events.map((event, index) => {
      const colors = eventPalette(event);
      return `
      <div class="mini-card" data-event="${event.id}">
        <header><strong>Event ${index + 1}</strong>
          <button type="button" class="ghost-btn" data-remove-event="${event.id}">Remove</button>
        </header>
        <label>Title <input data-title value="${escapeAttr(event.title)}" maxlength="80"></label>
        <label>Dress / theme line <input data-kicker value="${escapeAttr(event.kicker)}" maxlength="80"></label>
        <p class="hint">Theme colours</p>
        <div class="split event-color-row">
          ${colors.map((color, colorIndex) => `
            <label>Dot ${colorIndex + 1}
              <span class="color-pair">
                <input type="color" data-event-color="${colorIndex}" value="${toPicker(color)}">
                <input type="text" data-event-hex="${colorIndex}" value="${escapeAttr(color)}" maxlength="7">
              </span>
            </label>
          `).join("")}
        </div>
        <label>Venue <input data-venue value="${escapeAttr(event.venue)}" maxlength="120"></label>
        <label>Address <input data-address value="${escapeAttr(event.address)}" maxlength="200"></label>
        <label>Date <input data-date type="date" value="${escapeAttr(event.date)}"></label>
        <div class="split">
          <label>Start <input data-start type="time" value="${escapeAttr(event.startTime)}"></label>
          <label>End <input data-end type="time" value="${escapeAttr(event.endTime)}"></label>
        </div>
        <label>Google Maps URL <input data-maps value="${escapeAttr(event.mapsUrl)}" maxlength="500"></label>
      </div>
    `;
    }).join("");
    document.querySelectorAll("[data-event]").forEach((card) => {
      card.querySelectorAll("[data-event-color]").forEach((input) => {
        input.addEventListener("input", () => {
          const hex = card.querySelector(`[data-event-hex="${input.dataset.eventColor}"]`);
          if (hex) hex.value = input.value;
          onFormChange();
        });
      });
      card.querySelectorAll("[data-event-hex]").forEach((input) => {
        input.addEventListener("input", () => {
          const picker = card.querySelector(`[data-event-color="${input.dataset.eventHex}"]`);
          if (picker && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(input.value)) picker.value = toPicker(input.value);
          onFormChange();
        });
      });
    });
    document.querySelectorAll("[data-remove-event]").forEach((button) => {
      button.addEventListener("click", () => {
        invitation.content.events = invitation.content.events.filter((event) => event.id !== button.dataset.removeEvent);
        renderEvents();
        afterChange();
      });
    });
  }

  function normalizeScratchCards(content) {
    const cards = content.scratch && content.scratch.cards || [];
    const oldReveal = cards.some((card) => /friday|june/i.test(String(card.revealText || "")));
    const oldCover = cards.some((card) => /^\d+$/.test(String(card.hiddenText || "")) && String(card.hiddenText).toUpperCase() !== "SCRATCH");
    if (!oldReveal && !oldCover) return;
    const [year, month, day] = String(content.weddingDateTime && content.weddingDateTime.date || "2027-06-11").split("-");
    const revealed = [String(Number(day) || 11), month || "06", year || "2027"];
    content.scratch.cards = cards.map((card, index) => ({
      ...card,
      hiddenText: "SCRATCH",
      revealText: revealed[index] || card.revealText || String(Number(day) || 11),
    }));
  }

  function defaultWeekendEvents(content) {
    const venue = (content.location && content.location.venue) || "The Willow Room";
    const address = (content.location && content.location.address) || "Charleston, South Carolina";
    const mapsUrl = (content.location && content.location.mapsUrl) || "https://maps.google.com/?q=Charleston+South+Carolina";
    const wedding = (content.weddingDateTime && content.weddingDateTime.date) || "2027-06-11";
    const [year, month, day] = wedding.split("-").map(Number);
    const dateAt = (offset) => {
      const date = new Date(year || 2027, (month || 6) - 1, (day || 11) + offset);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    return [
      {
        id: `evt-${Math.random().toString(16).slice(2, 10)}`,
        type: "welcome",
        title: "Welcome drinks",
        kicker: "Garden party · citrus and cream",
        venue,
        address,
        date: dateAt(-1),
        startTime: "17:00",
        endTime: "20:00",
        mapsUrl,
        description: "A first toast under the trees.",
        colors: ["#c4a35a", "#7a8b68", "#f7f3ea"],
      },
      {
        id: `evt-${Math.random().toString(16).slice(2, 10)}`,
        type: "ceremony",
        title: "Ceremony",
        kicker: "Soft florals · ivory and sage",
        venue,
        address,
        date: dateAt(0),
        startTime: content.weddingDateTime && content.weddingDateTime.startTime || "16:00",
        endTime: "17:00",
        mapsUrl,
        description: "Please join us as we say our vows.",
        colors: ["#8ba3b5", "#f3ece1", "#3d4f3f"],
      },
      {
        id: `evt-${Math.random().toString(16).slice(2, 10)}`,
        type: "reception",
        title: "Reception",
        kicker: "Black tie optional · ivory and sage",
        venue,
        address,
        date: dateAt(1),
        startTime: "18:00",
        endTime: "23:00",
        mapsUrl,
        description: "Join us for dinner, toasts, and dancing.",
        colors: ["#3d4f3f", "#cbb89a", "#f7f3ea"],
      },
    ];
  }

  function defaultJourneyCopy() {
    return {
      title: "The Journey Up",
      subtitle: "Coaches",
      origin: "Central Park, New York",
      destination: "Lake Placid Lodge",
      departLine: "From Central Park, New York · 10 June, 9 AM",
      seatNote: "Tell us and we will keep you a seat",
      meetHeading: "Someone will meet you",
      meetLine: "At the trailhead, and again at the lodge",
      stopNote: "We stop for coffee on the way",
      arrivalHeading: "Once you are here",
      arrivalLine: "Everything is ten minutes from the hotel",
      extraNote: "Boats on the lake from morning",
      mapsUrl: "https://maps.google.com/?q=Lake+Placid+Lodge+New+York",
    };
  }

  function isCulturalEvent(event) {
    const text = `${event.title || ""} ${event.type || ""}`;
    return /mehndi|baraat|nikah|walima/i.test(text);
  }

  function looksLikeOldDemoEvents(events) {
    if (!Array.isArray(events) || events.length !== 1) return false;
    const event = events[0];
    return /reception/i.test(event.title || "") && /willow/i.test(event.venue || "");
  }

  function normalizeEnglishDefaults(content) {
    if (content.couple) {
      if (content.couple.brideName === "Mahbub") content.couple.brideName = "Emma";
      if (content.couple.groomName === "Bilal") content.couple.groomName = "James";
    }
    const events = Array.isArray(content.events) ? content.events : [];
    const kept = events.filter((event) => !isCulturalEvent(event));
    if (kept.length !== events.length || looksLikeOldDemoEvents(kept)) {
      content.events = defaultWeekendEvents(content);
    } else {
      content.events = kept.map((event) => {
        if (Array.isArray(event.colors) && event.colors.length) return event;
        return { ...event, colors: ["#c4a35a", "#7a8b68", "#f3ece1"] };
      });
    }
    if (content.text && /rawalakot|islamabad|karachi|pakistan/i.test(content.text.heroLocation || "")) {
      content.text.heroLocation = "Charleston, South Carolina";
    }
    if (content.location && /rawalakot|banjosa|islamabad|karachi/i.test(`${content.location.venue || ""} ${content.location.address || ""}`)) {
      content.location.venue = "The Willow Room";
      content.location.address = "Charleston, South Carolina";
      content.location.mapsUrl = "https://maps.google.com/?q=Charleston+South+Carolina";
    }
    content.journey = content.journey || {};
    const journey = content.journey;
    const journeyBlob = [journey.origin, journey.destination, journey.departLine, journey.meetLine, journey.stopNote, journey.title].join(" ");
    if (/islamabad|rawalakot|kohala|karachi|f-9|charleston airport/i.test(journeyBlob) || !journey.meetHeading) {
      const fallback = defaultJourneyCopy();
      if (/islamabad|rawalakot|kohala|karachi|f-9|charleston airport/i.test(journeyBlob)) {
        Object.assign(journey, fallback);
      } else {
        Object.keys(fallback).forEach((key) => {
          if (!journey[key]) journey[key] = fallback[key];
        });
      }
    }
    if (content.weddingDateTime && content.weddingDateTime.timezone === "Asia/Karachi") {
      content.weddingDateTime.timezone = "America/New_York";
    }
  }

  function onFormChange(event) {
    if (event && event.target && event.target.closest("[data-upload]")) return;
    if (!invitation) return;
    readForm();
    afterChange();
  }

  function afterChange() {
    dirty = true;
    setState("Unsaved changes");
    syncDefaultMusicUi();
    renderPreview();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => save("auto"), 1400);
  }

  function renderPreview() {
    if (!invitation) return;
    window.InviteRuntime.mount(previewRoot, invitation, { embedded: true, disableRsvp: true });
  }

  async function save(reason) {
    if (!invitation) return;
    readForm();
    try {
      setState(reason === "auto" ? "Saving…" : "Saving…");
      const data = await api.saveInvitation(invitation.id, invitation.content, invitation.title || "");
      invitation = data.invitation;
      dirty = false;
      setState("Saved");
      updatePublish();
    } catch (error) {
      setState(error.message, true);
    }
  }

  async function publish() {
    readForm();
    try {
      setState("Publishing…");
      const data = await api.publishInvitation(invitation.id, invitation.content, invitation.title || "");
      invitation = data.invitation;
      dirty = false;
      setState("Published");
      updatePublish();
    } catch (error) {
      setState(error.message, true);
    }
  }

  function updatePublish() {
    const url = `${window.location.origin}/i/${invitation.publicId}`;
    const node = document.getElementById("publishUrl");
    if (invitation.status === "published") {
      node.innerHTML = `Shareable link: <a href="${url}" target="_blank" rel="noopener">${url}</a>`;
      document.getElementById("copyBtn").hidden = false;
    } else {
      node.textContent = "Publish to generate a public guest link. Drafts stay private.";
      document.getElementById("copyBtn").hidden = true;
    }
  }

  function setState(message, isError) {
    saveState.textContent = message;
    saveState.classList.toggle("is-error", Boolean(isError));
  }

  function toPicker(hex) {
    const value = String(hex || "#5a6b5c");
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
    if (/^#[0-9a-fA-F]{3}$/.test(value)) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return "#5a6b5c";
  }

  function escapeAttr(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function attendingLabel(value) {
    if (value === "yes") return "Attending";
    if (value === "no") return "Not attending";
    if (value === "maybe") return "Maybe";
    return value || "—";
  }

  function formatReplyDate(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return String(value);
    }
  }

  function updateRsvpCountLabel(count) {
    const node = document.getElementById("rsvpCountLabel");
    if (!node) return;
    const total = Number(count || 0);
    node.textContent = total === 1 ? "1 reply for this invitation" : `${total} replies for this invitation`;
  }

  async function loadRsvpReplies() {
    const errorNode = document.getElementById("rsvpLoadError");
    const emptyNode = document.getElementById("rsvpEmpty");
    const tableWrap = document.getElementById("rsvpTableWrap");
    const tableBody = document.getElementById("rsvpTableBody");
    if (!invitation || !tableBody) return;

    try {
      if (errorNode) errorNode.hidden = true;
      const data = await api.listRsvps(invitation.id);
      rsvpReplies = Array.isArray(data.rsvps) ? data.rsvps : [];
      updateRsvpCountLabel(rsvpReplies.length);
      tableBody.innerHTML = rsvpReplies.map((row) => `
        <tr>
          <td>${escapeAttr(row.guestName)}</td>
          <td>${escapeAttr(attendingLabel(row.attending))}</td>
          <td>${escapeAttr(row.message || "—")}</td>
          <td>${escapeAttr(formatReplyDate(row.createdAt))}</td>
        </tr>
      `).join("");
      const hasRows = rsvpReplies.length > 0;
      if (emptyNode) {
        emptyNode.hidden = hasRows;
        emptyNode.textContent = hasRows ? "" : "No replies yet. Publish your invitation and share the guest link.";
      }
      if (tableWrap) tableWrap.hidden = !hasRows;
    } catch (error) {
      if (errorNode) {
        errorNode.hidden = false;
        errorNode.textContent = error.message || "Could not load replies.";
      }
      if (emptyNode) emptyNode.hidden = true;
      if (tableWrap) tableWrap.hidden = true;
    }
  }

  function exportRsvpCsv() {
    if (!rsvpReplies.length) {
      setState("No replies to export yet.", true);
      return;
    }
    const lines = [
      ["Guest", "Attending", "Message", "Received"].join(","),
      ...rsvpReplies.map((row) => [
        csvCell(row.guestName),
        csvCell(attendingLabel(row.attending)),
        csvCell(row.message || ""),
        csvCell(formatReplyDate(row.createdAt)),
      ].join(",")),
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "rsvp-replies.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setState("RSVP CSV downloaded");
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  window.addEventListener("beforeunload", (event) => {
    if (dirty) event.preventDefault();
  });
})();

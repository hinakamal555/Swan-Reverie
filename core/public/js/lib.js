(() => {
  "use strict";

  const api = {
    async request(path, options = {}) {
      const headers = Object.assign({ Accept: "application/json" }, options.headers || {});
      if (window.ClerkAuth) {
        try {
          const token = await window.ClerkAuth.getToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {
          /* Clerk not ready yet */
        }
      }
      if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      const response = await fetch(path, {
        credentials: "include",
        method: options.method || "GET",
        headers,
        body: options.body instanceof FormData || typeof options.body === "string"
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || "Request failed.");
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    },
    me: () => api.request("/api/auth/me"),
    listInvitations: () => api.request("/api/invitations"),
    createInvitation: () => api.request("/api/invitations", { method: "POST", body: {} }),
    deleteInvitation: (id) => api.request(`/api/invitations/${id}`, { method: "DELETE" }),
    getInvitation: (id) => api.request(`/api/invitations/${id}`),
    saveInvitation: (id, content, title) => api.request(`/api/invitations/${id}`, { method: "PUT", body: { content, title } }),
    publishInvitation: (id, content, title) => api.request(`/api/invitations/${id}/publish`, { method: "POST", body: { content, title } }),
    publicInvitation: (publicId) => api.request(`/api/public/${encodeURIComponent(publicId)}`),
    submitRsvp: (publicId, body) => api.request(`/api/public/${encodeURIComponent(publicId)}/rsvp`, { method: "POST", body }),
    listRsvps: (id) => api.request(`/api/invitations/${id}/rsvps`),
    uploadMedia: async (id, file) => {
      const body = new FormData();
      body.append("file", file);
      return api.request(`/api/invitations/${id}/media`, { method: "POST", body });
    },
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.startsWith("/") && !text.startsWith("//")) return text;
    try {
      const url = new URL(text);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch {
      return "";
    }
    return "";
  }

  function hexToRgb(hex) {
    let h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return { r: 90, g: 107, b: 92 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex({ r, g, b }) {
    const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return `#${to(r)}${to(g)}${to(b)}`;
  }

  function mix(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToHex({
      r: A.r + (B.r - A.r) * t,
      g: A.g + (B.g - A.g) * t,
      b: A.b + (B.b - A.b) * t,
    });
  }

  function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const to = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * to(r) + 0.7152 * to(g) + 0.0722 * to(b);
  }

  function contrastText(hex) {
    return luminance(hex) > 0.46 ? "#2a2a2a" : "#f7f3ea";
  }

  function applyTheme(root, colors) {
    const palette = Array.isArray(colors) && colors.length ? colors : ["#5a6b5c", "#d4af37", "#8ba3b5"];
    const primary = palette[0];
    const accent = palette[1] || mix(primary, "#d4af37", 0.62);
    const scenic = palette[2] || mix(primary, "#8ba3b5", 0.55);
    const heading = luminance(primary) > 0.62 ? mix(primary, "#1b211c", 0.55) : mix(primary, "#1b211c", 0.28);
    const vars = {
      "--theme-primary": primary,
      "--theme-primary-deep": heading,
      "--theme-accent": accent,
      "--theme-accent-deep": mix(accent, "#5a4710", 0.28),
      "--theme-accent-soft": mix(accent, "#fff6d6", 0.42),
      "--theme-scenic": scenic,
      "--theme-surface": "#f8f0e5",
      "--theme-surface-deep": mix(primary, "#e8e2d6", 0.12),
      "--theme-text": "#333333",
      "--theme-muted": "#5c5c5c",
      "--theme-on-primary": contrastText(primary),
      "--leaf": primary,
      "--leaf-deep": heading,
      "--gold": accent,
      "--gold-deep": mix(accent, "#5a4710", 0.28),
      "--gold-soft": mix(accent, "#fff6d6", 0.42),
      "--ink": "#333333",
      "--ink-soft": "#5c5c5c",
      "--water": scenic,
      "--parchment": "#f8f0e5",
      "--parchment-deep": "#e8e2d6",
    };
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    palette.slice(3).forEach((color, index) => {
      root.style.setProperty(`--theme-extra-${index}`, color);
    });
    root.style.setProperty("--theme-extra-count", String(Math.max(0, palette.length - 3)));
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
    }).format(new Date(y, m - 1, d)).toUpperCase();
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function formatTime(timeStr, language) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const date = new Date(2000, 0, 1, h || 0, m || 0);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function weddingTimestamp(wedding) {
    if (!wedding || !wedding.date) return null;
    const time = wedding.startTime || "12:00";
    const tz = wedding.timezone || "UTC";
    const [y, mo, d] = wedding.date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    try {
      const utcGuess = Date.UTC(y, mo - 1, d, hh, mm, 0);
      const asTz = new Date(utcGuess).toLocaleString("en-US", { timeZone: tz });
      const tzMs = new Date(asTz).getTime();
      return utcGuess + (utcGuess - tzMs);
    } catch {
      return new Date(`${wedding.date}T${time}:00`).getTime();
    }
  }

  function icsStamp(dateStr, timeStr) {
    const [y, m, d] = String(dateStr).split("-");
    const [hh, mm] = String(timeStr || "12:00").split(":");
    return `${y}${m}${d}T${hh}${mm}00`;
  }

  function icsEscape(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function downloadIcs(event, invitation) {
    const couple = invitation.content.couple || {};
    const tz = invitation.content.weddingDateTime && invitation.content.weddingDateTime.timezone;
    const start = icsStamp(event.date, event.startTime);
    const end = event.endTime ? icsStamp(event.date, event.endTime) : "";
    const summary = icsEscape(`${event.title || "Wedding"} — ${couple.brideName || ""} & ${couple.groomName || ""}`.trim());
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Invitation Platform//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${event.id || "event"}-${invitation.publicId || "invite"}@invitation`,
      `DTSTAMP:${icsStamp(new Date().toISOString().slice(0, 10), "00:00")}Z`,
      tz ? `DTSTART;TZID=${tz}:${start}` : `DTSTART:${start}`,
    ];
    if (end) lines.push(tz ? `DTEND;TZID=${tz}:${end}` : `DTEND:${end}`);
    lines.push(`SUMMARY:${summary}`);
    if (event.venue || event.address) lines.push(`LOCATION:${icsEscape([event.venue, event.address].filter(Boolean).join(", "))}`);
    if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    if (event.mapsUrl) lines.push(`URL:${icsEscape(event.mapsUrl)}`);
    lines.push("END:VEVENT", "END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(event.title || "event").replace(/[^\w]+/g, "-")}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const chrome = {
    en: {
      days: "Days",
      hours: "Hours",
      minutes: "Minutes",
      maps: "View on Maps",
      calendar: "Add to Calendar",
      attending: "Joyfully attending",
      notAttending: "Unable to attend",
      maybe: "Not sure yet",
      thanks: "Thank you — we have your reply.",
      contrast: "Contrast",
      typeSize: "Text size",
      openSeal: "Open the invitation",
    },
  };

  function applyBrandLabels() {
    const brand = window.__INVITE_BRAND_NAME__;
    if (!brand) return;
    document.querySelectorAll("[data-brand]").forEach((node) => {
      node.textContent = brand;
    });
  }

  function applySiteTitle() {
    const siteTitle = window.__INVITE_SITE_TITLE__;
    if (!siteTitle || !document.title.includes("__SITE_TITLE__")) return;
    document.title = document.title.replace("__SITE_TITLE__", siteTitle);
  }

  window.InviteLib = {
    api,
    applyBrandLabels,
    applySiteTitle,
    escapeHtml,
    safeUrl,
    applyTheme,
    formatDate,
    formatShortDate,
    formatTime,
    weddingTimestamp,
    downloadIcs,
    chrome,
    mix,
  };
})();

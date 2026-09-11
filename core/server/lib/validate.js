const { shortId } = require("./ids");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clip(value, max, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim().slice(0, max);
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafePathOrUrl(value) {
  if (!value) return true;
  const text = String(value).trim();
  if (text.startsWith("/") && !text.startsWith("//")) return true;
  return isHttpUrl(text);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeContent(raw) {
  const errors = [];
  const source = raw && typeof raw === "object" ? raw : {};
  const couple = source.couple || {};
  const wedding = source.weddingDateTime || {};
  const text = source.text || {};
  const theme = source.theme || {};
  const scratch = source.scratch || {};
  const journey = source.journey || {};
  const media = source.media || {};
  const rsvp = source.rsvp || {};
  const location = source.location || {};

  const content = {
    couple: {
      brideName: clip(couple.brideName, 80),
      groomName: clip(couple.groomName, 80),
    },
    weddingDateTime: {
      date: clip(wedding.date, 10),
      startTime: clip(wedding.startTime, 5),
      timezone: clip(wedding.timezone, 80, "UTC"),
    },
    text: {
      heroLabel: clip(text.heroLabel, 80),
      heroLocation: clip(text.heroLocation, 120),
      scrollLabel: clip(text.scrollLabel, 40),
      introHeading: clip(text.introHeading, 160),
      introBody: clip(text.introBody, 1200),
      familyLabel: clip(text.familyLabel, 80),
      saveTheDateHeading: clip(text.saveTheDateHeading, 80),
      saveTheDateBody: clip(text.saveTheDateBody, 240),
      detailsHeading: clip(text.detailsHeading, 80),
      detailsBody: clip(text.detailsBody, 240),
      journeyHeading: clip(text.journeyHeading, 80),
      journeyText: clip(text.journeyText, 1200),
      rsvpHeading: clip(text.rsvpHeading, 80),
      rsvpBody: clip(text.rsvpBody, 400),
      scratchPrompt: clip(text.scratchPrompt, 120),
      scratchCompletionText: clip(text.scratchCompletionText, 120),
      mapsButtonLabel: clip(text.mapsButtonLabel, 40),
      calendarButtonLabel: clip(text.calendarButtonLabel, 40),
      closingText: clip(text.closingText, 400),
      rsvpNameLabel: clip(text.rsvpNameLabel, 80),
      rsvpMessageLabel: clip(text.rsvpMessageLabel, 80),
      rsvpSubmitLabel: clip(text.rsvpSubmitLabel, 40),
    },
    theme: {
      colors: normalizeColors(theme.colors, errors),
    },
    scratch: {
      enabled: scratch.enabled !== false,
      cards: normalizeScratchCards(scratch.cards, errors),
      completionText: clip(scratch.completionText || text.scratchCompletionText, 120),
    },
    events: normalizeEvents(source.events, errors),
    location: {
      venue: clip(location.venue, 120),
      address: clip(location.address, 200),
      mapsUrl: clip(location.mapsUrl, 500),
    },
    journey: {
      enabled: journey.enabled !== false,
      title: clip(journey.title, 80),
      subtitle: clip(journey.subtitle, 80),
      text: clip(journey.text, 1200),
      origin: clip(journey.origin, 80),
      destination: clip(journey.destination, 80),
      departLine: clip(journey.departLine, 160),
      seatNote: clip(journey.seatNote, 160),
      meetHeading: clip(journey.meetHeading, 80),
      meetLine: clip(journey.meetLine, 160),
      stopNote: clip(journey.stopNote, 160),
      arrivalHeading: clip(journey.arrivalHeading, 80),
      arrivalLine: clip(journey.arrivalLine, 160),
      extraNote: clip(journey.extraNote, 160),
      mapsUrl: clip(journey.mapsUrl, 500),
      imageUrl: clip(journey.imageUrl, 500),
    },
    media: {
      heroImageUrl: clip(media.heroImageUrl, 500),
      gallery: normalizeGallery(media.gallery, errors),
      musicUrl: clip(media.musicUrl, 500),
    },
    rsvp: {
      enabled: rsvp.enabled !== false,
      deadline: clip(rsvp.deadline, 10),
      attendanceOptions: normalizeAttendance(rsvp.attendanceOptions),
    },
    language: "en",
  };

  if (content.weddingDateTime.date && !DATE_RE.test(content.weddingDateTime.date)) {
    errors.push("Wedding date must be YYYY-MM-DD.");
  }
  if (content.weddingDateTime.startTime && !TIME_RE.test(content.weddingDateTime.startTime)) {
    errors.push("Wedding time must be HH:MM.");
  }
  if (content.rsvp.deadline && !DATE_RE.test(content.rsvp.deadline)) {
    errors.push("RSVP deadline must be YYYY-MM-DD.");
  }

  [
    ["Location map URL", content.location.mapsUrl],
    ["Journey map URL", content.journey.mapsUrl],
    ["Journey image", content.journey.imageUrl],
    ["Hero image", content.media.heroImageUrl],
    ["Music", content.media.musicUrl],
  ].forEach(([label, value]) => {
    if (value && !isSafePathOrUrl(value)) errors.push(`${label} must be an http(s) URL or site path.`);
  });

  return { content, errors };
}

function normalizeColors(input, errors) {
  const list = Array.isArray(input) ? input : [];
  const colors = list
    .map((color) => String(color || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  colors.forEach((color) => {
    if (!HEX_RE.test(color)) errors.push(`Theme color ${color} is not a valid hex value.`);
  });

  if (!colors.length) colors.push("#5a6b5c");
  return colors;
}

function normalizeEventColors(input, errors) {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((color) => String(color || "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .filter((color) => {
      if (HEX_RE.test(color)) return true;
      errors.push(`Event color ${color} is not a valid hex value.`);
      return false;
    });
}

function normalizeScratchCards(input, errors) {
  const list = Array.isArray(input) ? input : [];
  const cards = list.slice(0, 6).map((card, index) => {
    const item = card && typeof card === "object" ? card : {};
    return {
      id: clip(item.id, 40, shortId("card")) || shortId("card"),
      hiddenText: clip(item.hiddenText, 24, String(index + 1).padStart(2, "0")),
      revealText: clip(item.revealText, 40),
    };
  });
  if (!cards.length) errors.push("Add at least one scratch card, or disable the scratch section.");
  return cards;
}

function normalizeEvents(input, errors) {
  const list = Array.isArray(input) ? input : [];
  return list.slice(0, 8).map((event) => {
    const item = event && typeof event === "object" ? event : {};
    const mapsUrl = clip(item.mapsUrl, 500);
    if (mapsUrl && !isHttpUrl(mapsUrl)) {
      errors.push(`Event map URL is not valid: ${mapsUrl}`);
    }
    if (item.date && !DATE_RE.test(String(item.date))) errors.push("Event dates must be YYYY-MM-DD.");
    if (item.startTime && !TIME_RE.test(String(item.startTime))) errors.push("Event start times must be HH:MM.");
    if (item.endTime && !TIME_RE.test(String(item.endTime))) errors.push("Event end times must be HH:MM.");
    return {
      id: clip(item.id, 40, shortId("evt")) || shortId("evt"),
      type: clip(item.type, 40, "event"),
      title: clip(item.title, 80),
      kicker: clip(item.kicker, 80),
      venue: clip(item.venue, 120),
      address: clip(item.address, 200),
      date: clip(item.date, 10),
      startTime: clip(item.startTime, 5),
      endTime: clip(item.endTime, 5),
      mapsUrl: mapsUrl && isHttpUrl(mapsUrl) ? mapsUrl : "",
      description: clip(item.description, 600),
      colors: normalizeEventColors(item.colors, errors),
    };
  });
}

function normalizeGallery(input, errors) {
  const list = Array.isArray(input) ? input : [];
  return list.slice(0, 12).map((entry) => {
    const url = typeof entry === "string" ? entry : entry && entry.url;
    const value = clip(url, 500);
    if (value && !isSafePathOrUrl(value)) errors.push("Gallery images must be http(s) URLs or site paths.");
    return value;
  }).filter(Boolean);
}

function normalizeAttendance(input) {
  const allowed = new Set(["yes", "no", "maybe"]);
  const list = Array.isArray(input) ? input : ["yes", "no"];
  const options = list.map((item) => String(item).toLowerCase()).filter((item) => allowed.has(item));
  return options.length ? Array.from(new Set(options)) : ["yes", "no"];
}


function sanitizeRsvpInput(body) {
  const errors = [];
  const guestName = clip(body && body.guestName, 80);
  const attending = String(body && body.attending || "").toLowerCase();
  const message = clip(body && body.message, 1000);
  const allowed = new Set(["yes", "no", "maybe"]);

  if (!guestName) errors.push("Please enter your name.");
  if (!allowed.has(attending)) errors.push("Please choose whether you can attend.");

  return {
    errors,
    rsvp: { guestName, attending, message },
  };
}

module.exports = {
  EMAIL_RE,
  sanitizeContent,
  sanitizeRsvpInput,
  normalizeEmail,
  isHttpUrl,
  isSafePathOrUrl,
};

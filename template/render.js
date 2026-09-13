(() => {
  "use strict";

  const { escapeHtml, safeUrl, formatDate, formatShortDate, formatTime, chrome } = window.InviteLib;

  window.InvitationTemplates.register("swan-reverie-01", {
    id: "swan-reverie-01",
    version: "1.0.0",
    render(root, invitation, options) {
      const content = invitation.content || {};
      const couple = content.couple || {};
      const text = content.text || {};
      const wedding = content.weddingDateTime || {};
      const language = options.language || content.language || "en";
      const ui = chrome[language] || chrome.en;
      const embedded = Boolean(options.embedded);
      const storedHero = safeUrl(content.media && content.media.heroImageUrl);
      const heroSrc = (!storedHero || /hero-archway/i.test(storedHero)) ? "/assets/hero-lake.jpg" : storedHero;
      const musicSrc = safeUrl(content.media && content.media.musicUrl);
      const journey = content.journey || {};
      const scratch = content.scratch || { cards: [] };
      const events = Array.isArray(content.events) ? content.events : [];
      const rsvp = content.rsvp || {};
      const location = content.location || {};
      const completion = scratch.completionText || text.scratchCompletionText || "We're getting married!";
      const mapsLabel = text.mapsButtonLabel || ui.maps;

      const cardsHtml = (scratch.cards || []).map((card, index) => `
        ${index ? '<div class="seal-sep" aria-hidden="true"></div>' : ""}
        <div class="seal">
          <span class="seal-value ${String(card.revealText || "").length > 4 ? "seal-value--sm" : ""}">${escapeHtml(card.revealText)}</span>
          <canvas class="seal-canvas" data-card-id="${escapeHtml(card.id)}" data-hidden="${escapeHtml(card.hiddenText)}" tabindex="0" aria-label="${escapeHtml(text.scratchPrompt || "Scratch to reveal")}"></canvas>
        </div>
      `).join("");

      const eventsHtml = events.map((event) => {
        const maps = safeUrl(event.mapsUrl);
        const palette = (Array.isArray(event.colors) && event.colors.length
          ? event.colors
          : (content.theme && content.theme.colors) || ["#c4a574", "#b88790", "#f7f0e8"]
        ).slice(0, 3);
        const dots = palette.map((color) => {
          const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : "#f7f0e8";
          return `<span class="event-dot" style="background:${hex}"></span>`;
        }).join("");
        const timeLine = [formatTime(event.startTime), formatTime(event.endTime)].filter(Boolean).join(" – ");
        const placeLines = [event.venue, event.address].filter(Boolean);
        const uniquePlaces = placeLines.filter((line, index) => placeLines.indexOf(line) === index);
        return `
          <li class="event-card">
            <h3 class="event-title reveal">${escapeHtml(event.title)}</h3>
            ${event.date ? `<p class="event-date reveal">${escapeHtml(formatShortDate(event.date))}</p>` : ""}
            ${event.kicker ? `<p class="event-theme reveal">${escapeHtml(event.kicker)}</p>` : ""}
            ${dots ? `<div class="event-dots reveal">${dots}</div>` : ""}
            ${timeLine ? `<p class="event-time reveal">${escapeHtml(timeLine)}</p>` : ""}
            ${uniquePlaces.map((line) => `<p class="event-place reveal">${escapeHtml(line)}</p>`).join("")}
            ${maps ? `<div class="event-actions">
              <a class="maps-btn" href="${escapeHtml(maps)}" target="_blank" rel="noopener noreferrer">
                <svg class="maps-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z"/></svg>
                ${escapeHtml(mapsLabel)}
              </a>
            </div>` : ""}
          </li>
        `;
      }).join("");

      const attendance = (rsvp.attendanceOptions || ["yes", "no"]).map((option) => {
        const label = option === "yes" ? ui.attending : option === "no" ? ui.notAttending : ui.maybe;
        return `<label class="check"><input type="radio" name="attending" value="${escapeHtml(option)}" required> ${escapeHtml(label)}</label>`;
      }).join("");

      const journeyEnabled = journey.enabled !== false && (
        journey.title || journey.subtitle || journey.departLine ||
        journey.meetHeading || journey.arrivalHeading || journey.mapsUrl ||
        journey.seatNote || journey.extraNote
      );
      const rsvpEnabled = rsvp.enabled !== false;
      const scratchEnabled = scratch.enabled !== false && (scratch.cards || []).length;

      root.innerHTML = `
        ${embedded ? "" : `
        <div class="gate-stage swan-gate-stage" id="gateStage">
          <div class="gatefold swan-gatefold" id="gatefold" role="dialog" aria-modal="true" aria-label="Closed wedding invitation">
            <div class="gate gate--left door-left">
              <div class="gate-panel gate-panel--left" aria-hidden="true"></div>
            </div>
            <div class="gate gate--right door-right">
              <div class="gate-panel gate-panel--right" aria-hidden="true"></div>
              <button class="seal-btn swan-gate-seal" id="openInvite" type="button" aria-label="${escapeHtml(ui.openSeal)}">
                <img class="seal-img" src="/assets/pearl-seal.svg" alt="" width="220" height="220" draggable="false" hidden>
              </button>
            </div>
          </div>
          <div class="gate-smoke" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
        </div>`}

        <div class="page invite-container swan-sheet" id="page">
          <div class="invite-controls" id="inviteControls">
            <button type="button" class="ctrl-btn" data-control="contrast" aria-label="${escapeHtml(ui.contrast)}" title="${escapeHtml(ui.contrast)}">
              <span></span>
            </button>
            <button type="button" class="ctrl-btn" data-control="type" aria-label="${escapeHtml(ui.typeSize)}" title="${escapeHtml(ui.typeSize)}">A</button>
          </div>
          <a class="scroll-down" id="scrollCue" href="#intro">${escapeHtml(text.scrollLabel || "Scroll down")} <span aria-hidden="true">↓</span></a>

          <header class="hero hero--lake" id="hero">
            <div class="hero-art">
              <img src="${escapeHtml(heroSrc)}" alt="" width="1080" height="1920">
            </div>
            <div class="petal-drift" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="hero-copy">
              <p class="eyebrow hero-line">${escapeHtml(text.heroLabel)}</p>
              <h1 class="couple hero-line">
                <span class="name">${escapeHtml(couple.brideName)}</span>
                <span class="amp" aria-hidden="true">&amp;</span>
                <span class="name">${escapeHtml(couple.groomName)}</span>
              </h1>
              <span class="hero-rule hero-line" aria-hidden="true"></span>
              <p class="hero-meta hero-line">${escapeHtml(formatDate(wedding.date, language))}</p>
              <p class="hero-meta hero-line">${escapeHtml(text.heroLocation || location.address || location.venue)}</p>
            </div>
          </header>

          <main class="pages-main">
            <section class="linen-section intro" id="intro" aria-labelledby="intro-heading">
              <div class="deco-layer" aria-hidden="true">
                <img class="deco deco-pearls" src="/assets/deco-pearls.png" alt="" draggable="false">
                <img class="deco deco-lotus" src="/assets/deco-lotus.png" alt="" draggable="false">
                <img class="deco deco-swans-nest" src="/assets/deco-swans-nest.png" alt="" draggable="false">
              </div>
              <div class="section-inner">
                <p class="together reveal" id="intro-heading">${escapeHtml(text.introHeading)}</p>
                <p class="intro-body reveal">${escapeHtml(text.introBody)}</p>
                <div class="families reveal">
                  <div class="family">
                    <p class="family-label">${escapeHtml(text.familyLabel)}</p>
                    <p class="family-name">${escapeHtml(couple.brideName)}</p>
                  </div>
                  <span class="family-rule" aria-hidden="true"></span>
                  <div class="family">
                    <p class="family-label">${escapeHtml(text.familyLabel)}</p>
                    <p class="family-name">${escapeHtml(couple.groomName)}</p>
                  </div>
                </div>
              </div>
            </section>

            <section class="linen-section when" id="when">
              <div class="deco-layer" aria-hidden="true">
                <img class="deco deco-wreath" src="/assets/deco-wreath.png" alt="" draggable="false">
              </div>
              <div class="section-inner">
                <h2 class="script-head reveal">${escapeHtml(text.saveTheDateHeading)}</h2>
                <p class="section-lead reveal">${escapeHtml(text.saveTheDateBody)}</p>
                <div class="countdown reveal" id="countdown" aria-live="polite">
                  <div class="count-cell"><span class="count-num" data-count="days">00</span><span class="count-lbl">${escapeHtml(ui.days)}</span></div>
                  <div class="count-cell"><span class="count-num" data-count="hours">00</span><span class="count-lbl">${escapeHtml(ui.hours)}</span></div>
                  <div class="count-cell"><span class="count-num" data-count="mins">00</span><span class="count-lbl">${escapeHtml(ui.minutes)}</span></div>
                </div>
                ${scratchEnabled ? `
                  <div class="when-scratch">
                    <p class="scratch-lead reveal">${escapeHtml(text.scratchPrompt)}</p>
                    <div class="seals" id="seals">${cardsHtml}</div>
                    <p class="married-badge" id="marriedBadge" hidden aria-live="polite">${escapeHtml(completion)}</p>
                  </div>
                ` : ""}
              </div>
            </section>

            <section class="linen-section events" id="events">
              <div class="deco-layer" aria-hidden="true">
                <img class="deco deco-blossom" src="/assets/deco-blossom.png" alt="" draggable="false">
              </div>
              <div class="section-inner">
                <ul class="event-list">${eventsHtml || `<li class="event-card"><p class="event-theme">Details to follow.</p></li>`}</ul>
              </div>
            </section>

            ${journeyEnabled ? `
            <section class="linen-section journey" id="journey">
              <div class="deco-layer" aria-hidden="true">
                <img class="deco deco-wisteria" src="/assets/deco-wisteria.png" alt="" draggable="false">
              </div>
              <div class="section-inner">
                <div class="journey-sheet">
                  <h2 class="script-head journey-title reveal">${escapeHtml(journey.title || "The Journey Up")}</h2>
                  ${journey.subtitle ? `<p class="journey-sub reveal">${escapeHtml(journey.subtitle)}</p>` : ""}
                  ${journey.departLine ? `<p class="journey-caps reveal">${escapeHtml(journey.departLine)}</p>` : ""}
                  ${journey.seatNote ? `<p class="journey-caps reveal">${escapeHtml(journey.seatNote)}</p>` : ""}
                  ${journey.meetHeading ? `<h3 class="journey-scene reveal">${escapeHtml(journey.meetHeading)}</h3>` : ""}
                  ${journey.meetLine ? `<p class="journey-caps reveal">${escapeHtml(journey.meetLine)}</p>` : ""}
                  ${journey.stopNote ? `<p class="journey-caps reveal">${escapeHtml(journey.stopNote)}</p>` : ""}
                  ${journey.arrivalHeading ? `<h3 class="journey-scene reveal">${escapeHtml(journey.arrivalHeading)}</h3>` : ""}
                  ${journey.arrivalLine ? `<p class="journey-caps reveal">${escapeHtml(journey.arrivalLine)}</p>` : ""}
                  ${journey.extraNote ? `<p class="journey-caps reveal">${escapeHtml(journey.extraNote)}</p>` : ""}
                  ${safeUrl(journey.mapsUrl) ? `<a class="journey-maps reveal" href="${escapeHtml(safeUrl(journey.mapsUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(mapsLabel)}</a>` : ""}
                </div>
              </div>
            </section>` : ""}

            ${rsvpEnabled ? `
            <section class="linen-section rsvp" id="rsvp">
              <div class="deco-layer" aria-hidden="true">
                <img class="deco deco-cosmos" src="/assets/deco-cosmos.png" alt="" draggable="false">
              </div>
              <div class="section-inner">
                <h2 class="script-head reveal">${escapeHtml(text.rsvpHeading)}</h2>
                <p class="section-lead reveal">${escapeHtml(text.rsvpBody)}</p>
                ${rsvp.deadline ? `<p class="rsvp-deadline reveal">Kindly reply by ${escapeHtml(formatDate(rsvp.deadline, language))}</p>` : ""}
                <form class="rsvp-form" id="rsvpForm">
                  <label class="field"><span>${escapeHtml(text.rsvpNameLabel)}</span><input name="guestName" type="text" maxlength="80" required autocomplete="name"></label>
                  <fieldset class="field field--checks"><legend>Will you attend?</legend>${attendance}</fieldset>
                  <label class="field"><span>${escapeHtml(text.rsvpMessageLabel)}</span><textarea name="message" maxlength="1000"></textarea></label>
                  <p class="form-error" id="rsvpError" hidden></p>
                  <button class="submit-btn" type="submit">${escapeHtml(text.rsvpSubmitLabel)}</button>
                </form>
                <div class="rsvp-thanks" id="rsvpThanks" hidden>
                  <p class="script-head">${escapeHtml(ui.thanks)}</p>
                </div>
              </div>
            </section>` : ""}

            <section class="scene-section closing" id="closing">
              <img class="scene-bg" src="/assets/closing-linen.jpg" alt="" width="1080" height="1920" draggable="false">
              <div class="section-inner">
                <p class="closing-text reveal">${escapeHtml(text.closingText)}</p>
                <p class="closing-names reveal">${escapeHtml(couple.brideName)} &amp; ${escapeHtml(couple.groomName)}</p>
                <img class="closing-swans reveal" src="/assets/deco-swans-heart.png" alt="" draggable="false">
              </div>
            </section>
          </main>
        </div>

        ${musicSrc ? `<audio id="bgMusic" src="${escapeHtml(musicSrc)}" loop preload="auto"></audio>
        <button type="button" class="music-toggle${embedded ? "" : " is-paused"}" id="musicToggle" aria-label="${embedded ? "Pause music" : "Play music"}" ${embedded ? "" : "hidden"}>
          <svg class="music-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            <path class="music-slash" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M4.2 4.2l15.6 15.6"/>
          </svg>
        </button>` : ""}
      `;
    },
  });
})();

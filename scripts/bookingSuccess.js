(function () {
  // Optionally load Font Awesome if not already present
  function loadFontAwesome() {
    if (!document.querySelector('link[href*="font-awesome"],link[href*="fontawesome"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  }

  function getQueryParams(url) {
    let params = {};
    let parser = document.createElement('a');
    parser.href = url;
    let query = parser.search.substring(1);
    let vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
      let pair = vars[i].split('=');
      let key = decodeURIComponent(pair[0]);
      let val = decodeURIComponent(pair[1] || '');
      if (params[key] !== undefined) {
        if (!Array.isArray(params[key])) params[key] = [params[key]];
        params[key].push(val);
      } else {
        params[key] = val;
      }
    }
    return params;
  }

  function renderDatesFlex(params) {
    let starts = Array.isArray(params.startTime) ? params.startTime : [params.startTime];
    let ends = Array.isArray(params.endTime) ? params.endTime : [params.endTime];
    if (starts[0] && starts[0].toLowerCase && starts[0].toLowerCase() === "dates") starts.shift();
    let html = `<div class="dates-label"><i class="fa-regular fa-calendar"></i> Dates</div>`;
    html += `<div class="booking-dates-list">`;
    html += starts.map((start, i) => {
      let end = ends[i] || "";
      let dateStr = '';
      if (start) {
        dateStr = new Date(start).toLocaleString();
        if (end) {
          let endStr = new Date(end).toLocaleTimeString();
          dateStr += ` - ${endStr}`;
        }
      }
      return dateStr
        ? `<div class="date-row"><span class="date-bullet"><i class="fa-solid fa-circle"></i></span><span class="date-time">${dateStr}</span></div>`
        : '';
    }).join('');
    html += `</div>`;
    return html;
  }

  function isWeeklyBooking(params) {
    return (params.type && /weekly/i.test(params.type)) ||
           (params.eventTypeSlug && /weekly/i.test(params.eventTypeSlug));
  }

  function createBookingBox(params, isGroup = false) {
    let attendee = params.attendeeName ? decodeURIComponent(params.attendeeName.replace(/\+/g, ' ')) : '';
    let host = params.hostName ? decodeURIComponent(params.hostName.replace(/\+/g, ' ')) : '';
    let email = params.email ? decodeURIComponent(params.email) : '';
    let sessionName = params.title ? decodeURIComponent(params.title.replace(/\+/g, ' ')) : '';
    let time = params.startTime ? new Date(Array.isArray(params.startTime) ? params.startTime[0] : params.startTime).toLocaleString() : '';
    let isFinalizing = isBlank(email);

    if (isFinalizing) {
      return `
        <div class="booking-success-box is-finalizing" style="border:4px solid #2E1443; border-radius: 0.75rem; padding:1em; margin-bottom:1em; background:#F9F7FB; box-shadow:0 2px 8px #0001; position:relative; min-height:220px;">
          <div class="finalizing-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;text-align:center;">
            <div class="paypal-spinner"></div>
            <div class="finalizing-text">Finalizing...</div>
          </div>
        </div>
      `;
    }

    // Title logic
    let isWeekly = isWeeklyBooking(params);
    let titleIcon = isWeekly ? '<i class="fa-solid fa-repeat" style="color:#5A189A;"></i>' : '<i class="fa-solid fa-check-circle" style="color:#2E1443;"></i>';
    let title;
    if (isWeekly) {
      title = `${titleIcon} Recurring Booking Successful!`;
    } else if (sessionName.startsWith("🎉")) {
      // Preserve original title if it starts with the emoji
      title = sessionName;
      sessionName = ""; // Don't show session name twice
    } else {
      title = `${titleIcon} Booking Successful!`;
    }

     let repeatMessage = '';
     if (isWeekly && (!Array.isArray(params.startTime) || params.startTime.length === 1)) {
       repeatMessage = `<div style="margin-top:.5em;"><b>This session is set to repeat weekly.</b></div>`;
     }

    // Render full details once required data (email) is available.
     return `
      <div class="booking-success-box" style="border:4px solid #2E1443; border-radius: 0.75rem; padding:1em;margin-bottom:1em;background:#F9F7FB;box-shadow:0 2px 8px #0001;position:relative;">
        <div class="booking-card-content">
          <div style="font-weight:bold;margin-bottom:.5em;font-size:1.2em;">${title}</div>
          ${sessionName ? `<div><strong><i class="fa-solid fa-graduation-cap"></i> Session:</strong> ${sessionName}</div>` : ""}
          ${time ? `<div><strong><i class="fa-regular fa-clock"></i> Time:</strong> ${time}</div>` : ''}
          ${attendee ? `<div><strong><i class="fa-solid fa-user"></i> Booked for:</strong> ${attendee}</div>` : ''}
          ${host ? `<div><strong><i class="fa-solid fa-chalkboard-user"></i> Host:</strong> ${host}</div>` : ''}
          <div style="margin-top:.5em;"><i class="fa-solid fa-envelope-open-text"></i> A booking pending email was sent to <strong>${email}</strong>.</div>
          <div style="margin-top:.25em;"><i class="fa-regular fa-clock"></i> A final confirmation email will be sent once the host confirms your session.</div>
          ${repeatMessage}
        </div>
      </div>
    `;
  }

  function renderBookings() {
    let container = document.getElementById('booking-success-list');
    if (!container) return;
    let bookings = [];
    try {
      bookings = JSON.parse(sessionStorage.getItem('bookingSuccessList') || '[]');
    } catch (e) {}
    container.innerHTML = '';
    if (bookings.length === 0) {
      container.innerHTML = '<em>No recent bookings to show.</em>';
    } else {
      for (let i = 0; i < bookings.length; i++) {
        let isGroup = bookings[i].isGroup || false;
        container.innerHTML += createBookingBox(bookings[i], isGroup);
        if (i < bookings.length - 1) {
          container.innerHTML += '<hr style="border:0;border-top:1px solid #eee;">';
        }
      }
      container.innerHTML += `<button id="clear-bookings-btn" style="margin-top:.5em;background:#2E1443;color:#fff;border:none;padding:.5em 1em;border-radius:3px;cursor:pointer;"><i class="fa-solid fa-trash"></i> Clear All</button>`;
      document.getElementById('clear-bookings-btn').onclick = async function () {
        const uids = bookings
          .map(function (b) { return (b && b.uid) ? String(b.uid).trim() : ''; })
          .filter(function (uid) { return !!uid; });

        // Clear local UI immediately for a seamless interaction.
        sessionStorage.removeItem('bookingSuccessList');
        renderBookings();

        // Then delete server-side copies in the background.
        const payload = JSON.stringify({ uids: uids });
        try {
          if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            const sent = navigator.sendBeacon('/.netlify/functions/delete-cal-bookings', blob);
            if (sent) return;
          }

          fetch('/.netlify/functions/delete-cal-bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(function () {});
        } catch (_err) {
          // Ignore background delete failures to keep UX instant.
        }
      };
    }
  }

  function isBlank(val) {
    return val == null || String(val).trim() === '';
  }

  function mergeIfMissing(base, incoming) {
    const merged = Object.assign({}, base || {});
    if (!incoming || typeof incoming !== 'object') return merged;

    const keys = ['email', 'attendeeName', 'hostName', 'title', 'startTime', 'endTime', 'description', 'type'];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (isBlank(merged[key]) && !isBlank(incoming[key])) {
        merged[key] = incoming[key];
      }
    }
    return merged;
  }

  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function fetchBookingFromWebhook(uid) {
    if (!uid) return null;
    try {
      const res = await fetch(`/.netlify/functions/get-cal-booking?uid=${encodeURIComponent(uid)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!res.ok) return null;
      const json = await res.json();
      return json && json.found && json.booking ? json.booking : null;
    } catch (_err) {
      return null;
    }
  }

  async function enrichFromWebhook(params) {
    if (!params || !params.uid) return params;

    // Poll briefly to account for webhook delivery delay.
    for (let attempt = 0; attempt < 8; attempt++) {
      const booking = await fetchBookingFromWebhook(params.uid);
      if (booking) {
        params = mergeIfMissing(params, booking);
      }

       const needsEmail = isBlank(params.email);
       if (!needsEmail) {
         return params;
       }

      await delay(1000);
    }

    return params;
  }

  async function enrichStoredBookingByUid(uid) {
    if (!uid) return;

    let bookings = [];
    try {
      bookings = JSON.parse(sessionStorage.getItem('bookingSuccessList') || '[]');
    } catch (e) {}

    const idx = bookings.findIndex(b => b.uid === uid);
    if (idx < 0) return;

    const enriched = await enrichFromWebhook(bookings[idx]);
    bookings[idx] = mergeIfMissing(bookings[idx], enriched);
    sessionStorage.setItem('bookingSuccessList', JSON.stringify(bookings));
    renderBookings();
  }

  function maybeStoreBooking() {
    const successPages = new Set([
      '/pages/success',
      '/pages/success/',
      '/pages/success.html',
      '/pages/subscribed',
      '/pages/subscribed/',
      '/pages/subscribed.html',
      '/pages/success-weekly',
      '/pages/success-weekly/',
      '/pages/success-weekly.html',
    ]);
    const path = String(window.location.pathname || '').toLowerCase();
    if (!successPages.has(path)) return;
    const params = getQueryParams(window.location.href);

    const normalizedSlug = String(params.eventTypeSlug || '').toLowerCase();
    const normalizedType = String(params.type || '').toLowerCase();
    const isSupportedEventType = /(?:^|\/)weekly-(?:60|90|120)-min$/.test(normalizedSlug)
      || /(?:^|\/)prepaid-(?:60|90|120)-min$/.test(normalizedSlug)
      || normalizedType.includes('weekly')
      || normalizedType.includes('prepaid');

    const isRelevant = params.isSuccessBookingPage === 'true'
      || isSupportedEventType;

    if (!isRelevant) return;

    let bookings = [];
    try {
      bookings = JSON.parse(sessionStorage.getItem('bookingSuccessList') || '[]');
    } catch (e) {}

    const existingIdx = params.uid ? bookings.findIndex(b => b.uid === params.uid) : -1;
    if (existingIdx >= 0) {
      bookings[existingIdx] = mergeIfMissing(bookings[existingIdx], params);
      sessionStorage.setItem('bookingSuccessList', JSON.stringify(bookings));
      if (params.uid) {
        enrichStoredBookingByUid(params.uid);
      }
      return;
    }

    if (path === '/pages/subscribed' && Array.isArray(params.startTime) && params.startTime.length > 1) {
      if (!params.uid || !bookings.find(b => b.uid === params.uid)) {
        params.isGroup = true;
        bookings.push(params);
      }
    } else {
      if (!params.uid || !bookings.find(b => b.uid === params.uid)) {
        params.isGroup = false;
        bookings.push(params);
      }
    }
    sessionStorage.setItem('bookingSuccessList', JSON.stringify(bookings));

    if (params.uid) {
      enrichStoredBookingByUid(params.uid);
    }
  }

  function ensureContainer() {
    let container = document.getElementById('booking-success-list');
    if (!container) {
      container = document.createElement('div');
      container.id = 'booking-success-list';
      let main = document.querySelector('main') || document.body;
      main.insertBefore(container, main.firstChild);
    }
  }

  function waitForPreloaderUnlock(cb) {
    if (!document.documentElement.classList.contains('preloader-lock')) {
      cb();
    } else {
      const observer = new MutationObserver(() => {
        if (!document.documentElement.classList.contains('preloader-lock')) {
          observer.disconnect();
          cb();
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // Run everything
  loadFontAwesome();
  waitForPreloaderUnlock(function () {
    ensureContainer();
    maybeStoreBooking();
    renderBookings();
  });

  // Add styles for flex date rows, centering, and the Dates underline
  const style = document.createElement('style');
  style.innerHTML = `
    .paypal-spinner {
      width: 86px;
      height: 86px;
      border-radius: 50%;
      border: 8px solid #e5deef;
      border-top-color: #2E1443;
      animation: paypalSpin 0.85s linear infinite;
    }
    @keyframes paypalSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .finalizing-text {
      color: #2E1443;
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: 0.03em;
    }
    .finalizing-overlay {
      background: rgba(249, 247, 251, 0.97);
      border-radius: 0.55rem;
      z-index: 20;
    }
    .booking-success-box .dates-label {
      font-weight: bold;
      text-align: center;
      border-bottom: 1.5px solid #2E1443;
      margin: 0.5em auto 0.5em auto;
      display: block;
      padding-bottom: 3px;
      letter-spacing: .5px;
      width: 100%;
      max-width: 120px;
    }
    .booking-success-box .booking-dates-list {
      display: inline-block;
      text-align: left;
      margin: 0.5em 0 0.5em 0;
      padding: 0;
    }
    .booking-success-box .date-row {
      display: flex;
      align-items: center;
      gap: 0.5em;
      font-family: inherit;
      font-size: 1em;
    }
    .booking-success-box .date-bullet {
      display: inline-block;
      width: 1.2em;
      text-align: right;
      font-size: 1.1em;
      color: #5A189A;
    }
    .booking-success-box .date-time {
      display: inline-block;
    }
    .booking-success-box {
      text-align: center;
      font-family: inherit;
    }
    .booking-success-box i.fa-solid,
    .booking-success-box i.fa-regular {
      margin-right: 3px;
      vertical-align: middle;
    }
    .booking-success-box button#clear-bookings-btn i.fa-solid {
      margin-right: 5px;
    }
  `;
  document.head.appendChild(style);
})();
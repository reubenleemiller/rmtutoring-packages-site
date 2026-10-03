(function () {
  "use strict";

  const CAL_ORIGIN = "https://app.cal.com";
  const STORAGE_KEY = "lastCalLink";
  const RETURN_PAGE_KEY = "lastCalReturnPage";
  const DETAILS_STORAGE_KEY = "lastCalBookingDetails";

  const WEEKLY_SLUGS = new Set([
    "rleemiller/weekly-60-min",
    "rleemiller/weekly-90-min",
    "rleemiller/weekly-120-min",
  ]);

  const PREPAID_SLUGS = new Set([
    "rleemiller/prepaid-60-min",
    "rleemiller/prepaid-90-min",
    "rleemiller/prepaid-120-min",
  ]);

  function setLastSlug(slug) {
    if (typeof slug === "string" && slug.trim()) {
      sessionStorage.setItem(STORAGE_KEY, slug.trim());
    }
  }

  function setCachedDetails(details) {
    if (!details || typeof details !== "object") return;
    const existing = getCachedDetails();
    const merged = {
      email: pickFirst(details.email, existing.email),
    };
    sessionStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(merged));
  }

  function getCachedDetails() {
    try {
      const raw = sessionStorage.getItem(DETAILS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function clearCachedDetails() {
    try {
      sessionStorage.removeItem(DETAILS_STORAGE_KEY);
    } catch (_err) {
      // Ignore storage errors.
    }
  }

  function getLastSlug() {
    return sessionStorage.getItem(STORAGE_KEY) || "";
  }

  function setLastReturnPage(pathname) {
    const path = String(pathname || "").toLowerCase();
    if (path.indexOf("/pages/subscribed") !== -1) {
      sessionStorage.setItem(RETURN_PAGE_KEY, "subscribed");
      return;
    }
    if (path.indexOf("/pages/success-weekly") !== -1) {
      sessionStorage.setItem(RETURN_PAGE_KEY, "success-weekly");
      return;
    }
    if (path.indexOf("/pages/success") !== -1) {
      sessionStorage.setItem(RETURN_PAGE_KEY, "success");
      return;
    }
    sessionStorage.removeItem(RETURN_PAGE_KEY);
  }

  function getLastReturnPage() {
    return sessionStorage.getItem(RETURN_PAGE_KEY) || "";
  }

  function isKnownSlug(slug) {
    return WEEKLY_SLUGS.has(slug) || PREPAID_SLUGS.has(slug);
  }

  function isWeeklySlug(slug) {
    return WEEKLY_SLUGS.has(slug);
  }

  // 1) Capture which Cal link the user clicked (this is the routing key)
  document.addEventListener("click", function (e) {
    const target = e && e.target && e.target.closest ? e.target.closest("[data-cal-link]") : null;
    if (!target) return;
    clearCachedDetails();
    setLastReturnPage(window.location.pathname);
    const slug = target.getAttribute("data-cal-link") || "";
    setLastSlug(slug);
  });

  function pick(val) {
    return val == null ? "" : String(val);
  }

  function pickFirst() {
    for (let i = 0; i < arguments.length; i++) {
      const val = arguments[i];
      if (val != null && String(val).trim() !== "") {
        return val;
      }
    }
    return "";
  }

  function getPath(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function extractLabeledValue(list, labelNeedle) {
    if (!Array.isArray(list)) return "";
    for (let i = 0; i < list.length; i++) {
      const row = list[i] || {};
      const label = pickFirst(row.label, row.name, row.key, row.field).toLowerCase();
      if (!label || !label.includes(labelNeedle)) continue;
      const val = pickFirst(row.value, row.answer, row.text, row.email, row.name);
      if (val) return val;
    }
    return "";
  }

  function parseNamesFromTitle(title) {
    const text = pick(title);
    if (!text) return { hostName: "", attendeeName: "" };

    const betweenIdx = text.toLowerCase().lastIndexOf(" between ");
    if (betweenIdx === -1) return { hostName: "", attendeeName: "" };

    const trailing = text.slice(betweenIdx + 9).trim();
    const parts = trailing.split(" and ");
    if (parts.length < 2) return { hostName: "", attendeeName: "" };

    return {
      hostName: parts[0].trim(),
      attendeeName: parts.slice(1).join(" and ").trim(),
    };
  }

  function extractCount(payload) {
    const direct = pickFirst(
      payload.count,
      payload.recurrenceCount,
      payload.recurringCount,
      payload.recurring?.count,
      payload.recurrence?.count,
      payload.booking?.count,
      payload.booking?.recurrenceCount,
      payload.booking?.recurringCount,
      payload.repeating?.count,
      payload.repeatedCount
    );

    if (direct) return direct;

    const rrule = pickFirst(
      payload.rrule,
      payload.recurrenceRule,
      payload.recurring?.rrule,
      payload.booking?.rrule
    );

    if (rrule) {
      const match = String(rrule).match(/COUNT=(\d+)/i);
      if (match && match[1]) return match[1];
    }

    return "";
  }

  function walkForValue(obj, predicate, seen) {
    if (obj == null) return "";
    if (!seen) seen = new Set();
    if (typeof obj === "object") {
      if (seen.has(obj)) return "";
      seen.add(obj);
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const found = walkForValue(obj[i], predicate, seen);
        if (found) return found;
      }
      return "";
    }

    if (typeof obj === "object") {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = obj[key];

        if (predicate(key, val)) {
          return val;
        }

        const found = walkForValue(val, predicate, seen);
        if (found) return found;
      }
    }

    return "";
  }

  function materializeObject(value, seen) {
    if (value == null || typeof value !== "object") return value;
    if (!seen) seen = new WeakSet();
    if (seen.has(value)) return "";
    seen.add(value);

    const out = Array.isArray(value) ? [] : {};
    const keys = Reflect.ownKeys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const outKey = typeof key === "symbol" ? String(key) : key;
      let v;
      try {
        v = value[key];
      } catch (_err) {
        continue;
      }
      out[outKey] = materializeObject(v, seen);
    }
    return out;
  }

  function findCalIframeSrc() {
    const visited = new Set();
    const queue = [document];

    while (queue.length > 0) {
      const root = queue.shift();
      if (!root || visited.has(root)) continue;
      visited.add(root);

      let iframes = [];
      try {
        iframes = root.querySelectorAll ? root.querySelectorAll('iframe[src*="app.cal.com"]') : [];
      } catch (_err) {
        iframes = [];
      }

      if (iframes && iframes.length > 0) {
        for (let i = 0; i < iframes.length; i++) {
          const frame = iframes[i];
          const src = frame && (frame.getAttribute("src") || frame.src);
          if (src && String(src).includes("app.cal.com")) return String(src);
        }
      }

      let elements = [];
      try {
        elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
      } catch (_err) {
        elements = [];
      }

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el && el.shadowRoot) queue.push(el.shadowRoot);
      }
    }

    return "";
  }

  function looksLikeEmail(value) {
    if (typeof value !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function deepExtractEmail(msg) {
    const emailFromText = extractEmailFromText(JSON.stringify(msg || {}));
    if (emailFromText) return emailFromText;

    const byKey = walkForValue(msg, function (key, val) {
      if (typeof key !== "string") return false;
      if (!key.toLowerCase().includes("email")) return false;

      const text = String(val || "");
      return !!extractEmailFromText(text);
    });
    if (byKey) {
      const found = extractEmailFromText(String(byKey));
      if (found) return found;
    }

    const byValue = walkForValue(msg, function (_key, val) {
      return !!extractEmailFromText(String(val || ""));
    });
    return extractEmailFromText(String(byValue || ""));
  }

  function extractEmailFromText(text) {
    if (typeof text !== "string") return "";
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match && match[0] ? match[0] : "";
  }

  function extractQueryParamFromUrl(value, key) {
    if (!value || !key) return "";
    const text = String(value);
    const regex = new RegExp("[?&]" + key.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "=([^&#]+)", "i");
    const match = text.match(regex);
    return match && match[1] ? decodeURIComponent(match[1]) : "";
  }

  function deepExtractRecurringCount(msg) {
    const serialized = JSON.stringify(msg || {});

    const keyMatch = serialized.match(/"(?:recurringEventCount|recurrenceCount|count|repeatCount)"\s*:\s*"?(\d+)"?/i);
    if (keyMatch && keyMatch[1]) return keyMatch[1];

    const queryMatch = serialized.match(/[?&](?:recurringEventCount|recurrenceCount|count)=([0-9]+)/i);
    if (queryMatch && queryMatch[1]) return queryMatch[1];

    const rruleMatch = serialized.match(/COUNT=(\d+)/i);
    if (rruleMatch && rruleMatch[1]) return rruleMatch[1];

    return "";
  }

  function readRecurringCountFromCalIframe() {
    const src = findCalIframeSrc();
    if (!src) return "";
    return extractQueryParamFromUrl(src, "recurringEventCount")
      || extractQueryParamFromUrl(src, "recurrenceCount")
      || extractQueryParamFromUrl(src, "count");
  }

  function readRecurringCountFromResourceEntries() {
    if (typeof performance === "undefined" || !performance.getEntriesByType) return "";
    const entries = performance.getEntriesByType("resource") || [];

    // Scan newest-first so we get the user's latest choice.
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const name = entry && entry.name ? String(entry.name) : "";
      if (!name || name.indexOf("app.cal.com") === -1 || name.indexOf("/embed") === -1 || name.indexOf("slot=") === -1) continue;

      const fromRecurring = extractQueryParamFromUrl(name, "recurringEventCount");
      if (fromRecurring) return fromRecurring;

      const fromRecurrence = extractQueryParamFromUrl(name, "recurrenceCount");
      if (fromRecurrence) return fromRecurrence;

      const fromCount = extractQueryParamFromUrl(name, "count");
      if (fromCount) return fromCount;
    }

    return "";
  }

  function parseCountFromCalUrl(url) {
    if (!url || String(url).indexOf("app.cal.com") === -1 || String(url).indexOf("slot=") === -1) return "";
    return extractQueryParamFromUrl(url, "recurringEventCount")
      || extractQueryParamFromUrl(url, "recurrenceCount")
      || extractQueryParamFromUrl(url, "count");
  }

  function maybeCacheCountFromCalUrl(url) {
    const count = parseCountFromCalUrl(url);
    if (count) {
      setCachedDetails({ count: count });
    }
  }

  function initResourceObserver() {
    if (typeof PerformanceObserver === "undefined") return;
    if (typeof performance === "undefined" || !performance.getEntriesByType) return;

    // Prime from any buffered entries first.
    const existing = performance.getEntriesByType("resource") || [];
    for (let i = 0; i < existing.length; i++) {
      const entry = existing[i];
      maybeCacheCountFromCalUrl(entry && entry.name);
    }

    try {
      const observer = new PerformanceObserver(function (list) {
        const entries = list.getEntries() || [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          maybeCacheCountFromCalUrl(entry && entry.name);
        }
      });
      observer.observe({ type: "resource", buffered: true });
    } catch (_err) {
      // Ignore observer failures in older browsers.
    }
  }

  function readEmailFromCalIframe() {
    const src = findCalIframeSrc();
    if (!src) return "";

    const byKnownParams = pickFirst(
      extractQueryParamFromUrl(src, "email"),
      extractQueryParamFromUrl(src, "attendeeEmail"),
      extractQueryParamFromUrl(src, "inviteeEmail"),
      extractQueryParamFromUrl(src, "userEmail")
    );
    if (byKnownParams) return byKnownParams;

    return extractEmailFromText(src);
  }

  function deepExtractCount(msg) {
    const recurringFromDeep = deepExtractRecurringCount(msg);
    if (recurringFromDeep) return recurringFromDeep;

    const byKey = walkForValue(msg, function (key, val) {
      const k = String(key || "").toLowerCase();
      if (!/(count|recurr|repeat)/.test(k)) return false;
      return /^\d+$/.test(String(val || "").trim());
    });
    if (byKey && /^\d+$/.test(String(byKey).trim())) return String(byKey).trim();

    const byRRule = walkForValue(msg, function (key, val) {
      const k = String(key || "").toLowerCase();
      return (k.includes("rrule") || k.includes("recurrence")) && typeof val === "string" && /COUNT=\d+/i.test(val);
    });

    if (typeof byRRule === "string") {
      const match = byRRule.match(/COUNT=(\d+)/i);
      if (match && match[1]) return match[1];
    }

    return "";
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function fetchBookingByUid(uid) {
    if (!uid) return null;
    try {
      const res = await fetch(`/.netlify/functions/get-cal-booking?uid=${encodeURIComponent(uid)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json && json.found && json.booking ? json.booking : null;
    } catch (_err) {
      return null;
    }
  }

  async function fetchBookingByUidWithRetry(uid) {
    if (!uid) return null;
    // Keep redirect snappy: try briefly, then continue with local data.
    for (let i = 0; i < 3; i++) {
      const booking = await fetchBookingByUid(uid);
      if (booking) return booking;
      await delay(300);
    }
    return null;
  }

  function buildRedirectUrl(calMsg, enrichedBooking) {
    const slug = getLastSlug();
    const weekly = isWeeklySlug(slug);
    const returnPage = getLastReturnPage();

    let base = weekly
      ? "https://packages.rmtutoringservices.com/pages/success-weekly"
      : "https://packages.rmtutoringservices.com/pages/success";

    if (returnPage === "subscribed") {
      base = "https://packages.rmtutoringservices.com/pages/subscribed";
    }

    const payload = (calMsg && calMsg.data) ? calMsg.data : {};
    const webhookBooking = (enrichedBooking && typeof enrichedBooking === "object") ? enrichedBooking : {};
    const attendee0 =
      Array.isArray(payload.attendees) && payload.attendees.length > 0
        ? payload.attendees[0]
        : null;

    const title = pickFirst(webhookBooking.title, payload.eventTitle, payload.title);
    const namesFromTitle = parseNamesFromTitle(title);

    const formResponses = pickFirst(
      payload.responses,
      payload.response,
      payload.formResponses,
      payload.bookingFieldsResponses,
      payload.booking?.responses,
      payload.booking?.bookingFieldsResponses
    );

    const email = pickFirst(
      webhookBooking.email,
      attendee0?.email,
      payload.email,
      payload.attendee?.email,
      payload.booking?.email,
      payload.responses?.email,
      payload.contact?.email,
      payload.metadata?.email,
      getPath(payload, "booking.attendee.email"),
      getPath(payload, "booking.contact.email"),
      extractLabeledValue(formResponses, "email")
    );

    const attendeeName = pickFirst(
      webhookBooking.attendeeName,
      attendee0?.name,
      payload.attendeeName,
      payload.attendee?.name,
      payload.booking?.attendeeName,
      payload.responses?.name,
      payload.contact?.name,
      getPath(payload, "booking.attendee.name"),
      extractLabeledValue(formResponses, "name"),
      namesFromTitle.attendeeName
    );

    const hostName = pickFirst(
      webhookBooking.hostName,
      payload?.organizer?.name,
      payload.hostName,
      payload.host?.name,
      payload.booking?.hostName,
      getPath(payload, "booking.organizer.name"),
      getPath(payload, "booking.host.name"),
      namesFromTitle.hostName
    );


    const qs = new URLSearchParams({
      isSuccessBookingPage: "true",
      eventTypeSlug: slug,

      // Optional "nice to have" booking detail fields for bookingSuccess.js:
      title: pick(title),
      startTime: pick(pickFirst(webhookBooking.startTime, payload.startTime)),
      endTime: pick(pickFirst(webhookBooking.endTime, payload.endTime)),
      uid: pick(pickFirst(webhookBooking.uid, payload.uid)),

      email: pick(email),
      attendeeName: pick(attendeeName),
      hostName: pick(hostName),
      description: pick(pickFirst(webhookBooking.description, payload.description || payload.additionalNotes)),
      type: pick(pickFirst(webhookBooking.type, payload.type || (weekly ? "weekly" : "prepaid"))),
    });

    return base + "?" + qs.toString();
  }

  // 2) Listen for Cal booking completion
  initResourceObserver();

  window.addEventListener("message", async function (event) {
    if (!event || event.origin !== CAL_ORIGIN) return;

    const rawMsg = event.data;
    const msg = materializeObject(rawMsg);
    if (!msg || msg.originator !== "CAL") return;

    // Harvest likely fields from any CAL message as fallback for bookingSuccessfulV2.
    setCachedDetails({
      email: pickFirst(deepExtractEmail(msg), deepExtractEmail(rawMsg), readEmailFromCalIframe()),
    });

    // Only redirect on booking completion message we observed:
    if (msg.type !== "bookingSuccessfulV2") return;

    // Only redirect if user clicked one of our supported slugs
    const slug = getLastSlug();
    if (!isKnownSlug(slug)) return;

    // Redirect immediately without waiting for webhook
    window.location.href = buildRedirectUrl(msg, null);
  });
})();

const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const BIN_ID = process.env.CAL_BOOKINGS_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET || "";

function getHeader(headers, name) {
  if (!headers) return "";
  const target = String(name || "").toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key.toLowerCase() === target) {
      return headers[key] || "";
    }
  }
  return "";
}

function getRawBody(event) {
  if (!event || !event.body) return "";
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return event.body;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text || "{}");
  } catch (_err) {
    return null;
  }
}

function verifySignature(rawBody, signatureHeader, secret) {
  if (!secret) return true;
  if (!signatureHeader) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody || "").digest("hex");
  const candidate = String(signatureHeader).replace(/^sha256=/i, "").trim();

  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(candidate, "utf8"));
  } catch (_err) {
    return false;
  }
}

function pickFirst() {
  for (let i = 0; i < arguments.length; i++) {
    const val = arguments[i];
    if (val != null && String(val).trim() !== "") return val;
  }
  return "";
}

function normalizeCountCandidates(list) {
  const input = Array.isArray(list) ? list : [];
  const seen = new Set();
  const out = [];
  for (let i = 0; i < input.length; i++) {
    const n = parseInt(String(input[i] || ""), 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    const key = String(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function resolveCountFromCandidates(list) {
  const vals = normalizeCountCandidates(list)
    .map((v) => parseInt(v, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!vals.length) return "";

  // Prefer the smallest valid count seen (avoids stale default 12 when real selection is lower).
  let best = vals[0];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] < best) best = vals[i];
  }
  return String(best);
}

function toInt(value) {
  const n = parseInt(String(value || ""), 10);
  return Number.isFinite(n) ? n : null;
}

function buildSeriesKey(data) {
  return [
    String(data && data.title || "").trim().toLowerCase(),
    String(data && data.attendeeName || "").trim().toLowerCase(),
    String(data && data.hostName || "").trim().toLowerCase(),
    String(data && data.type || "").trim().toLowerCase(),
  ].join("|");
}

function pickCount(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  for (let i = candidates.length - 1; i >= 0; i--) {
    const n = toInt(candidates[i]);
    if (n != null && n > 0) return String(n);
  }
  return "";
}

function countFromText(text) {
  if (!text) return "";
  const str = String(text);

  // Prefer recurring values from slot URLs (this reflects final user selection).
  const slotCandidates = [];
  const slotRegex = /https?:\/\/[^\s"']+/gi;
  let slotMatch;
  while ((slotMatch = slotRegex.exec(str)) !== null) {
    const url = slotMatch[0] || "";
    if (!url.includes("app.cal.com") || !url.includes("/embed") || !url.includes("slot=")) continue;
    const m = url.match(/[?&](?:recurringEventCount|recurrenceCount|repeatCount|count)=([0-9]+)/i);
    if (m && m[1]) slotCandidates.push(m[1]);
  }
  const preferred = pickCount(slotCandidates);
  if (preferred) return preferred;

  const queryCandidates = [];
  const queryRegex = /[?&](?:recurringEventCount|recurrenceCount|repeatCount|count)=([0-9]+)/gi;
  let q;
  while ((q = queryRegex.exec(str)) !== null) {
    if (q[1]) queryCandidates.push(q[1]);
  }
  const queryPick = pickCount(queryCandidates);
  if (queryPick) return queryPick;

  const keyCandidates = [];
  const keyRegex = /(?:recurringEventCount|recurrenceCount|repeatCount|count)"?\s*[:=]\s*"?(\d+)"?/gi;
  let k;
  while ((k = keyRegex.exec(str)) !== null) {
    if (k[1]) keyCandidates.push(k[1]);
  }
  const keyPick = pickCount(keyCandidates);
  if (keyPick) return keyPick;

  const rruleCandidates = [];
  const rruleRegex = /COUNT=(\d+)/gi;
  let r;
  while ((r = rruleRegex.exec(str)) !== null) {
    if (r[1]) rruleCandidates.push(r[1]);
  }
  const rrulePick = pickCount(rruleCandidates);
  if (rrulePick) return rrulePick;

  return "";
}

function deepFindCount(value, seen) {
  if (value == null) return "";

  const asText = countFromText(value);
  if (asText) return asText;

  if (typeof value !== "object") return "";
  if (!seen) seen = new WeakSet();
  if (seen.has(value)) return "";
  seen.add(value);

  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = value[key];

    if (/(count|recurr|repeat|rrule)/i.test(String(key))) {
      const direct = countFromText(val);
      if (direct) return direct;
    }

    const nested = deepFindCount(val, seen);
    if (nested) return nested;
  }

  return "";
}

function extractCount(payload) {
  const direct = pickFirst(
    payload.recurringEventCount,
    payload.recurrenceCount,
    payload.recurringCount,
    payload.count,
    payload.recurring?.count,
    payload.recurrence?.count,
    payload.booking?.recurringEventCount,
    payload.booking?.recurrenceCount,
    payload.booking?.count
  );
  if (direct) return String(direct);

  const rrule = pickFirst(payload.rrule, payload.booking?.rrule, payload.recurrenceRule);
  if (rrule) {
    const match = String(rrule).match(/COUNT=(\d+)/i);
    if (match && match[1]) return match[1];
  }

  return deepFindCount(payload);
}

function normalizePayload(obj, rawBody) {
  const top = obj || {};
  const payload = top.payload || top.data || top;

  const attendee0 = Array.isArray(payload.attendees) && payload.attendees[0] ? payload.attendees[0] : null;

  const uid = pickFirst(
    payload.uid,
    payload.bookingUid,
    payload.booking?.uid,
    payload.data?.uid
  );

  const email = pickFirst(
    attendee0?.email,
    payload.email,
    payload.attendee?.email,
    payload.booking?.email,
    payload.booking?.attendee?.email,
    payload.responses?.email,
    payload.contact?.email
  );

  const attendeeName = pickFirst(
    attendee0?.name,
    payload.attendeeName,
    payload.attendee?.name,
    payload.booking?.attendeeName,
    payload.booking?.attendee?.name
  );

  const hostName = pickFirst(
    payload.organizer?.name,
    payload.hostName,
    payload.host?.name,
    payload.booking?.hostName,
    payload.booking?.organizer?.name
  );

  return {
    uid: String(uid || ""),
    email: String(email || ""),
    attendeeName: String(attendeeName || ""),
    hostName: String(hostName || ""),
    title: String(pickFirst(payload.eventTitle, payload.title) || ""),
    startTime: String(pickFirst(payload.startTime, payload.booking?.startTime) || ""),
    endTime: String(pickFirst(payload.endTime, payload.booking?.endTime) || ""),
    description: String(pickFirst(payload.description, payload.additionalNotes) || ""),
    type: String(pickFirst(payload.type, payload.booking?.type) || ""),
    count: pickFirst(extractCount(payload), deepFindCount(top), countFromText(rawBody)),
    seriesKey: buildSeriesKey({
      title: pickFirst(payload.eventTitle, payload.title),
      attendeeName: attendeeName,
      hostName: hostName,
      type: pickFirst(payload.type, payload.booking?.type),
    }),
    sourceType: String(top.type || payload.type || ""),
    updatedAt: new Date().toISOString(),
  };
}

async function readStore() {
  if (!BIN_ID || !API_KEY) {
    throw new Error("Missing CAL_BOOKINGS_BIN_ID or JSONBIN_API_KEY");
  }

  const url = `https://api.jsonbin.io/v3/b/${BIN_ID}/latest`;
  const res = await fetch(url, {
    headers: {
      "X-Master-Key": API_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unable to read JSONBin: ${text}`);
  }

  const json = await res.json();
  const record = (json && json.record && typeof json.record === "object") ? json.record : {};
  if (!record.bookings || typeof record.bookings !== "object") {
    record.bookings = {};
  }
  return record;
}

async function writeStore(record) {
  const url = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": API_KEY,
    },
    body: JSON.stringify(record || { bookings: {} }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unable to update JSONBin: ${text}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const rawBody = getRawBody(event);
    const signature = pickFirst(
      getHeader(event.headers, "x-cal-signature-256"),
      getHeader(event.headers, "cal-signature-256")
    );

    const valid = verifySignature(rawBody, signature, WEBHOOK_SECRET);
    if (!valid) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid webhook signature" }) };
    }

    const parsed = safeParseJson(rawBody);
    if (!parsed) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
    }

    const normalized = normalizePayload(parsed, rawBody);
    if (!normalized.uid) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true, reason: "No uid in payload" }) };
    }

    const store = await readStore();
    const existing = store.bookings[normalized.uid] || {};

    const countCandidates = normalizeCountCandidates([
      ...(Array.isArray(existing.countCandidates) ? existing.countCandidates : []),
      existing.count,
      normalized.count,
    ]);
    const resolvedCount = resolveCountFromCandidates(countCandidates);

    store.bookings[normalized.uid] = {
      uid: normalized.uid,
      email: pickFirst(normalized.email, existing.email),
      attendeeName: pickFirst(normalized.attendeeName, existing.attendeeName),
      hostName: pickFirst(normalized.hostName, existing.hostName),
      title: pickFirst(normalized.title, existing.title),
      startTime: pickFirst(normalized.startTime, existing.startTime),
      endTime: pickFirst(normalized.endTime, existing.endTime),
      description: pickFirst(normalized.description, existing.description),
      type: pickFirst(normalized.type, existing.type),
      count: pickFirst(resolvedCount, normalized.count, existing.count),
      countCandidates: countCandidates,
      seriesKey: pickFirst(normalized.seriesKey, existing.seriesKey),
      sourceType: normalized.sourceType,
      updatedAt: normalized.updatedAt,
    };

    // Keep record size bounded by trimming oldest entries if needed.
    const ids = Object.keys(store.bookings);
    if (ids.length > 500) {
      ids.sort((a, b) => {
        const aTime = new Date(store.bookings[a].updatedAt || 0).getTime();
        const bTime = new Date(store.bookings[b].updatedAt || 0).getTime();
        return bTime - aTime;
      });
      const keep = new Set(ids.slice(0, 500));
      const next = {};
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (keep.has(id)) next[id] = store.bookings[id];
      }
      store.bookings = next;
    }

    await writeStore(store);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, uid: normalized.uid }),
    };
  } catch (err) {
    console.error("cal-webhook error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Server error" }),
    };
  }
};

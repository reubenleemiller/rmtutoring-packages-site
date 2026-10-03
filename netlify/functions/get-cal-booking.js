const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const BIN_ID = process.env.CAL_BOOKINGS_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

function pickFirst() {
  for (let i = 0; i < arguments.length; i++) {
    const val = arguments[i];
    if (val != null && String(val).trim() !== "") return val;
  }
  return "";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function buildSeriesKey(booking) {
  if (!booking || typeof booking !== "object") return "";
  if (booking.seriesKey) return String(booking.seriesKey);
  return [
    normalizeText(booking.title),
    normalizeText(booking.attendeeName),
    normalizeText(booking.hostName),
    normalizeText(booking.type),
  ].join("|");
}

function resolveCount(booking) {
  if (!booking || typeof booking !== "object") return "";
  const source = Array.isArray(booking.countCandidates)
    ? booking.countCandidates
    : [booking.count];

  let best = null;
  for (let i = 0; i < source.length; i++) {
    const n = parseInt(String(source[i] || ""), 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (best == null || n < best) best = n;
  }

  return best == null ? "" : String(best);
}

function toMs(value) {
  const t = new Date(String(value || "")).getTime();
  return Number.isFinite(t) ? t : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    if (!BIN_ID || !API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing CAL_BOOKINGS_BIN_ID or JSONBIN_API_KEY" }),
      };
    }

    const uid = pickFirst(
      event.queryStringParameters && event.queryStringParameters.uid,
      event.queryStringParameters && event.queryStringParameters.bookingUid
    );

    if (!uid) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing uid query parameter" }) };
    }

    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
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
    const bookings = (record.bookings && typeof record.bookings === "object") ? record.bookings : {};

    const booking = bookings[uid] || null;
    if (!booking) {
      return { statusCode: 200, body: JSON.stringify({ found: false, uid }) };
    }

    const resolvedCount = resolveCount(booking);
    if (resolvedCount) {
      booking.count = resolvedCount;
    }

    const seriesKey = buildSeriesKey(booking);
    let familyCount = 1;
    if (seriesKey) {
      familyCount = Object.keys(bookings).reduce((count, id) => {
        if (buildSeriesKey(bookings[id]) === seriesKey) return count + 1;
        return count;
      }, 0) || 1;
    }

    // Count only bookings created in the same immediate creation burst as this uid.
    // This avoids stale historical rows skewing recurrence count.
    const seedTime = toMs(booking.updatedAt);
    let derivedCount = familyCount;
    if (seriesKey && seedTime != null) {
      const WINDOW_MS = 2 * 60 * 1000;
      derivedCount = Object.keys(bookings).reduce((count, id) => {
        const row = bookings[id];
        if (buildSeriesKey(row) !== seriesKey) return count;
        const rowTime = toMs(row && row.updatedAt);
        if (rowTime == null) return count;
        if (Math.abs(rowTime - seedTime) <= WINDOW_MS) return count + 1;
        return count;
      }, 0) || 1;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ found: true, uid, booking, familyCount, derivedCount }),
    };
  } catch (err) {
    console.error("get-cal-booking error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Server error" }),
    };
  }
};

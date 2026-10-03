const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const BIN_ID = process.env.CAL_BOOKINGS_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeUidList(input) {
  const source = toArray(input);
  const dedup = new Set();
  for (let i = 0; i < source.length; i++) {
    const uid = String(source[i] || "").trim();
    if (uid) dedup.add(uid);
  }
  return Array.from(dedup);
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

function toMs(value) {
  const t = new Date(String(value || "")).getTime();
  return Number.isFinite(t) ? t : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    if (!BIN_ID || !API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing CAL_BOOKINGS_BIN_ID or JSONBIN_API_KEY" }),
      };
    }

    const parsed = JSON.parse(event.body || "{}");
    const uids = normalizeUidList(parsed.uids);

    if (uids.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, deleted: 0 }) };
    }

    const readRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": API_KEY,
      },
    });

    if (!readRes.ok) {
      const text = await readRes.text();
      throw new Error(`Unable to read JSONBin: ${text}`);
    }

    const readJson = await readRes.json();
    const record = (readJson && readJson.record && typeof readJson.record === "object") ? readJson.record : {};
    if (!record.bookings || typeof record.bookings !== "object") {
      record.bookings = {};
    }

    const toDelete = new Set();
    for (let i = 0; i < uids.length; i++) {
      const uid = uids[i];
      const seed = record.bookings[uid];
      if (!seed) continue;

      toDelete.add(uid);

      // Also remove sibling UIDs created in the same recurring booking burst.
      const seedSeries = buildSeriesKey(seed);
      const seedTime = toMs(seed.updatedAt);
      if (!seedSeries || seedTime == null) continue;

      const WINDOW_MS = 2 * 60 * 1000;
      const ids = Object.keys(record.bookings);
      for (let j = 0; j < ids.length; j++) {
        const id = ids[j];
        const row = record.bookings[id];
        if (buildSeriesKey(row) !== seedSeries) continue;
        const rowTime = toMs(row && row.updatedAt);
        if (rowTime == null) continue;
        if (Math.abs(rowTime - seedTime) <= WINDOW_MS) {
          toDelete.add(id);
        }
      }
    }

    let deleted = 0;
    const idsToDelete = Array.from(toDelete);
    for (let i = 0; i < idsToDelete.length; i++) {
      const id = idsToDelete[i];
      if (Object.prototype.hasOwnProperty.call(record.bookings, id)) {
        delete record.bookings[id];
        deleted += 1;
      }
    }

    const writeRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
      },
      body: JSON.stringify(record),
    });

    if (!writeRes.ok) {
      const text = await writeRes.text();
      throw new Error(`Unable to update JSONBin: ${text}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, requested: uids.length, deleted }),
    };
  } catch (err) {
    console.error("delete-cal-bookings error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Server error" }),
    };
  }
};

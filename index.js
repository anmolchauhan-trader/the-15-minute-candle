import { restClient } from '@massive.com/client-js';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.MASSIVE_APIKEY;
const rest = restClient(apiKey, 'https://api.massive.com');

const TICKER = 'C:EURUSD';
const TWO_HOURS = 2 * 60 * 60 * 1000;
const RR = 2; // target = 2x the first candle's range

const START_DATE = '2026-09-01';
const END_DATE = '2026-11-13';

const SESSIONS = {
  london:  { tz: 'Europe/London',    hour: 8, minute: 0 },
  newyork: { tz: 'America/New_York', hour: 9, minute: 30 },
};

// rate limit: pause after every N requests
let requestCount = 0;
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 61000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- timezone helpers ----------
function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function zonedToMs(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ms = guess - tzOffsetMs(guess, tz);
  ms = guess - tzOffsetMs(ms, tz); // re-check for DST edges
  return ms;
}

// ---------- data ----------
async function getBars(start, end) {
  try {
    const response = await rest.getForexAggregates({
      forexTicker: TICKER,
      multiplier: '15',
      timespan: 'minute',
      from: String(start),
      to: String(end),
      adjusted: 'true',
      sort: 'asc',
      limit: '120',
    });
    return response.results ?? [];
  } catch (e) {
    console.error('Fetch error:', e.message ?? e);
    return [];
  }
}

// ---------- strategy ----------
// returns null (skip), or { side, result } where result is success | failure | open | nobreakout
function testSession(bars, sessionStart) {
  if (bars.length < 2 || bars[0].t !== sessionStart) return null; // no data / first candle missing

  const first = bars[0];
  const range = first.h - first.l;

  for (let i = 1; i < bars.length; i++) {
    // breakout up -> long
    if (bars[i].c > first.h) {
      const target = first.h + RR * range;
      for (let j = i + 1; j < bars.length; j++) {
        if (bars[j].c < first.l) return { side: 'long', result: 'failure' };
        if (bars[j].c > target)  return { side: 'long', result: 'success' };
      }
      return { side: 'long', result: 'open' };
    }

    // breakout down -> short
    if (bars[i].c < first.l) {
      const target = first.l - RR * range;
      for (let j = i + 1; j < bars.length; j++) {
        if (bars[j].c > first.h) return { side: 'short', result: 'failure' };
        if (bars[j].c < target)  return { side: 'short', result: 'success' };
      }
      return { side: 'short', result: 'open' };
    }
  }
  return { side: 'none', result: 'nobreakout' };
}

// ---------- main ----------
async function main() {
  const stats = {};
  for (const s of Object.keys(SESSIONS)) {
    stats[s] = { success: 0, failure: 0, open: 0, nobreakout: 0, skipped: 0 };
  }

  const day = new Date(`${START_DATE}T00:00:00Z`);
  const last = new Date(`${END_DATE}T00:00:00Z`);

  for (; day <= last; day.setUTCDate(day.getUTCDate() + 1)) {
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();

    for (const [name, { tz, hour, minute }] of Object.entries(SESSIONS)) {
      const start = zonedToMs(y, m, d, hour, minute, tz);
      const bars = await getBars(start, start + TWO_HOURS - 1);

      const out = testSession(bars, start);
      if (!out) {
        stats[name].skipped++;
      } else {
        stats[name][out.result]++;
        console.log(day.toISOString().slice(0, 10), name, out.side, out.result);
      }

      // 10s pause after every 5 requests
      requestCount++;
      if (requestCount % BATCH_SIZE === 0) {
        console.log(`Made ${requestCount} requests, waiting 10s...`);
        await sleep(BATCH_PAUSE_MS);
      }
    }
  }

  for (const [name, s] of Object.entries(stats)) {
    const trades = s.success + s.failure;
    const winRate = trades ? ((s.success / trades) * 100).toFixed(1) : 'n/a';
    console.log(`\n${name}:`, s, `win rate: ${winRate}%`);
  }
}

main();
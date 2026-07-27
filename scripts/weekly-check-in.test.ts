import test from "node:test";
import assert from "node:assert/strict";

import { getCurrentWeeklyCheckInPeriod, isWeeklyCheckInPending } from "../lib/weight-utils";

test("Malaysia Friday remains in the previous Saturday cycle", () => {
  const period = getCurrentWeeklyCheckInPeriod(new Date("2026-07-24T15:59:59.000Z"));

  assert.equal(period.start.toISOString(), "2026-07-18T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-07-25T00:00:00.000Z");
});

test("Malaysia Saturday starts a new weekly cycle", () => {
  const period = getCurrentWeeklyCheckInPeriod(new Date("2026-07-24T16:00:00.000Z"));

  assert.equal(period.start.toISOString(), "2026-07-25T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-08-01T00:00:00.000Z");
});

test("weekly period always uses a Saturday-inclusive, next-Saturday-exclusive boundary", () => {
  const period = getCurrentWeeklyCheckInPeriod(new Date("2026-07-27T04:00:00.000Z"));

  assert.equal(period.start.getUTCDay(), 6);
  assert.equal(period.end.getUTCDay(), 6);
  assert.equal(period.end.getTime() - period.start.getTime(), 7 * 24 * 60 * 60 * 1000);
});

test("a Friday entry does not satisfy Saturday's new cycle", () => {
  const now = new Date("2026-07-25T02:00:00.000Z");
  const started = new Date("2026-07-01T12:00:00.000Z");

  assert.equal(
    isWeeklyCheckInPending(started, [new Date("2026-07-24T12:00:00.000Z")], now),
    true,
  );
  assert.equal(
    isWeeklyCheckInPending(started, [new Date("2026-07-25T12:00:00.000Z")], now),
    false,
  );
});

test("future challenge participants are excluded and mid-cycle starters are pending", () => {
  const now = new Date("2026-07-27T04:00:00.000Z");

  assert.equal(
    isWeeklyCheckInPending(new Date("2026-07-28T12:00:00.000Z"), [], now),
    false,
  );
  assert.equal(
    isWeeklyCheckInPending(new Date("2026-07-27T12:00:00.000Z"), [], now),
    true,
  );
});

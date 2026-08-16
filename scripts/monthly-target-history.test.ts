import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUserMonthlyTargetMap,
  getMonthlyLossTargetKgForPeriod,
} from "../lib/monthly-targets";
import { getRemainingMonthlyLossKg, getRequiredLossKg } from "../lib/weight-utils";

const userId = "participant-1";

test("a new target applies only from its effective month", () => {
  const targets = buildUserMonthlyTargetMap([
    { userId, year: 2026, month: 8, monthlyLossTargetKg: 1 },
  ]);

  assert.equal(getMonthlyLossTargetKgForPeriod(userId, 2, targets, { year: 2026, month: 7 }), 2);
  assert.equal(getMonthlyLossTargetKgForPeriod(userId, 2, targets, { year: 2026, month: 8 }), 1);
  assert.equal(getMonthlyLossTargetKgForPeriod(userId, 2, targets, { year: 2027, month: 1 }), 1);
});

test("multiple target changes resolve to the latest applicable change", () => {
  const targets = buildUserMonthlyTargetMap([
    { userId, year: 2027, month: 1, monthlyLossTargetKg: 1.5 },
    { userId, year: 2026, month: 8, monthlyLossTargetKg: 1 },
  ]);

  assert.equal(getMonthlyLossTargetKgForPeriod(userId, 2, targets, { year: 2026, month: 12 }), 1);
  assert.equal(getMonthlyLossTargetKgForPeriod(userId, 2, targets, { year: 2027, month: 1 }), 1.5);
});

test("historical penalties retain the old target while percentages use each month's base", () => {
  const targets = buildUserMonthlyTargetMap([
    { userId, year: 2026, month: 8, monthlyLossTargetKg: 1 },
  ]);
  const julyBase = getMonthlyLossTargetKgForPeriod(userId, 2, targets, { year: 2026, month: 7 });
  const augustBase = getMonthlyLossTargetKgForPeriod(userId, 2, targets, { year: 2026, month: 8 });

  assert.equal(getRequiredLossKg(julyBase, 100), 2);
  assert.equal(1.4 < getRequiredLossKg(julyBase, 100), true);
  assert.equal(getRequiredLossKg(augustBase, 75), 0.75);
});

test("monthly loss remaining includes weight gained during the month", () => {
  assert.equal(getRemainingMonthlyLossKg(-1, 2), 3);
  assert.equal(getRemainingMonthlyLossKg(0.5, 2), 1.5);
  assert.equal(getRemainingMonthlyLossKg(2.5, 2), 0);
});

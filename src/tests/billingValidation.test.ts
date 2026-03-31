import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBillingInterval,
  parseCheckoutMode,
  parsePlanKey,
  validateUsageRecord,
} from "../services/billingValidation";

test("parses checkout mode correctly", () => {
  assert.equal(parseCheckoutMode("subscription"), "subscription");
  assert.equal(parseCheckoutMode("one_time"), "one_time");
  assert.equal(parseCheckoutMode("other"), null);
});

test("parses interval and plan key safely", () => {
  assert.equal(parseBillingInterval("monthly"), "monthly");
  assert.equal(parseBillingInterval("yearly"), "yearly");
  assert.equal(parseBillingInterval("weekly"), null);

  assert.equal(parsePlanKey("starter"), "starter");
  assert.equal(parsePlanKey("pro"), "pro");
  assert.equal(parsePlanKey("enterprise"), "enterprise");
  assert.equal(parsePlanKey("unknown"), null);
});

test("validates usage payload", () => {
  assert.equal(validateUsageRecord(5, "event_123456"), null);
  assert.equal(
    validateUsageRecord(0, "event_123456"),
    "quantity must be a positive integer"
  );
  assert.equal(
    validateUsageRecord(5, "short"),
    "sourceEventId is required and must be unique"
  );
});

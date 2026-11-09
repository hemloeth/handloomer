import test from "node:test";
import assert from "node:assert/strict";
import { resolveCustomerOrderStatus } from "../lib/order-status.ts";

const paid = { status: "shipped", payment: { method: "prepaid", status: "paid" }, delivery: { status: "in_transit" } };

test("delivery labels", () => {
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "undelivered" } }).label, "Delivery Attempt Failed");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "rto_initiated" } }).label, "Return Initiated");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "rto_in_transit" } }).label, "Returning to Seller");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "rto_out_for_delivery" } }).label, "Return Out for Delivery");
  const r = resolveCustomerOrderStatus({ ...paid, delivery: { status: "rto_delivered" } });
  assert.equal(r.label, "Returned to Seller");
  assert.notEqual(r.label, "Delivered");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "delivered" } }).label, "Delivered");
});

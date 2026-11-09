import test from "node:test";
import assert from "node:assert/strict";
import { resolveCustomerOrderStatus, resolveOrderActions, resolveProductPreviews } from "../lib/order-status.ts";

const paid = { status: "shipped", payment: { method: "prepaid", status: "paid" }, delivery: { status: "in_transit" } };

test("delivery labels and all 14 canonical delivery statuses", () => {
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "pending" } }).label, "Order Confirmed");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "picked_up" } }).label, "Picked Up");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "shipped" } }).label, "Shipped");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "in_transit" } }).label, "In Transit");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "out_for_delivery" } }).label, "Out for Delivery");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "delivered" } }).label, "Delivered");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "undelivered" } }).label, "Delivery Attempt Failed");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "rto_initiated" } }).label, "Return Initiated");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "rto_in_transit" } }).label, "Returning to Seller");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "rto_out_for_delivery" } }).label, "Return Out for Delivery");
  const r = resolveCustomerOrderStatus({ ...paid, delivery: { status: "rto_delivered" } });
  assert.equal(r.label, "Returned to Seller");
  assert.notEqual(r.label, "Delivered");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "lost" } }).label, "Package Lost");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "damaged" } }).label, "Package Damaged");
  assert.equal(resolveCustomerOrderStatus({ ...paid, delivery: { status: "cancelled" } }).label, "Cancelled");
});

test("business precedence: cancellations and holds outrank canonical delivery", () => {
  // Cancellation requested outranks delivery.status
  const cancelReq = resolveCustomerOrderStatus({
    ...paid,
    cancellation: { status: "requested" },
    delivery: { status: "in_transit" },
  });
  assert.equal(cancelReq.key, "cancellation_pending");
  assert.equal(cancelReq.label, "Cancellation Pending");

  // Refund failed on cancelled order outranks delivery.status
  const refundFailed = resolveCustomerOrderStatus({
    status: "cancelled",
    payment: { method: "prepaid", status: "paid" },
    refund: { status: "failed" },
    delivery: { status: "delivered" },
  });
  assert.equal(refundFailed.key, "refund_failed");
  assert.equal(refundFailed.label, "Refund Requires Attention");

  // Hold / under review outranks delivery.status
  const hold = resolveCustomerOrderStatus({
    ...paid,
    fulfillmentHold: { active: true, reason: "Address check" },
    delivery: { status: "shipped" },
  });
  assert.equal(hold.key, "under_review");
  assert.equal(hold.label, "Under Review");

  // Canonical delivery outranks stale order.status
  const staleStatusOrder = resolveCustomerOrderStatus({
    status: "shipped",
    payment: { method: "prepaid", status: "paid" },
    delivery: { status: "delivered" },
  });
  assert.equal(staleStatusOrder.key, "delivered");
  assert.equal(staleStatusOrder.label, "Delivered");
});

test("resolveProductPreviews returns strictly ProductPreviewResult", () => {
  const previews = resolveProductPreviews([
    { productName: "Saree 1", quantity: 1, price: 1500 },
    { productName: "Saree 2", quantity: 2, price: 2500 },
  ]);
  assert.deepEqual(Object.keys(previews).sort(), ["previews", "remainingCount", "totalQuantity"].sort());
  assert.equal(previews.previews.length, 2);
  assert.equal(previews.remainingCount, 0);
  assert.equal(previews.totalQuantity, 3);
});

test("resolveOrderActions canonical logistics actions", () => {
  const inTransitActions = resolveOrderActions({
    status: "processing",
    delivery: { status: "in_transit" },
    payment: { method: "prepaid", status: "paid" },
  });
  assert.equal(inTransitActions.canTrack, true);
  assert.equal(inTransitActions.canCancel, false);

  const rtoActions = resolveOrderActions({
    status: "processing",
    delivery: { status: "rto_in_transit" },
    payment: { method: "prepaid", status: "paid" },
  });
  assert.equal(rtoActions.canTrack, true);
  assert.equal(rtoActions.canCancel, false);
});

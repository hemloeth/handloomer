import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

test("Part 1: Multi-Store Admin Orders Badge & Interface Verification", async (t) => {
  const typesContent = fs.readFileSync(
    path.join(ROOT, "app", "admin", "(dashboard)", "orders", "use-admin-orders.ts"),
    "utf8"
  );
  const viewContent = fs.readFileSync(
    path.join(ROOT, "app", "admin", "(dashboard)", "orders", "orders-view.tsx"),
    "utf8"
  );

  await t.test("1. AdminOrder interface explicitly defines storeId property", () => {
    assert.match(
      typesContent,
      /storeId\?:\s*string/,
      "AdminOrder TypeScript interface must include storeId?: string"
    );
  });

  await t.test("2. Table header maintains clean 9 columns without redundant Store column", () => {
    assert.doesNotMatch(
      viewContent,
      /<TableHead[^>]*>Store<\/TableHead>/,
      "Store should not create a separate table column"
    );
    assert.match(
      viewContent,
      /<TableHead[^>]*>Order ID<\/TableHead>\s*<TableHead[^>]*>Customer<\/TableHead>/s,
      "Order ID column is directly followed by Customer column"
    );
  });

  await t.test("3. Table body renders store badge above Order ID on left with one-click copy", () => {
    assert.match(
      viewContent,
      /renderStoreBadge\(order\.storeId, order\.orderId\)/,
      "Store badge must be rendered inside the Order ID cell"
    );
    assert.match(
      viewContent,
      /copyToClipboard\(order\.orderId,\s*"Order ID"\)/,
      "Order ID must be one-click copyable in table"
    );
  });

  await t.test("4. Empty and error rows have correct colSpan of 9", () => {
    const colSpans = [...viewContent.matchAll(/colSpan=\{9\}/g)];
    assert.equal(colSpans.length, 2, "Both error and empty rows must have colSpan={9} for 9 table columns");
    assert.doesNotMatch(viewContent, /colSpan=\{10\}/, "Redundant colSpan={10} must not exist");
  });

  await t.test("5. renderStoreBadge maps handloomer strictly to Handloomer badge", () => {
    assert.match(viewContent, /normalized === "handloomer"/);
    assert.match(viewContent, /title="Store: Handloomer"/);
    assert.match(viewContent, />\s*Handloomer\s*<\/span>/);
  });

  await t.test("6. renderStoreBadge maps linen strictly to Linen badge with distinguishable styling", () => {
    assert.match(viewContent, /normalized === "linen"/);
    assert.match(viewContent, /title="Store: Linen"/);
    assert.match(viewContent, />\s*Linen\s*<\/span>/);
  });

  await t.test("7. renderStoreBadge provides safe Unknown Store fallback for missing/unrecognized storeId", () => {
    assert.match(viewContent, /title="Store: Unknown \/ Legacy origin"/);
    assert.match(viewContent, />\s*Unknown Store\s*<\/span>/);
  });

  await t.test("8. Order Detail modal displays store badge above Order ID with one-click copy", () => {
    assert.match(
      viewContent,
      /renderStoreBadge\(viewOrder\.storeId,\s*viewOrder\.orderId\)/s,
      "Order Details modal must display the store badge above viewOrder.orderId"
    );
    assert.match(
      viewContent,
      /copyToClipboard\(viewOrder\.orderId,\s*"Order ID"\)/,
      "Order Details modal must provide one-click copy for Order ID"
    );
  });

  await t.test("9. SKU in table and modal provides one-click copy with toast and feedback", () => {
    assert.match(
      viewContent,
      /copyToClipboard\(item\.sku,\s*"SKU"\)/,
      "SKU must provide one-click copy handler"
    );
  });

  await t.test("10. Store badges are non-interactive span elements with proper accessibility labels", () => {
    assert.match(viewContent, /aria-label="Store: Handloomer"/);
    assert.match(viewContent, /aria-label="Store: Linen"/);
    assert.match(viewContent, /aria-label="Store: Unknown Store"/);
  });
});


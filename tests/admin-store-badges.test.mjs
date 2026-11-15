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

  await t.test("2. Table header defines compact Store column directly beside Order ID", () => {
    assert.match(
      viewContent,
      /<TableHead[^>]*>Order ID<\/TableHead>\s*<TableHead[^>]*>Store<\/TableHead>/s,
      "Store column must be placed directly beside Order ID in TableHeader"
    );
  });

  await t.test("3. Table body renders store badge cell directly beside Order ID cell", () => {
    assert.match(
      viewContent,
      /<TableCell[^>]*>\{order\.orderId\}<\/TableCell>\s*<TableCell[^>]*>\{renderStoreBadge\(order\.storeId\)\}<\/TableCell>/s,
      "Store badge must be rendered in its dedicated column beside orderId"
    );
  });

  await t.test("4. Empty and error rows have updated colSpan to 10", () => {
    const colSpans = [...viewContent.matchAll(/colSpan=\{10\}/g)];
    assert.equal(colSpans.length, 2, "Both error and empty rows must have colSpan={10} for 10 table columns");
    assert.doesNotMatch(viewContent, /colSpan=\{9\}/, "Legacy colSpan={9} must be completely replaced");
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

  await t.test("8. Order Detail modal displays store badge beside Order ID in header", () => {
    assert.match(
      viewContent,
      /<h2[^>]*>\{viewOrder\.orderId\}<\/h2>\s*\{renderStoreBadge\(viewOrder\.storeId\)\}/s,
      "Order Details modal must display the store badge directly beside viewOrder.orderId"
    );
  });

  await t.test("9. Store badges are non-interactive span elements with proper accessibility labels", () => {
    assert.match(viewContent, /aria-label="Store: Handloomer"/);
    assert.match(viewContent, /aria-label="Store: Linen"/);
    assert.match(viewContent, /aria-label="Store: Unknown Store"/);
  });
});


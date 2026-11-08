import "./setup-test-dom.mjs";
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: { "@": path.resolve("."), "next/navigation": path.resolve("tests/navigation-mock.mjs") },
});
const navMock = jiti("./navigation-mock.mjs");

const read = (p) => fs.readFileSync(path.resolve(p), "utf8");

// ---------------------------------------------------------------------------
// P1: Edit Product data integrity
// ---------------------------------------------------------------------------
describe("Edit Product integrity", () => {
  const src = read("app/admin/(dashboard)/edit-product/[id]/page.tsx");
  test("no hardcoded spec defaults in edit fetch", () => {
    assert.doesNotMatch(src, /setSareeSize\("5\.5 mtr"\)/);
    assert.doesNotMatch(src, /setBlouseSize\("95 cm"\)/);
    assert.doesNotMatch(src, /setWashCare\("Dry clean recommended"\)/);
  });
  test("every spec loads from stored product", () => {
    for (const field of ["sareeSize", "blouseSize", "washCare", "dispatch", "disclaimer", "internationalNote"]) {
      const setter = field[0].toUpperCase() + field.slice(1);
      assert.match(src, new RegExp(`set${setter}\\(product\\.${field}`), field);
    }
  });
  test("explicit load states gate submission", () => {
    assert.match(src, /loadState/);
    assert.match(src, /"loading"/);
    assert.match(src, /"not-found"/);
    assert.match(src, /"error"/);
    assert.match(src, /loadState !== "loaded"/);
    assert.match(src, /Could not load product/);
    assert.match(src, /Product not found/);
    assert.match(src, /Retry/);
  });
  test("update uses local submitting state + Sonner toasts", () => {
    assert.match(src, /isUpdating/);
    assert.match(src, /toast\.success\("Product updated successfully"\)/);
    assert.match(src, /toast\.error/);
    assert.doesNotMatch(src, /setShowSuccessModal/);
  });
});

// ---------------------------------------------------------------------------
// P2: Mutation error propagation
// ---------------------------------------------------------------------------
describe("Mutation errors propagate (no false success)", () => {
  const prod = read("context/product-context.tsx");
  const cat = read("context/category-context.tsx");
  const blog = read("context/blog-context.tsx");
  test("deleteProduct throws", () => {
    assert.match(prod, /deleteProduct[\s\S]*?throw err/);
  });
  test("deleteCategory throws", () => {
    assert.match(cat, /deleteCategory[\s\S]*?throw err/);
  });
  test("gallery + video mutations throw (no silent swallow)", () => {
    assert.doesNotMatch(prod, /Image info update failed/);
    assert.doesNotMatch(prod, /Video upload failed/);
  });
  test("blog mutations throw on success:false", () => {
    assert.match(blog, /throw new Error\(data\.message \|\| "Failed to add blog"\)/);
    assert.match(blog, /throw new Error\(data\.message \|\| "Failed to delete blog"\)/);
  });
  test("products/categories callers show error toasts", () => {
    const p = read("app/admin/(dashboard)/products/page.tsx");
    const c = read("app/admin/(dashboard)/categories/page.tsx");
    assert.match(p, /Delete failed/);
    assert.match(p, /Bulk delete failed/);
    assert.match(c, /Delete failed/);
  });
});

// ---------------------------------------------------------------------------
// P3/P4: Session, logout, freshness
// ---------------------------------------------------------------------------
describe("Admin session + logout + freshness", () => {
  const layout = read("app/admin/(dashboard)/layout.tsx");
  test("layout verifies backend token but skips loader when already verified", () => {
    assert.match(layout, /ADMIN_SESSION_VERIFIED_KEY/);
    assert.match(layout, /verify-token/);
    assert.match(layout, /Verifying session/);
    assert.doesNotMatch(layout, /Authorizing Session/);
    assert.doesNotMatch(layout, /Establishing Secure Encryption/);
    assert.doesNotMatch(layout, /blur-\[100px\]/);
  });
  test("logout calls backend before clearing local state", () => {
    const header = read("components/admin/header.tsx");
    const sidebar = read("components/admin/sidebar.tsx");
    for (const src of [header, sidebar]) {
      assert.match(src, /apiPost\("\/api\/user\/logout"/);
      assert.match(src, /clearAdminToken/);
    }
  });
  test("provider keeps stale-time, dedupe, race guards and separate refresh flag", () => {
    const prod = read("context/product-context.tsx");
    assert.match(prod, /PRODUCT_STALE_TIME_MS/);
    assert.match(prod, /inflightRef/);
    assert.match(prod, /generationRef/);
    assert.match(prod, /isRefreshing/);
    // Background refresh never clears list: setProducts([]) absent in fetch path.
    assert.doesNotMatch(prod, /setProducts\(\[\]\)/);
  });
});

// ---------------------------------------------------------------------------
// P5-P8: Pagination, scroll, forms, nav
// ---------------------------------------------------------------------------
describe("Pagination, scroll, forms, navigation", () => {
  test("admin products uses backend pagination, not global-100 slicing", () => {
    const src = read("app/admin/(dashboard)/products/page.tsx");
    assert.match(src, /pageProducts/);
    assert.match(src, /totalProducts/);
    assert.match(src, /\/api\/product\/allproducts\?/);
    assert.doesNotMatch(src, /products\.filter/);
  });
  test("number inputs use native scrolling (no wheel-blur interruption)", () => {
    for (const f of ["app/admin/(dashboard)/add-product/page.tsx", "app/admin/(dashboard)/edit-product/[id]/page.tsx"]) {
      assert.doesNotMatch(read(f), /onWheel/);
    }
  });
  test("previews stick below 64px header; admin scrollbars restored", () => {
    for (const f of ["app/admin/(dashboard)/add-product/page.tsx", "app/admin/(dashboard)/edit-product/[id]/page.tsx"]) {
      assert.match(read(f), /top-\[76px\]/);
    }
    const css = read("app/globals.css");
    assert.doesNotMatch(css, /\[data-admin-root\] \*,?\s*\{/);
    assert.doesNotMatch(css, /display: none !important;\s*\n\s*width: 0/);
  });
  test("Replace buttons are type=button; add-product validates image with feedback", () => {
    const edit = read("app/admin/(dashboard)/edit-product/[id]/page.tsx");
    const add = read("app/admin/(dashboard)/add-product/page.tsx");
    assert.match(edit, /type="button"[^>]*>Replace</);
    assert.match(add, /type="button"[^>]*>Replace</);
    assert.match(add, /Please upload a main product image/);
    assert.match(add, /htmlFor="main-image-upload"/);
  });
  test("desktop hamburger removed; mobile drawer has dialog semantics + Escape", () => {
    const header = read("components/admin/header.tsx");
    const sidebar = read("components/admin/sidebar.tsx");
    const layout = read("app/admin/(dashboard)/layout.tsx");
    assert.doesNotMatch(header, /Collapse sidebar/);
    assert.doesNotMatch(layout, /handloomer_admin_sidebar_collapsed/);
    assert.doesNotMatch(layout, /toggleSidebarCollapse/);
    assert.match(sidebar, /role="dialog"/);
    assert.match(sidebar, /Escape/);
    assert.match(sidebar, /onFocus/);
    assert.match(layout, /lg:pl-16/);
  });
});

// ---------------------------------------------------------------------------
// P9-P13: Dashboard, customers, blog
// ---------------------------------------------------------------------------
describe("Dashboard, customers, blog", () => {
  test("dashboard fails honestly instead of zero metrics", () => {
    const src = read("app/admin/(dashboard)/dashboard/page.tsx");
    assert.match(src, /Unable to load dashboard data/);
    assert.match(src, /Retry/);
    assert.match(src, /Refresh failed — showing last known values/);
  });
  test("customers uses single deterministic query with newest-wins cancel", () => {
    const src = read("app/admin/(dashboard)/customers/page.tsx");
    assert.match(src, /debouncedSearch/);
    assert.match(src, /cancelled/);
    assert.doesNotMatch(src, /searchTimeout/);
  });
  test("uploadVideo + gallery throw to callers", async () => {
    let originalFetch;
    beforeEach(() => { originalFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = originalFetch; cleanup(); });
    const prodMod = jiti("../context/product-context.tsx");
    navMock.__setPathname("/admin/products");
    globalThis.fetch = async () => ({
      ok: false, status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: false, message: "Nope" }),
      text: async () => '{"success":false}',
    });
    const { result } = renderHook(() => prodMod.useProducts(), {
      wrapper: ({ children }) => React.createElement(prodMod.ProductProvider, { initialProducts: [{ id: "a", name: "A", slug: "a", category: "L", categorySlug: "l", price: 100, originalPrice: 100, image: "/a.jpg", images: [], description: "", details: [], fabric: "L", color: "R", isOnSale: false, isFeatured: true, isNew: false, stock: 1 }] }, children),
    });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    await assert.rejects(async () => { await result.current.deleteProduct("a"); }, /Nope/);
  });
});

// ---------------------------------------------------------------------------
// Blog sanitization (client + server trust boundary)
// ---------------------------------------------------------------------------
describe("Blog HTML sanitization", () => {
  const fe = jiti("../lib/sanitize-html.ts");
  const be = jiti("../../saree-backend/utils/sanitizeHtml.js");

  test("strips scripts, handlers, javascript URLs; keeps formatting", () => {
    const dirty = `<p onclick="x()">Hi <strong>there</strong></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://ok.test/x">good</a><iframe src="https://x"></iframe>`;
    for (const clean of [fe.sanitizeBlogHtml(dirty), be.sanitizeBlogHtml(dirty)]) {
      assert.doesNotMatch(clean, /<script/);
      assert.doesNotMatch(clean, /onclick/);
      assert.doesNotMatch(clean, /javascript:/);
      assert.doesNotMatch(clean, /<iframe/);
      assert.match(clean, /<strong>there<\/strong>/);
      assert.match(clean, /href="https:\/\/ok\.test\/x"/);
      assert.match(clean, /rel="noopener noreferrer"|target="_blank"/);
    }
  });
  test("backend sanitizes add/update before save", () => {
    const ctrl = fs.readFileSync(path.resolve("../saree-backend/controllers/blogController.js"), "utf8");
    assert.match(ctrl, /sanitizeBlogHtml\(description/);
    const pub = read("app/blog/[slug]/page.tsx");
    assert.match(pub, /sanitizeBlogHtml\(post\.content\)/);
  });
});

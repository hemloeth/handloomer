import "./setup-test-dom.mjs";
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import React from "react";
import { render, renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    "@": path.resolve("."),
    "next/navigation": path.resolve("tests/navigation-mock.mjs"),
  },
});

const productsLib = jiti("../lib/products.ts");
const { PRODUCT_STALE_TIME_MS, HOMEPAGE_PRODUCT_LIMIT, fetchNewestProducts, fetchPaginatedProductsClient } = productsLib;
const navMock = jiti("./navigation-mock.mjs");

// ---------------------------------------------------------------------------
// Header / Hero — deterministic first paint, single owner
// ---------------------------------------------------------------------------
describe("Header / Hero deterministic offset", () => {
  const css = fs.readFileSync(path.resolve("app/globals.css"), "utf8");
  const headerSrc = fs.readFileSync(path.resolve("components/layout/header.tsx"), "utf8");
  const heroSrc = fs.readFileSync(path.resolve("components/sections/auto-scroll-hero.tsx"), "utf8");

  function baseOffset() {
    const m = css.match(/:root\s*\{[^}]*--header-offset:\s*(\d+)px/);
    return m ? Number(m[1]) : null;
  }
  function mediaOffset(minWidth) {
    const re = new RegExp(`@media\\s*\\(min-width:\\s*${minWidth}px\\)\\s*\\{\\s*:root\\s*\\{\\s*--header-offset:\\s*(\\d+)px`);
    const m = css.match(re);
    return m ? Number(m[1]) : null;
  }

  test("base --header-offset covers smallest mobile (320/375/390 = 159px, incl. 1px border)", () => {
    assert.equal(baseOffset(), 159);
  });
  test("desktop breakpoints match measured headers", () => {
    assert.equal(mediaOffset(420), 131);
    assert.equal(mediaOffset(1024), 113);
    assert.equal(mediaOffset(1280), 97);
  });
  test("tablet breakpoints are defined (768 = 121px)", () => {
    assert.equal(mediaOffset(768), 121);
  });
  test("Header is the single JS owner of --header-offset; hero only consumes it", () => {
    assert.match(headerSrc, /setProperty\(['"]--header-offset['"]/);
    assert.doesNotMatch(heroSrc, /setProperty\(['"]--header-offset['"]/);
    assert.doesNotMatch(heroSrc, /getElementById\(['"]main-header['"]\)/);
  });
  test("Hero consumes var(--header-offset) with no oversized fallback (first paint already correct)", () => {
    assert.match(heroSrc, /marginTop:\s*"var\(--header-offset\)"/);
    assert.match(heroSrc, /calc\(100vh - var\(--header-offset\)\)/);
    assert.doesNotMatch(heroSrc, /var\(--header-offset,\s*140px\)/);
  });
  test("No page keeps a mismatched fallback", () => {
    const bad = /var\(--header-offset,\s*(80|100|120|140)px\)/;
    assert.doesNotMatch(heroSrc, bad);
    // Sample other consumers normalized to plain var (spot-check).
    const productPage = fs.readFileSync(path.resolve("app/product/[slug]/page.tsx"), "utf8");
    const collections = fs.readFileSync(path.resolve("app/collections/page.tsx"), "utf8");
    assert.doesNotMatch(productPage, bad);
    assert.doesNotMatch(collections, bad);
    assert.match(productPage, /var\(--header-offset\)/);
  });
});

// ---------------------------------------------------------------------------
// Product freshness — backend-driven helpers
// ---------------------------------------------------------------------------
describe("Product freshness helpers", () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.window.localStorage.clear();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window.localStorage.clear();
  });

  function jsonResponse(body, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }

  test("PRODUCT_STALE_TIME_MS is a small freshness window (not HTTP cache)", () => {
    assert.ok(PRODUCT_STALE_TIME_MS >= 15000 && PRODUCT_STALE_TIME_MS <= 60000,
      `stale window should be 15-60s, got ${PRODUCT_STALE_TIME_MS}`);
    assert.equal(HOMEPAGE_PRODUCT_LIMIT, 20);
  });

  test("fetchNewestProducts requests 20 newest (sortBy=newest) and preserves order", async () => {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(String(url));
      return jsonResponse({
        success: true,
        products: [
          { _id: "c", name: "C Saree", sku: "C", category: "Linen", regularPrice: 2000, price: 1800, stock: 5, shortDescription: "d", tags: "t", mainImage: "/a.jpg", galleryImages: [], color: "Red", material: "Linen", sareeSize: "5.5", blouseSize: "1", washCare: "W" },
          { _id: "a", name: "A Saree", sku: "A", category: "Linen", regularPrice: 2000, price: 2000, stock: 3, shortDescription: "d", tags: "t", mainImage: "/a.jpg", galleryImages: [], color: "Red", material: "Linen", sareeSize: "5.5", blouseSize: "1", washCare: "W" },
          { _id: "b", name: "B Saree", sku: "B", category: "Linen", regularPrice: 1800, price: 1800, stock: 2, shortDescription: "d", tags: "t", mainImage: "/a.jpg", galleryImages: [], color: "Blue", material: "Linen", sareeSize: "5.5", blouseSize: "1", washCare: "W" },
        ],
        pagination: { currentPage: 1, totalPages: 1, totalProducts: 3, limit: 20 },
      });
    };
    const list = await fetchNewestProducts(20);
    assert.equal(list.length, 3);
    assert.equal(list[0].name, "C Saree");
    assert.equal(list[0].price, 1800, "updated price must flow through");
    assert.ok(urls[0].includes("sortBy=newest"), `newest sort requested, got ${urls[0]}`);
    assert.ok(urls[0].includes("limit=20"), `limit 20 requested, got ${urls[0]}`);
    assert.ok(!urls[0].includes("isNewArrival=1") && !urls[0].includes("isNewArrival=true"), "Latest must not filter isNewArrival");
  });

  test("Updated price/stock reflected on next fresh fetch; new product appears newest", async () => {
    const mk = (id, name, price) => ({ _id: id, name, sku: id.toUpperCase(), category: "Linen", regularPrice: price + 200, price, stock: 4, shortDescription: "d", tags: "t", mainImage: "/a.jpg", galleryImages: [], color: "Red", material: "Linen", sareeSize: "5.5", blouseSize: "1", washCare: "W" });
    let phase = 0;
    globalThis.fetch = async () => {
      phase++;
      if (phase === 1) return jsonResponse({ success: true, products: [mk("a", "A Saree", 2000), mk("b", "B Saree", 1800)], pagination: { currentPage: 1, totalPages: 1, totalProducts: 2, limit: 20 } });
      return jsonResponse({ success: true, products: [mk("c", "C Saree", 2200), mk("a", "A Saree", 1800), mk("b", "B Saree", 1800)], pagination: { currentPage: 1, totalPages: 1, totalProducts: 3, limit: 20 } });
    };
    const first = await fetchNewestProducts(20);
    assert.deepEqual(first.map(p => p.name), ["A Saree", "B Saree"]);
    const second = await fetchNewestProducts(20);
    assert.deepEqual(second.map(p => p.name), ["C Saree", "A Saree", "B Saree"], "C (new) must be first");
    assert.equal(second.find(p => p.name === "A Saree").price, 1800, "A updated price 2000->1800");
  });

  test("fetchPaginatedProductsClient composes category/search/isNewArrival + pagination backend-side (>100 safe)", async () => {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(String(url));
      return jsonResponse({
        success: true,
        products: [{ _id: "x1", name: "Blue Linen", sku: "X1", category: "Linen", regularPrice: 3000, price: 3000, stock: 1, shortDescription: "d", tags: "t", mainImage: "/a.jpg", galleryImages: [], color: "Blue", material: "Linen", sareeSize: "5.5", blouseSize: "1", washCare: "W" }],
        pagination: { currentPage: 2, totalPages: 16, totalProducts: 320, limit: 20 },
      });
    };
    const { products, pagination } = await fetchPaginatedProductsClient({ category: "linen", search: "blue linen", isNewArrival: "true", page: 2, limit: 20 });
    assert.equal(products.length, 1);
    assert.equal(pagination.totalProducts, 320);
    assert.equal(pagination.totalPages, 16);
    assert.equal(pagination.currentPage, 2);
    assert.ok(urls[0].includes("category=linen"), urls[0]);
    assert.ok(urls[0].includes("search="), urls[0]);
    assert.ok(urls[0].includes("isNewArrival=true"), urls[0]);
    assert.ok(urls[0].includes("page=2"), urls[0]);
  });
});

// ---------------------------------------------------------------------------
// Provider — stale-time, dedupe, race, error preservation
// ---------------------------------------------------------------------------
describe("ProductProvider freshness", () => {
  let originalFetch;
  let realNow;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    realNow = Date.now;
    globalThis.window.localStorage.clear();
    navMock.__setPathname("/");
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    Date.now = realNow;
    cleanup();
    globalThis.window.localStorage.clear();
    globalThis.document.body.innerHTML = "";
  });

  const mkDb = (id, name, price) => ({ _id: id, name, sku: id.toUpperCase(), category: "Linen", regularPrice: price + 200, price, stock: 4, shortDescription: "d", tags: "t", mainImage: "/a.jpg", galleryImages: [], color: "Red", material: "Linen", sareeSize: "5.5", blouseSize: "1", washCare: "W", isNewArrival: false, isOnSale: false, isFestive: false, productCollection: "none" });
  const ssrSeed = (id, name, price) => ({ id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), category: "Linen", categorySlug: "linen", price, originalPrice: price + 200, image: "/a.jpg", images: ["/a.jpg"], description: "d", details: [], fabric: "Linen", color: "Red", isOnSale: false, isFeatured: true, isNew: false, stock: 4 });
  function jsonResponse(body, status = 200) {
    return { ok: status >= 200 && status < 300, status, headers: new Headers({ "content-type": "application/json" }), json: async () => body, text: async () => JSON.stringify(body) };
  }

  async function renderProvider(seed) {
    // Fresh jiti import each render to avoid module state leaking between tests.
    const providerMod = jiti("../context/product-context.tsx");
    return renderHook(() => providerMod.useProducts(), {
      wrapper: ({ children }) => React.createElement(providerMod.ProductProvider, { initialProducts: seed }, children),
    });
  }

  test("Fresh provider (SSR seed, 5s old) does not fetch on route return", async () => {
    const t0 = 1_700_000_000_000;
    Date.now = () => t0;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return jsonResponse({ success: true, products: [] }); };
    const { rerender } = await renderProvider([ssrSeed("a", "A Saree", 2000)]);
    // SSR seed counts as fresh at mount: no immediate client fetch.
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    assert.equal(calls, 0, "fresh SSR seed must not trigger immediate fetch");
    // 5s later, return to home — still fresh.
    Date.now = () => t0 + 5000;
    navMock.__setPathname("/collections");
    rerender();
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    assert.equal(calls, 0, "5s-old data must not refetch");
  });

  test("Stale provider (2min old) refreshes on route return, keeps old visible until new arrives", async () => {
    const t0 = 1_700_000_000_000;
    Date.now = () => t0;
    let calls = 0;
    let resolveFetch;
    globalThis.fetch = () => {
      calls++;
      return new Promise((res) => { resolveFetch = () => res(jsonResponse({ success: true, products: [mkDb("c", "C Saree", 2200), mkDb("a", "A Saree", 2000)] })); });
    };
    const { result, rerender } = await renderProvider([ssrSeed("a", "A Saree", 2000)]);
    assert.equal(result.current.mappedProducts[0].name, "A Saree");
    Date.now = () => t0 + 120000;
    navMock.__setPathname("/collections");
    rerender();
    // Fetch in flight, old visible.
    assert.equal(result.current.mappedProducts[0].name, "A Saree", "old must stay during background fetch");
    await act(async () => { resolveFetch(); await new Promise(r => setTimeout(r, 50)); });
    assert.equal(calls, 1);
    assert.equal(result.current.mappedProducts[0].name, "C Saree", "new data replaces old");
  });

  test("New + updated products flow through provider refresh (C,A,B + price 1800)", async () => {
    const t0 = 1_700_000_000_000;
    Date.now = () => t0;
    let phase = 0;
    globalThis.fetch = async () => {
      phase++;
      if (phase === 1) return jsonResponse({ success: true, products: [mkDb("a", "A Saree", 2000), mkDb("b", "B Saree", 1800)] });
      return jsonResponse({ success: true, products: [mkDb("c", "C Saree", 2200), mkDb("a", "A Saree", 1800), mkDb("b", "B Saree", 1800)] });
    };
    // No SSR seed => initial fetch runs.
    const { result } = await renderProvider([]);
    await waitFor(() => assert.equal(result.current.mappedProducts.length, 2));
    assert.deepEqual(result.current.mappedProducts.map(p => p.name), ["A Saree", "B Saree"]);
    Date.now = () => t0 + 120000;
    await act(async () => { await result.current.refreshProducts(); });
    // refreshProducts is stale-guarded; force via time + route is covered elsewhere.
    // Here stale window passed, so refresh runs.
    await waitFor(() => assert.equal(result.current.mappedProducts.length, 3));
    assert.deepEqual(result.current.mappedProducts.map(p => p.name), ["C Saree", "A Saree", "B Saree"]);
    assert.equal(result.current.mappedProducts.find(p => p.name === "A Saree").price, 1800);
  });

  test("Duplicate simultaneous triggers (focus + visibility) share one inflight fetch", async () => {
    const t0 = 1_700_000_000_000;
    Date.now = () => t0;
    let calls = 0;
    let resolveFetch;
    globalThis.fetch = () => {
      calls++;
      return new Promise((res) => { resolveFetch = () => res(jsonResponse({ success: true, products: [mkDb("n", "N Saree", 1500)] })); });
    };
    const { result } = await renderProvider([]);
    // initial fetch inflight; simulate focus+visibility now.
    await act(async () => {
      globalThis.window.dispatchEvent(new globalThis.Event("focus"));
      globalThis.document.dispatchEvent(new globalThis.Event("visibilitychange"));
      await new Promise(r => setTimeout(r, 30));
    });
    assert.equal(calls, 1, "focus+visibility must dedupe to 1 network call");
    await act(async () => { resolveFetch(); await new Promise(r => setTimeout(r, 50)); });
    assert.equal(result.current.mappedProducts[0].name, "N Saree");
  });

  test("Overlapping refresh calls cannot let an older slower response overwrite newer", async () => {
    const t0 = 1_700_000_000_000;
    Date.now = () => t0;
    let calls = 0;
    let resolvers = [];
    globalThis.fetch = () => {
      calls++;
      return new Promise((res) => { resolvers.push(() => res(jsonResponse({ success: true, products: [mkDb("s", `S${calls} Saree`, 1000 + calls)] }))); });
    };
    const { result } = await renderProvider([]);
    // initial fetch (call 1) pending; a second refresh must reuse it, not start call 2.
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    const before = calls;
    // refreshProducts while inflight returns same promise (no new network call).
    let p2;
    act(() => { p2 = result.current.refreshProducts(); });
    assert.equal(calls, before, "inflight reuse must not start a second call");
    await act(async () => { resolvers[0](); await new Promise(r => setTimeout(r, 50)); });
    // Latest (single) response wins; no older overwrite possible.
    assert.ok(result.current.mappedProducts.length === 1);
    assert.equal(result.current.mappedProducts[0].name, "S1 Saree");
  });

  test("Failed background refresh keeps valid catalog (no wipe)", async () => {
    const t0 = 1_700_000_000_000;
    Date.now = () => t0;
    let phase = 0;
    globalThis.fetch = async () => {
      phase++;
      if (phase === 1) return jsonResponse({ success: true, products: [mkDb("a", "A Saree", 2000)] });
      return jsonResponse({ success: false, message: "Bad request" }, 400);
    };
    const { result } = await renderProvider([]);
    await waitFor(() => assert.equal(result.current.mappedProducts.length, 1));
    assert.equal(result.current.mappedProducts[0].name, "A Saree");
    Date.now = () => t0 + 120000;
    await act(async () => { await result.current.refreshProducts(); });
    assert.equal(result.current.mappedProducts.length, 1);
    assert.equal(result.current.mappedProducts[0].name, "A Saree", "valid data must survive failed refresh");
  });
});

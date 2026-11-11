import "./setup-test-dom.mjs";
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import React from "react";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    "@": path.resolve("."),
  },
});

const productsLib = jiti("../lib/products.ts");
const { mapProductFromDB } = productsLib;

const galleryMod = jiti("../components/products/product-card-gallery.ts");
const { useProductCardGallery } = galleryMod;

describe("Product Catalog Mapper - Image Preservation", () => {
  test("mainImage + all gallery URLs -> all unique URLs preserved", () => {
    const dbProduct = {
      _id: "prod-1",
      name: "Handwoven Linen Saree",
      sku: "HLS-001",
      category: "Linen",
      regularPrice: 3500,
      price: 2999,
      stock: 5,
      shortDescription: "A beautiful handwoven linen saree",
      tags: "linen, handwoven",
      mainImage: "https://pub.r2.dev/main.jpg",
      galleryImages: [
        { url: "https://pub.r2.dev/view1.jpg", title: "View 1", description: "Front drape" },
        { url: "https://pub.r2.dev/view2.jpg", title: "View 2", description: "Pallu detail" },
        { url: "https://pub.r2.dev/view3.jpg" },
        // Duplicate main image in gallery should be deduplicated
        { url: "https://pub.r2.dev/main.jpg" },
        // Plain string format support
        "https://pub.r2.dev/view4.jpg",
      ],
    };

    const mapped = mapProductFromDB(dbProduct);

    assert.equal(mapped.image, "https://pub.r2.dev/main.jpg");
    assert.deepEqual(mapped.images, [
      "https://pub.r2.dev/main.jpg",
      "https://pub.r2.dev/view1.jpg",
      "https://pub.r2.dev/view2.jpg",
      "https://pub.r2.dev/view3.jpg",
      "https://pub.r2.dev/view4.jpg",
    ]);
  });
});

describe("ProductCard Gallery Hover & Preload Logic", () => {
  afterEach(() => {
    cleanup();
  });
  test("images = [main] -> no hover cycle", async () => {
    let preloadedUrls = [];
    const preloadImage = async (src) => {
      preloadedUrls.push(src);
      return true;
    };

    const { result } = renderHook(() =>
      useProductCardGallery({
        images: ["/main.jpg"],
        preloadImage,
      })
    );

    assert.equal(result.current.currentIndex, 0);
    assert.equal(result.current.currentSrc, "/main.jpg");
    assert.equal(result.current.incomingSrc, null);

    // Hover starts
    act(() => {
      result.current.onHoverStart();
    });

    assert.equal(result.current.isHovered, true);
    assert.equal(preloadedUrls.length, 0, "Single image must not trigger any preload");
    assert.equal(result.current.currentIndex, 0);
    assert.equal(result.current.incomingSrc, null);

    // Wait some time to verify no cycling occurs
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    assert.equal(result.current.currentIndex, 0);
    assert.equal(result.current.incomingSrc, null);
  });

  test("images = [main, a] -> preload a, main remains until a ready, then displays a", async () => {
    let resolveA;
    const preloadImage = (src) => {
      if (src === "/a.jpg") {
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      }
      return Promise.resolve(true);
    };

    const { result } = renderHook(() =>
      useProductCardGallery({
        images: ["/main.jpg", "/a.jpg"],
        cycleIntervalMs: 500,
        fadeDurationMs: 100,
        preloadImage,
      })
    );

    // Hover starts
    act(() => {
      result.current.onHoverStart();
    });

    // While preload of 'a' is in flight: main remains visible, incoming is not yet mounted
    assert.equal(result.current.currentSrc, "/main.jpg", "Main image must stay visible during preload");
    assert.equal(result.current.incomingSrc, null, "Incoming layer must not mount before preload completes");

    // Preload of 'a' resolves successfully
    await act(async () => {
      resolveA(true);
      await new Promise((r) => setTimeout(r, 30));
    });

    // Alternate image 'a' is now incoming
    assert.equal(result.current.incomingSrc, "/a.jpg");
    assert.equal(result.current.currentSrc, "/main.jpg", "Base layer still has main image for cross-fade");

    // After fade duration, 'a' becomes currentSrc
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });

    assert.equal(result.current.currentSrc, "/a.jpg");
    assert.equal(result.current.incomingSrc, null);
  });

  test("images = [main, a, b, c] -> hover cycles all unique images", async () => {
    const preloaded = [];
    const preloadImage = async (src) => {
      preloaded.push(src);
      return true;
    };

    const { result } = renderHook(() =>
      useProductCardGallery({
        images: ["/main.jpg", "/a.jpg", "/b.jpg", "/c.jpg"],
        cycleIntervalMs: 200,
        fadeDurationMs: 50,
        preloadImage,
      })
    );

    act(() => {
      result.current.onHoverStart();
    });

    // Progressive cycle: transitions to 'a', then 'b', then 'c'
    await waitFor(() => assert.equal(result.current.currentSrc, "/a.jpg"), { timeout: 1500 });
    await waitFor(() => assert.equal(result.current.currentSrc, "/b.jpg"), { timeout: 1500 });
    await waitFor(() => assert.equal(result.current.currentSrc, "/c.jpg"), { timeout: 1500 });

    assert.ok(preloaded.includes("/a.jpg"));
    assert.ok(preloaded.includes("/b.jpg"));
    assert.ok(preloaded.includes("/c.jpg"));

    act(() => {
      result.current.onHoverEnd();
    });
  });

  test("failed alternate preload -> current image remains, failed image skipped", async () => {
    const preloadImage = async (src) => {
      // Simulate /fail.jpg failing to load
      if (src === "/fail.jpg") return false;
      return true;
    };

    const { result } = renderHook(() =>
      useProductCardGallery({
        images: ["/main.jpg", "/fail.jpg", "/working.jpg"],
        cycleIntervalMs: 300,
        fadeDurationMs: 50,
        preloadImage,
      })
    );

    act(() => {
      result.current.onHoverStart();
    });

    // /fail.jpg was skipped; /working.jpg loads
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Should transition to /working.jpg instead of failing or blanking
    assert.equal(result.current.currentSrc, "/working.jpg");
    assert.equal(result.current.incomingSrc, null);

    act(() => {
      result.current.onHoverEnd();
    });
  });

  test("mouseleave -> returns to main, timers cleared", async () => {
    let resolveB;
    const preloadImage = (src) => {
      if (src === "/b.jpg") {
        return new Promise((resolve) => {
          resolveB = resolve;
        });
      }
      return Promise.resolve(true);
    };

    const { result } = renderHook(() =>
      useProductCardGallery({
        images: ["/main.jpg", "/a.jpg", "/b.jpg"],
        cycleIntervalMs: 200,
        fadeDurationMs: 50,
        preloadImage,
      })
    );

    act(() => {
      result.current.onHoverStart();
    });

    // Transition to /a.jpg completes
    await waitFor(() => assert.equal(result.current.currentSrc, "/a.jpg"), { timeout: 1500 });

    // Mouse leaves
    act(() => {
      result.current.onHoverEnd();
    });

    // Immediately resets to main image (index 0)
    assert.equal(result.current.currentIndex, 0);
    assert.equal(result.current.currentSrc, "/main.jpg");
    assert.equal(result.current.incomingSrc, null);
    assert.equal(result.current.isHovered, false);

    // Resolve late preload for b - must NOT update state
    await act(async () => {
      if (resolveB) resolveB(true);
      await new Promise((r) => setTimeout(r, 100));
    });

    assert.equal(result.current.currentIndex, 0);
    assert.equal(result.current.currentSrc, "/main.jpg");
  });
});

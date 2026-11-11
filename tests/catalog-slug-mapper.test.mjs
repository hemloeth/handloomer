import "./setup-test-dom.mjs";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    "@": path.resolve("."),
    "next/navigation": path.resolve("tests/navigation-mock.mjs"),
  },
});

const productsLib = jiti("../lib/products.ts");
const { createProductSlug, mapProductFromDB, getBestSellers } = productsLib;

describe("Product Slug Canonicalization & Mapper Parity", () => {
  test("createProductSlug produces canonical normalized-name-SKU format", () => {
    const slug1 = createProductSlug("Royal Blue Pure Linen Saree", "RKS-1001-BLU");
    assert.equal(slug1, "royal-blue-pure-linen-saree-RKS-1001-BLU");

    const slug2 = createProductSlug("Handcrafted Zari Border Saree (Special Edition!)", "SAR-9988");
    assert.equal(slug2, "handcrafted-zari-border-saree-special-edition-SAR-9988");

    const slug3 = createProductSlug("  Eco   Linen   Saree  ", "  SKU 123  ");
    assert.equal(slug3, "eco-linen-saree-SKU 123");
  });

  test("mapProductFromDB generates identical slug and flags for both server and client usage", () => {
    const rawDB = {
      _id: "672f0001a1b2c3d4e5f60001",
      name: "Pastel Pink Organic Saree",
      sku: "ORG-PNK-001",
      description: "Organic handspun linen saree",
      price: 4999,
      category: { _id: "cat1", name: "Organic Linen" },
      stock: 12,
      isFeatured: true,
      isBestSeller: true,
      isFestive: false,
      isNewArrival: true,
      mainImage: "/images/pink-saree.jpg",
      galleryImages: ["/images/pink-1.jpg", "/images/pink-2.jpg"],
      colors: ["Pink"],
      fabric: "Linen",
      rating: 4.8,
      reviewsCount: 24,
    };

    const mapped = mapProductFromDB(rawDB);

    // Canonical slug check
    assert.equal(mapped.slug, "pastel-pink-organic-saree-ORG-PNK-001");
    assert.equal(mapped.sku, "ORG-PNK-001");
    assert.equal(mapped.isFeatured, true);
    assert.equal(mapped.isBestSeller, true);
    assert.equal(mapped.isNew, true);
    assert.equal(mapped.isFestive, false);
    assert.equal(mapped.id, "672f0001a1b2c3d4e5f60001");
    assert.deepEqual(mapped.images, [
      "/images/pink-saree.jpg",
      "/images/pink-1.jpg",
      "/images/pink-2.jpg",
    ]);

    // Repeat mapping behaves identically (pure mapping function)
    const secondMapping = mapProductFromDB(rawDB);
    assert.deepEqual(mapped, secondMapping);
  });

  test("getBestSellers filters explicitly by isBestSeller property", () => {
    const sampleProducts = [
      {
        id: "p1",
        slug: "saree-one-SKU1",
        name: "Saree One",
        price: 2999,
        isBestSeller: true,
        rating: 4.2,
      },
      {
        id: "p2",
        slug: "saree-two-SKU2",
        name: "Saree Two",
        price: 3499,
        isBestSeller: false,
        rating: 4.9,
      },
      {
        id: "p3",
        slug: "saree-three-SKU3",
        name: "Saree Three",
        price: 3999,
        isBestSeller: true,
        rating: 4.0,
      },
    ];

    const bestSellers = getBestSellers(sampleProducts);
    assert.equal(bestSellers.length, 2);
    assert.equal(bestSellers[0].id, "p1");
    assert.equal(bestSellers[1].id, "p3");
  });

  test("getBestSellers falls back gracefully if no product has isBestSeller true", () => {
    const sampleProducts = [
      {
        id: "p1",
        slug: "saree-one-SKU1",
        name: "Saree One",
        price: 2999,
        originalPrice: 2999,
        isBestSeller: false,
        isOnSale: false,
      },
      {
        id: "p2",
        slug: "saree-two-SKU2",
        name: "Saree Two",
        price: 2999,
        originalPrice: 3499,
        isBestSeller: false,
        isOnSale: true,
      },
    ];

    const bestSellers = getBestSellers(sampleProducts);
    assert.equal(bestSellers.length, 1);
    assert.equal(bestSellers[0].id, "p2");
  });

  test("Backward compatibility: slug without SKU fallback handling", () => {
    // Legacy products without SKU still generate a safe slug without trailing dash
    const legacySlug = createProductSlug("Traditional Linen Saree", "");
    assert.equal(legacySlug, "traditional-linen-saree");

    const rawLegacyDB = {
      _id: "672f0001a1b2c3d4e5f69999",
      name: "Traditional Linen Saree",
      sku: "",
      price: 1999,
      stock: 5,
    };
    const mapped = mapProductFromDB(rawLegacyDB);
    assert.equal(mapped.slug, "traditional-linen-saree");
  });
});

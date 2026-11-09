"use client"

import { useEffect, useState } from "react"
import { ProductCard } from "@/components/products/product-card"
import type { Product } from "@/lib/products"
import { apiGet } from "@/lib/api"

const KEY = "handloomer_recently_viewed_v1"
const MAX = 12

// Recently Viewed: local-only, non-sensitive IDs, never blocks main product.
// Stores productIds; fetches lightweight cards lazily after mount.
export function RecentlyViewed({ currentId }: { currentId: string }) {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      const ids: string[] = raw ? JSON.parse(raw) : []
      const next = [currentId, ...ids.filter((x) => x !== currentId)].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let ids: string[] = []
      try {
        ids = JSON.parse(localStorage.getItem(KEY) || "[]")
      } catch { return }
      const others = ids.filter((x) => x !== currentId).slice(0, 8)
      if (others.length === 0) return
      // No bulk endpoint — paginated list + client filter is bounded (8 ids).
      // Fetch one small page and keep only recent IDs (no N requests).
      try {
        const data = await apiGet(`/api/product/allproducts?limit=100&fullData=false`)
        if (cancelled || !data.success) return
        const byId = new Map(data.products.map((d: any) => [String(d._id), d]))
        const mapped: Product[] = others
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((d: any) => ({
            id: String(d._id),
            sku: d.sku,
            name: d.name,
            slug: `${d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${d.sku}`,
            category: d.category,
            categorySlug: String(d.category || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            price: d.price,
            originalPrice: d.regularPrice || d.price,
            image: d.mainImage,
            images: [d.mainImage].filter(Boolean),
            description: "",
            details: [],
            fabric: d.material || "Linen",
            color: d.color || "Multicolor",
            isOnSale: Boolean(d.isOnSale),
            isFeatured: true,
            isNew: Boolean(d.isNewArrival),
            stock: d.stock,
            averageRating: d.averageRating || 0,
            totalReviews: d.numReviews || 0,
          }))
        if (!cancelled) setProducts(mapped)
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [currentId])

  if (products.length === 0) return null
  return (
    <section className="py-8 sm:py-12 bg-background">
      <div className="max-w-[1500px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16">
        <h2 className="font-serif text-2xl sm:text-3xl mb-8">Recently Viewed</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

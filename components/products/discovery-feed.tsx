"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ProductCard } from "@/components/products/product-card"
import type { Product } from "@/lib/products"
import { apiGet } from "@/lib/api"

export const DESKTOP_MAX_ITEMS = 20
export const MOBILE_MAX_ITEMS = 10

// Discovery recommendations: limited to 20 products on desktop and 10 on mobile.
// No continuous/infinite fetching of the entire catalog on the product page.
// Single-flight + generation guard, lightweight cards only.
export function DiscoveryFeed({ productId }: { productId: string; productSlug?: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [maxLimit, setMaxLimit] = useState(DESKTOP_MAX_ITEMS)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const seenRef = useRef<Set<string>>(new Set([productId]))
  const cursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const generationRef = useRef(0)
  const maxLimitRef = useRef(DESKTOP_MAX_ITEMS)

  // Detect responsive limit: 10 on mobile (<768px), 20 on desktop
  useEffect(() => {
    const computeLimit = () => (window.innerWidth < 768 ? MOBILE_MAX_ITEMS : DESKTOP_MAX_ITEMS)
    const limit = computeLimit()
    setMaxLimit(limit)
    maxLimitRef.current = limit

    const onResize = () => {
      const next = computeLimit()
      if (next !== maxLimitRef.current) {
        maxLimitRef.current = next
        setMaxLimit(next)
      }
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // Reset when navigating A → B (new feed, no A leakage).
  useEffect(() => {
    generationRef.current += 1
    seenRef.current = new Set([productId])
    cursorRef.current = null
    hasMoreRef.current = true
    loadingRef.current = false
    setProducts([])
    setHasMore(true)
    setIsLoadingMore(true)
    setFailed(false)
  }, [productId, retryKey])

  const loadMore = async () => {
    if (loadingRef.current || !hasMoreRef.current) return
    const limitTarget = maxLimitRef.current
    loadingRef.current = true
    setIsLoadingMore(true)
    const generation = generationRef.current
    try {
      const cursor = cursorRef.current
      const url = `/api/product/recommendations/${productId}?limit=${limitTarget}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
      const data = await apiGet(url)
      // Navigated away / reset while in flight: discard late response.
      if (generation !== generationRef.current) return
      if (!data.success || !Array.isArray(data.products)) throw new Error(data.message || "Failed to load")
      const mapped: Product[] = data.products
        .filter((d: any) => !seenRef.current.has(String(d._id)))
        .map((d: any) => {
          seenRef.current.add(String(d._id))
          return {
            id: String(d._id),
            sku: d.sku,
            name: d.name,
            slug: d.slug || `${d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${d.sku}`,
            category: d.category,
            categorySlug: String(d.category || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            price: d.price,
            originalPrice: d.regularPrice || d.price,
            image: d.mainImage,
            images: [d.mainImage, d.alternateImage].filter(Boolean),
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
          }
        })
      
      let nextTotal = 0
      setProducts((prev) => {
        const combined = [...prev, ...mapped]
        nextTotal = combined.length
        return combined.slice(0, limitTarget)
      })

      cursorRef.current = data.nextCursor ?? null
      // Stop requesting once we reach limitTarget (10 on mobile, 20 on desktop) or backend runs out
      const stillHasMore = Boolean(data.hasMore) && nextTotal < limitTarget
      hasMoreRef.current = stillHasMore
      setHasMore(stillHasMore)
    } catch {
      if (generation !== generationRef.current) return
      // Main product stays usable; only discovery shows retry.
      setFailed(true)
    } finally {
      if (generation !== generationRef.current) return
      loadingRef.current = false
      setIsLoadingMore(false)
    }
  }

  // Keep a ref to the latest loader
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  // Initial load when productId, retryKey, or limit target initializes
  useEffect(() => {
    loadMoreRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, retryKey])

  const visibleProducts = products.slice(0, maxLimit)

  return (
    <section className="py-8 sm:py-16 bg-secondary">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-sm tracking-[0.2em] uppercase text-muted-foreground mb-2">You May Also Like</p>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl">More To Explore</h2>
          </div>
          <Link href="/collections" className="inline-flex items-center gap-2 text-sm tracking-wide uppercase hover:text-primary transition-colors group">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
          {visibleProducts.map((p, i) => (
            <ProductCard key={p.id} product={p} eager={i < 4} />
          ))}
          {isLoadingMore && (
            <>
              {Array.from({ length: Math.min(4, maxLimit) }).map((_, i) => (
                <div key={i} className="aspect-[500/650] bg-muted animate-pulse" />
              ))}
            </>
          )}
        </div>
        {failed && !isLoadingMore && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">Couldn&apos;t load more sarees.</p>
            <button onClick={() => { setFailed(false); setRetryKey((k) => k + 1) }} className="text-sm underline">Retry</button>
          </div>
        )}
        {!hasMore && visibleProducts.length > 0 && !isLoadingMore && (
          <p className="text-center text-xs text-muted-foreground py-8">You&apos;ve explored all matching sarees.</p>
        )}
      </div>
    </section>
  )
}

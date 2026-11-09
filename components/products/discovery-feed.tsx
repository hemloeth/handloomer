"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ProductCard } from "@/components/products/product-card"
import type { Product } from "@/lib/products"
import { apiGet } from "@/lib/api"

export const DISCOVERY_BATCH = 8

// Continuous discovery: small batches, cursor pagination, IntersectionObserver
// sentinel (600px lookahead), single-flight + generation guard (apiGet has no
// AbortSignal), lightweight cards only. First batch streams behind Suspense
// so ProductDetails never waits for it.
export function DiscoveryFeed({ productId }: { productId: string; productSlug?: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const seenRef = useRef<Set<string>>(new Set([productId]))
  const cursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const generationRef = useRef(0)

  // Reset when navigating A → B (new feed, no A leakage).
  useEffect(() => {
    generationRef.current += 1
    seenRef.current = new Set([productId])
    cursorRef.current = null
    hasMoreRef.current = true
    loadingRef.current = true
    setProducts([])
    setHasMore(true)
    setIsLoadingMore(true)
    setFailed(false)
  }, [productId, retryKey])

  const loadMore = async () => {
    if (loadingRef.current || !hasMoreRef.current) return
    loadingRef.current = true
    setIsLoadingMore(true)
    const generation = generationRef.current
    try {
      const cursor = cursorRef.current
      const url = `/api/product/recommendations/${productId}?limit=${DISCOVERY_BATCH}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
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
      setProducts((prev) => [...prev, ...mapped])
      cursorRef.current = data.nextCursor ?? null
      hasMoreRef.current = Boolean(data.hasMore)
      setHasMore(hasMoreRef.current)
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

  // Keep a ref to the latest loader so the observer never uses stale cursor.
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  // Initial batch.
  useEffect(() => {
    loadMoreRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, retryKey])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current()
      },
      { rootMargin: "600px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, products.length])

  return (
    <section className="py-8 sm:py-16 bg-secondary">
      <div className="max-w-[1500px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16">
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
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} eager={i < 4} />
          ))}
          {isLoadingMore && (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[500/650] bg-muted animate-pulse" />
              ))}
            </>
          )}
        </div>
        <div ref={sentinelRef} className="h-2" />
        {failed && !isLoadingMore && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">Couldn&apos;t load more sarees.</p>
            <button onClick={() => { setFailed(false); setRetryKey((k) => k + 1) }} className="text-sm underline">Retry</button>
          </div>
        )}
        {!hasMore && products.length > 0 && !isLoadingMore && (
          <p className="text-center text-xs text-muted-foreground py-8">You&apos;ve explored all matching sarees.</p>
        )}
      </div>
    </section>
  )
}

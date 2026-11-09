"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ProductCard, CardImage } from "@/components/products/product-card"
import type { Product } from "@/lib/products"
import { apiGet } from "@/lib/api"

type Discovery = { products: Product[]; nextCursor: string | null; hasMore: boolean }

export const DISCOVERY_BATCH = 8

// Continuous discovery: small batches, cursor pagination, IntersectionObserver
// sentinel (500px lookahead), single-flight + AbortController, lightweight
// cards only. First batch streams in a Suspense boundary so ProductDetails
// never waits for it.
export function DiscoveryFeed({ productId, productSlug }: { productId: string; productSlug?: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const seenRef = useRef<Set<string>>(new Set([productId]))

  // Reset when navigating A → B (new feed, no A leakage).
  useEffect(() => {
    seenRef.current = new Set([productId])
    setProducts([])
    setNextCursor(null)
    setHasMore(true)
    setIsLoadingMore(true)
    setFailed(false)
    abortRef.current?.abort()
  }, [productId, retryKey])

  useEffect(() => {
    if (!hasMore || isLoadingMore) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: "600px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoadingMore, nextCursor, productId])

  const loadMore = async () => {
    if (isLoadingMore && products.length > 0) return
    if (!hasMore) return
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    setIsLoadingMore(true)
    try {
      const cursor = nextCursor
      const url = `/api/product/recommendations/${productId}?limit=${DISCOVERY_BATCH}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
      const data = await apiGet(url)
      if (ctl.signal.aborted) return
      if (!data.success || !Array.isArray(data.products)) throw new Error(data.message || "Failed to load")
      // Lightweight card → Product shape. alternateImage becomes images[1].
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
      setNextCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.hasMore))
    } catch {
      if (ctl.signal.aborted) return
      // Main product stays usable; only discovery shows retry.
      setFailed(true)
    } finally {
      if (!ctl.signal.aborted) setIsLoadingMore(false)
    }
  }

  // Initial batch.
  useEffect(() => {
    loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, retryKey])

  useEffect(() => () => abortRef.current?.abort(), [])

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
          {isLoadingMore && products.length === 0 && (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[500/650] bg-muted animate-pulse" />
              ))}
            </>
          )}
          {isLoadingMore && products.length > 0 && (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`skel-${i}`} className="aspect-[500/650] bg-muted animate-pulse" />
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

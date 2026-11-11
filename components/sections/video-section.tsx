"use client"

import Link from "next/link"
import { useRef, useState, useEffect } from "react"
import { Heart, ShoppingBag, Play, Pause } from "lucide-react"
import { useCart } from "@/context/cart-context"
import { useWishlist } from "@/context/wishlist-context"
import { fetchPaginatedProductsClient, type Product } from "@/lib/products"
import { useInView } from "react-intersection-observer"
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-utils"
import { resolveMediaUrl } from "@/lib/media"

interface VideoCardProps {
  product: any
}

function VideoCard({ product }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const { addToCart } = useCart()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  
  // 1. Observer for playing/pausing when visible
  const { ref: inViewRef, inView } = useInView({
    // Start playing when it's 100px away from the screen, so it's ready when visible
    rootMargin: "100px 0px", 
    threshold: 0,
  })

  // 2. Observer for lazy mounting (DOM virtualization)
  const { ref: mountRef, inView: isNearScreen } = useInView({
    // Mount the video when it's 1200px (about 1.5 screens) away
    rootMargin: "1200px 0px", 
    triggerOnce: true,
  })

  // Helper to merge refs
  const setRefs = (node: HTMLDivElement | null) => {
    inViewRef(node)
    mountRef(node)
  }

  useEffect(() => {
    if (videoRef.current) {
      if (inView) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            // Auto-play was prevented
            setIsPlaying(false)
          });
        }
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
  }, [inView])

  const price = product.price
  const originalPrice = product.originalPrice || price
  const discount = Math.round(((originalPrice - price) / originalPrice) * 100)
  const isWishlisted = isInWishlist(product.id)
  const videoSrc = product.videos?.[0] ? optimizeCloudinaryUrl(product.videos[0], 'video') : ""

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleWishlistClick = () => {
    if (isWishlisted) {
      removeFromWishlist(product.id)
    } else {
      addToWishlist(product)
    }
  }

  if (!videoSrc) return null

  return (
    <div className="group relative w-full block">
      <div className="relative w-full mb-4" ref={setRefs}>
        <div className="aspect-[3/4] overflow-hidden bg-black rounded-sm relative">
          <Link href={`/product/${product.slug}`} className="absolute inset-0 z-0" aria-label={`View ${product.name}`}>
            <span className="sr-only">View {product.name}</span>
          </Link>
          {isNearScreen && (
            <video
              ref={videoRef}
              src={videoSrc}
              poster={product.image ? resolveMediaUrl(product.image) : (product.images?.[0] ? resolveMediaUrl(product.images[0]) : undefined)}
              loop
              muted
              playsInline
              preload="metadata"
              disablePictureInPicture
              disableRemotePlayback
              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105 pointer-events-none"
              onLoadedData={() => { if (inView) setIsPlaying(true) }}
            />
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Badges */}
          <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 flex flex-col gap-1 z-10 max-w-[calc(100%-2rem)] md:max-w-[calc(100%-3rem)] group-hover:-translate-y-10 md:group-hover:-translate-y-16 transition-transform duration-500 pointer-events-none">
            {discount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1 font-medium rounded-sm whitespace-nowrap inline-block">
                {discount}% OFF
              </span>
            )}
            <span className="bg-background/90 text-foreground text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1 font-medium rounded-sm whitespace-nowrap inline-block">
              {product.category}
            </span>
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              togglePlay()
            }}
            className="absolute top-1 right-8 md:top-2 md:right-12 p-1.5 md:p-2 bg-background/90 hover:bg-background rounded-full transition-colors opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
            suppressHydrationWarning
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 md:w-4 md:h-4" />
            ) : (
              <Play className="w-3 h-3 md:w-4 md:h-4" />
            )}
          </button>

          {/* Quick Actions */}
          <div className="absolute top-1 right-1 md:top-2 md:right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleWishlistClick()
              }}
              className={`p-1.5 md:p-2 bg-background/90 hover:bg-background rounded-full transition-colors shadow-sm cursor-pointer ${isWishlisted ? 'text-primary' : ''
                }`}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              suppressHydrationWarning
            >
              <Heart className={`w-3 h-3 md:w-4 md:h-4 ${isWishlisted ? 'fill-primary' : ''}`} />
            </button>
          </div>

          {/* Add to Cart Button */}
          <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-500 z-10">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                addToCart(product)
              }}
              className="w-full bg-background/95 hover:bg-white py-2 md:py-4 px-2 md:px-4 flex items-center justify-center gap-1 md:gap-2 text-[10px] md:text-sm btn-premium text-foreground border border-foreground/5 cursor-pointer"
              suppressHydrationWarning
            >
              <ShoppingBag className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Add to Cart</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>

          {/* Click to View Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-background/95 text-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg">
              View Details
            </div>
          </div>
        </div>
      </div>

      <div className="block">
        <Link href={`/product/${product.slug}`} className="block group-hover:text-primary transition-colors">
          <h3 className="font-medium text-xs md:text-sm leading-tight mb-1 md:mb-2 line-clamp-2">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center gap-1 md:gap-2 flex-wrap">
          <span className="font-semibold text-xs md:text-sm">₹{price.toLocaleString('en-IN')}</span>
          {discount > 0 && (
            <span className="text-[10px] md:text-sm text-muted-foreground line-through">
              ₹{originalPrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function VideoSection() {
  const [productsToShow, setProductsToShow] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchVideos = async () => {
      try {
        const { products } = await fetchPaginatedProductsClient({
          hasVideo: "true",
          limit: 12,
          sortBy: "newest",
        })
        if (!cancelled && products) {
          setProductsToShow(products)
        }
      } catch (err) {
        console.error("Failed to load video section products:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchVideos()
    return () => { cancelled = true }
  }, [])

  if (loading || productsToShow.length === 0) {
    return null
  }

  return (
    <section className="py-16 md:py-20 bg-gradient-to-br from-background to-secondary/30">
      <div className="max-w-[1500px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-foreground mb-3">
            Experience Our Sarees
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto font-light">
            Watch our handcrafted collection in motion with these exclusive video showcases
          </p>
        </div>

        {/* Video Grid - 4 columns on desktop for exactly 3 rows of 4 videos */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {productsToShow.map((product) => (
            <VideoCard
              key={product.id}
              product={product}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-4 mb-8">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
            <p className="text-sm text-muted-foreground tracking-wide">
              Discover more in our complete collection
            </p>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
          </div>
          <Link
            href="/video-collection"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground px-12 py-4 rounded-none font-bold btn-premium shadow-lg group"
            suppressHydrationWarning
          >
            <div className="absolute inset-0 animate-shimmer opacity-20 pointer-events-none" />
            <span className="relative z-10">View All Video Collection</span>
            <svg className="w-5 h-5 relative z-10 group-hover:translate-x-2 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}

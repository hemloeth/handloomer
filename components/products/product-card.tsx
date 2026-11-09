"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Heart, ShoppingBag, Check } from "lucide-react"
import { useCart } from "@/context/cart-context"
import { useWishlist } from "@/context/wishlist-context"
import { StarRating } from "@/components/common/star-rating"
import type { Product } from "@/lib/products"
import { cn } from "@/lib/utils"
import { resolveMediaUrl } from "@/lib/media"
interface ProductCardProps {
  product: Product
  className?: string
}

const CARD_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"

// Intent-based prefetch: Link renders prefetch={false} until hover/focus/touch,
// then Next prefetches only that product (deduped by Next). Native <Link>,
// so modifier-click / new-tab still works; no preventDefault.
function ProductLink({ href, className, children, onMouseEnter, onMouseLeave, onFocus, onBlur }: { href: string; className?: string; children: React.ReactNode; onMouseEnter?: () => void; onMouseLeave?: () => void; onFocus?: () => void; onBlur?: () => void }) {
  const [intent, setIntent] = useState(false)
  const combine = (a?: () => void) => () => { setIntent(true); a?.() }
  return (
    <Link href={href} className={className} prefetch={intent ? undefined : false} onMouseEnter={combine(onMouseEnter)} onMouseLeave={onMouseLeave} onFocus={combine(onFocus)} onBlur={onBlur} onTouchStart={() => setIntent(true)}>
      {children}
    </Link>
  )
}

export function CardImage({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <span className="relative block w-full aspect-[500/650] bg-muted overflow-hidden">
      <Image src={src} alt={alt} width={500} height={650} sizes={CARD_SIZES} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} onLoad={() => setLoaded(true)} className={`w-full h-auto block transition-all duration-500 ${loaded ? "opacity-100" : "opacity-0"} group-hover:scale-105`} />
      {!loaded && <span className="absolute inset-0 bg-muted animate-pulse" aria-hidden="true" />}
    </span>
  )
}

export function ProductCard({ product, className, eager = false }: ProductCardProps & { eager?: boolean }) {
  const { addToCart } = useCart()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  const [isAdded, setIsAdded] = useState(false)
  const [mounted, setMounted] = useState(false)
 
  useEffect(() => {
    setMounted(true)
  }, [])

  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
  const isWishlisted = mounted ? isInWishlist(product.id) : false

  const avgRating = product.averageRating || 0
  const totalReviews = product.totalReviews || 0
  const outOfStock = product.stock !== undefined && product.stock <= 0

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    addToCart(product)
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 2500)
  }

  const handleWishlistClick = () => {
    if (isWishlisted) {
      removeFromWishlist(product.id)
    } else {
      addToWishlist(product)
    }
  }

  const [hovered, setHovered] = useState(false)
  const secondImage = product.images?.[1]

  return (
    <div className={cn("group relative w-full max-w-[280px] mx-auto", className)}>
      <div className="relative w-full mb-4">
        <div className="relative overflow-hidden rounded-sm">
          <ProductLink href={`/product/${product.slug}`} className="block w-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}>
            <CardImage src={product.image || "/placeholder.svg"} alt={product.name} eager={eager} />
            {secondImage && hovered && (
              <span className="absolute inset-0">
                <CardImage src={secondImage} alt={`${product.name} alternate view`} />
              </span>
            )}
          </ProductLink>
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-2 z-20 pointer-events-none">
            {outOfStock && (
              <span className="bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider backdrop-blur-sm shadow-sm hidden md:inline-block">
                Out of Stock
              </span>
            )}
            {outOfStock && (
              <span className="bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider backdrop-blur-sm shadow-sm md:hidden text-center leading-none">
                Sold Out
              </span>
            )}
          </div>

          {/* Quick Actions (Wishlist) */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            <button
              onClick={(e) => { e.preventDefault(); handleWishlistClick(); }}
              className={`p-2 bg-background/95 hover:bg-background rounded-full transition-all shadow-sm active:scale-95 ${isWishlisted ? 'text-primary' : ''
                }`}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              suppressHydrationWarning
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-primary' : ''}`} />
            </button>
          </div>


        </div>
      </div >

      <ProductLink href={`/product/${product.slug}`} className="block">
        <h3 className="font-medium text-xs md:text-sm leading-tight mb-1 md:mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {product.name}
        </h3>

        {/* Reviews - Always visible */}
        <div className="flex items-center gap-1 mb-1.5 md:mb-2">
          <StarRating
            rating={totalReviews > 0 ? avgRating : 0}
            size="sm"
          />
          <span className="text-[9px] md:text-[10px] text-muted-foreground">
            {totalReviews > 0 ? `(${totalReviews})` : "(0)"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap mb-3 md:mb-4">
          <span className="font-bold text-xs md:text-base">₹{product.price.toLocaleString('en-IN')}</span>
          {product.originalPrice > product.price && (
            <>
              <span className="text-[9px] md:text-xs text-muted-foreground line-through decoration-muted-foreground/50">
                ₹{product.originalPrice.toLocaleString('en-IN')}
              </span>
              <span className="text-red-600 text-[9px] md:text-[10px] font-bold">
                -{discount}%
              </span>
            </>
          )}
        </div>
      </ProductLink>

      <div className="flex gap-1.5 md:gap-2 h-9 md:h-10">
        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          className={`w-10 md:w-12 h-full flex items-center justify-center transition-all duration-300 rounded-sm active:scale-95 shadow-sm ${outOfStock
            ? "bg-muted text-muted-foreground cursor-not-allowed active:scale-100"
            : isAdded
              ? "bg-green-600 text-white scale-105"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          title={outOfStock ? "Out of Stock" : "Add to Cart"}
          suppressHydrationWarning
        >
          {isAdded ? (
            <Check className="w-4 h-4 animate-[bounceIn_0.4s_ease-out]" />
          ) : (
            <ShoppingBag className="w-4 h-4" />
          )}
        </button>
        {outOfStock ? (
          <div className="flex-1 h-full flex items-center justify-center bg-muted/50 border border-muted text-muted-foreground px-3 text-[10px] md:text-xs font-bold rounded-sm uppercase tracking-wider cursor-not-allowed">
            Out of Stock
          </div>
        ) : (
          <Link
            href={`/checkout?product=${product.id}`}
            className="flex-1 h-full"
            onClick={() => addToCart(product)}
          >
            <button 
              className="w-full h-full flex items-center justify-center bg-background border border-primary text-primary hover:bg-primary/5 px-3 text-[10px] md:text-xs font-bold transition-all rounded-sm active:scale-95 shadow-sm uppercase tracking-wider"
              suppressHydrationWarning
            >
              Buy Now
            </button>
          </Link>
        )}
      </div>
    </div >
  )
}

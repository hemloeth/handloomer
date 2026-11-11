import { cache, Suspense } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ProductDetails } from "@/components/products/product-details"
import { ProductReviews } from "@/components/products/product-reviews"
import { JsonLd } from "@/components/common/json-ld"
import { DiscoveryFeed } from "@/components/products/discovery-feed"
import { RecentlyViewed } from "@/components/products/recently-viewed"
import { fetchProductBySku, fetchProductBySlug, fetchPaginatedProducts } from "@/lib/products"
import type { Product } from "@/lib/products"
import { notFound } from "next/navigation"
import { resolveMediaUrl } from "@/lib/media"
import { getOpenGraphImageUrl } from "@/lib/cloudinary-utils"
import type { Metadata } from "next"

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ slug: string }>
}

const getProduct = cache(async (slug: string): Promise<Product | null> => {
  // 1. Candidate SKU suffixes if slug contains hyphens (supports hyphens inside SKUs)
  if (slug.includes('-')) {
    const parts = slug.split('-');
    for (let segs = 1; segs < parts.length && segs <= 6; segs++) {
      const candidateSku = parts.slice(parts.length - segs).join('-');
      const product = await fetchProductBySku(candidateSku);
      if (product) return product;
    }
  }

  // 2. Direct SKU attempt
  const directSkuProduct = await fetchProductBySku(slug);
  if (directSkuProduct) return directSkuProduct;

  // 3. Fallback to /api/product/by-slug/:slug (full data resolution for legacy name slugs)
  const productBySlug = await fetchProductBySlug(slug);
  if (productBySlug) return productBySlug;

  return null;
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    return {
      title: "Product Not Found | Handloomer"
    }
  }

  const images = []
  if (product.image) images.push(resolveMediaUrl(product.image))
  if (product.images) images.push(...product.images.map(img => resolveMediaUrl(img)))

  const finalImages = images.length > 0 ? images : ["/placeholder.svg"]

  const ogImageUrl = getOpenGraphImageUrl(finalImages[0]);

  return {
    title: `${product.name} | Handloomer`,
    description: product.description,
    openGraph: {
      title: `${product.name} | Handloomer`,
      description: product.description,
      url: `/product/${slug}`,
      siteName: 'Handloomer',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
      locale: 'en_IN',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | Handloomer`,
      description: product.description,
      images: [ogImageUrl],
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params

  const product = await getProduct(slug);

  if (!product) {
    notFound()
  }
  // Product core streams first; Related fetches behind Suspense so it
  // never blocks image/price/CTA rendering.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": product.images,
    "description": product.description,
    "sku": product.id,
    "brand": {
      "@type": "Brand",
      "name": "Handloomer"
    },
    "offers": {
      "@type": "Offer",
      "url": `${process.env.NEXT_PUBLIC_BASE_URL || ''}/product/${product.slug}`,
      "priceCurrency": "INR",
      "price": product.price,
      "itemCondition": "https://schema.org/NewCondition",
      "availability": product.stock && product.stock > 0 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock"
    },
    ...(product.averageRating && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": product.averageRating,
        "reviewCount": product.totalReviews || 0
      }
    })
  }

  // Discovery replaces static related: first batch (8) is the Suspense
  // boundary; infinite batches append as user scrolls. Main product above
  // never waits for it.
  return (
    <main className="min-h-screen">
      <Header />
      <JsonLd data={jsonLd} />

      <div style={{ paddingTop: 'calc(var(--header-offset))' }}>
        <ProductDetails product={product} />

        {/* Reviews Section */}
        <div id="reviews">
          <ProductReviews productId={product.id} productName={product.name} />
        </div>

        <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading more sarees…</div>}>
          <DiscoveryFeed productId={product.id} productSlug={product.slug} />
        </Suspense>

        <RecentlyViewed currentId={product.id} />
      </div>

      <Footer />
    </main>
  )

}

export async function generateStaticParams() {
  const { products } = await fetchPaginatedProducts({ limit: 50 })
  return (products || []).map((product) => ({
    slug: product.slug,
  }))
}

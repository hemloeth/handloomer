import { cache, Suspense } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ProductDetails } from "@/components/products/product-details"
import { ProductReviews } from "@/components/products/product-reviews"
import { JsonLd } from "@/components/common/json-ld"
import { RelatedProducts } from "@/components/products/related-products"
import { fetchProductBySku, fetchPaginatedProducts, fetchProductsFromDB } from "@/lib/products"
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
  // Extract SKU from the end of the URL slug (e.g., name-slug-SKU)
  const parts = slug.split('-');
  const sku = parts[parts.length - 1];
  
  if (sku) {
    const product = await fetchProductBySku(sku);
    if (product) return product;
  }

  // Fallback for old URLs or URLs where SKU parsing failed
  const products = await fetchProductsFromDB();
  const product = products.find(p => {
    const oldSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    return p.slug === slug || oldSlug === slug;
  });

  return product || null;
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

  async function RelatedSection() {
    const p = product as Product
    const relatedResponse = await fetchPaginatedProducts({ category: p.category, limit: 5 });
    const relatedProducts = relatedResponse.products.filter(x => x.id !== p.id).slice(0, 4);
    return <RelatedProducts products={relatedProducts} category={p.category} />
  }

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

        <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading related products…</div>}>
          <RelatedSection />
        </Suspense>
      </div>

      <Footer />
    </main>
  )
}

export async function generateStaticParams() {
  const products = await fetchProductsFromDB()
  return products.map((product) => ({
    slug: product.slug,
  }))
}

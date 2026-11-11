import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PageHeroSlider } from "@/components/sections/page-hero-slider"
import { CategoryProductsClient } from "../categories/[slug]/category-products-client"
import { fetchPaginatedProducts } from "@/lib/products"
import { apiServerGet } from "@/lib/api"
import Link from "next/link"
import { Suspense } from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Best Sellers - Handloomer | Handpicked Customer Favorites",
  description: "Discover our most loved and best-selling pure linen and silk sarees. Handcrafted favorites with 5-star reviews.",
}

interface BestSellersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const bestSellerSlides = [
  {
    id: "best-sellers-main",
    image: "/images/celebrity-linen-couture-banner.jpg",
    title: "Best Sellers",
    subtitle: "Our most coveted handcrafted sarees, loved and reviewed by thousands"
  }
]

const breadcrumbs = [
  { label: "Home", href: "/" },
  { label: "Collections", href: "/collections" },
  { label: "Best Sellers" }
]

export default async function BestSellersPage({ searchParams }: BestSellersPageProps) {
  const resolvedSearchParams = await searchParams

  // Fetch paginated products with isBestSeller: "true"
  const { products: paginatedProducts, pagination } = await fetchPaginatedProducts({
    ...resolvedSearchParams,
    sort: resolvedSearchParams.sort || "featured",
    isBestSeller: "true",
    limit: 20
  })

  // Fallback to featured query if no products flagged as best seller
  let displayProducts = paginatedProducts
  let currentPagination = pagination
  if (!displayProducts || displayProducts.length === 0) {
    const featuredRes = await fetchPaginatedProducts({
      ...resolvedSearchParams,
      sortBy: "featured",
      limit: 20
    })
    displayProducts = featuredRes.products
    currentPagination = featuredRes.pagination
  }

  // Fetch marketing collections for the subnav
  const colRes = await apiServerGet('/api/marketing-collections', { cache: 'no-store' }).catch(() => ({ success: false, data: [] }))
  const marketingCols = colRes.success && colRes.data ? colRes.data.filter((c: any) => c.key !== 'none') : []

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Hero Banner */}
      <div style={{ marginTop: "var(--header-offset)" }}>
        <PageHeroSlider
          slides={bestSellerSlides}
          height="40vh"
          breadcrumbs={breadcrumbs}
        />
      </div>

      {/* Collections / Sub-nav Bar */}
      <section className="bg-secondary border-b border-border py-8">
        <div className="max-w-[1500px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16">
          <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-3 lg:gap-4">
            <Link
              href="/collections"
              className="px-2 sm:px-6 py-2 border border-border hover:bg-foreground hover:text-background text-xs sm:text-sm tracking-wide transition-all text-center flex items-center justify-center"
            >
              All Collections
            </Link>
            <Link
              href="/best-sellers"
              className="px-2 sm:px-6 py-2 bg-foreground text-background shadow-md text-xs sm:text-sm tracking-wide transition-all text-center flex items-center justify-center font-medium"
            >
              Best Sellers
            </Link>
            <Link
              href="/collections/new-arrivals"
              className="px-2 sm:px-6 py-2 border border-border hover:bg-foreground hover:text-background text-xs sm:text-sm tracking-wide transition-all text-center flex items-center justify-center"
            >
              New Arrivals
            </Link>
            {marketingCols.map((col: any) => (
              <Link
                key={col.key}
                href={`/collections/${col.key}`}
                className="px-2 sm:px-6 py-2 border border-border hover:bg-foreground hover:text-background text-xs sm:text-sm tracking-wide transition-all text-center flex items-center justify-center"
              >
                {col.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section with Sidebar Filters & Sorting */}
      <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading best sellers...</div>}>
        <CategoryProductsClient
          initialProducts={displayProducts}
          pagination={currentPagination}
          pageTitle="Best Sellers"
        />
      </Suspense>

      <Footer />
    </main>
  )
}

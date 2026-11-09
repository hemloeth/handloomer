import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { AutoScrollHero } from "@/components/sections/auto-scroll-hero"
import { NewCollections } from "@/components/sections/new-collections"
import { CategoryGrid } from "@/components/sections/category-grid"
import { CollectionBanners } from "@/components/sections/collection-banners"
import { VideoSection } from "@/components/sections/video-section"
import { FeaturedBanner } from "@/components/sections/featured-banner"
import { TrustSection } from "@/components/sections/trust-section"
import { NewsletterSection } from "@/components/sections/newsletter-section"
import { Footer } from "@/components/layout/footer"
import { apiServerGet } from "@/lib/api"
import { fetchNewestProducts } from "@/lib/products"

async function HeroSection() {
  const data = await apiServerGet('/api/hero', { revalidate: 60 }).catch(() => null)
  return <AutoScrollHero initialSlides={data?.slides ?? []} />
}

async function NewestSection() {
  const products = await fetchNewestProducts().catch(() => [])
  return <NewCollections initialProducts={products} />
}

async function CategoriesSection() {
  const data = await apiServerGet('/api/category/allcategory', { revalidate: 60 }).catch(() => null)
  return <CategoryGrid initialCategories={data?.categories ?? []} />
}

export default function Home() {
  // Shell renders immediately; each section streams independently behind
  // Suspense so one slow API can't block the logo/Home click feedback.
  return (
    <main className="min-h-screen">
      <Header />
      <Suspense fallback={<div className="min-h-[540px] bg-muted animate-pulse" />}>
        <HeroSection />
      </Suspense>
      <div>
        <Suspense fallback={<div className="py-16 bg-background"><div className="max-w-[1500px] mx-auto px-4"><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[500/650] bg-muted animate-pulse" />)}</div></div></div>}>
          <NewestSection />
        </Suspense>
        <Suspense fallback={null}>
          <CategoriesSection />
        </Suspense>
        <CollectionBanners />
        <VideoSection />
        <FeaturedBanner />

        <NewsletterSection />
        <TrustSection />
        <Footer />
      </div>
    </main>
  )
}

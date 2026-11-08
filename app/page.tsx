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

export default async function Home() {
  // Hero slides and categories are INDEPENDENT reads — fetch them in parallel
  // so the page waits on the slower of the two, not their sum (spec §12). Each
  // handles its own failure so one bad widget can't blank the whole homepage.
  // "Latest Arrivals" = newest 20 by createdAt DESC (backend-driven, not
  // sliced from the global 100-cap provider). no-store, so every full
  // refresh + client return to "/" gets live DB state.
  const [heroResult, catResult, newestResult] = await Promise.allSettled([
    apiServerGet('/api/hero', { revalidate: 60 }),
    apiServerGet('/api/category/allcategory', { revalidate: 60 }),
    fetchNewestProducts(),
  ])

  let heroSlides: any[] = []
  if (heroResult.status === "fulfilled" && heroResult.value && heroResult.value.slides) {
    heroSlides = heroResult.value.slides
  } else if (heroResult.status === "rejected") {
    console.error("Failed to fetch hero slides on server:", heroResult.reason)
  }

  let categories: any[] = []
  if (catResult.status === "fulfilled" && catResult.value && catResult.value.categories) {
    categories = catResult.value.categories
  } else if (catResult.status === "rejected") {
    console.error("Failed to fetch categories on server:", catResult.reason)
  }

  let newestProducts: any[] = []
  if (newestResult.status === "fulfilled" && newestResult.value) {
    newestProducts = newestResult.value
  } else if (newestResult.status === "rejected") {
    console.error("Failed to fetch newest products on server:", newestResult.reason)
  }

  return (
    <main className="min-h-screen">
      <Header />
      <AutoScrollHero initialSlides={heroSlides} />
      <div>
        <NewCollections initialProducts={newestProducts} />
        <CategoryGrid initialCategories={categories} />
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

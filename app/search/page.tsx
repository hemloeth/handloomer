"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { fetchPaginatedProductsClient, type FilterOptions, type SortOption, type Product } from "@/lib/products"
import { SearchResults } from "@/components/search/search-results"
import { PageHeroSlider } from "@/components/sections/page-hero-slider"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Search, X, Sparkles, SlidersHorizontal, ArrowLeft } from "lucide-react"

const searchSlides = [
  {
    id: "search-main",
    image: "/images/festive-collection-hero.jpg",
    title: "Find Your Perfect Saree",
    subtitle: "Search through our curated collection of premium linen sarees"
  },
  {
    id: "search-variety",
    image: "/images/celebrity-star-banner.jpg",
    title: "Endless Variety",
    subtitle: "From casual to festive, discover sarees for every occasion"
  },
  {
    id: "search-quality",
    image: "/images/celebrity-linen-couture-banner.jpg",
    title: "Premium Quality",
    subtitle: "Handcrafted sarees with attention to every detail"
  },
  {
    id: "search-colors",
    image: "/images/big-sale-banner.jpg",
    title: "Vibrant Colors",
    subtitle: "Explore our rainbow of colors and patterns"
  }
]

const POPULAR_TAGS = ['Pure Linen', 'Banarasi Silk', 'Handloom', 'Festive Saree', 'Golden Zari', 'Pink', 'Red', 'Organza']

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [filters, setFilters] = useState<FilterOptions>({})
  const [sortBy, setSortBy] = useState<SortOption>('featured')
  const [results, setResults] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ currentPage: number; totalPages: number; totalProducts: number } | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const generationRef = useRef(0)

  // Sync query from URL (one-way: URL -> state). Fetching is separate below.
  useEffect(() => {
    const searchQuery = searchParams.get('q') || ''
    setQuery(searchQuery)
    setInputValue(searchQuery)
    setPage(1)
    document.title = searchQuery
      ? `Search: ${searchQuery} - The Handloomer`
      : 'Search Products - The Handloomer'
  }, [searchParams])

  // Backend-driven search + filters + sort (full DB, not global-100).
  // Previous results stay visible during fetch; only latest wins; failed
  // fetch keeps valid results (no wipe).
  useEffect(() => {
    const generation = ++generationRef.current
    let cancelled = false
    setIsSearching(true)
    const params: Record<string, unknown> = {
      limit: 20,
      page,
      sortBy: sortBy,
    }
    if (query.trim()) params.search = query.trim()
    if (filters.categories?.length) params.category = filters.categories.join(',')
    if (filters.colors?.length) params.color = filters.colors.join(',')
    if (filters.fabrics?.length) params.material = filters.fabrics.join(',')
    if (filters.priceRange) {
      params.priceMin = filters.priceRange.min
      params.priceMax = filters.priceRange.max
    }
    if (filters.isOnSale !== undefined) params.isOnSale = String(filters.isOnSale)
    // `isNew` here is the explicit New Arrivals flag (isNewArrival=true).
    if (filters.isFeatured !== undefined) params.isFeatured = String(filters.isFeatured)
    if (filters.isNew !== undefined) params.isNewArrival = String(filters.isNew)
    ;(async () => {
      try {
        const { products, pagination: pag } = await fetchPaginatedProductsClient(params)
        if (cancelled || generation !== generationRef.current) return
        setResults(products || [])
        if (pag) {
          setPagination({
            currentPage: pag.currentPage,
            totalPages: pag.totalPages,
            totalProducts: pag.totalProducts
          })
        }
      } catch (err) {
        if (cancelled || generation !== generationRef.current) return
        console.error('Search failed', err)
      } finally {
        if (!cancelled && generation === generationRef.current) setIsSearching(false)
      }
    })()
    return () => { cancelled = true }
  }, [query, filters, sortBy, page])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    setQuery(trimmed)
    const url = new URL(window.location.href)
    if (trimmed) url.searchParams.set('q', trimmed)
    else url.searchParams.delete('q')
    window.history.pushState({}, '', url.toString())
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    setQuery(suggestion)
    const url = new URL(window.location.href)
    url.searchParams.set('q', suggestion)
    window.history.pushState({}, '', url.toString())
  }

  const handleClearSearch = () => {
    setInputValue('')
    setQuery('')
    const url = new URL(window.location.href)
    url.searchParams.delete('q')
    window.history.pushState({}, '', url.toString())
  }

  const handleFiltersChange = (newFilters: FilterOptions, newSortBy: SortOption) => {
    setFilters(newFilters)
    setSortBy(newSortBy)
  }

  return (
    <>
      {/* Hero Section with Auto-Scroll if no query */}
      {!query && (
        <div style={{ marginTop: "var(--header-offset)" }}>
          <PageHeroSlider slides={searchSlides} height="30vh" />
        </div>
      )}

      {/* Main Content */}
      <div className="bg-background py-10 lg:py-16" style={query ? { marginTop: "var(--header-offset)" } : undefined}>
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Search Bar & Header */}
          <div className="max-w-3xl mx-auto mb-10 text-center">
            {query && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <Link
                  href="/collections"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Collections</span>
                </Link>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-xs text-muted-foreground">Search Catalog</span>
              </div>
            )}

            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3 text-foreground">
              {query ? `Search Results` : `Search Collection`}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
              {query
                ? `Showing results for “${query}” (${results.length} found)${isSearching ? ' …' : ''}`
                : `Find your dream linen saree by color, weave, occasion, or style`}
            </p>

            {/* Interactive Search Input Box */}
            <form onSubmit={handleSearchSubmit} className="relative shadow-sm rounded-full bg-card border border-border/80 hover:border-primary/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all p-1.5 flex items-center gap-2">
              <div className="pl-3.5 text-muted-foreground">
                <Search className="w-5 h-5 text-primary" />
              </div>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search by saree name, fabric, color, SKU..."
                className="flex-1 bg-transparent px-2 py-2 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
              />

              {inputValue && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Clear search input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="submit"
                className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs sm:text-sm font-bold tracking-wide rounded-full transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                Search
              </button>
            </form>

            {/* Popular Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                Popular:
              </span>
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSuggestionClick(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                    query.toLowerCase() === tag.toLowerCase()
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/60 hover:bg-secondary text-foreground border-border"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Search Results Component */}
          <SearchResults
            products={results}
            query={query}
            pagination={pagination}
            onPageChange={setPage}
            onSuggestionClick={handleSuggestionClick}
            onFiltersChange={handleFiltersChange}
          />
        </div>
      </div>
    </>
  )
}

export default function SearchPage() {
  return (
    <main className="min-h-screen">
      <Header />

      <Suspense fallback={
        <div className="min-h-[50vh] flex items-center" style={{ marginTop: "var(--header-offset)" }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading search results...</p>
          </div>
        </div>
      }>
        <SearchContent />
      </Suspense>

      <Footer />
    </main>
  )
}

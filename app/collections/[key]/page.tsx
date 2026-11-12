"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useSearchParams, redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { apiGet } from "@/lib/api"
import { ProductCard } from "@/components/products/product-card"
import Image from "next/image"
import { motion } from "framer-motion"
import { Sparkles, ShoppingBag, Star } from "lucide-react"
import { fetchPaginatedProductsClient, categories } from "@/lib/products"
import { CategoryProductsClient } from "../../categories/[slug]/category-products-client"
import { Suspense } from "react"

interface Props {
    params: Promise<{ key: string }>
}

export default function MarketingCollectionDetailPage({ params }: Props) {
    const { key } = use(params)
    
    // SMART REDIRECT: If this is a category slug, send them to /categories/
    if (categories.some(c => c.slug === key)) {
        redirect(`/categories/${key}`);
    }

    const [collection, setCollection] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])
    const [pagination, setPagination] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const searchParams = useSearchParams()

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch collection details (with fallback for hardcoded default collections if they aren't in the DB yet)
                try {
                    const colResponse = await apiGet(`/api/marketing-collections/${key}`)
                    if (colResponse.success) {
                        setCollection(colResponse.data)
                        document.title = `${colResponse.data.name} | Handloomer`
                    }
                } catch (colErr) {
                    const fallbacks: Record<string, any> = {
                        'new-arrivals': { key: 'new-arrivals', name: 'New Arrivals', title1: 'Just', title2: 'Dropped', description: 'Explore our latest additions.', image: '/images/celebrity-star-banner.jpg', stats: [] },
                        'festive': { key: 'festive', name: 'Festive Collection', title1: 'Festive', title2: 'Special', description: 'Perfect sarees for your celebrations.', image: '/images/festive-collection-hero.jpg', stats: [] },
                        'big-sale': { key: 'big-sale', name: 'Big Sale', title1: 'Clearance', title2: 'Sale', description: 'Incredible discounts on premium sarees.', image: '/images/big-sale-banner.jpg', stats: [] },
                        'celebrity': { key: 'celebrity', name: 'Celebrity Looks', title1: 'Celebrity', title2: 'Style', description: 'Sarees inspired by the stars.', image: '/images/celebrity-linen-couture-banner.jpg', stats: [] },
                        'sale': { key: 'sale', name: 'Sale', title1: 'On', title2: 'Sale', description: 'Discounted items.', image: '/images/big-sale-banner.jpg', stats: [] }
                    }
                    if (fallbacks[key]) {
                        setCollection(fallbacks[key])
                        document.title = `${fallbacks[key].name} | Handloomer`
                    } else {
                        throw colErr;
                    }
                }

                // Backend-driven filtering + pagination + ordering
                const page = searchParams.get('page') || '1'
                const sortBy = searchParams.get('sortBy') || 'newest'
                const color = searchParams.get('color') || undefined
                const material = searchParams.get('material') || undefined
                const priceMin = searchParams.get('priceMin') || undefined
                const priceMax = searchParams.get('priceMax') || undefined
                const isOnSale = searchParams.get('isOnSale') || undefined
                const isFeatured = searchParams.get('isFeatured') || undefined

                const query: Record<string, any> = {
                    limit: 20,
                    page,
                    sortBy,
                    color,
                    material,
                    priceMin,
                    priceMax,
                    isOnSale,
                    isFeatured,
                    productCollection: key,
                }
                const { products: mapped, pagination: pag } = await fetchPaginatedProductsClient(query)
                setProducts(mapped || [])
                if (pag) setPagination(pag)
            } catch (error) {
                console.error("Error fetching collection data:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [key, searchParams])

    // Fetch all marketing collections for the sub-nav
    const [allCollections, setAllCollections] = useState<any[]>([])
    useEffect(() => {
        const fetchAll = async () => {
            const res = await apiGet('/api/marketing-collections')
            if (res.success) {
                setAllCollections(res.data.filter((c: any) => c.key !== 'none' && c.key !== 'new-arrivals'))
            }
        }
        fetchAll()
    }, [])

    if (isLoading) {
        return (
            <main className="min-h-screen bg-background">
                <Header />
                <div style={{ height: "var(--header-offset)" }} />

                {/* Skeleton loading — keeps the header and grid layout stable,
                    no full-page "Loading" text flash. */}
                <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="mb-3 h-8 w-52 rounded bg-muted animate-pulse" />
                    <div className="mb-8 h-4 w-72 rounded bg-muted/70 animate-pulse" />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="aspect-[2/3] md:aspect-[4/5] bg-muted rounded-sm" />
                                <div className="h-4 bg-muted rounded w-3/4 mt-4" />
                                <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                                <div className="h-4 bg-muted rounded w-1/3 mt-3" />
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        )
    }

    if (!collection) {
        return (
            <main className="min-h-screen bg-background">
                <Header />
                <div style={{ height: "var(--header-offset)" }} />
                <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
                    <h1 className="font-serif text-3xl mb-3">Collection not found</h1>
                    <p className="text-muted-foreground mb-6">We couldn't find the collection you were looking for.</p>
                    <Link
                        href="/collections"
                        className="inline-block px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Browse all collections
                    </Link>
                </div>
                <Footer />
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-background">
            <Header />

            {/* Spacer to clear the fixed header using its live measured height */}
            <div style={{ height: "var(--header-offset)" }} />

            {/* Collections Sub-nav */}
            {key !== 'new-arrivals' && (
                <section className="bg-secondary border-b border-border py-8">
                    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-3 lg:gap-4">
                            <Link
                                href="/collections"
                                className="px-2 sm:px-6 py-2 border border-border hover:bg-foreground hover:text-background text-xs sm:text-sm tracking-wide transition-all text-center flex items-center justify-center"
                            >
                                All Collections
                            </Link>
                            {allCollections.map((col: any) => (
                                <Link
                                    key={col.key}
                                    href={`/collections/${col.key}`}
                                    className={`px-2 sm:px-6 py-2 text-xs sm:text-sm tracking-wide transition-all text-center flex items-center justify-center ${col.key === key
                                        ? "bg-foreground text-background shadow-md"
                                        : "border border-border hover:bg-foreground hover:text-background"
                                        }`}
                                >
                                    {col.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Collection Stats/Offer Section */}
            {(collection.stats?.length > 0 || collection.offer) && (
                <section className="py-12 bg-secondary/30 border-b border-border">
                    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-wrap justify-center items-center gap-12 lg:gap-24">
                            {collection.key === 'big-sale' && collection.offer && (
                                <div className="text-center">
                                    <span className="block text-xs font-bold tracking-widest text-primary uppercase mb-1">Limited Time</span>
                                    <span className="text-4xl font-serif text-foreground">{collection.offer}</span>
                                </div>
                            )}

                            {collection.stats?.map((stat: any, idx: number) => (
                                <div key={idx} className="text-center">
                                    <span className="block text-3xl font-serif text-foreground">{stat.number}</span>
                                    <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Products Grid */}
            <Suspense fallback={<div className="py-20 text-center">Loading products...</div>}>
                <CategoryProductsClient
                    initialProducts={products}
                    pagination={pagination}
                    pageTitle={collection.name}
                />
            </Suspense>

            <Footer />
        </main>
    )
}

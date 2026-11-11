"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react"
import {
    type Product as FrontendProduct,
    type FilterOptions,
    type SortOption,
    getProductBySlug,
    getProductsByCategory,
    getFeaturedProducts,
    getNewProducts,
    getBestSellers,
    getUniqueColors,
    getUniqueFabrics,
    getPriceRange,
    filterProducts,
    sortProducts,
    PRODUCT_STALE_TIME_MS,
    searchProducts,
    mapProductFromDB
} from "@/lib/products"
import { apiGet, apiUpload, apiDelete, apiPut, apiPatch } from "@/lib/api"

export interface ImageInfo {
    url: string
    title: string
    description: string
    alt: string
    caption: string
    tags?: string[]
}

interface Product {
    _id: string
    name: string
    sku: string
    category: string
    regularPrice: number
    price: number
    stock: number
    shortDescription: string
    tags: string
    mainImage: string
    mainImageInfo?: ImageInfo
    galleryImages: ImageInfo[]
    color: string
    material: string
    sareeSize: string
    blouseSize: string
    washCare: string
    dispatch: string
    disclaimer: string
    internationalNote: string
    videoUrl: string
    videoFile: string
    isOnSale: boolean
    isFestive: boolean
    isNewArrival: boolean
    isFeatured?: boolean
    isBestSeller?: boolean
    productCollection?: string
    createdAt: string
}

interface ProductContextType {
    products: Product[]
    refreshProducts: () => Promise<void>
    addProduct: (formData: FormData) => Promise<Product | null>
    updateProduct: (id: string, formData: FormData) => Promise<Product | null>
    quickUpdateProduct: (id: string, updates: Partial<Product>) => Promise<Product | any>
    uploadVideo: (productId: string, videoFile: File) => Promise<void>
    deleteProduct: (id: string) => Promise<void>
    deleteMultipleProducts: (ids: string[]) => Promise<number>
    updateGalleryImageInfo: (productId: string, imageIndex: number, info: Partial<ImageInfo>) => Promise<void>
    loading: boolean
    isRefreshing: boolean
    error: string | null

    // Frontend Mapped Products & Helpers
    mappedProducts: FrontendProduct[]
    getProductBySlug: (slug: string) => FrontendProduct | undefined
    getProductsByCategory: (categorySlug: string) => FrontendProduct[]
    getFeaturedProducts: () => FrontendProduct[]
    getNewProducts: () => FrontendProduct[]
    getBestSellers: () => FrontendProduct[]
    getUniqueColors: () => string[]
    getUniqueFabrics: () => string[]
    getPriceRange: () => { min: number; max: number }
    filterProducts: (filters: FilterOptions) => FrontendProduct[]
    sortProducts: (list: FrontendProduct[], sortBy: SortOption) => FrontendProduct[]
    searchProducts: (query: string, filters?: FilterOptions, sort?: SortOption) => FrontendProduct[]
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

export function ProductProvider({ children, initialProducts = [] }: { children: ReactNode, initialProducts?: FrontendProduct[] }) {
    const [products, setProducts] = useState<Product[]>([])
    const [ssrProducts, setSsrProducts] = useState<FrontendProduct[]>(initialProducts)
    const [loading, setLoading] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Stale-time + race/dedupe guards. Backend stays no-store; stale-time
    // only gates whether a network request is sent when explicitly requested.
    // Background refreshes never clear `products` (list stays visible); a
    // failed refresh keeps valid catalog + logs (error surfaced, no UI wipe).
    const lastFetchedAtRef = useRef<number>(initialProducts.length > 0 ? Date.now() : 0)
    const generationRef = useRef(0)
    const inflightRef = useRef<Promise<void> | null>(null)

    // Catalog reads happen ONLY when a consumer explicitly requests them (e.g. via refreshProducts).
    // Storefront pages fetch their own targeted data (homepage, categories, collections, etc.);
    // do NOT automatically download 100 products globally on mount, route change, focus, or visibility change.
    const fetchProducts = useCallback(async (options?: { force?: boolean }) => {
        const force = options?.force ?? false
        // Dedupe simultaneous triggers
        if (inflightRef.current) return inflightRef.current
        // Skip when data is fresh
        if (!force && Date.now() - lastFetchedAtRef.current < PRODUCT_STALE_TIME_MS) {
            return
        }
        const generation = ++generationRef.current
        // Background refresh: keep list visible, only flag refreshing.
        const isBackground = products.length > 0 || ssrProducts.length > 0
        if (isBackground) setIsRefreshing(true)
        const run = (async () => {
            try {
                const data = await apiGet('/api/product/allproducts?limit=100&fullData=false', { cache: 'no-store' })
                // Only latest fetch may update state (slow A cannot beat fast B).
                if (generation !== generationRef.current) return
                if (data?.products) {
                    setProducts(data.products)
                    lastFetchedAtRef.current = Date.now()
                }
            } catch (err) {
                if (generation !== generationRef.current) return
                console.error("Failed to fetch products", err)
                setError(err instanceof Error ? err.message : "Failed to fetch products")
            } finally {
                if (generation === generationRef.current) {
                    inflightRef.current = null
                    setIsRefreshing(false)
                }
            }
        })()
        inflightRef.current = run
        return run
    }, [products.length, ssrProducts.length])

    // Cleanup in-flight requests on unmount
    useEffect(() => {
        return () => {
            generationRef.current++
        }
    }, [])

    const addProduct = async (formData: FormData): Promise<Product | null> => {
        setLoading(true)
        setError(null)

        try {
            const data = await apiUpload('/api/product/add-product', formData, 'POST')
            setProducts((prev) => [data.product, ...prev])
            lastFetchedAtRef.current = Date.now()
            return data.product
        } catch (err: any) {
            setError(err.message || "Something went wrong")
            throw err
        } finally {
            setLoading(false)
        }
    }

    const uploadVideo = async (productId: string, videoFile: File) => {
        const videoForm = new FormData()
        videoForm.append("videoFile", videoFile)
        const data = await apiUpload(`/api/product/upload-video/${productId}`, videoForm, 'PUT')
        // Update the product in state with video URL
        setProducts((prev) =>
            prev.map((p) => (p._id === productId ? data.product : p))
        )
    }

    const updateProduct = async (id: string, formData: FormData): Promise<Product | null> => {
        setLoading(true)
        setError(null)

        try {
            const data = await apiUpload(`/api/product/update/${id}`, formData, 'PUT')

            setProducts((prev) =>
                prev.map((p) => (p._id === id ? data.product : p))
            )
            lastFetchedAtRef.current = Date.now()
            return data.product
        } catch (err: any) {
            setError(err.message || "Something went wrong")
            throw err
        } finally {
            setLoading(false)
        }
    }

    const quickUpdateProduct = async (id: string, updates: Partial<Product>) => {
        try {
            const data = await apiPatch(`/api/product/quick-update/${id}`, updates)
            setProducts((prev) =>
                prev.map((p) => (p._id === id ? data.product : p))
            )
            if (data?.product) {
                setProducts((prev) =>
                    prev.map((p) => (p._id === id ? data.product : p))
                )
                return data.product
            }
            return data
        } catch (err: any) {
            console.error("Quick update failed", err)
            throw err
        }
    }

    const deleteProduct = async (id: string) => {
        setLoading(true)
        setError(null)
        try {
            await apiDelete(`/api/product/${id}`)
            setProducts((prev) => prev.filter((p) => p._id !== id))
            lastFetchedAtRef.current = Date.now()
        } catch (err: any) {
            setError(err.message || "Something went wrong")
            throw err
        } finally {
            setLoading(false)
        }
    }

    const deleteMultipleProducts = async (ids: string[]): Promise<number> => {
        setLoading(true)
        setError(null)

        try {
            const data = await apiDelete('/api/product/bulk-delete', { ids })

            const idSet = new Set(ids)
            setProducts((prev) => prev.filter((p) => !idSet.has(p._id)))
            return data.deletedCount
        } catch (err: any) {
            setError(err.message || "Something went wrong")
            throw err
        } finally {
            setLoading(false)
        }
    }

    const updateGalleryImageInfo = async (productId: string, imageIndex: number, info: Partial<ImageInfo>) => {
        const data = await apiPut(`/api/product/${productId}/gallery-image-info`, { imageIndex, ...info })
        setProducts((prev) =>
            prev.map((p) => (p._id === productId ? data.product : p))
        )
    }

    // Map the raw DB products to the frontend expected format using the canonical mapper
    const mappedProducts = useMemo(() => {
        if (products.length === 0 && ssrProducts.length > 0) {
            return ssrProducts;
        }

        return products.map(mapProductFromDB);
    }, [products, ssrProducts]);

    return (
        <ProductContext.Provider
            value={{
                products,
                refreshProducts: fetchProducts,
                addProduct,
                updateProduct,
                quickUpdateProduct,
                uploadVideo,
                deleteProduct,
                deleteMultipleProducts,
                updateGalleryImageInfo,
                loading,
                isRefreshing,
                error,

                // Frontend Helpers
                mappedProducts,
                getProductBySlug: (slug) => getProductBySlug(mappedProducts, slug),
                getProductsByCategory: (cat) => getProductsByCategory(mappedProducts, cat),
                getFeaturedProducts: () => getFeaturedProducts(mappedProducts),
                getNewProducts: () => getNewProducts(mappedProducts),
                getBestSellers: () => getBestSellers(mappedProducts),
                getUniqueColors: () => getUniqueColors(mappedProducts),
                getUniqueFabrics: () => getUniqueFabrics(mappedProducts),
                getPriceRange: () => getPriceRange(mappedProducts),
                filterProducts: (filters) => filterProducts(mappedProducts, filters),
                sortProducts: (list, sortBy) => sortProducts(list, sortBy),
                searchProducts: (query, filters, sort) => searchProducts(mappedProducts, query, filters, sort)
            }}
        >
            {children}
        </ProductContext.Provider>
    )
}

export function useProducts() {
    const context = useContext(ProductContext)
    if (context === undefined) {
        throw new Error("useProducts must be used within a ProductProvider")
    }
    return context
}

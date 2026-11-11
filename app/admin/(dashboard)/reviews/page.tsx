"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Star,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  MessageSquare,
  Clock,
  ShieldCheck,
  AlertCircle,
  Eye,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiGet, apiPut, apiDelete } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface AdminReviewProduct {
  _id: string
  name: string
  sku?: string
  mainImage?: string
  price?: number
  slug?: string
}

interface AdminReview {
  _id: string
  reviewerName: string
  reviewerEmail?: string
  rating: number
  title?: string
  comment: string
  photos?: string[]
  status: "pending" | "approved" | "rejected"
  isApproved: boolean
  product?: AdminReviewProduct | null
  user?: {
    _id: string
    name: string
    email?: string
  } | null
  createdAt: string
}

interface ReviewCounts {
  all: number
  pending: number
  approved: number
  rejected: number
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [counts, setCounts] = useState<ReviewCounts>({ all: 0, pending: 0, approved: 0, rejected: 0 })
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchReviews = useCallback(async (tab = activeTab, pageNum = page) => {
    setIsLoading(true)
    try {
      const statusParam = tab === "all" ? "" : `&status=${tab}`
      const res = await apiGet<{
        success: boolean
        reviews: AdminReview[]
        counts: ReviewCounts
        pagination: { page: number; limit: number; totalCount: number; totalPages: number }
      }>(`/api/review/admin/all?page=${pageNum}&limit=20${statusParam}`)

      if (res.success) {
        setReviews(res.reviews || [])
        if (res.counts) setCounts(res.counts)
        if (res.pagination) setTotalPages(res.pagination.totalPages || 1)
      }
    } catch (err: any) {
      console.error("Failed to fetch admin reviews:", err)
      toast.error(err.message || "Failed to load reviews.")
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, page])

  useEffect(() => {
    fetchReviews(activeTab, page)
  }, [fetchReviews, activeTab, page])

  const handleStatusChange = async (reviewId: string, newStatus: "approved" | "rejected") => {
    setUpdatingId(reviewId)
    try {
      const res = await apiPut<{ success: boolean; message?: string }>(
        `/api/review/admin/${reviewId}/status`,
        { status: newStatus }
      )
      if (res.success) {
        toast.success(
          newStatus === "approved"
            ? "Review approved and published to product page!"
            : "Review disapproved and hidden from storefront."
        )
        // Refresh reviews and counters
        await fetchReviews(activeTab, page)
      }
    } catch (err: any) {
      console.error("Failed to update review status:", err)
      toast.error(err.message || "Failed to update review status")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this review?")) {
      return
    }

    setUpdatingId(reviewId)
    try {
      const res = await apiDelete<{ success: boolean; message?: string }>(`/api/review/${reviewId}`)
      if (res.success) {
        toast.success("Review deleted successfully.")
        await fetchReviews(activeTab, page)
      }
    } catch (err: any) {
      console.error("Failed to delete review:", err)
      toast.error(err.message || "Failed to delete review")
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredReviews = reviews.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const reviewer = (r.reviewerName || "").toLowerCase()
    const email = (r.reviewerEmail || "").toLowerCase()
    const prodName = (r.product?.name || "").toLowerCase()
    const prodSku = (r.product?.sku || "").toLowerCase()
    const title = (r.title || "").toLowerCase()
    const comment = (r.comment || "").toLowerCase()
    return (
      reviewer.includes(q) ||
      email.includes(q) ||
      prodName.includes(q) ||
      prodSku.includes(q) ||
      title.includes(q) ||
      comment.includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-primary" />
            Reviews Moderation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review customer feedback, approve ratings for public display, or disapprove spam and inappropriate comments.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchReviews(activeTab, page)}
          disabled={isLoading}
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 border border-border p-1 rounded-lg bg-card/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab("pending")
              setPage(1)
            }}
            className={cn(
              "px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer",
              activeTab === "pending"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Pending Approval
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[11px]",
                counts.pending > 0
                  ? "bg-amber-500 text-white font-bold"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("approved")
              setPage(1)
            }}
            className={cn(
              "px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer",
              activeTab === "approved"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approved
            <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
              {counts.approved}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("rejected")
              setPage(1)
            }}
            className={cn(
              "px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer",
              activeTab === "rejected"
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
            Disapproved
            <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
              {counts.rejected}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("all")
              setPage(1)
            }}
            className={cn(
              "px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer",
              activeTab === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            All Reviews
            <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-muted/80 text-muted-foreground">
              {counts.all}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search reviewer, product, text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Review List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-card border border-border rounded-lg">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading reviews...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-lg font-medium text-foreground">No Reviews Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {activeTab === "pending"
              ? "All submitted reviews have been moderated. New submissions will appear here for your approval."
              : `There are currently no ${activeTab === "all" ? "" : activeTab} reviews.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => {
            const isPending = review.status === "pending"
            const isApproved = review.status === "approved" || review.isApproved
            const isRejected = review.status === "rejected"
            const isActionBusy = updatingId === review._id

            return (
              <div
                key={review._id}
                className={cn(
                  "bg-card border rounded-xl p-5 sm:p-6 transition-all space-y-4",
                  isPending
                    ? "border-amber-400/50 dark:border-amber-600/40 shadow-xs"
                    : "border-border hover:border-border/80"
                )}
              >
                {/* Header: Product & Reviewer Info */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/70">
                  {/* Product Details */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-16 rounded-md overflow-hidden bg-muted border border-border flex-shrink-0">
                      {review.product?.mainImage ? (
                        <Image
                          src={review.product.mainImage}
                          alt={review.product.name || "Product"}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          No Pic
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground text-sm sm:text-base line-clamp-1">
                          {review.product?.name || "Product unavailable"}
                        </h4>
                        {review.product && (
                          <Link
                            href={`/product/${review.product.slug || review.product.sku || review.product._id}`}
                            target="_blank"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="View product storefront page"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {review.product?.sku && <span>SKU: {review.product.sku}</span>}
                        {review.product?.price && <span>• ₹{review.product.price}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Reviewer Details & Status Badge */}
                  <div className="flex items-center gap-3 self-start lg:self-center">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-medium text-foreground text-sm">
                          {review.reviewerName || "Anonymous"}
                        </span>
                        {review.user ? (
                          <span
                            title="Registered Customer"
                            className="inline-flex items-center text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium"
                          >
                            <ShieldCheck className="h-3 w-3 mr-0.5" /> Verified User
                          </span>
                        ) : (
                          <span
                            title="Guest Reviewer"
                            className="inline-flex items-center text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium"
                          >
                            Guest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {review.reviewerEmail || "No email provided"} •{" "}
                        {new Date(review.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                          <Clock className="h-3 w-3" /> Pending Approval
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700">
                          <CheckCircle className="h-3 w-3" /> Approved
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-700">
                          <XCircle className="h-3 w-3" /> Disapproved
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body: Rating, Headline, and Comment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center text-amber-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            "h-4 w-4",
                            star <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted stroke-muted-foreground"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {review.rating} / 5
                    </span>
                    {review.title && (
                      <span className="text-sm font-semibold text-foreground ml-2">
                        “{review.title}”
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-foreground/85 leading-relaxed bg-muted/30 p-3.5 rounded-lg border border-border/50">
                    {review.comment}
                  </p>
                </div>

                {/* Uploaded Photos Section */}
                {review.photos && review.photos.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Review Photos ({review.photos.length}):
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {review.photos.map((photoUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewImage(photoUrl)}
                          className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-border hover:border-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Image
                            src={photoUrl}
                            alt={`Review photo ${idx + 1}`}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Eye className="h-4 w-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <div className="text-xs text-muted-foreground">
                    {isPending && "This review is currently hidden from the public product page."}
                    {isApproved && "This review is currently visible on the product page and counts towards the rating."}
                    {isRejected && "This review is rejected and hidden from customers."}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isApproved && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isActionBusy}
                        onClick={() => handleStatusChange(review._id, "approved")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs h-8 px-3 cursor-pointer"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                    )}

                    {!isRejected && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActionBusy}
                        onClick={() => handleStatusChange(review._id, "rejected")}
                        className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1.5 text-xs h-8 px-3 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Disapprove
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isActionBusy}
                      onClick={() => handleDelete(review._id)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-8 px-2.5 cursor-pointer"
                      title="Permanently delete review"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] w-full bg-background rounded-lg overflow-hidden border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/40">
              <span className="text-xs font-medium text-foreground">Review Photo Preview</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative w-full h-[65vh]">
              <Image
                src={previewImage}
                alt="Enlarged review photo"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


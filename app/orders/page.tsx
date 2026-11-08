"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  Search,
  Loader2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  CreditCard
} from 'lucide-react'
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { useAuth } from "@/context/auth-context"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { resolveMediaUrl } from "@/lib/media"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  resolveCustomerOrderStatus,
  shouldShowRefund,
  resolveRefundDisplay,
  resolvePaymentDisplay,
  resolveOrderActions,
  resolveProductPreviews,
} from "@/lib/order-status"

interface OrderItem {
  name: string
  quantity: number
  price: number
  image?: string
}

interface Order {
  _id: string
  orderId: string
  status: string
  createdAt: string
  pricing: {
    subtotal: number
    shipping: number
    discount: number
    total: number
  }
  items: OrderItem[]
  shiprocket?: {
    courierName?: string
    awbCode?: string
    trackingUrl?: string
  }
  payment?: {
    method: string
    status: string
    verificationPending?: boolean
  }
  fulfillmentHold?: {
    active?: boolean
    reason?: string | null
  }
  reservation?: {
    state?: string
    expiresAt?: string | Date
  }
  resourcesReleased?: boolean
  canResumePayment?: boolean
  cannotResumeReason?: string | null
  canCancel?: boolean
  cannotCancelReason?: string | null
  cancellationSummary?: {
    canCancel?: boolean
    cannotCancelReason?: string | null
    reasonCode?: string
    status?: string
    requestedAt?: string | null
    resolvedAt?: string | null
    courierOutcome?: string | null
    reason?: string | null
  }
  refundSummary?: {
    status?: string | null
    amountPaise?: number
    amountRupees?: number
    currency?: string
    initiatedAt?: string | null
    verifiedAt?: string | null
    finalized?: boolean
    paymentMethod?: string
    notice?: string
  }
}

const CANCELLATION_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery time is too long",
  "Need to change shipping address or phone number",
  "Incorrect items in order",
  "Changed my mind",
  "Other"
]

export default function OrdersPage() {
  const { isAuthenticated, isHydrated, user, logout } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")

  // Cancellation Modal & Per-order action states
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null)
  const [selectedReason, setSelectedReason] = useState(CANCELLATION_REASONS[0])
  const [optionalDetails, setOptionalDetails] = useState("")
  const [cancellingIds, setCancellingIds] = useState<Record<string, boolean>>({})
  const [resumingIds, setResumingIds] = useState<Record<string, boolean>>({})
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({})
  const [cancelErrors, setCancelErrors] = useState<Record<string, string | null>>({})

  const isMountedRef = useRef(true)
  const currentUserRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Detect account switch: discard old orders
    if (currentUserRef.current !== user?.email) {
      currentUserRef.current = user?.email
      setOrders([])
      setPage(1)
      setTotalPages(1)
      setTotalCount(0)
      setFetchError(null)
    }
  }, [user?.email])

  const fetchOrders = useCallback(async (targetPage = 1, append = false, isBackground = false) => {
    if (!append && !isBackground) {
      setLoading(true)
      setFetchError(null)
    }
    if (append) {
      setLoadingMore(true)
    }

    try {
      const { apiGet } = await import("@/lib/api")
      const data = await apiGet(`/api/order/my-orders?page=${targetPage}&limit=10`)

      if (!isMountedRef.current) return

      if (data.success && Array.isArray(data.orders)) {
        setOrders(prev => {
          if (!append) return data.orders
          const existingIds = new Set(prev.map(o => o._id))
          const newItems = data.orders.filter((o: Order) => !existingIds.has(o._id))
          return [...prev, ...newItems]
        })
        setPage(data.pagination?.page || targetPage)
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalCount(data.pagination?.totalCount || data.orders.length)
        setFetchError(null)
      } else {
        throw new Error(data.message || "Invalid order data received.")
      }
    } catch (err: any) {
      if (!isMountedRef.current) return
      console.error("Failed to fetch orders:", err)
      const errorMsg = err?.message || "Failed to load orders. Please check your connection."
      if (!append && orders.length === 0) {
        setFetchError(errorMsg)
      } else {
        toast.error("Could not refresh orders. Showing loaded data.")
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [orders.length])

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      fetchOrders(1, false)
    } else if (isHydrated) {
      setLoading(false)
    }
  }, [isHydrated, isAuthenticated, fetchOrders])

  // Single order status refresh (for pending cancellation or refund states)
  const refreshSingleOrder = async (orderId: string) => {
    setRefreshingIds(prev => ({ ...prev, [orderId]: true }))
    try {
      const { apiGet } = await import("@/lib/api")
      const data = await apiGet(`/api/order/${orderId}`)
      if (isMountedRef.current && data.success && data.order) {
        setOrders(prev => prev.map(o => o._id === orderId ? data.order : o))
        toast.success("Order status refreshed.")
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        toast.error(err?.message || "Failed to refresh order status.")
      }
    } finally {
      if (isMountedRef.current) {
        setRefreshingIds(prev => ({ ...prev, [orderId]: false }))
      }
    }
  }

  // Window focus revalidation: if any order is pending cancellation or refund, refresh it
  useEffect(() => {
    const handleFocus = () => {
      if (!isAuthenticated || loading || orders.length === 0) return
      const hasPendingWork = orders.some(o =>
        o.cancellationSummary?.status === "requested" ||
        o.refundSummary?.status === "pending" ||
        o.refundSummary?.status === "requested"
      )
      if (hasPendingWork) {
        fetchOrders(1, false, true)
      }
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [isAuthenticated, loading, orders, fetchOrders])

  // Cancellation submission handler
  const handleConfirmCancel = async () => {
    if (!orderToCancel) return
    const orderId = orderToCancel._id

    setCancellingIds(prev => ({ ...prev, [orderId]: true }))
    setCancelErrors(prev => ({ ...prev, [orderId]: null }))

    try {
      const { apiPost } = await import("@/lib/api")
      const response = await apiPost(`/api/order/${orderId}/cancel`, {
        reason: selectedReason,
        details: optionalDetails.trim(),
      })

      if (!isMountedRef.current) return

      if (response.success && response.order) {
        // Update authoritative order in place
        setOrders(prev => prev.map(o => o._id === orderId ? response.order : o))

        if (response.finalized) {
          const refundNote = response.refund?.amountRupees
            ? ` A refund of ₹${response.refund.amountRupees.toLocaleString('en-IN')} has been initiated.`
            : ""
          toast.success(`Order #${orderToCancel.orderId} cancelled successfully.${refundNote}`)
        } else if (response.confirmationPending) {
          toast.info(`Cancellation requested for Order #${orderToCancel.orderId}. Awaiting courier verification.`)
        } else {
          toast.info(response.message || "Cancellation request processed.")
        }

        setOrderToCancel(null)
        setSelectedReason(CANCELLATION_REASONS[0])
        setOptionalDetails("")
      } else {
        throw new Error(response.message || "Unable to complete cancellation.")
      }
    } catch (err: any) {
      if (!isMountedRef.current) return
      console.error("Cancellation error:", err)
      const errorMsg = err?.message || "Failed to cancel order. Please refresh and try again."
      setCancelErrors(prev => ({ ...prev, [orderId]: errorMsg }))
      toast.error(errorMsg)
      // Re-fetch authoritative state before encouraging retry
      refreshSingleOrder(orderId)
    } finally {
      if (isMountedRef.current) {
        setCancellingIds(prev => ({ ...prev, [orderId]: false }))
      }
    }
  }

  const handleResumePayment = async (order: Order) => {
    if (resumingIds[order._id]) return
    setResumingIds(prev => ({ ...prev, [order._id]: true }))

    try {
      const { apiPost } = await import("@/lib/api")
      const { openRazorpayModal } = await import("@/lib/razorpay-modal")
      const { PreparingRetryManager } = await import("@/lib/preparing-retry")

      // 1. Authoritative status check against backend
      const checkData = await apiPost('/api/order/verify-payment', {
        orderId: order.orderId,
      })

      if (checkData?.outcome === "paid" || checkData?.status === "paid") {
        toast.success("Payment confirmed! Your order has been placed successfully.")
        await refreshSingleOrder(order._id)
        return
      }

      if (checkData?.outcome === "terminal") {
        toast.error(checkData?.message || "Payment window for this order has expired.")
        await refreshSingleOrder(order._id)
        return
      }

      if (checkData?.outcome === "held") {
        toast.info(checkData?.message || "This order is under review.")
        await refreshSingleOrder(order._id)
        return
      }

      if (checkData?.outcome === "payable") {
        const retryManager = new PreparingRetryManager()
        const op = retryManager.startOperation("orders-page", order.orderId)
        if (!op) return

        await openRazorpayModal({
          scope: "orders-page",
          retryManager,
          parentOp: op,
          orderId: order.orderId,
          razorpayOrderId: checkData.razorpayOrderId,
          amount: checkData.amount,
          currency: checkData.currency || "INR",
          key: checkData.key,
          prefill: {
            name: user?.name,
            email: user?.email,
          },
          onVerify: async (response, verifyOp) => {
            try {
              const verifyRes = await apiPost('/api/order/verify-payment', {
                orderId: order.orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              })
              if (verifyRes?.status === "paid" || verifyRes?.outcome === "paid") {
                toast.success("Payment Successful! Your order has been confirmed.")
                await refreshSingleOrder(order._id)
              } else if (verifyRes?.outcome === "held") {
                toast.info(verifyRes.message || "Payment received and is undergoing quick verification.")
                await refreshSingleOrder(order._id)
              } else {
                toast.info("Payment received, awaiting confirmation.")
                await refreshSingleOrder(order._id)
              }
            } catch (vErr: any) {
              toast.error(vErr?.message || "Payment confirmation error. Checking status...")
              await refreshSingleOrder(order._id)
            }
          },
          onDismiss: async () => {
            // Recheck status in case external UPI app completed
            try {
              const postDismiss = await apiPost('/api/order/verify-payment', { orderId: order.orderId })
              if (postDismiss?.outcome === "paid" || postDismiss?.status === "paid") {
                toast.success("Payment confirmed! Your order is placed.")
                await refreshSingleOrder(order._id)
                return
              }
            } catch {}

            toast.error("Payment Not Completed: You closed the payment window before completing the transaction. Tap 'Resume Payment' to complete your order.", {
              duration: 7000,
            })
            await refreshSingleOrder(order._id)
          },
          onFailure: (failRes) => {
            toast.error(failRes?.error?.description || "Payment did not complete. You can retry with another method.", {
              duration: 6000,
            })
            refreshSingleOrder(order._id)
          },
          onErrorState: (errMsg) => {
            toast.error(errMsg)
          },
        })
      } else {
        toast.info(checkData?.message || "Order payment status pending.")
        await refreshSingleOrder(order._id)
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not resume payment. Please try again.")
    } finally {
      if (isMountedRef.current) {
        setResumingIds(prev => ({ ...prev, [order._id]: false }))
      }
    }
  }

  const renderStatusIcon = (iconName: string) => {
    switch (iconName) {
      case 'check-circle':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />
      case 'truck':
        return <Truck className="w-5 h-5 text-blue-600" />
      case 'clock':
        return <Clock className="w-5 h-5 text-amber-600" />
      case 'x-circle':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'rotate-ccw':
        return <RotateCcw className="w-5 h-5 text-orange-600" />
      case 'alert-triangle':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'refresh-cw':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
      default:
        return <Package className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getPaymentMethodDisplay = (method?: string) => {
    if (!method) return "Online Payment"
    if (method.toLowerCase() === "cod") return "Cash on Delivery"
    if (method.toLowerCase() === "card") return "Prepaid (Card)"
    if (method.toLowerCase() === "upi") return "Prepaid (UPI)"
    return `Prepaid (${method.toUpperCase()})`
  }

  const getRefundBadge = (status?: string | null) => {
    switch (status) {
      case "processed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">✓ Refund Processed</span>
      case "pending":
      case "requested":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200">⏳ Refund Processing</span>
      case "failed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">⚠ Refund Action Required</span>
      default:
        return null
    }
  }

  const filteredOrders = orders.filter(order =>
    order.orderId.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div
          className="min-h-[60vh] flex items-center justify-center"
          style={{ paddingTop: 'calc(var(--header-offset) + 2rem)' }}
        >
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading your orders...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div
          className="min-h-[60vh] flex items-center justify-center"
          style={{ paddingTop: 'calc(var(--header-offset) + 2rem)' }}
        >
          <div className="text-center px-4">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Please log in</h3>
            <p className="text-muted-foreground mb-6">Log in to view and manage your orders</p>
            <Link href="/account/login" className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all duration-300">
              Log In
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div
        className="container mx-auto px-4 pb-16"
        style={{ paddingTop: 'calc(var(--header-offset) + 2rem)' }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Orders</h1>
          <p className="text-muted-foreground">Track shipments, view cancellation details and monitor refund status</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search by order ID (e.g. LS-...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-sm"
            />
          </div>
          {totalCount > 0 && (
            <div className="text-sm text-muted-foreground">
              Showing {orders.length} of {totalCount} {totalCount === 1 ? "order" : "orders"}
            </div>
          )}
        </div>

        {/* Fetch Failure Error Banner */}
        {fetchError && orders.length === 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-8 text-center my-8">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load orders</h3>
            <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
            {fetchError.toLowerCase().includes("session expired") || fetchError.toLowerCase().includes("not authorized") ? (
              <Button onClick={() => { logout(); router.push("/account/login"); }} className="gap-2">
                Log In Again
              </Button>
            ) : (
              <Button onClick={() => fetchOrders(1, false)} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" /> Try Again
              </Button>
            )}
          </div>
        )}

        {/* Order Cards List */}
        <div className="space-y-5">
          {filteredOrders.map((order) => {
            const isCancelling = !!cancellingIds[order._id]
            const isResuming = !!resumingIds[order._id]
            const isRefreshing = !!refreshingIds[order._id]
            const orderError = cancelErrors[order._id]

            // Authoritative presentation state resolved from centralized helpers
            const orderStatus = resolveCustomerOrderStatus(order)
            const paymentDisplay = resolvePaymentDisplay(order)
            const refundDisplay = resolveRefundDisplay(order)
            const actions = resolveOrderActions(order)
            const productInfo = resolveProductPreviews(order.items)

            const isCancellationRequested = order.cancellationSummary?.status === "requested"

            return (
              <div
                key={order._id}
                className="bg-card rounded-2xl shadow-sm border border-border/80 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30"
              >
                {/* 1. Header */}
                <div className="bg-secondary/40 px-5 sm:px-6 py-3.5 sm:py-4 border-b border-border/60">
                  {/* Desktop Header */}
                  <div className="hidden sm:flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-base text-foreground tracking-tight">
                        Order #{order.orderId}
                      </span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${orderStatus.badgeColor}`}
                      >
                        {renderStatusIcon(orderStatus.iconName)}
                        <span>{orderStatus.label}</span>
                      </span>

                      {(orderStatus.isPendingPayment || isCancellationRequested || refundDisplay?.status === "pending" || orderStatus.key === "under_review") && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => refreshSingleOrder(order._id)}
                          disabled={isRefreshing}
                          title="Refresh current status"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Mobile Header: Stacks intentionally */}
                  <div className="sm:hidden flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ${orderStatus.badgeColor}`}
                      >
                        {renderStatusIcon(orderStatus.iconName)}
                        <span>{orderStatus.label}</span>
                      </span>

                      {(orderStatus.isPendingPayment || isCancellationRequested || refundDisplay?.status === "pending" || orderStatus.key === "under_review") && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => refreshSingleOrder(order._id)}
                          disabled={isRefreshing}
                          className="h-6 text-[11px] text-muted-foreground p-0 gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                          <span>Refresh</span>
                        </Button>
                      )}
                    </div>

                    <div>
                      <div className="font-mono font-bold text-sm text-foreground break-all">
                        Order #{order.orderId}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Pending Payment Notice (Incomplete Razorpay payment) */}
                {orderStatus.isPendingPayment && (
                  <div className="px-5 sm:px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>
                        <strong>Payment Pending:</strong> Payment was not completed. Tap &apos;Resume Payment&apos; to complete your purchase.
                      </span>
                    </div>
                    {actions.canResumePayment && (
                      <Button
                        size="sm"
                        onClick={() => handleResumePayment(order)}
                        disabled={isResuming}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-3 shrink-0 font-medium self-start sm:self-auto"
                      >
                        {isResuming ? "Connecting..." : "Pay Now →"}
                      </Button>
                    )}
                  </div>
                )}

                {/* 3. Refund Banner: ONLY when genuine refund lifecycle exists! NEVER on normal paid orders! */}
                {refundDisplay && (
                  <div className="px-5 sm:px-6 py-3 bg-secondary/50 border-b border-border/70">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${refundDisplay.badgeClass}`}>
                          {refundDisplay.badgeLabel}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          ₹{refundDisplay.formattedAmount} to {refundDisplay.paymentMethodDisplay}
                        </span>
                      </div>
                      {refundDisplay.verifiedAtDate && (
                        <span className="text-[11px] text-muted-foreground">
                          Processed on {refundDisplay.verifiedAtDate}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {refundDisplay.notice}
                    </p>
                  </div>
                )}

                {/* Per-order error banner */}
                {orderError && (
                  <div className="px-5 sm:px-6 py-2 bg-destructive/10 text-xs text-destructive border-b border-destructive/20 flex items-center justify-between">
                    <span>{orderError}</span>
                    <button
                      onClick={() => setCancelErrors(prev => ({ ...prev, [order._id]: null }))}
                      className="text-destructive font-bold ml-2 text-sm"
                      aria-label="Dismiss error"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* 4. Product Previews (Compact representation: 1 preview + N more items) */}
                <div className="px-5 sm:px-6 py-4">
                  {productInfo.previews.map((preview, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-lg overflow-hidden border border-border/70 bg-muted/40 shrink-0">
                          {preview.image ? (
                            <img
                              src={resolveMediaUrl(preview.image)}
                              alt={preview.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-sm font-semibold text-foreground truncate"
                            title={preview.name}
                          >
                            {preview.name}
                          </h4>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Qty {preview.quantity}
                          </div>
                          {productInfo.remainingCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrderDetails(order)}
                              className="text-xs font-semibold text-primary hover:underline mt-1 block"
                            >
                              + {productInfo.remainingCount} more {productInfo.remainingCount === 1 ? "item" : "items"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Desktop Total Amount display */}
                      <div className="hidden sm:block text-right shrink-0">
                        <div className="text-xs text-muted-foreground font-medium">Total</div>
                        <div className="text-base font-bold text-foreground">
                          ₹{order.pricing.total.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 5. Footer & Actions */}
                <div className="bg-secondary/30 px-5 sm:px-6 py-3.5 border-t border-border/70">
                  {/* Desktop Footer */}
                  <div className="hidden sm:flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground font-medium">Payment:</span>
                      <span className="font-semibold text-foreground">
                        {paymentDisplay.combinedDisplay}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrderDetails(order)}
                        className="text-xs h-8 px-3 border-border/80 hover:bg-secondary font-medium"
                      >
                        View Details
                      </Button>

                      {actions.canTrack && (
                        order.shiprocket?.trackingUrl ? (
                          <a
                            href={order.shiprocket.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border/80 bg-background hover:bg-secondary h-8 px-3 transition-colors"
                          >
                            Track Order
                          </a>
                        ) : (
                          <Link href={`/track-order?orderId=${encodeURIComponent(order.orderId)}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 px-3 border-border/80 hover:bg-secondary font-medium"
                            >
                              Track Order
                            </Button>
                          </Link>
                        )
                      )}

                      {actions.canResumePayment && (
                        <Button
                          size="sm"
                          onClick={() => handleResumePayment(order)}
                          disabled={isResuming || isCancelling}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 px-3 font-semibold shadow-sm"
                        >
                          {isResuming ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                              Connecting...
                            </>
                          ) : (
                            "Resume Payment"
                          )}
                        </Button>
                      )}

                      {actions.canCheckStatus && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refreshSingleOrder(order._id)}
                          disabled={isRefreshing}
                          className="text-xs h-8 px-3 border-border/80 hover:bg-secondary font-medium"
                        >
                          {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                          Check Status
                        </Button>
                      )}

                      {actions.canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOrderToCancel(order)
                            setSelectedReason(CANCELLATION_REASONS[0])
                            setOptionalDetails("")
                          }}
                          disabled={isCancelling || isResuming}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-8 px-3 font-medium"
                        >
                          {isCancelling ? "Cancelling..." : "Cancel Order"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Mobile Footer: Intentionally Stacked */}
                  <div className="sm:hidden flex flex-col gap-2.5">
                    <div className="flex justify-between items-center text-xs py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-medium">Payment</span>
                      <span className="font-semibold text-foreground text-right">
                        {paymentDisplay.combinedDisplay}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline text-sm">
                      <span className="text-muted-foreground font-medium">Total</span>
                      <span className="text-lg font-bold text-foreground">
                        ₹{order.pricing.total.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="default"
                        onClick={() => setSelectedOrderDetails(order)}
                        className="w-full text-xs h-10 border-border/80 font-medium"
                      >
                        View Order Details
                      </Button>

                      {actions.canTrack && (
                        order.shiprocket?.trackingUrl ? (
                          <a
                            href={order.shiprocket.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center rounded-md text-xs font-medium border border-border/80 bg-background hover:bg-secondary h-10 transition-colors"
                          >
                            Track Order
                          </a>
                        ) : (
                          <Link href={`/track-order?orderId=${encodeURIComponent(order.orderId)}`} className="w-full">
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full text-xs h-10 border-border/80 font-medium"
                            >
                              Track Order
                            </Button>
                          </Link>
                        )
                      )}

                      {actions.canResumePayment && (
                        <Button
                          size="default"
                          onClick={() => handleResumePayment(order)}
                          disabled={isResuming || isCancelling}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-10 font-semibold shadow-sm"
                        >
                          {isResuming ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                              Connecting...
                            </>
                          ) : (
                            "Resume Payment"
                          )}
                        </Button>
                      )}

                      {actions.canCheckStatus && (
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => refreshSingleOrder(order._id)}
                          disabled={isRefreshing}
                          className="w-full text-xs h-10 border-border/80 font-medium"
                        >
                          {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                          Check Status
                        </Button>
                      )}

                      {actions.canCancel && (
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => {
                            setOrderToCancel(order)
                            setSelectedReason(CANCELLATION_REASONS[0])
                            setOptionalDetails("")
                          }}
                          disabled={isCancelling || isResuming}
                          className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-10 font-medium"
                        >
                          {isCancelling ? "Cancelling..." : "Cancel Order"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Load More Pagination */}
        {page < totalPages && (
          <div className="text-center mt-8">
            <Button
              variant="outline"
              size="lg"
              onClick={() => fetchOrders(page + 1, true)}
              disabled={loadingMore}
              className="min-w-[160px] gap-2"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>Load More Orders ({orders.length} of {totalCount})</>
              )}
            </Button>
          </div>
        )}

        {/* Empty Search or Empty Orders State */}
        {filteredOrders.length === 0 && !loading && !fetchError && (
          <div className="text-center py-16 bg-card rounded-xl border border-border p-8 my-8">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchTerm ? "No matching orders found" : "No orders yet"}
            </h3>
            <p className="text-muted-foreground mb-6 text-sm max-w-sm mx-auto">
              {searchTerm
                ? `No orders matching "${searchTerm}" in your account.`
                : "Explore our handcrafted handloom collection and place your first order today."}
            </p>
            {searchTerm ? (
              <Button variant="outline" onClick={() => setSearchTerm("")}>
                Clear Search
              </Button>
            ) : (
              <Link href="/collections" className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all inline-block">
                Start Shopping
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Comprehensive Order Details Dialog */}
      <Dialog open={!!selectedOrderDetails} onOpenChange={(open) => !open && setSelectedOrderDetails(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-serif flex items-center justify-between gap-2">
              <span>Order Details</span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                #{selectedOrderDetails?.orderId}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Placed on {selectedOrderDetails && new Date(selectedOrderDetails.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </DialogDescription>
          </DialogHeader>

          {selectedOrderDetails && (
            <div className="space-y-4 py-2">
              {/* Status & Payment Header */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/60">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${resolveCustomerOrderStatus(selectedOrderDetails).badgeColor}`}>
                  {resolveCustomerOrderStatus(selectedOrderDetails).label}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {resolvePaymentDisplay(selectedOrderDetails).combinedDisplay}
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Purchased Items ({selectedOrderDetails.items?.length || 0})
                </div>
                <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden bg-card">
                  {selectedOrderDetails.items?.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-md overflow-hidden border border-border/60 shrink-0 bg-muted/40">
                          {item.image ? (
                            <img
                              src={resolveMediaUrl(item.image)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 m-auto text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-foreground truncate" title={item.name}>
                            {item.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Qty: {item.quantity} × ₹{item.price.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-foreground shrink-0">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 p-3.5 rounded-xl bg-secondary/30 border border-border/60 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{selectedOrderDetails.pricing.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {selectedOrderDetails.pricing.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Discount</span>
                    <span>-₹{selectedOrderDetails.pricing.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>{selectedOrderDetails.pricing.shipping === 0 ? "FREE" : `₹${selectedOrderDetails.pricing.shipping.toLocaleString('en-IN')}`}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border/60">
                  <span>Total Amount</span>
                  <span>₹{selectedOrderDetails.pricing.total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Courier details if available */}
              {selectedOrderDetails.shiprocket?.courierName && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 text-xs space-y-1">
                  <div className="font-semibold text-foreground">Delivery Partner:</div>
                  <div className="text-muted-foreground">
                    {selectedOrderDetails.shiprocket.courierName}
                    {selectedOrderDetails.shiprocket.awbCode ? ` • AWB: ${selectedOrderDetails.shiprocket.awbCode}` : ""}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedOrderDetails(null)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accessible Cancellation Dialog */}
      <Dialog open={!!orderToCancel} onOpenChange={(open) => !open && setOrderToCancel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Cancel Order #{orderToCancel?.orderId}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Please let us know why you wish to cancel this order.
            </DialogDescription>
          </DialogHeader>

          {orderToCancel && (
            <div className="space-y-4 py-2">
              {/* Commercial & Refund Impact Notice */}
              <div className="p-3 bg-secondary rounded-lg text-xs space-y-1.5 border border-border">
                <div className="font-semibold text-foreground">Payment & Refund Policy:</div>
                {orderToCancel.payment?.method === "cod" ? (
                  <p className="text-muted-foreground leading-relaxed">
                    This is a Cash on Delivery order. No payment was collected, so no monetary refund is required. Stock will be restored to store inventory.
                  </p>
                ) : orderToCancel.payment?.status !== "paid" ? (
                  <p className="text-muted-foreground leading-relaxed">
                    No payment was charged for this order. It will be cancelled immediately and reserved items will be released back to the store.
                  </p>
                ) : (
                  <p className="text-muted-foreground leading-relaxed">
                    A full refund of <strong>₹{orderToCancel.pricing.total.toLocaleString('en-IN')}</strong> will be initiated to your original payment method ({getPaymentMethodDisplay(orderToCancel.payment?.method)}). Bank processing typically reflects in 5-7 business days.
                  </p>
                )}
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Reason for cancellation <span className="text-destructive">*</span>
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  {CANCELLATION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Additional Details */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Additional Details <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={optionalDetails}
                  onChange={(e) => setOptionalDetails(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Tell us more about your request (up to 500 characters)..."
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none resize-none"
                />
                <div className="text-[11px] text-muted-foreground text-right mt-0.5">
                  {optionalDetails.length}/500
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOrderToCancel(null)}
              disabled={orderToCancel ? !!cancellingIds[orderToCancel._id] : false}
            >
              Keep Order
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={orderToCancel ? !!cancellingIds[orderToCancel._id] : false}
              className="gap-2"
            >
              {orderToCancel && cancellingIds[orderToCancel._id] ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}

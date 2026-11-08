export interface CustomerOrderStatus {
  key: string
  label: string
  badgeColor: string
  iconName: 'clock' | 'truck' | 'check-circle' | 'x-circle' | 'rotate-ccw' | 'alert-triangle' | 'package' | 'refresh-cw'
  description: string
  canResumePayment: boolean
  canCancel: boolean
  cannotResumeReason?: string | null
  isPendingPayment: boolean
  isTerminal: boolean
}

export interface MinimalOrderState {
  status?: string
  payment?: {
    method?: string
    status?: string
    verificationPending?: boolean
  }
  cancellation?: {
    status?: string
    courierOutcome?: string | null
  }
  cancellationSummary?: {
    status?: string
    canCancel?: boolean
    courierOutcome?: string | null
  }
  refund?: {
    status?: string | null
  }
  refundSummary?: {
    status?: string | null
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
  canCancel?: boolean
  canResumePayment?: boolean
}

/**
 * Authoritative Customer-Facing Order Status Resolver
 * Maps backend multi-domain order fields to accurate, transparent customer statuses.
 */
export function resolveCustomerOrderStatus(order: MinimalOrderState | null | undefined): CustomerOrderStatus {
  if (!order) {
    return {
      key: 'unknown',
      label: 'Unknown',
      badgeColor: 'bg-muted text-muted-foreground border-border',
      iconName: 'package',
      description: 'Order details unavailable.',
      canResumePayment: false,
      canCancel: false,
      isPendingPayment: false,
      isTerminal: false,
    }
  }

  const rawStatus = (order.status || '').toLowerCase()
  const paymentMethod = (order.payment?.method || '').toLowerCase()
  const paymentStatus = (order.payment?.status || '').toLowerCase()
  const isCod = paymentMethod === 'cod'
  const isPrepaid = !isCod && paymentMethod !== ''

  const isHoldActive = Boolean(order.fulfillmentHold?.active)

  // 1. Check Cancellations & Terminal returns
  const isCancellationRequested =
    order.cancellationSummary?.status === 'requested' ||
    order.cancellation?.status === 'requested'

  const isCancelled =
    rawStatus === 'cancelled' ||
    order.cancellationSummary?.status === 'completed' ||
    order.cancellation?.status === 'completed'

  const refundStatus = (order.refundSummary?.status || order.refund?.status || '').toLowerCase()

  if (isCancellationRequested) {
    return {
      key: 'cancellation_pending',
      label: 'Cancellation Pending',
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
      iconName: 'clock',
      description: 'Cancellation request received. Checking shipment status with courier partner.',
      canResumePayment: false,
      canCancel: false,
      isPendingPayment: false,
      isTerminal: false,
    }
  }

  if (isCancelled) {
    // Check if there is an active or completed refund for paid orders
    if (refundStatus === 'failed') {
      return {
        key: 'refund_failed',
        label: 'Refund Requires Attention',
        badgeColor: 'bg-red-100 text-red-900 border border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800',
        iconName: 'alert-triangle',
        description: 'Refund processing encountered an issue. Our support team is actively reviewing.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }

    if (refundStatus === 'processed' || paymentStatus === 'refunded') {
      return {
        key: 'refund_processed',
        label: 'Refund Processed',
        badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
        iconName: 'check-circle',
        description: 'Refund has been successfully processed by the payment gateway to your original account.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }

    if (refundStatus === 'pending' || refundStatus === 'requested' || (paymentStatus === 'paid' && isPrepaid)) {
      return {
        key: 'refund_processing',
        label: 'Refund Processing',
        badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
        iconName: 'clock',
        description: 'Your refund has been initiated and will reflect in your account within 5-7 business days.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }

    // Default cancelled (unpaid online order cancelled, or COD cancelled)
    return {
      key: 'cancelled',
      label: 'Cancelled',
      badgeColor: 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
      iconName: 'x-circle',
      description: 'This order has been cancelled and inventory released.',
      canResumePayment: false,
      canCancel: false,
      isPendingPayment: false,
      isTerminal: true,
    }
  }

  if (rawStatus === 'returned') {
    if (refundStatus === 'processed' || paymentStatus === 'refunded') {
      return {
        key: 'refund_processed',
        label: 'Refund Processed',
        badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
        iconName: 'check-circle',
        description: 'Item returned and refund processed successfully.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }
    return {
      key: 'returned',
      label: 'Returned',
      badgeColor: 'bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800',
      iconName: 'rotate-ccw',
      description: 'The return process for this order has been completed.',
      canResumePayment: false,
      canCancel: false,
      isPendingPayment: false,
      isTerminal: true,
    }
  }

  // 2. Fulfillment Hold / Manual Review
  if (isHoldActive) {
    return {
      key: 'under_review',
      label: 'Under Review',
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
      iconName: 'alert-triangle',
      description: order.fulfillmentHold?.reason || 'Order is undergoing security or address verification.',
      canResumePayment: false,
      canCancel: order.canCancel ?? true,
      isPendingPayment: false,
      isTerminal: false,
    }
  }

  // 3. Physical Dispatch & Delivery States
  if (rawStatus === 'delivered') {
    return {
      key: 'delivered',
      label: 'Delivered',
      badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
      iconName: 'check-circle',
      description: 'Your package has been safely delivered.',
      canResumePayment: false,
      canCancel: false,
      isPendingPayment: false,
      isTerminal: true,
    }
  }

  if (rawStatus === 'out_for_delivery') {
    return {
      key: 'out_for_delivery',
      label: 'Out for Delivery',
      badgeColor: 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800',
      iconName: 'truck',
      description: 'Your package is out for delivery with our courier partner today.',
      canResumePayment: false,
      canCancel: false,
      isPendingPayment: false,
      isTerminal: false,
    }
  }

  if (rawStatus === 'shipped' || rawStatus === 'in_transit') {
    return {
      key: 'shipped',
      label: 'Shipped',
      badgeColor: 'bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800',
      iconName: 'truck',
      description: 'Your order has been dispatched and is on its way.',
      canResumePayment: false,
      canCancel: false,
      isPendingPayment: false,
      isTerminal: false,
    }
  }

  if (rawStatus === 'processing') {
    return {
      key: 'processing',
      label: 'Processing',
      badgeColor: 'bg-yellow-100 text-yellow-900 border border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-200 dark:border-yellow-800',
      iconName: 'clock',
      description: 'Your order is being carefully packaged and prepared for shipping.',
      canResumePayment: false,
      canCancel: order.canCancel ?? true,
      isPendingPayment: false,
      isTerminal: false,
    }
  }

  // 4. Initial Acceptance & Payment Verification
  // Check if reservation is expired or released
  const reservationState = order.reservation?.state
  const expiresAt = order.reservation?.expiresAt ? new Date(order.reservation.expiresAt).getTime() : null
  const isTimeExpired = expiresAt !== null && !isNaN(expiresAt) && expiresAt < Date.now()
  const isExpired =
    reservationState === 'released' ||
    reservationState === 'expired' ||
    order.resourcesReleased === true ||
    (isPrepaid && paymentStatus === 'pending' && isTimeExpired)

  // Online Payment Evaluation
  if (isPrepaid) {
    if (paymentStatus === 'paid') {
      return {
        key: 'order_placed',
        label: 'Order Placed',
        badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
        iconName: 'check-circle',
        description: 'Payment confirmed. Your order has been placed and will be prepared soon.',
        canResumePayment: false,
        canCancel: order.canCancel ?? true,
        isPendingPayment: false,
        isTerminal: false,
      }
    }

    // Uncertain verification / bank confirmation in progress
    if (order.payment?.verificationPending) {
      return {
        key: 'verifying_payment',
        label: 'Verifying Payment',
        badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800',
        iconName: 'refresh-cw',
        description: 'We are confirming payment with your bank. If money was deducted, it will confirm shortly.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: true,
        isTerminal: false,
      }
    }

    // Expired reservation
    if (isExpired) {
      return {
        key: 'payment_expired',
        label: 'Payment Expired',
        badgeColor: 'bg-stone-100 text-stone-700 border border-stone-300 dark:bg-stone-800/80 dark:text-stone-300 dark:border-stone-700',
        iconName: 'clock',
        description: 'The payment window for this order has expired. Reserved inventory has been released.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }

    // Failed attempt with retry allowed
    if (paymentStatus === 'failed') {
      return {
        key: 'payment_failed',
        label: 'Payment Failed — Retry',
        badgeColor: 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
        iconName: 'alert-triangle',
        description: 'Previous payment attempt was not completed. You can retry with another payment method.',
        canResumePayment: true,
        canCancel: order.canCancel ?? true,
        isPendingPayment: true,
        isTerminal: false,
      }
    }

    // Incomplete payment pending
    return {
      key: 'payment_pending',
      label: 'Payment Pending',
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
      iconName: 'clock',
      description: 'Payment is pending. Please complete the transaction to confirm your order.',
      canResumePayment: true,
      canCancel: order.canCancel ?? true,
      isPendingPayment: true,
      isTerminal: false,
    }
  }

  // Cash on Delivery
  if (isCod) {
    return {
      key: 'order_placed',
      label: 'Order Placed',
      badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
      iconName: 'clock',
      description: 'Your cash on delivery order has been received and will be verified for dispatch.',
      canResumePayment: false,
      canCancel: order.canCancel ?? true,
      isPendingPayment: false,
      isTerminal: false,
    }
  }

  // Fallback for confirmed/placed orders without specified payment method (e.g. zero-payable)
  return {
    key: 'order_placed',
    label: 'Order Placed',
    badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
    iconName: 'check-circle',
    description: 'Your order has been confirmed successfully.',
    canResumePayment: false,
    canCancel: order.canCancel ?? true,
    isPendingPayment: false,
    isTerminal: false,
  }
}


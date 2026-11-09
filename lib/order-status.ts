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
  delivery?: {
    status?: string
    rawStatus?: string
    rawStatusCode?: string
    lastEventAt?: string | Date
    expectedDeliveryAt?: string | Date
    lastSyncedAt?: string | Date
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

  // Logistics (canonical delivery.status) — RTO never becomes Delivered.
  const rawStatus = (order.status || '').toLowerCase()
  const deliveryStatus = ((order as any).delivery?.status || "").toString().toLowerCase()
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

  // 3. Canonical Delivery / Logistics Progression (authoritative over stale order.status)
  if (deliveryStatus) {
    if (deliveryStatus === 'pending') {
      return {
        key: 'placed',
        label: 'Order Confirmed',
        badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800',
        iconName: 'package',
        description: 'Order confirmed and being prepared for fulfillment.',
        canResumePayment: false,
        canCancel: order.canCancel ?? true,
        isPendingPayment: false,
        isTerminal: false,
      }
    }
    if (deliveryStatus === 'picked_up') {
      return {
        key: 'processing',
        label: 'Picked Up',
        badgeColor: 'bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800',
        iconName: 'package',
        description: 'Courier partner has picked up your package.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: false,
      }
    }
    if (deliveryStatus === 'shipped') {
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
    if (deliveryStatus === 'in_transit') {
      return {
        key: 'in_transit',
        label: 'In Transit',
        badgeColor: 'bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800',
        iconName: 'truck',
        description: 'Your order is currently in transit to your city.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: false,
      }
    }
    if (deliveryStatus === 'out_for_delivery') {
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
    if (deliveryStatus === 'delivered') {
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
    if (deliveryStatus === 'undelivered') {
      return {
        key: 'undelivered',
        label: 'Delivery Attempt Failed',
        badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
        iconName: 'alert-triangle',
        description: 'Delivery attempt failed. Courier will attempt re-delivery.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: false,
      }
    }
    if (deliveryStatus === 'rto_initiated') {
      return {
        key: 'rto_initiated',
        label: 'Return Initiated',
        badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
        iconName: 'rotate-ccw',
        description: 'Package is being returned to our warehouse.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: false,
      }
    }
    if (deliveryStatus === 'rto_in_transit') {
      return {
        key: 'rto_in_transit',
        label: 'Returning to Seller',
        badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
        iconName: 'rotate-ccw',
        description: 'Package is in transit back to our seller warehouse.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: false,
      }
    }
    if (deliveryStatus === 'rto_out_for_delivery') {
      return {
        key: 'rto_out_for_delivery',
        label: 'Return Out for Delivery',
        badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
        iconName: 'rotate-ccw',
        description: 'Return package is out for delivery to our seller warehouse.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: false,
      }
    }
    if (deliveryStatus === 'rto_delivered') {
      return {
        key: 'rto_delivered',
        label: 'Returned to Seller',
        badgeColor: 'bg-stone-100 text-stone-900 border border-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700',
        iconName: 'rotate-ccw',
        description: 'Package has been returned to our warehouse.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }
    if (deliveryStatus === 'lost') {
      return {
        key: 'lost',
        label: 'Package Lost',
        badgeColor: 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
        iconName: 'alert-triangle',
        description: 'Package reported lost by courier partner. Contact support for refund/replacement.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }
    if (deliveryStatus === 'damaged') {
      return {
        key: 'damaged',
        label: 'Package Damaged',
        badgeColor: 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
        iconName: 'alert-triangle',
        description: 'Package reported damaged during transit. Contact support for assistance.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }
    if (deliveryStatus === 'cancelled') {
      return {
        key: 'cancelled',
        label: 'Cancelled',
        badgeColor: 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
        iconName: 'x-circle',
        description: 'Shipment was cancelled with the courier partner.',
        canResumePayment: false,
        canCancel: false,
        isPendingPayment: false,
        isTerminal: true,
      }
    }
  }

  // 4. Physical Dispatch & Delivery States (fallback when no canonical delivery.status)
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

/**
 * Determine whether refund UI should be shown to customer.
 * Allowed ONLY for genuine refund lifecycle states. Never shown for normal paid orders.
 */
export function shouldShowRefund(order: any): boolean {
  if (!order) return false;

  const paymentMethod = (order.payment?.method || '').toLowerCase();
  if (paymentMethod === 'cod') return false; // COD never requires monetary refund

  const refundStatus = (order.refundSummary?.status || order.refund?.status || '').toLowerCase();
  const paymentStatus = (order.payment?.status || '').toLowerCase();
  const isCancelled =
    order.status === 'cancelled' ||
    order.cancellation?.status === 'completed' ||
    order.cancellationSummary?.status === 'completed';
  const isPaid = paymentStatus === 'paid' || paymentStatus === 'refunded' || Number(order.payment?.amountPaid || 0) > 0;

  // Genuine refund statuses
  const hasValidRefundStatus = ['requested', 'pending', 'processed', 'failed'].includes(refundStatus);
  const isPaymentMarkedRefunded = paymentStatus === 'refunded' || Number(order.payment?.refundedAmount || 0) > 0;
  const isCancelledPaidPrepaid = isCancelled && isPaid;

  if (!hasValidRefundStatus && !isPaymentMarkedRefunded && !isCancelledPaidPrepaid) {
    return false;
  }

  // Must have a positive refund amount
  const amountRupees = Number(
    order.refundSummary?.amountRupees ??
    (order.refund?.amountPaise ? order.refund.amountPaise / 100 : undefined) ??
    (order.payment?.refundedAmount ? order.payment.refundedAmount / 100 : undefined) ??
    (isCancelledPaidPrepaid ? order.pricing?.total : 0)
  );

  return amountRupees > 0;
}

export interface CustomerRefundDisplay {
  shouldShow: boolean;
  status: 'requested' | 'pending' | 'processed' | 'failed';
  badgeLabel: string;
  badgeClass: string;
  title: string;
  amountRupees: number;
  formattedAmount: string;
  paymentMethodDisplay: string;
  notice: string;
  verifiedAtDate?: string | null;
}

/**
 * Resolve transparent customer-facing refund details
 */
export function resolveRefundDisplay(order: any): CustomerRefundDisplay | null {
  if (!shouldShowRefund(order)) return null;

  const rawStatus = (order.refundSummary?.status || order.refund?.status || '').toLowerCase();
  const paymentStatus = (order.payment?.status || '').toLowerCase();

  let status: 'requested' | 'pending' | 'processed' | 'failed' = 'pending';
  if (rawStatus === 'processed' || paymentStatus === 'refunded') {
    status = 'processed';
  } else if (rawStatus === 'failed') {
    status = 'failed';
  } else if (rawStatus === 'requested') {
    status = 'requested';
  } else {
    status = 'pending';
  }

  const amountRupees = Number(
    order.refundSummary?.amountRupees ??
    (order.refund?.amountPaise ? order.refund.amountPaise / 100 : undefined) ??
    (order.payment?.refundedAmount ? order.payment.refundedAmount / 100 : undefined) ??
    order.pricing?.total ?? 0
  );

  const formattedAmount = amountRupees.toLocaleString('en-IN', {
    minimumFractionDigits: amountRupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  const paymentMethod = resolvePaymentMethodName(order.payment?.method);

  let badgeLabel = 'Refund Processing';
  let badgeClass = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800';
  let title = 'Refund Processing';
  let notice = `₹${formattedAmount} will be returned to your original payment method (${paymentMethod}). It typically reflects within 5-7 business days.`;

  if (status === 'processed') {
    badgeLabel = 'Refund Processed';
    badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800';
    title = 'Refund Processed';
    notice = `₹${formattedAmount} has been refunded to your ${paymentMethod}. Bank credit reflects within 5-7 business days.`;
  } else if (status === 'failed') {
    badgeLabel = 'Refund Requires Attention';
    badgeClass = 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-200 dark:border-red-800';
    title = 'Refund Requires Attention';
    notice = `We are reviewing your refund of ₹${formattedAmount}. Our support team will assist you shortly.`;
  } else if (status === 'requested') {
    badgeLabel = 'Refund Requested';
    badgeClass = 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800';
    title = 'Refund Requested';
    notice = `Your refund request of ₹${formattedAmount} has been received and is being initiated.`;
  }

  const verifiedAt = order.refundSummary?.verifiedAt || order.refund?.verifiedAt;
  const verifiedAtDate = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return {
    shouldShow: true,
    status,
    badgeLabel,
    badgeClass,
    title,
    amountRupees,
    formattedAmount,
    paymentMethodDisplay: paymentMethod,
    notice,
    verifiedAtDate,
  };
}

export function resolvePaymentMethodName(method?: string): string {
  const m = (method || '').toLowerCase();
  if (m === 'cod') return 'Cash on Delivery';
  if (m === 'upi') return 'UPI';
  if (m === 'card') return 'Card';
  if (m === 'netbanking') return 'NetBanking';
  if (m === 'wallet') return 'Wallet';
  if (m === 'coupon') return 'Gift Coupon';
  return 'Online Payment';
}

export interface CustomerPaymentDisplay {
  methodName: string;
  statusLabel: string;
  combinedDisplay: string;
  isPaid: boolean;
  isCod: boolean;
  isPending: boolean;
  isZeroPayable: boolean;
}

export function resolvePaymentDisplay(order: any): CustomerPaymentDisplay {
  const isCod = (order?.payment?.method || '').toLowerCase() === 'cod';
  const methodName = resolvePaymentMethodName(order?.payment?.method);
  const paymentStatus = (order?.payment?.status || '').toLowerCase();

  const isZeroPayable =
    order?.isZeroPayable === true ||
    (order?.pricing?.total !== undefined &&
      order?.pricing?.total !== null &&
      Number(order.pricing.total) === 0 &&
      !isCod);

  if (isZeroPayable) {
    return {
      methodName: 'Coupon / Free',
      statusLabel: 'No Payment Due',
      combinedDisplay: 'No Payment Due',
      isPaid: true,
      isCod: false,
      isPending: false,
      isZeroPayable: true,
    };
  }

  if (isCod) {
    return {
      methodName,
      statusLabel: 'Pay on Delivery',
      combinedDisplay: 'Cash on Delivery • Pay on Delivery',
      isPaid: false,
      isCod: true,
      isPending: false,
      isZeroPayable: false,
    };
  }

  const isPaid = paymentStatus === 'paid' || paymentStatus === 'refunded';
  const isPending = paymentStatus === 'pending' || !paymentStatus;

  const statusLabel = isPaid ? 'Paid' : isPending ? 'Pending' : 'Failed';
  const combinedDisplay = `${methodName} • ${statusLabel}`;

  return {
    methodName,
    statusLabel,
    combinedDisplay,
    isPaid,
    isCod: false,
    isPending,
    isZeroPayable: false,
  };
}

export interface ProductPreviewItem {
  name: string;
  image?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ProductPreviewResult {
  previews: ProductPreviewItem[];
  remainingCount: number;
  totalQuantity: number;
}

export function resolveProductPreviews(items: any[] | undefined | null): ProductPreviewResult {
  if (!Array.isArray(items) || items.length === 0) {
    return { previews: [], remainingCount: 0, totalQuantity: 0 };
  }

  const allItems: ProductPreviewItem[] = items.map((item) => {
    const name = item.productName || item.productId?.name || item.name || 'Handcrafted Saree';
    const image = item.productImage || item.productId?.mainImage || item.image || '/placeholder.svg';
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.price || 0);
    const lineTotal = unitPrice * quantity;
    return { name, image, quantity, unitPrice, lineTotal };
  });

  const totalQuantity = allItems.reduce((acc, curr) => acc + curr.quantity, 0);

  // Show up to 2 previews; if more than 2, show 1 and "+ N more items" to keep cards compact
  const maxPreviews = allItems.length > 2 ? 1 : allItems.length;
  const previews = allItems.slice(0, maxPreviews);
  const remainingCount = allItems.length - previews.length;

  return { previews, remainingCount, totalQuantity };
}

export interface CustomerOrderActions {
  canViewDetails: boolean;
  canTrack: boolean;
  canCancel: boolean;
  canResumePayment: boolean;
  canCheckStatus: boolean;
  cannotCancelReason?: string | null;
  cannotResumeReason?: string | null;
}

export function resolveOrderActions(order: any): CustomerOrderActions {
  const status = resolveCustomerOrderStatus(order);

  const canResumePayment = Boolean(status.canResumePayment && (order?.canResumePayment ?? true));
  const canCheckStatus = Boolean(status.isPendingPayment);

  // Track order: only useful if placed, confirmed, shipped, out_for_delivery, delivered, or in logistics
  const trackableKeys = [
    'order_placed',
    'placed',
    'processing',
    'picked_up',
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'undelivered',
    'rto_initiated',
    'rto_in_transit',
    'rto_out_for_delivery',
    'rto_delivered',
  ];
  const canTrack = trackableKeys.includes(status.key) && !status.isPendingPayment;

  // Cancel order: only if canCancel is true, not shipped/delivered/cancelled/pending payment or in transit/RTO
  const nonCancellableKeys = [
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'returned',
    'undelivered',
    'rto_initiated',
    'rto_in_transit',
    'rto_out_for_delivery',
    'rto_delivered',
    'lost',
    'damaged',
  ];
  const canCancel = Boolean(
    status.canCancel &&
    (order?.canCancel ?? true) &&
    !status.isPendingPayment &&
    !status.isTerminal &&
    !nonCancellableKeys.includes(status.key)
  );

  return {
    canViewDetails: true,
    canTrack,
    canCancel,
    canResumePayment,
    canCheckStatus,
    cannotCancelReason: order?.cannotCancelReason || null,
    cannotResumeReason: order?.cannotResumeReason || null,
  };
}


import test from 'node:test'
import assert from 'node:assert/strict'

// Import the resolver & presentation helpers
import {
  resolveCustomerOrderStatus,
  shouldShowRefund,
  resolveRefundDisplay,
  resolvePaymentDisplay,
  resolveOrderActions,
  resolveProductPreviews,
} from '../lib/order-status.ts'

test('Customer Order Status Resolver - Comprehensive Lifecycle Mapping', async (t) => {
  await t.test('1. Online payment incomplete -> Payment Pending', () => {
    const order = {
      status: 'placed',
      payment: { method: 'upi', status: 'pending' },
      reservation: { state: 'reserved', expiresAt: new Date(Date.now() + 600000) },
      canCancel: true,
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'payment_pending')
    assert.equal(resolved.label, 'Payment Pending')
    assert.equal(resolved.canResumePayment, true)
    assert.equal(resolved.canCancel, true)
    assert.equal(resolved.isPendingPayment, true)
    assert.equal(resolved.isTerminal, false)
  })

  await t.test('2. Online payment failed but retry is allowed -> Payment Failed — Retry', () => {
    const order = {
      status: 'placed',
      payment: { method: 'card', status: 'failed' },
      reservation: { state: 'reserved', expiresAt: new Date(Date.now() + 600000) },
      canCancel: true,
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'payment_failed')
    assert.equal(resolved.label, 'Payment Failed — Retry')
    assert.equal(resolved.canResumePayment, true)
    assert.equal(resolved.canCancel, true)
    assert.equal(resolved.isPendingPayment, true)
    assert.equal(resolved.isTerminal, false)
  })

  await t.test('3. Payment verification uncertain -> Verifying Payment', () => {
    const order = {
      status: 'placed',
      payment: { method: 'upi', status: 'pending', verificationPending: true },
      reservation: { state: 'reserved', expiresAt: new Date(Date.now() + 600000) },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'verifying_payment')
    assert.equal(resolved.label, 'Verifying Payment')
    assert.equal(resolved.canResumePayment, false)
    assert.equal(resolved.isPendingPayment, true)
    assert.equal(resolved.isTerminal, false)
  })

  await t.test('4. Payment reservation expired -> Payment Expired', () => {
    const order = {
      status: 'placed',
      payment: { method: 'netbanking', status: 'pending' },
      reservation: { state: 'released', expiresAt: new Date(Date.now() - 1000) },
      resourcesReleased: true,
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'payment_expired')
    assert.equal(resolved.label, 'Payment Expired')
    assert.equal(resolved.canResumePayment, false)
    assert.equal(resolved.canCancel, false)
    assert.equal(resolved.isTerminal, true)
  })

  await t.test('5. Payment confirmed online -> Order Placed', () => {
    const order = {
      status: 'placed',
      payment: { method: 'card', status: 'paid' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'order_placed')
    assert.equal(resolved.label, 'Order Placed')
    assert.equal(resolved.canResumePayment, false)
    assert.equal(resolved.canCancel, true)
    assert.equal(resolved.isPendingPayment, false)
  })

  await t.test('6. COD order accepted -> Order Placed immediately', () => {
    const order = {
      status: 'placed',
      payment: { method: 'cod', status: 'pending' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'order_placed')
    assert.equal(resolved.label, 'Order Placed')
    assert.equal(resolved.canResumePayment, false)
    assert.equal(resolved.canCancel, true)
    assert.equal(resolved.isPendingPayment, false)
  })

  await t.test('7. Order being prepared -> Processing', () => {
    const order = {
      status: 'processing',
      payment: { method: 'card', status: 'paid' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'processing')
    assert.equal(resolved.label, 'Processing')
    assert.equal(resolved.canResumePayment, false)
    assert.equal(resolved.canCancel, true)
  })

  await t.test('8. Order dispatched -> Shipped', () => {
    const order = {
      status: 'shipped',
      payment: { method: 'upi', status: 'paid' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'shipped')
    assert.equal(resolved.label, 'Shipped')
    assert.equal(resolved.canCancel, false)
  })

  await t.test('9. Order out for delivery -> Out for Delivery', () => {
    const order = {
      status: 'out_for_delivery',
      payment: { method: 'cod', status: 'pending' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'out_for_delivery')
    assert.equal(resolved.label, 'Out for Delivery')
    assert.equal(resolved.canCancel, false)
  })

  await t.test('10. Order delivered -> Delivered', () => {
    const order = {
      status: 'delivered',
      payment: { method: 'card', status: 'paid' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'delivered')
    assert.equal(resolved.label, 'Delivered')
    assert.equal(resolved.canCancel, false)
    assert.equal(resolved.isTerminal, true)
  })

  await t.test('11. Cancellation requested -> Cancellation Pending', () => {
    const order = {
      status: 'placed',
      payment: { method: 'card', status: 'paid' },
      cancellationSummary: { status: 'requested', canCancel: false },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'cancellation_pending')
    assert.equal(resolved.label, 'Cancellation Pending')
    assert.equal(resolved.canCancel, false)
  })

  await t.test('12. Unpaid online order cancelled -> Cancelled (no refund display)', () => {
    const order = {
      status: 'cancelled',
      payment: { method: 'card', status: 'pending' },
      cancellationSummary: { status: 'completed' },
      refundSummary: null,
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'cancelled')
    assert.equal(resolved.label, 'Cancelled')
    assert.equal(resolved.canResumePayment, false)
    assert.equal(resolved.canCancel, false)
    assert.equal(resolved.isTerminal, true)
  })

  await t.test('13. Paid order cancelled with refund initiated -> Refund Processing', () => {
    const order = {
      status: 'cancelled',
      payment: { method: 'card', status: 'paid' },
      cancellationSummary: { status: 'completed' },
      refundSummary: { status: 'pending' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'refund_processing')
    assert.equal(resolved.label, 'Refund Processing')
    assert.equal(resolved.canResumePayment, false)
    assert.equal(resolved.isTerminal, true)
  })

  await t.test('14. Paid order cancelled with refund finalized -> Refund Processed', () => {
    const order = {
      status: 'cancelled',
      payment: { method: 'upi', status: 'refunded' },
      cancellationSummary: { status: 'completed' },
      refundSummary: { status: 'processed' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'refund_processed')
    assert.equal(resolved.label, 'Refund Processed')
    assert.equal(resolved.isTerminal, true)
  })

  await t.test('15. Paid order cancelled with refund failure -> Refund Requires Attention', () => {
    const order = {
      status: 'cancelled',
      payment: { method: 'card', status: 'paid' },
      cancellationSummary: { status: 'completed' },
      refundSummary: { status: 'failed' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'refund_failed')
    assert.equal(resolved.label, 'Refund Requires Attention')
    assert.equal(resolved.isTerminal, true)
  })

  await t.test('16. Order held for manual review -> Under Review', () => {
    const order = {
      status: 'placed',
      payment: { method: 'card', status: 'paid' },
      fulfillmentHold: { active: true, reason: 'High-risk velocity check triggered' },
    }
    const resolved = resolveCustomerOrderStatus(order)
    assert.equal(resolved.key, 'under_review')
    assert.equal(resolved.label, 'Under Review')
    assert.equal(resolved.canResumePayment, false)
    assert.equal(resolved.description, 'High-risk velocity check triggered')
  })
})

test('Refund UI Visibility and Presentation Guardrails (ISSUE 1)', async (t) => {
  await t.test('Normal placed and paid order MUST NOT show refund UI', () => {
    const order = {
      orderId: 'HL-ORD-101',
      status: 'placed',
      payment: { method: 'upi', status: 'paid', amountPaid: 249900 },
      pricing: { total: 2499 },
      cancellation: null,
      refundSummary: null,
    }
    assert.equal(shouldShowRefund(order), false)
    assert.equal(resolveRefundDisplay(order), null)
  })

  await t.test('Normal COD order MUST NOT show refund UI', () => {
    const order = {
      orderId: 'HL-ORD-COD-1',
      status: 'placed',
      payment: { method: 'cod', status: 'pending' },
      pricing: { total: 2499 },
    }
    assert.equal(shouldShowRefund(order), false)
    assert.equal(resolveRefundDisplay(order), null)
  })

  await t.test('Cancelled COD order MUST NOT show refund UI (no money was collected)', () => {
    const order = {
      orderId: 'HL-ORD-COD-CANCEL',
      status: 'cancelled',
      payment: { method: 'cod', status: 'cancelled' },
      cancellation: { status: 'completed' },
      pricing: { total: 2499 },
    }
    assert.equal(shouldShowRefund(order), false)
    assert.equal(resolveRefundDisplay(order), null)
  })

  await t.test('Cancelled paid order with pending refund shows refund UI with ₹1 formatting', () => {
    const order = {
      orderId: 'HL-ORD-1RUPEE',
      status: 'cancelled',
      payment: { method: 'upi', status: 'paid', amountPaid: 100 },
      cancellationSummary: { status: 'completed' },
      refundSummary: { status: 'pending', amountRupees: 1 },
      pricing: { total: 1 },
    }
    assert.equal(shouldShowRefund(order), true)
    const refundInfo = resolveRefundDisplay(order)
    assert.ok(refundInfo)
    assert.equal(refundInfo.status, 'pending')
    assert.equal(refundInfo.amountRupees, 1)
    assert.equal(refundInfo.formattedAmount, '1')
    assert.match(refundInfo.notice, /₹1 will be returned to your original payment method/)
  })

  await t.test('Processed refund shows Refund Processed badge and gateway date', () => {
    const order = {
      orderId: 'HL-ORD-PROCESSED',
      status: 'cancelled',
      payment: { method: 'card', status: 'refunded' },
      cancellation: { status: 'completed' },
      refundSummary: {
        status: 'processed',
        amountRupees: 2499,
        verifiedAt: '2026-11-08T06:00:00.000Z',
      },
      pricing: { total: 2499 },
    }
    assert.equal(shouldShowRefund(order), true)
    const refundInfo = resolveRefundDisplay(order)
    assert.ok(refundInfo)
    assert.equal(refundInfo.status, 'processed')
    assert.equal(refundInfo.badgeLabel, 'Refund Processed')
    assert.ok(refundInfo.verifiedAtDate)
  })
})

test('Payment Presentation & Zero-Payable Discrimination (ISSUE 4)', async (t) => {
  await t.test('Missing or null order data does NOT evaluate to zero-payable', () => {
    const missingOrder = null
    const display = resolvePaymentDisplay(missingOrder)
    assert.equal(display.isZeroPayable, false)
    assert.notEqual(display.statusLabel, 'No Payment Due')

    const emptyOrder = {}
    const emptyDisplay = resolvePaymentDisplay(emptyOrder)
    assert.equal(emptyDisplay.isZeroPayable, false)
  })

  await t.test('Server confirmed ₹0 total is marked isZeroPayable: true', () => {
    const zeroOrder = {
      pricing: { total: 0 },
      payment: { method: 'coupon', status: 'paid' },
      isZeroPayable: true,
    }
    const display = resolvePaymentDisplay(zeroOrder)
    assert.equal(display.isZeroPayable, true)
    assert.equal(display.statusLabel, 'No Payment Due')
    assert.equal(display.combinedDisplay, 'No Payment Due')
  })

  await t.test('Standard online paid order formats payment method and status accurately', () => {
    const upiOrder = {
      payment: { method: 'upi', status: 'paid' },
      pricing: { total: 2499 },
    }
    const display = resolvePaymentDisplay(upiOrder)
    assert.equal(display.isZeroPayable, false)
    assert.equal(display.methodName, 'UPI')
    assert.equal(display.statusLabel, 'Paid')
    assert.equal(display.combinedDisplay, 'UPI • Paid')
  })

  await t.test('COD order shows Cash on Delivery • Pay on Delivery', () => {
    const codOrder = {
      payment: { method: 'cod', status: 'pending' },
      pricing: { total: 2499 },
    }
    const display = resolvePaymentDisplay(codOrder)
    assert.equal(display.isCod, true)
    assert.equal(display.combinedDisplay, 'Cash on Delivery • Pay on Delivery')
  })
})

test('Product Previews & Compact List Representation (ISSUE 5)', async (t) => {
  await t.test('Single item order shows 1 preview with 0 remaining', () => {
    const items = [
      { productName: 'Handloom Linen Saree', quantity: 1, price: 2499, productImage: '/saree1.jpg' },
    ]
    const res = resolveProductPreviews(items)
    assert.equal(res.previews.length, 1)
    assert.equal(res.remainingCount, 0)
    assert.equal(res.totalQuantity, 1)
    assert.equal(res.previews[0].name, 'Handloom Linen Saree')
  })

  await t.test('5-item order is compact: shows preview and + 4 more items', () => {
    const items = [
      { productName: 'Saree 1', quantity: 1, price: 1000 },
      { productName: 'Saree 2', quantity: 2, price: 1000 },
      { productName: 'Saree 3', quantity: 1, price: 1000 },
      { productName: 'Saree 4', quantity: 1, price: 1000 },
      { productName: 'Saree 5', quantity: 1, price: 1000 },
    ]
    const res = resolveProductPreviews(items)
    assert.equal(res.previews.length, 1)
    assert.equal(res.remainingCount, 4)
    assert.equal(res.totalQuantity, 6)
  })
})

test('Contextual Action Resolution (ISSUE 5)', async (t) => {
  await t.test('Paid placed order allows View Details, Track, Cancel', () => {
    const order = {
      status: 'placed',
      payment: { method: 'upi', status: 'paid' },
      canCancel: true,
    }
    const actions = resolveOrderActions(order)
    assert.equal(actions.canViewDetails, true)
    assert.equal(actions.canTrack, true)
    assert.equal(actions.canCancel, true)
    assert.equal(actions.canResumePayment, false)
  })

  await t.test('Pending payment order allows Resume Payment and Check Status, not Track or Cancel', () => {
    const order = {
      status: 'placed',
      payment: { method: 'upi', status: 'pending' },
      canResumePayment: true,
    }
    const actions = resolveOrderActions(order)
    assert.equal(actions.canResumePayment, true)
    assert.equal(actions.canCheckStatus, true)
    assert.equal(actions.canTrack, false)
    assert.equal(actions.canCancel, false)
  })

  await t.test('Shipped order allows Track and View Details, but NOT Cancel', () => {
    const order = {
      status: 'shipped',
      payment: { method: 'upi', status: 'paid' },
      canCancel: false,
    }
    const actions = resolveOrderActions(order)
    assert.equal(actions.canTrack, true)
    assert.equal(actions.canCancel, false)
  })
})


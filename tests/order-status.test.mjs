import test from 'node:test'
import assert from 'node:assert/strict'

// Import the resolver
import { resolveCustomerOrderStatus } from '../lib/order-status.ts'

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


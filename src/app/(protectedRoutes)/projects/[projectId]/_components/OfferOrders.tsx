import React from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { ORDER_MODE_COPY, type OfferOrderRow } from '@/lib/offers/offerTypes'

const STATUS: Record<OfferOrderRow['status'], { label: string; tone: string }> = {
  PAID: { label: 'Paid', tone: 'bg-green-500/15 text-green-500' },
  DEPOSIT_PAID: { label: 'Deposit paid', tone: 'bg-sky-500/15 text-sky-400' },
  PENDING: { label: 'Didn’t finish', tone: 'bg-muted text-muted-foreground' },
  REFUNDED: { label: 'Refunded', tone: 'bg-amber-500/15 text-amber-500' },
  CANCELED: { label: 'Canceled', tone: 'bg-muted text-muted-foreground' },
  FAILED: { label: 'Failed', tone: 'bg-red-500/15 text-red-400' },
}

const PRICE_KIND: Record<NonNullable<OfferOrderRow['priceKind']>, string> = {
  ONE_TIME: 'In full',
  MONTHLY: 'Monthly',
  DEPOSIT: 'Deposit',
}

export function formatMoney(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100)
}

/** Orders for one offer, newest first. "Didn't finish" rows are buyers who left checkout: follow up. */
export function OfferOrders({ orders }: { orders: OfferOrderRow[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground">No orders yet. Share your link to get the first one.</p>
  }
  return (
    <ul className="divide-y divide-border">
      {orders.map((order) => {
        const status = STATUS[order.status]
        const balance = order.status === 'DEPOSIT_PAID' ? order.amountTotalCents - order.amountPaidCents : 0
        return (
          <li key={order.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{order.buyer ?? 'Direct pay (no details)'}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.createdAt), 'MMM d, h:mm a')}
                {order.way ? ` · ${ORDER_MODE_COPY[order.way].title}` : ''}
                {order.priceKind ? ` · ${PRICE_KIND[order.priceKind]}` : ''}
                {order.source ? ` · from ${order.source}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium">
                  {order.amountPaidCents ? formatMoney(order.amountPaidCents, order.currency) : '—'}
                </p>
                {balance > 0 ? (
                  <p className="text-xs text-muted-foreground">{formatMoney(balance, order.currency)} balance due</p>
                ) : null}
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.tone)}>{status.label}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

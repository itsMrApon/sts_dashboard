import { ImageResponse } from 'next/og'
import { loadPublicOffer } from '@/lib/offers/publicOffer'
import { describePrice } from '@/lib/offers/publicOfferTypes'

/** Link preview for WhatsApp, iMessage and social: business, offer name and price. */
export const runtime = 'nodejs'
export const alt = 'Offer'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OfferPreviewImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const offer = await loadPublicOffer(slug)
  const title = offer?.live ? offer.title : 'Offer not available'
  const business = offer?.business.name ?? 'sts-ai'
  const defaultPrice = offer?.live ? (offer.prices.find((price) => price.isDefault) ?? offer.prices[0]) : undefined
  const priceText = defaultPrice ? describePrice(defaultPrice).title : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #0b0b10 0%, #1d1530 60%, #2a1a4a 100%)',
          color: '#f5f3ff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 32, color: '#c4b5fd' }}>{business}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
            {title.length > 70 ? `${title.slice(0, 67)}…` : title}
          </div>
          {priceText ? <div style={{ display: 'flex', fontSize: 40, color: '#ddd6fe' }}>{priceText}</div> : null}
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#a78bfa' }}>Tap to get started</div>
      </div>
    ),
    size,
  )
}

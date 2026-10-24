import { NextRequest, NextResponse } from 'next/server'

const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token'
const EBAY_SEARCH_BY_IMAGE_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search_by_image'
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope'

type CachedToken = { accessToken: string; expiresAt: number }
let cachedToken: CachedToken | null = null

async function getApplicationToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken
  }

  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('EBAY_CLIENT_ID / EBAY_CLIENT_SECRET manquants dans les variables d\'environnement')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: EBAY_SCOPE,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Echec de l'authentification eBay (${response.status}): ${text}`)
  }

  const data = await response.json()
  cachedToken = {
    accessToken: data.access_token,
    // On retire 60s de marge par rapport à l'expiration réelle annoncée par eBay
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }

  return cachedToken.accessToken
}

function stripBase64Prefix(image: string): string {
  const commaIndex = image.indexOf(',')
  if (image.startsWith('data:') && commaIndex !== -1) {
    return image.slice(commaIndex + 1)
  }
  return image
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const image = body?.image as string | undefined

    if (!image) {
      return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
    }

    if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
      console.error('[ebay/search-by-image] EBAY_CLIENT_ID / EBAY_CLIENT_SECRET manquants')
      return NextResponse.json(
        { error: "La recherche eBay n'est pas encore activée : les clés eBay n'ont pas été ajoutées au site." },
        { status: 503 }
      )
    }

    const accessToken = await getApplicationToken()
    const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_FR'

    const ebayResponse = await fetch(`${EBAY_SEARCH_BY_IMAGE_URL}?limit=10`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      },
      body: JSON.stringify({ image: stripBase64Prefix(image) }),
    })

    if (!ebayResponse.ok) {
      const text = await ebayResponse.text()
      console.error('[ebay/search-by-image] eBay error', ebayResponse.status, text)
      return NextResponse.json(
        { error: "La recherche eBay a échoué. Réessaye dans quelques instants." },
        { status: 502 }
      )
    }

    const data = await ebayResponse.json()
    const items = (data.itemSummaries || []).map((item: any) => ({
      id: item.itemId,
      title: item.title,
      price: item.price ? { value: item.price.value, currency: item.price.currency } : null,
      imageUrl: item.image?.imageUrl ?? null,
      itemWebUrl: item.itemWebUrl,
      condition: item.condition ?? null,
    }))

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('[ebay/search-by-image] Unexpected error', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur inattendue lors de la recherche eBay.' },
      { status: 500 }
    )
  }
}

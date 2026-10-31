import { NextRequest, NextResponse } from 'next/server'

const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token'
const EBAY_SEARCH_BY_IMAGE_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search_by_image'
const EBAY_SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search'
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
    const query = (body?.query as string | undefined)?.trim()

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
    // eBay refuse la recherche par image sur EBAY_FR (seuls DE, AU, US, GB sont acceptés)
    const imageMarketplaceId = process.env.EBAY_IMAGE_MARKETPLACE_ID || 'EBAY_DE'

    const buildHeaders = (marketplace: string) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplace,
    })

    const imagePromise = fetch(`${EBAY_SEARCH_BY_IMAGE_URL}?limit=20`, {
      method: 'POST',
      headers: buildHeaders(imageMarketplaceId),
      body: JSON.stringify({ image: stripBase64Prefix(image) }),
    }).catch(() => null)
    // La recherche par mots-clés est facultative : si elle échoue, on garde l'image seule
    const keywordPromise = query
      ? fetch(`${EBAY_SEARCH_URL}?${new URLSearchParams({ q: query, limit: '20' })}`, {
          headers: buildHeaders(marketplaceId),
        }).catch(() => null)
      : Promise.resolve(null)

    const [ebayResponse, keywordResponse] = await Promise.all([imagePromise, keywordPromise])

    // L'erreur n'est fatale que si ni l'image ni les mots-clés n'ont donné de réponse exploitable
    if (ebayResponse && !ebayResponse.ok) {
      console.error('[ebay/search-by-image] eBay error', ebayResponse.status, await ebayResponse.clone().text())
    }
    if (!ebayResponse?.ok && !keywordResponse?.ok) {
      return NextResponse.json(
        { error: "La recherche eBay a échoué. Réessaye dans quelques instants." },
        { status: 502 }
      )
    }

    const mapItem = (item: any) => ({
      id: item.itemId,
      title: item.title,
      price: item.price ? { value: item.price.value, currency: item.price.currency } : null,
      imageUrl: item.image?.imageUrl ?? null,
      itemWebUrl: item.itemWebUrl,
      condition: item.condition ?? null,
    })

    const imageItems =
      ebayResponse && ebayResponse.ok ? ((await ebayResponse.json()).itemSummaries || []).map(mapItem) : []
    const keywordItems =
      keywordResponse && keywordResponse.ok
        ? ((await keywordResponse.json()).itemSummaries || []).map(mapItem)
        : []

    // Les annonces trouvées par l'image ET par les mots-clés passent en premier : ce sont les plus fiables
    const imageIds = new Set(imageItems.map((i: { id: string }) => i.id))
    const keywordIds = new Set(keywordItems.map((i: { id: string }) => i.id))
    const both = imageItems.filter((i: { id: string }) => keywordIds.has(i.id))
    const keywordOnly = keywordItems.filter((i: { id: string }) => !imageIds.has(i.id))
    const imageOnly = imageItems.filter((i: { id: string }) => !keywordIds.has(i.id))
    const items = [...both, ...keywordOnly, ...imageOnly].slice(0, 20)

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('[ebay/search-by-image] Unexpected error', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur inattendue lors de la recherche eBay.' },
      { status: 500 }
    )
  }
}

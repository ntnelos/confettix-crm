import { NextResponse, NextRequest } from 'next/server'
import https from 'https'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
  }

  const wcUrl = process.env.NEXT_PUBLIC_WC_STORE_URL
  const consumerKey = process.env.CONSUMER_KEY
  const consumerSecret = process.env.CONSUMER_SECRET

  if (!wcUrl || !consumerKey || !consumerSecret) {
    console.error('Missing WooCommerce credentials in environment variables')
    return NextResponse.json({ error: 'Server configuration error (missing WC credentials)' }, { status: 500 })
  }

  try {
    // Strip trailing slash from store URL to prevent double-slash
    const baseUrl = wcUrl.replace(/\/$/, '')
    
    // Construct the WooCommerce API URL
    const url = new URL(`${baseUrl}/wp-json/wc/v3/products`)
    url.searchParams.append('search', q)
    url.searchParams.append('status', 'publish')
    url.searchParams.append('per_page', '10')
    // Use query string auth - more compatible than Basic Auth on many WP hosts
    url.searchParams.append('consumer_key', consumerKey)
    url.searchParams.append('consumer_secret', consumerSecret)

    const fetchWooCommerce = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        https.get(url, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; ConfettixCRM/1.0)',
            'Accept': 'application/json',
            'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
            'Cache-Control': 'no-cache',
          }
        }, (res) => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(data))
              } catch (e) {
                reject(new Error('Failed to parse JSON response'))
              }
            } else {
              reject({ status: res.statusCode, body: data })
            }
          })
        }).on('error', (e) => reject(e))
      })
    }

    const data = await fetchWooCommerce()
    
    // Transform into a simplified structure for the CRM frontend
    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

    const products = data.map((item: any) => ({
      id: item.id.toString(),
      name: item.name,
      price: parseFloat(item.price || '0'),
      regular_price: parseFloat(item.regular_price || '0'),
      sku: item.sku || '',
      permalink: item.permalink,
      image_url: item.images && item.images.length > 0 ? item.images[0].src : null,
      // description first, short_description as fallback
      short_description: stripHtml(item.short_description || ''),
      description: stripHtml(item.description || item.short_description || '')
    }))

    return NextResponse.json({ products })

  } catch (error: any) {
    console.error('Failed to search WooCommerce products:', error)
    const status = error.status || 500
    const detail = error.body || error.message || 'Failed to search products'
    return NextResponse.json({ error: `WooCommerce API responded with status ${status}`, detail }, { status })
  }
}

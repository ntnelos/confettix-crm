import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

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
    // Basic Auth header for WooCommerce REST API
    const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
    
    // Construct the WooCommerce API URL
    // We search across products, getting only published ones to keep it clean.
    const url = new URL(`${wcUrl}/wp-json/wc/v3/products`)
    url.searchParams.append('search', q)
    url.searchParams.append('status', 'publish')
    url.searchParams.append('per_page', '10') // Limit results to fast search

    // Fetch from WooCommerce
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('WooCommerce API Error:', response.status, errText)
      return NextResponse.json({ error: `WooCommerce API responded with status ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    
    // Transform into a simplified structure for the CRM frontend
    const products = data.map((item: any) => ({
      id: item.id.toString(),
      name: item.name,
      price: parseFloat(item.price || '0'),
      regular_price: parseFloat(item.regular_price || '0'),
      sku: item.sku || '',
      permalink: item.permalink,
      image_url: item.images && item.images.length > 0 ? item.images[0].src : null
    }))

    return NextResponse.json({ products })

  } catch (error) {
    console.error('Failed to search WooCommerce products:', error)
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 })
  }
}

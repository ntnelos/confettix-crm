import { getMorningErrorMessage } from './errors'

interface MorningConfig {
  apiKey: string
  apiSecret: string
  tokenUrl: string
  apiUrl: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

export function getMorningConfig(): MorningConfig {
  const apiKey = process.env.MORNING_API_KEY || process.env.GREEN_INVOICE_API_KEY || ''
  const apiSecret = process.env.MORNING_API_SECRET || ''
  const tokenUrl = process.env.MORNING_TOKEN_URL || 'https://api.morning.co/idp/v1/oauth/token'
  const apiUrl = process.env.MORNING_API_URL || 'https://api.greeninvoice.co.il/api/v1'

  return { apiKey, apiSecret, tokenUrl, apiUrl }
}

/**
 * Retrieves a valid OAuth2 Bearer token from Morning IDP.
 * Caches token in memory for up to 50 minutes to avoid redundant network requests.
 */
export async function getMorningToken(forceRefresh = false): Promise<string> {
  const { apiKey, apiSecret, tokenUrl } = getMorningConfig()

  if (!apiKey || !apiSecret) {
    throw new Error('Morning API credentials not configured. Please verify MORNING_API_KEY and MORNING_API_SECRET.')
  }

  const now = Date.now()
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token
  }

  let authRes: Response
  try {
    authRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: apiKey,
        client_secret: apiSecret
      })
    })
  } catch (netErr: any) {
    throw new Error(`שגיאת רשת בהתחברות ל-Morning (${tokenUrl}): ${netErr.message}`)
  }

  if (!authRes.ok) {
    const errText = await authRes.text()
    let errorDesc = errText
    try {
      const parsed = JSON.parse(errText)
      errorDesc = parsed.error_description || parsed.message || parsed.error || errText
    } catch {}
    throw new Error(`שגיאת אימות מול Morning (סטטוס ${authRes.status}): ${errorDesc}`)
  }

  const authData = await authRes.json()
  const token = authData.accessToken || authData.access_token || authData.token

  if (!token) {
    throw new Error('שרת Morning לא החזיר Access Token בתגובה.')
  }

  // Cache token for 50 minutes (validity is usually 1 hour)
  const expiresInSeconds = authData.expires_in || 3600
  cachedToken = {
    token,
    expiresAt: now + (expiresInSeconds - 600) * 1000
  }

  return token
}

/**
 * Tests connection to Morning API and retrieves active business info.
 */
export async function testMorningConnection(): Promise<{
  success: boolean
  business?: { id: string; name: string; taxId?: string; title?: string }
  error?: string
}> {
  try {
    const token = await getMorningToken(true)
    const { apiUrl } = getMorningConfig()

    const res = await fetch(`${apiUrl}/businesses`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `שגיאה בקריאת פרטי העסק מ-Morning: ${errText}` }
    }

    const businesses = await res.json()
    const primaryBusiness = Array.isArray(businesses) && businesses.length > 0 ? businesses[0] : null

    return {
      success: true,
      business: primaryBusiness
        ? {
            id: primaryBusiness.id,
            name: primaryBusiness.name,
            taxId: primaryBusiness.taxId,
            title: primaryBusiness.title
          }
        : undefined
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'שגיאה בלתי צפויה בבדיקת החיבור ל-Morning'
    }
  }
}

/**
 * Search existing client in Morning by email, phone, or name.
 */
export async function searchMorningClient(
  token: string,
  criteria: { email?: string | null; name?: string | null; phone?: string | null }
): Promise<any | null> {
  const { apiUrl } = getMorningConfig()

  // 1. Try search by email first (most specific)
  if (criteria.email && criteria.email.trim()) {
    try {
      const res = await fetch(`${apiUrl}/clients/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: criteria.email.trim(), pageSize: 5 })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.items && data.items.length > 0) {
          return data.items[0]
        }
      }
    } catch (e) {
      console.warn('Morning search client by email failed:', e)
    }
  }

  // 2. Try search by exact name
  if (criteria.name && criteria.name.trim()) {
    try {
      const res = await fetch(`${apiUrl}/clients/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: criteria.name.trim(), pageSize: 5 })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.items && data.items.length > 0) {
          // Find matching name
          const match = data.items.find(
            (c: any) => c.name?.trim().toLowerCase() === criteria.name?.trim().toLowerCase()
          )
          if (match) return match
        }
      }
    } catch (e) {
      console.warn('Morning search client by name failed:', e)
    }
  }

  return null
}

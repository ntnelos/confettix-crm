const path = require('path')
const fs = require('fs')

// Load .env.local
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const [k, ...v] = trimmed.split('=')
    if (k && v.length) {
      process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
    }
  })
}

async function testMorning() {
  const apiKey = process.env.MORNING_API_KEY
  const apiSecret = process.env.MORNING_API_SECRET
  const tokenUrl = process.env.MORNING_TOKEN_URL || 'https://api.morning.co/idp/v1/oauth/token'
  const apiUrl = process.env.MORNING_API_URL || 'https://api.greeninvoice.co.il/api/v1'

  console.log('Testing Morning Connection...')
  console.log('API Key:', apiKey ? `${apiKey.slice(0, 8)}...` : 'MISSING')

  const authRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiSecret
    })
  })

  if (!authRes.ok) {
    console.error('Auth error:', authRes.status, await authRes.text())
    return
  }

  const tokenData = await authRes.json()
  const token = tokenData.accessToken || tokenData.access_token

  console.log('Authentication Successful! Token acquired.')

  const bizRes = await fetch(`${apiUrl}/businesses`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (bizRes.ok) {
    const businesses = await bizRes.json()
    console.log('Connected Business:', businesses[0]?.name, 'Tax ID:', businesses[0]?.taxId)
  } else {
    console.error('Failed to get businesses:', await bizRes.text())
  }
}

testMorning()

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const settingsPath = path.join(process.cwd(), 'data', 'settings.json')

export async function GET() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8')
      return NextResponse.json(JSON.parse(data))
    }
    return NextResponse.json({ invoice_footer: '', invoice_email: '', invoice_remarks: '' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const newSettings = await req.json()
    
    // Read existing
    let currentSettings = {}
    if (fs.existsSync(settingsPath)) {
       currentSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    }

    const merged = { ...currentSettings, ...newSettings }
    
    // Ensure dir exists
    const dir = path.dirname(settingsPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8')
    
    return NextResponse.json(merged)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

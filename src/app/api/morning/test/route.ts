import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { testMorningConnection } from '@/lib/morning/client'

const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

export async function GET() {
  return handleTest()
}

export async function POST() {
  return handleTest()
}

async function handleTest() {
  const supabase = getServiceClient()

  try {
    const result = await testMorningConnection()

    if (result.success) {
      await supabase.from('system_logs').insert({
        level: 'info',
        service: 'morning_api',
        message: 'בדיקת חיבור ל-Morning הושלמה בהצלחה',
        details: { business: result.business }
      })
      return NextResponse.json({
        success: true,
        message: 'החיבור ל-Morning תקין ומאומת',
        business: result.business
      })
    } else {
      await supabase.from('system_logs').insert({
        level: 'error',
        service: 'morning_api',
        message: 'בדיקת חיבור ל-Morning נכשלה',
        details: { error: result.error }
      })
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'שגיאה בהתחברות ל-Morning'
        },
        { status: 400 }
      )
    }
  } catch (err: any) {
    await supabase.from('system_logs').insert({
      level: 'error',
      service: 'morning_api',
      message: `שגיאה בלתי צפויה בבדיקת חיבור ל-Morning: ${err.message}`,
      details: { stack: err.stack }
    })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

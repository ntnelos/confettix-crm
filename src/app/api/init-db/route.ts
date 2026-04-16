import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS system_settings (
        id text PRIMARY KEY,
        value text NOT NULL,
        updated_at timestamp with time zone default now()
      );
    `
  })
  
  if (error) {
    return NextResponse.json({ error })
  }
  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client' // Wait, I should use server client for internal updates

export async function POST(req: Request) {
  try {
    const { orgId, orgName, currentInfo } = await req.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key is missing. Please add OPENAI_API_KEY to your .env.local' }, { status: 500 })
    }

    // This is a placeholder for actual AI search logic.
    // In a real scenario, you'd use a search API like Tavily + OpenAI
    // or Perplexity API to get live data.
    
    // For now, we'll use OpenAI GPT-4o-mini to provide information based on its training data
    // which covers most well-known companies.
    
    const prompt = `
      You are a business intelligence assistant. 
      Provided is a company name: "${orgName}"
      Current info: ${JSON.stringify(currentInfo)}
      
      Please find or provide the following details for this company in JSON format:
      - industry (one of: הייטק ותוכנה, בנקאות ופיננסים, תחבורה, ביטוח, נדלן, בריאות, קמעונאות, תקשורת ומדיה, תעשייה, חינוך, ממשלה, אחר)
      - employee_count (number)
      - website (URL)
      - general_info (A concise summary of what they do, in Hebrew)
      - company_number (if known, H.P number in Israel)

      Respond ONLY with valid JSON.
    `

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    })

    const aiData = await response.json()
    if (!response.ok) throw new Error(aiData.error?.message || 'AI request failed')

    const enrichment = JSON.parse(aiData.choices[0].message.content)

    // Optional: Auto-save to DB here if desired, 
    // but the client-side will also handle saving if the user confirms or via the existing updateField logic
    // We'll just return it to the client for now to let the user see the "magic"
    
    return NextResponse.json({ updates: enrichment })

  } catch (error: any) {
    console.error('AI Enrichment Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

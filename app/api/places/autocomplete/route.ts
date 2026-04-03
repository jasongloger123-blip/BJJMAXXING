import { NextResponse } from 'next/server'

const ALLOWED_TYPES = new Set(['gym', 'health', 'establishment', 'school', 'university', 'point_of_interest'])
const PRIORITY_KEYWORDS = ['bjj', 'jiu jitsu', 'mma', 'grappling', 'fight', 'academy', 'club', 'fitness', 'wrestling']

function normalizeSuggestion(item: any) {
  return {
    placeId: item.place_id as string,
    name: item.structured_formatting?.main_text ?? item.description ?? '',
    secondaryText: item.structured_formatting?.secondary_text ?? '',
    description: item.description ?? '',
    types: Array.isArray(item.types) ? item.types : [],
  }
}

function scoreSuggestion(item: any) {
  const haystack = `${item.description ?? ''} ${(item.types ?? []).join(' ')}`.toLowerCase()
  const keywordScore = PRIORITY_KEYWORDS.reduce((score, keyword) => score + (haystack.includes(keyword) ? 2 : 0), 0)
  const typeScore = (item.types ?? []).reduce((score: number, type: string) => score + (ALLOWED_TYPES.has(type) ? 1 : 0), 0)
  return keywordScore + typeScore
}

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  if (!apiKey) {
    return NextResponse.json({ suggestions: [], error: 'GOOGLE_MAPS_API_KEY fehlt.' }, { status: 200 })
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', query)
  url.searchParams.set('language', 'de')
  url.searchParams.set('types', 'establishment')
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString(), { cache: 'no-store' })

  if (!response.ok) {
    return NextResponse.json({ suggestions: [], error: 'Google Places konnte nicht geladen werden.' }, { status: 200 })
  }

  const payload = await response.json()
  const suggestions = (payload.predictions ?? [])
    .filter((item: any) => {
      const types = Array.isArray(item.types) ? item.types : []
      return types.some((type: string) => ALLOWED_TYPES.has(type)) || PRIORITY_KEYWORDS.some((keyword) => (item.description ?? '').toLowerCase().includes(keyword))
    })
    .sort((a: any, b: any) => scoreSuggestion(b) - scoreSuggestion(a))
    .slice(0, 8)
    .map(normalizeSuggestion)

  return NextResponse.json({ suggestions })
}

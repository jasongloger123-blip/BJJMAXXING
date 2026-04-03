import { NextResponse } from 'next/server'

const ALLOWED_TYPES = new Set(['gym', 'health', 'establishment', 'school', 'university', 'point_of_interest'])

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get('place_id')?.trim()

  if (!placeId) {
    return NextResponse.json({ error: 'place_id fehlt.' }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY fehlt.' }, { status: 500 })
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('language', 'de')
  url.searchParams.set('fields', 'place_id,name,formatted_address,types')
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString(), { cache: 'no-store' })

  if (!response.ok) {
    return NextResponse.json({ error: 'Google Place Details konnten nicht geladen werden.' }, { status: 502 })
  }

  const payload = await response.json()
  const result = payload.result

  if (!result?.place_id || !result?.name || !result?.formatted_address) {
    return NextResponse.json({ error: 'Place Details sind unvollstaendig.' }, { status: 422 })
  }

  const types = Array.isArray(result.types) ? result.types.filter((type: string) => ALLOWED_TYPES.has(type)) : []

  return NextResponse.json({
    placeId: result.place_id,
    name: result.name,
    location: result.formatted_address,
    types,
  })
}

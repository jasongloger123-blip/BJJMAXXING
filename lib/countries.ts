export type CountryOption = {
  code: string
  label: string
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'DE', label: 'Deutschland' },
  { code: 'US', label: 'United States' },
  { code: 'BR', label: 'Brasilien' },
  { code: 'GB', label: 'Grossbritannien' },
  { code: 'FR', label: 'Frankreich' },
  { code: 'ES', label: 'Spanien' },
  { code: 'IT', label: 'Italien' },
  { code: 'PT', label: 'Portugal' },
  { code: 'NL', label: 'Niederlande' },
  { code: 'PL', label: 'Polen' },
  { code: 'AT', label: 'Oesterreich' },
  { code: 'CH', label: 'Schweiz' },
  { code: 'SE', label: 'Schweden' },
  { code: 'NO', label: 'Norwegen' },
  { code: 'DK', label: 'Daenemark' },
  { code: 'FI', label: 'Finnland' },
  { code: 'IE', label: 'Irland' },
  { code: 'MX', label: 'Mexiko' },
  { code: 'CA', label: 'Kanada' },
  { code: 'AU', label: 'Australien' },
  { code: 'NZ', label: 'Neuseeland' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'Suedkorea' },
  { code: 'CN', label: 'China' },
  { code: 'IN', label: 'Indien' },
  { code: 'AE', label: 'Vereinigte Arabische Emirate' },
  { code: 'TR', label: 'Tuerkei' },
  { code: 'ZA', label: 'Suedafrika' },
  { code: 'AR', label: 'Argentinien' },
]

export function getFlagEmoji(countryCode?: string | null) {
  if (!countryCode || countryCode.length !== 2) return ''

  return countryCode
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('')
}

export function getFlagSvgUrl(countryCode?: string | null) {
  if (!countryCode || countryCode.length !== 2) return null

  return `https://flagcdn.com/${countryCode.toLowerCase()}.svg`
}

export function getCountryLabel(countryCode?: string | null) {
  return COUNTRY_OPTIONS.find((entry) => entry.code === countryCode)?.label ?? null
}

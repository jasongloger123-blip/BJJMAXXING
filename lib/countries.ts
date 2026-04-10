export type CountryOption = {
  code: string
  label: string
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'AR', label: 'Argentinien' },
  { code: 'AU', label: 'Australien' },
  { code: 'AT', label: 'Oesterreich' },
  { code: 'BR', label: 'Brasilien' },
  { code: 'CA', label: 'Kanada' },
  { code: 'CN', label: 'China' },
  { code: 'DK', label: 'Daenemark' },
  { code: 'DE', label: 'Deutschland' },
  { code: 'FI', label: 'Finnland' },
  { code: 'FR', label: 'Frankreich' },
  { code: 'GB', label: 'Grossbritannien' },
  { code: 'IN', label: 'Indien' },
  { code: 'IE', label: 'Irland' },
  { code: 'IT', label: 'Italien' },
  { code: 'JP', label: 'Japan' },
  { code: 'MX', label: 'Mexiko' },
  { code: 'NL', label: 'Niederlande' },
  { code: 'NZ', label: 'Neuseeland' },
  { code: 'NO', label: 'Norwegen' },
  { code: 'PL', label: 'Polen' },
  { code: 'PT', label: 'Portugal' },
  { code: 'SE', label: 'Schweden' },
  { code: 'CH', label: 'Schweiz' },
  { code: 'ES', label: 'Spanien' },
  { code: 'ZA', label: 'Suedafrika' },
  { code: 'KR', label: 'Suedkorea' },
  { code: 'TR', label: 'Tuerkei' },
  { code: 'AE', label: 'Vereinigte Arabische Emirate' },
  { code: 'US', label: 'United States' },
  { code: 'TO', label: 'Tonga' },
]

export function getFlagSvgUrl(countryCode?: string | null) {
  if (!countryCode || countryCode.length !== 2) return null

  return `https://flagcdn.com/${countryCode.toLowerCase()}.svg`
}

export function getCountryLabel(countryCode?: string | null) {
  return COUNTRY_OPTIONS.find((entry) => entry.code === countryCode)?.label ?? null
}

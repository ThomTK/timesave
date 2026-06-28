import { sv, Translations } from './sv'
import { uk } from './uk'

const translations: Record<string, Translations> = { sv, uk }

export function t(lang: string, key: keyof Translations): string {
  return (translations[lang] ?? sv)[key] ?? (sv[key] as string)
}

export { sv, uk }
export type { Translations }

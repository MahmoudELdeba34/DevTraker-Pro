import { EN } from './en';
import { AR } from './ar';

export type AppLocale = 'en' | 'ar';
export type TranslationDict = Record<string, string>;

export const TRANSLATIONS: Record<AppLocale, TranslationDict> = {
  en: EN,
  ar: AR,
};

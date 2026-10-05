import type { Lang } from '../config/course';
import { kk } from './kk';
import { ru } from './ru';
import type { Content } from './types';

export const CONTENT: Record<Lang, Content> = { ru, kk };

export function content(lang: Lang): Content {
  return CONTENT[lang];
}

export function otherLang(lang: Lang): Lang {
  return lang === 'ru' ? 'kk' : 'ru';
}

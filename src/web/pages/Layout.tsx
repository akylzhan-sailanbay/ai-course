import type { Child, FC } from 'hono/jsx';
import { raw } from 'hono/html';
import type { Content } from '../../content/types';
import { LogoMark } from '../components/ui';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  alternates?: { ru: string; kk: string };
  ogImage?: string;
  noindex?: boolean;
}

/** JSON for a <script type="application/json">: `<` escaped so content can never close the tag. */
export function jsonScript(id: string, data: unknown) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return raw(`<script type="application/json" id="${id}">${json}</script>`);
}

export const Layout: FC<{
  c: Content;
  meta: PageMeta;
  assetV: string;
  brand: string;
  otherLangHref?: string;
  otherLangName?: string;
  navCta?: boolean;
  head?: Child;
  footer: Child;
  children: Child;
}> = ({ c, meta, assetV, brand, otherLangHref, otherLangName, navCta = true, head, footer, children }) => (
  <html lang={c.htmlLang}>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      {meta.noindex ? <meta name="robots" content="noindex" /> : null}
      <link rel="canonical" href={meta.canonical} />
      {meta.alternates ? (
        <>
          <link rel="alternate" hreflang="ru" href={meta.alternates.ru} />
          <link rel="alternate" hreflang="kk" href={meta.alternates.kk} />
          <link rel="alternate" hreflang="x-default" href={meta.alternates.ru} />
        </>
      ) : null}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={brand} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={meta.canonical} />
      <meta property="og:locale" content={c.lang === 'kk' ? 'kk_KZ' : 'ru_RU'} />
      {meta.ogImage ? (
        <>
          <meta property="og:image" content={meta.ogImage} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
        </>
      ) : null}
      <meta name="theme-color" content="#ffcf33" />
      <link rel="icon" href={`/assets/img/favicon.svg?v=${assetV}`} type="image/svg+xml" />
      <link rel="preload" href="/assets/fonts/geologica-cyrillic.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
      <link rel="stylesheet" href={`/assets/css/site.css?v=${assetV}`} />
      {head}
    </head>
    <body>
      <a class="skip" href="#main">
        {c.lang === 'kk' ? 'Мазмұнға өту' : 'К содержанию'}
      </a>
      <header class="site-header">
        <div class="wrap">
          <a class="logo" href={c.path} aria-label={brand}>
            <LogoMark />
            <span>{brand}</span>
          </a>
          {navCta ? (
            <nav class="nav" aria-label={c.lang === 'kk' ? 'Бөлімдер' : 'Разделы'}>
              <a href="#program" data-track="nav">{c.nav.program}</a>
              <a href="#format" data-track="nav">{c.nav.format}</a>
              <a href="#price" data-track="nav">{c.nav.price}</a>
              <a href="#faq" data-track="nav">{c.nav.faq}</a>
            </nav>
          ) : null}
          <div class="header-actions">
            {otherLangHref ? (
              <a class="lang-switch" href={otherLangHref} hreflang={c.lang === 'ru' ? 'kk' : 'ru'} data-track="lang">
                {otherLangName}
              </a>
            ) : null}
            {navCta ? (
              <a class="btn header-cta" href="#apply" data-cta="header">
                {c.nav.apply}
              </a>
            ) : null}
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      {footer}
    </body>
  </html>
);

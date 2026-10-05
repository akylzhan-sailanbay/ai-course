import type { FC } from 'hono/jsx';
import type { Course } from '../../config/course';
import type { Content } from '../../content/types';
import { LogoMark, T } from '../components/ui';

export interface Links {
  telegram: string | null;
  channel: string | null;
  whatsapp: string | null;
  instagram: string | null;
  phone: string | null;
  email: string | null;
}

export const Footer: FC<{ c: Content; brand: string; course: Course; links: Links }> = ({ c, brand, course, links }) => {
  const prefix = c.lang === 'kk' ? '/kz' : '';
  return (
    <footer class="site-footer">
      <div class="wrap">
        <div>
          <a class="logo" href={c.path}>
            <LogoMark />
            <span>{brand}</span>
          </a>
          <p style="margin-top:14px">
            <T>{course.legal.entity}</T>, <T>{course.legal.bin}</T>
          </p>
          <p>
            © {new Date().getFullYear()} {brand}. {c.footer.rights}.
          </p>
        </div>
        <ul>
          <li>
            <a href={`${prefix}/offer`}>{c.footer.offer}</a>
          </li>
          <li>
            <a href={`${prefix}/privacy`}>{c.footer.privacy}</a>
          </li>
        </ul>
        <ul aria-label={c.footer.contacts}>
          {links.telegram ? (
            <li>
              <a href={links.telegram} data-tg data-cta="footer_tg">
                Telegram
              </a>
            </li>
          ) : null}
          {links.channel ? (
            <li>
              <a href={links.channel} rel="noopener">
                {c.lang === 'kk' ? 'Telegram-арна' : 'Telegram-канал'}
              </a>
            </li>
          ) : null}
          {links.whatsapp ? (
            <li>
              <a href={links.whatsapp} data-cta="footer_wa" rel="noopener">
                WhatsApp
              </a>
            </li>
          ) : null}
          {links.instagram ? (
            <li>
              <a href={links.instagram} rel="noopener">
                Instagram
              </a>
            </li>
          ) : null}
          {links.phone ? <li>{links.phone}</li> : null}
          {links.email ? <li>{links.email}</li> : null}
        </ul>
      </div>
    </footer>
  );
};

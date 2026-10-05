import type { Child, FC } from 'hono/jsx';
import { splitPlaceholders } from '../../lib/placeholders';

/** Renders text, highlighting any [[TODO: …]] placeholders so missing facts are obvious. */
export const T: FC<{ children: string }> = ({ children }) => (
  <>
    {splitPlaceholders(children).map((p) => (p.todo ? <mark class="todo">{p.text}</mark> : p.text))}
  </>
);

type IconProps = { class?: string };
const svg = (path: Child, viewBox = '0 0 24 24', extra: Record<string, string> = {}) =>
  (({ class: cls }: IconProps) => (
    <svg class={cls} viewBox={viewBox} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...extra}>
      {path}
    </svg>
  )) as FC<IconProps>;

/** Logo mark: four blocks, the last one still sliding into place. */
export const LogoMark: FC = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="2" y="2" width="13" height="13" rx="3" fill="currentColor" />
    <rect x="17" y="2" width="13" height="13" rx="3" fill="currentColor" />
    <rect x="2" y="17" width="13" height="13" rx="3" fill="currentColor" />
    <rect x="19" y="19" width="11" height="11" rx="3" fill="#ffcf33" stroke="currentColor" stroke-width="2" transform="rotate(12 24.5 24.5)" />
  </svg>
);

export const Check = svg(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const Cross = svg(<path d="M7 7l10 10M17 7L7 17" />);
export const Chevron = svg(<path d="M6 9l6 6 6-6" />);
export const Plus = svg(<path d="M12 5v14M5 12h14" />);
export const Spark = svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />);
export const Key = svg(
  <>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
  </>,
);
export const Server = svg(
  <>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6" />
  </>,
);
export const Database = svg(
  <>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </>,
);
export const Globe = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </>,
);

export const TelegramIcon: FC<IconProps> = ({ class: cls }) => (
  <svg class={cls} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M21.9 4.3c.3-1.3-1-2.3-2.2-1.8L2.8 9.1c-1.3.5-1.2 2.3.1 2.7l4.3 1.3 1.6 5.2c.3 1 1.6 1.3 2.3.5l2.4-2.4 4.4 3.2c1 .7 2.3.2 2.6-1L21.9 4.3zM9.4 14.6l8.3-7.4-6.3 8.6-.4 3-1.6-4.2z" />
  </svg>
);

export const TelegramBubble: FC = () => (
  <svg viewBox="0 0 36 36" aria-hidden="true">
    <circle cx="18" cy="18" r="18" fill="#229ed9" />
    <path fill="#fff" d="M26.6 11.1c.2-.9-.7-1.6-1.5-1.3L8.6 16.2c-.9.3-.8 1.6.1 1.9l3.9 1.2 1.5 4.7c.2.7 1.1.9 1.6.4l2.2-2.1 3.9 2.9c.7.5 1.7.1 1.9-.7l2.9-13.4zm-11.4 9.7l7.3-6.6-5.6 7.6-.3 2.6-1.4-3.6z" />
  </svg>
);

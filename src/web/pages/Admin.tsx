import type { FC } from 'hono/jsx';
import type { Lead } from '../../db/leads';
import { pct, type Funnel, type SegmentRow, type SourceRow } from '../../db/stats';
import { formatPhone, whatsappLink } from '../../lib/phone';
import { stage, TIER_LABEL } from '../../services/stage';

export interface AdminData {
  brand: string;
  days: number;
  funnels: Array<{ label: string; f: Funnel }>;
  sources: SourceRow[];
  roles: SegmentRow[];
  leads: Lead[];
  readiness: { missing: string[]; placeholders: Array<{ path: string; text: string }>; integrations: Array<{ name: string; ok: boolean; hint: string }> };
  seats: { taken: number; capacity: number };
}

const money = (n: number) => `${new Intl.NumberFormat('ru-RU').format(Math.round(n))} ₸`;

const STEPS: Array<[keyof Funnel, string]> = [
  ['visitors', 'Посетители'],
  ['leads', 'Лиды (имя + телефон)'],
  ['applied', 'Анкеты'],
  ['qualified', 'Горячие (квалифицированы)'],
  ['tgLinked', 'В Telegram-боте'],
  ['paymentRequested', 'Запросили оплату'],
  ['paid', 'Оплатили'],
  ['joined', 'Вступили в чат'],
];

const css = `
body{font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#191c3a;margin:0;background:#f1f2f7}
header{background:#ffcf33;padding:14px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
header b{font-size:18px}main{padding:20px;max-width:1280px;margin:auto;display:grid;gap:20px}
section{background:#fff;border-radius:14px;padding:18px;overflow-x:auto}h2{margin:0 0 12px;font-size:17px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:7px 10px;border-bottom:1px solid #e3e5ee;text-align:left;white-space:nowrap}
th{font-weight:600;color:#565b7c;font-size:13px}td.n,th.n{text-align:right}.muted{color:#565b7c}
.ok{color:#17a34a}.bad{color:#c2272d}.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}
a{color:#2f5bea}ul{margin:6px 0 0;padding-left:18px}.pill{display:inline-block;padding:2px 8px;border-radius:99px;background:#f1f2f7;font-size:12px}
nav a{margin-right:10px}`;

export const Admin: FC<{ d: AdminData }> = ({ d }) => (
  <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>Панель — {d.brand}</title>
      <style>{css}</style>
    </head>
    <body>
      <header>
        <b>{d.brand}: панель</b>
        <span>
          Места: {d.seats.taken} / {d.seats.capacity}
        </span>
        <nav>
          {[7, 30, 90, 3650].map((n) => (
            <a href={`/admin?days=${n}`} style={n === d.days ? 'font-weight:700' : undefined}>
              {n === 3650 ? 'всё время' : `${n} дн.`}
            </a>
          ))}
          <a href="/admin/leads.csv">Экспорт CSV</a>
        </nav>
      </header>
      <main>
        <section>
          <h2>Готовность к запуску</h2>
          <div class="grid">
            <div>
              <b>Факты курса</b>
              {d.readiness.missing.length || d.readiness.placeholders.length ? (
                <ul>
                  {d.readiness.missing.map((m) => (
                    <li class="bad">{m}</li>
                  ))}
                  {d.readiness.placeholders.map((p) => (
                    <li class="bad">
                      {p.path}: <span class="muted">{p.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="ok">Всё заполнено</p>
              )}
            </div>
            <div>
              <b>Интеграции</b>
              <ul>
                {d.readiness.integrations.map((i) => (
                  <li class={i.ok ? 'ok' : 'bad'}>
                    {i.ok ? '✓' : '✗'} {i.name} {i.ok ? null : <span class="muted">— {i.hint}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2>Воронка</h2>
          <table>
            <thead>
              <tr>
                <th>Шаг</th>
                {d.funnels.map((x) => (
                  <>
                    <th class="n">{x.label}</th>
                    <th class="n">конв.</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {STEPS.map(([key, label], i) => (
                <tr>
                  <td>{label}</td>
                  {d.funnels.map((x) => (
                    <>
                      <td class="n">{x.f[key]}</td>
                      <td class="n muted">{i === 0 ? '' : pct(x.f[key], x.f[STEPS[i - 1]![0]])}</td>
                    </>
                  ))}
                </tr>
              ))}
              <tr>
                <td>Выручка</td>
                {d.funnels.map((x) => (
                  <>
                    <td class="n">{money(x.f.revenue)}</td>
                    <td class="n muted">{pct(x.f.paid, x.f.visitors)} визит→оплата</td>
                  </>
                ))}
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Каналы (первое касание), {d.days === 3650 ? 'всё время' : `${d.days} дн.`}</h2>
          <table>
            <thead>
              <tr>
                <th>Источник</th>
                <th class="n">Визиты</th>
                <th class="n">Лиды</th>
                <th class="n">Визит→лид</th>
                <th class="n">Горячие</th>
                <th class="n">Оплаты</th>
                <th class="n">Лид→оплата</th>
                <th class="n">Выручка</th>
                <th class="n">Расход</th>
                <th class="n">CAC</th>
                <th class="n">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {d.sources.map((s) => (
                <tr>
                  <td>{s.src}</td>
                  <td class="n">{s.visitors}</td>
                  <td class="n">{s.leads}</td>
                  <td class="n muted">{pct(s.leads, s.visitors)}</td>
                  <td class="n">{s.qualified}</td>
                  <td class="n">{s.paid}</td>
                  <td class="n muted">{pct(s.paid, s.leads)}</td>
                  <td class="n">{money(s.revenue)}</td>
                  <td class="n">{s.spend ? money(s.spend) : '—'}</td>
                  <td class="n">{s.spend && s.paid ? money(s.spend / s.paid) : '—'}</td>
                  <td class="n">{s.spend ? `${(s.revenue / s.spend).toFixed(1)}×` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="muted">Расход на рекламу добавляется командой боту: /spend instagram 50000</p>
        </section>

        <section>
          <h2>Сегменты</h2>
          <table>
            <thead>
              <tr>
                <th>Кто</th>
                <th class="n">Лиды</th>
                <th class="n">Горячие</th>
                <th class="n">Оплаты</th>
                <th class="n">Лид→оплата</th>
              </tr>
            </thead>
            <tbody>
              {d.roles.map((r) => (
                <tr>
                  <td>{r.role}</td>
                  <td class="n">{r.leads}</td>
                  <td class="n">{r.qualified}</td>
                  <td class="n">{r.paid}</td>
                  <td class="n muted">{pct(r.paid, r.leads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Последние лиды</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Создан</th>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Telegram</th>
                <th>Источник</th>
                <th>Кто / цель</th>
                <th>Оценка</th>
                <th>Этап</th>
              </tr>
            </thead>
            <tbody>
              {d.leads.map((l) => (
                <tr>
                  <td>{l.id}</td>
                  <td class="muted">{l.created_at.slice(0, 16).replace('T', ' ')}</td>
                  <td>{l.name ?? '—'}</td>
                  <td>
                    {l.phone ? (
                      <a href={whatsappLink(l.phone)} rel="noopener noreferrer" target="_blank">
                        {formatPhone(l.phone)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{l.tg_username ? `@${l.tg_username}` : l.tg_user_id ? 'да' : '—'}</td>
                  <td>
                    {l.src ?? '(direct)'}
                    {l.cmp ? <span class="muted"> / {l.cmp}</span> : null}
                  </td>
                  <td class="muted">{[l.role, l.goal].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{l.tier ? TIER_LABEL[l.tier] : '—'}</td>
                  <td>
                    <span class="pill">{stage(l)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </body>
  </html>
);

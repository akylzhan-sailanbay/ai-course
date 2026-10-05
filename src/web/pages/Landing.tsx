import type { FC } from 'hono/jsx';
import type { Course } from '../../config/course';
import type { Content, Facts } from '../../content/types';
import { QUIZ_FIELDS, QUIZ_OPTIONS } from '../../lib/scoring';
import { Check, Chevron, Cross, Database, Globe, Key, Plus, Server, Spark, T, TelegramBubble, TelegramIcon } from '../components/ui';
import { Footer, type Links } from './Footer';
import { jsonScript, Layout } from './Layout';

export interface LandingProps {
  c: Content;
  f: Facts;
  course: Course;
  links: Links;
  assetV: string;
  publicUrl: string;
  otherLang: { href: string; name: string };
  clientConfig: Record<string, unknown>;
  analytics: boolean;
}

export const Landing: FC<LandingProps> = (p) => {
  const { c, f, course, links, publicUrl } = p;
  const canonical = `${publicUrl}${c.path === '/' ? '/' : c.path}`;
  return (
    <Layout
      c={c}
      brand={f.brand}
      assetV={p.assetV}
      otherLangHref={p.otherLang.href}
      otherLangName={p.otherLang.name}
      meta={{
        title: c.meta.title(f),
        description: c.meta.description(f).replace(/\[\[TODO:[^\]]*\]\]/g, ''),
        canonical,
        alternates: { ru: `${publicUrl}/`, kk: `${publicUrl}/kz` },
        ogImage: `${publicUrl}/assets/img/og-${c.lang}.png`,
      }}
      head={
        <>
          {jsonScript('cfg', p.clientConfig)}
          <script src={`/assets/js/app.js?v=${p.assetV}`} defer></script>
          {p.analytics ? <script src={`/assets/js/analytics.js?v=${p.assetV}`} defer></script> : null}
        </>
      }
      footer={
        <>
          <Footer c={c} brand={f.brand} course={course} links={links} />
          <div class="sticky-cta" id="sticky-cta">
            <a class="btn" href="#apply" data-cta="sticky">
              {c.sticky.cta}
            </a>
            {links.telegram ? (
              <a class="btn btn--tg" href={links.telegram} data-tg data-cta="sticky_tg" aria-label="Telegram">
                <TelegramIcon />
              </a>
            ) : null}
          </div>
        </>
      }
    >
      <Hero {...p} />
      <Pains c={c} />
      <Projects c={c} />
      <FirstHour c={c} course={course} />
      <Program c={c} f={f} />
      <Compare c={c} f={f} />
      <Security c={c} />
      <Audience c={c} />
      <Format c={c} f={f} course={course} />
      <Teacher c={c} course={course} />
      <Guarantee c={c} f={f} />
      <Pricing c={c} f={f} />
      <Faq c={c} f={f} />
      <Apply c={c} f={f} links={links} />
    </Layout>
  );
};

const Hero: FC<LandingProps> = ({ c, f, links }) => {
  const d = c.hero.demo;
  return (
    <section class="hero" aria-labelledby="hero-title">
      <div class="wrap">
        <div>
          <p class="hero-eyebrow">{c.hero.eyebrow}</p>
          <h1 id="hero-title">
            <span>{c.hero.title[0]}</span> <span>{c.hero.title[1]}</span>
          </h1>
          <p class="hero-sub">{c.hero.subtitle}</p>
          <div class="hero-ctas">
            <a class="btn" href="#apply" data-cta="hero">
              {c.hero.ctaPrimary}
            </a>
            <a class="link" href="#program" data-cta="hero_program">
              {c.hero.ctaSecondary}
            </a>
          </div>
          {links.telegram ? (
            <p class="hero-ask">
              <a class="link" href={links.telegram} data-tg data-cta="hero_tg">
                {c.hero.askTelegram}
              </a>
            </p>
          ) : null}
          <dl class="facts">
            {c.hero.facts(f).map((x) => (
              <div>
                <dt>{x.label}</dt>
                <dd>
                  <T>{x.value}</T>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <figure class="bench" aria-label={`${d.prompt} — ${d.done}`}>
          <div class="prompt" data-step style="--d:150">
            <span class="who">{d.you}</span>
            {d.prompt}
          </div>
          <div class="ai-line" data-step style="--d:900">
            <Spark />
            <span>
              {d.ai}: {d.done}
            </span>
          </div>
          <div class="browser" data-step style="--d:1200" aria-hidden="true">
            <div class="browser-bar">
              <span class="dots">
                <i></i>
                <i></i>
                <i></i>
              </span>
              <span class="url">{d.url}</span>
              <span class="live" data-step style="--d:2400">
                <i></i>онлайн
              </span>
            </div>
            <div class="site">
              <div class="site-nav" data-step style="--d:1450">
                <b>{d.siteName}</b>
                <span>
                  <i></i>
                  <i></i>
                  <i></i>
                </span>
              </div>
              <div class="site-title" data-step style="--d:1600">
                {d.siteTitle}
              </div>
              <div class="site-text" data-step style="--d:1750">
                {d.siteText}
              </div>
              <div class="site-button" data-step style="--d:1900">
                {d.siteButton}
              </div>
              <div class="site-tiles" data-step style="--d:2050">
                <i></i>
                <i></i>
                <i></i>
              </div>
            </div>
          </div>
          <div class="toast" data-step style="--d:2900" aria-hidden="true">
            <TelegramBubble />
            <div>
              <b>{d.toast}</b>
              <span>{d.toastText}</span>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
};

const Pains: FC<{ c: Content }> = ({ c }) => (
  <section class="section" aria-labelledby="pains-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="pains-title">{c.pains.title}</h2>
      </div>
      <div class="pains">
        {c.pains.items.map((i) => (
          <div class="pain">
            <h3>{i.title}</h3>
            <p>{i.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Projects: FC<{ c: Content }> = ({ c }) => (
  <section class="section section--mist" id="projects" aria-labelledby="projects-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="projects-title">{c.projects.title}</h2>
        <p>{c.projects.subtitle}</p>
      </div>
      <ol class="weeks" role="list" style="list-style:none;padding:0;margin:0">
        {c.projects.items.map((it, i) => (
          <li class="week">
            <span class="week-n" aria-label={it.week}>
              {i + 1}
              <small aria-hidden="true">{c.projects.unit}</small>
            </span>
            <h3>{it.title}</h3>
            <p>{it.text}</p>
            <span class="example">{it.example}</span>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

const minutes = (time: string): [number, number] => {
  const m = /(\d+)\D+(\d+)/.exec(time);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
};

function embedUrl(url: string): { kind: 'iframe' | 'video'; src: string } {
  const yt = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (yt) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  return { kind: 'video', src: url };
}

const FirstHour: FC<{ c: Content; course: Course }> = ({ c, course }) => {
  const video = course.proofVideoUrl ? embedUrl(course.proofVideoUrl) : null;
  return (
    <section class="section" id="first-hour" aria-labelledby="hour-title">
      <div class="wrap">
        <div class="section-head">
          <h2 id="hour-title">{c.firstHour.title}</h2>
          <p>{c.firstHour.subtitle}</p>
        </div>
        <div class="hour">
          <div>
            <ol class="timeline">
              {c.firstHour.steps.map((s) => {
                const [from, to] = minutes(s.time);
                return (
                  <li>
                    <span class="t">{s.time}</span>
                    <span>{s.text}</span>
                    <span class="bar" aria-hidden="true">
                      <i style={`--from:${(from / 60) * 100}%;--len:${((to - from) / 60) * 100}%`}></i>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p class="hour-goal">{c.firstHour.goal}</p>
          </div>
          <div>
            <div class="video">
              {video?.kind === 'iframe' ? (
                <iframe src={video.src} title={c.firstHour.videoCaption} loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>
              ) : video ? (
                <video src={video.src} controls preload="none" playsinline></video>
              ) : (
                <div class="video-missing">
                  <p>
                    <mark class="todo">{c.firstHour.videoMissing}</mark>
                  </p>
                </div>
              )}
            </div>
            <p class="video-caption">{c.firstHour.videoCaption}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

const Program: FC<{ c: Content; f: Facts }> = ({ c, f }) => (
  <section class="section section--mist" id="program" aria-labelledby="program-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="program-title">{c.curriculum.title(f)}</h2>
        <p>{c.curriculum.subtitle}</p>
      </div>
      <div class="program">
        {c.curriculum.weeks.map((w, wi) => (
          <details open={wi === 0} data-track="program" data-week={String(wi + 1)}>
            <summary>
              <span class="wk">{c.curriculum.week(wi + 1)}</span>
              <h3>{w.title}</h3>
              <Chevron class="chev" />
            </summary>
            <div class="body">
              <ol class="sessions">
                {w.sessions.map((s, si) => {
                  const n = wi * w.sessions.length + si + 1;
                  const last = wi === c.curriculum.weeks.length - 1 && si === w.sessions.length - 1;
                  return (
                    <li class={last ? 'demo' : undefined}>
                      <span class="num">{n}</span>
                      <b>{s.title}</b>
                      <span>{s.text}</span>
                    </li>
                  );
                })}
              </ol>
              <p class="result">
                <b>{c.curriculum.result}</b>
                {w.result}
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  </section>
);

const Compare: FC<{ c: Content; f: Facts }> = ({ c, f }) => (
  <section class="section" aria-labelledby="compare-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="compare-title">{c.compare.title}</h2>
      </div>
      <table class="compare">
        <thead>
          <tr>
            <th scope="col">
              <span class="skip">—</span>
            </th>
            <th scope="col">{c.compare.alone}</th>
            <th scope="col" class="us">
              {f.brand}
            </th>
          </tr>
        </thead>
        <tbody>
          {c.compare.rows.map((r) => (
            <tr>
              <th scope="row">{r.label}</th>
              <td data-label={c.compare.alone}>{r.alone}</td>
              <td class="us" data-label={f.brand}>
                {r.course}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="footnote">{c.compare.footnote}</p>
    </div>
  </section>
);

const Security: FC<{ c: Content }> = ({ c }) => {
  const icons = [Key, Server, Database, Globe];
  return (
    <section class="section section--ink" id="security" aria-labelledby="security-title">
      <div class="wrap">
        <div class="section-head">
          <p class="lead-in">{c.security.eyebrow}</p>
          <h2 id="security-title">{c.security.title}</h2>
          <p>{c.security.subtitle}</p>
        </div>
        <div class="guards">
          {c.security.items.map((it, i) => {
            const Icon = icons[i % icons.length]!;
            return (
              <div class="guard">
                <Icon />
                <h3>{it.title}</h3>
                <p>{it.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const Audience: FC<{ c: Content }> = ({ c }) => (
  <section class="section" aria-labelledby="fit-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="fit-title">{c.audience.title}</h2>
      </div>
      <div class="fit">
        <div>
          <h3>{c.audience.forTitle}</h3>
          <ul class="marks">
            {c.audience.forItems.map((t) => (
              <li>
                <Check />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{c.audience.notTitle}</h3>
          <ul class="marks marks--no">
            {c.audience.notItems.map((t) => (
              <li>
                <Cross />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

const Format: FC<{ c: Content; f: Facts; course: Course }> = ({ c, f, course }) => (
  <section class="section section--mist" id="format" aria-labelledby="format-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="format-title">{c.format.title}</h2>
      </div>
      <dl class="spec">
        {c.format.items(f).map((x) => (
          <div>
            <dt>{x.label}</dt>
            <dd>
              <T>{x.value}</T>
            </dd>
          </div>
        ))}
      </dl>
      {course.tools.length ? (
        <div class="tools">
          <h3>{c.tools.title}</h3>
          <ul>
            {course.tools.map((t) => (
              <li>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  </section>
);

const Teacher: FC<{ c: Content; course: Course }> = ({ c, course }) => {
  const t = course.instructor;
  const lang = c.lang;
  return (
    <section class="section" id="teacher" aria-labelledby="teacher-title">
      <div class="wrap">
        <div class="section-head">
          <h2 id="teacher-title">{c.instructor.title}</h2>
        </div>
        <div class="teacher">
          {t.photo ? (
            <img class="teacher-photo" src={t.photo} alt={t.name} width="260" height="260" loading="lazy" />
          ) : (
            <div class="teacher-photo teacher-photo--empty">
              <mark class="todo">{lang === 'kk' ? 'фото' : 'фото преподавателя'}</mark>
            </div>
          )}
          <div>
            <h3>
              <T>{t.name}</T>
            </h3>
            <p class="role">
              <T>{t.role[lang]}</T>
            </p>
            <ul>
              {t.credentials[lang].map((x) => (
                <li>
                  <T>{x}</T>
                </li>
              ))}
            </ul>
            {t.links.length ? (
              <p class="teacher-links">
                {t.links.map((l) => (
                  <a class="link" href={l.url} rel="noopener" target="_blank">
                    {l.label}
                  </a>
                ))}
              </p>
            ) : null}
          </div>
        </div>

        <div style="margin-top:clamp(48px,7vw,88px)">
          <div class="section-head">
            <h2>{c.proof.title}</h2>
          </div>
          {course.testimonials.length ? (
            <div class="quotes">
              {course.testimonials.map((q) => (
                <figure class="quote">
                  <blockquote>{q.quote[lang]}</blockquote>
                  <figcaption>
                    <b>{q.name}</b>
                    <span>{q.role[lang]}</span>
                    {q.projectUrl ? (
                      <a class="link" href={q.projectUrl} rel="noopener" target="_blank">
                        {c.proof.viewProject}
                      </a>
                    ) : null}
                    <a class="link" href={q.sourceUrl} rel="noopener" target="_blank">
                      {c.proof.viewSource}
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div class="proof-empty">
              <h3>{c.proof.emptyTitle}</h3>
              <p>{c.proof.emptyText}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const Guarantee: FC<{ c: Content; f: Facts }> = ({ c, f }) => (
  <section class="section section--mist" id="guarantee" aria-labelledby="guarantee-title">
    <div class="wrap promise">
      <div>
        <h2 id="guarantee-title">{c.guarantee.title}</h2>
        <p class="promise-text">{c.guarantee.text}</p>
      </div>
      <div>
        <h3>{c.guarantee.termsTitle}</h3>
        <ul class="terms">
          {c.guarantee.terms(f).map((t) => (
            <li>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

const Pricing: FC<{ c: Content; f: Facts }> = ({ c, f }) => {
  const soldOut = f.seatsLeft <= 0;
  const early = c.pricing.earlyBird(f);
  return (
    <section class="section" id="price" aria-labelledby="price-title">
      <div class="wrap">
        <div class="section-head" style="margin-inline:auto;text-align:center">
          <h2 id="price-title">{c.pricing.title}</h2>
        </div>
        <div class="offer" data-view="pricing">
          <p class="offer-cohort">
            <T>{c.pricing.cohort(f)}</T>
          </p>
          <p class="price">
            <T>{f.price}</T>
          </p>
          {early ? <p class="early">{early}</p> : null}
          {soldOut ? (
            <p class="seats">{c.pricing.soldOut}</p>
          ) : f.showSeats ? (
            <p class="seats">{c.pricing.seatsLeft(f)}</p>
          ) : null}
          <ul class="includes">
            {c.pricing.includes(f).map((x) => (
              <li>
                <Check />
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <a class="btn btn--block" href="#apply" data-cta="pricing">
            {c.pricing.cta}
          </a>
          <p class="pay-methods">{c.pricing.payMethods(f)}</p>
          <p class="offer-note">{c.pricing.note}</p>
        </div>
      </div>
    </section>
  );
};

const Faq: FC<{ c: Content; f: Facts }> = ({ c, f }) => (
  <section class="section section--mist" id="faq" aria-labelledby="faq-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="faq-title">{c.faq.title}</h2>
      </div>
      <div class="faq">
        {c.faq.items(f).map((it, i) => (
          <details data-track="faq" data-q={String(i + 1)}>
            <summary>
              <span>{it.q}</span>
              <Plus />
            </summary>
            <p>
              <T>{it.a}</T>
            </p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

const Apply: FC<{ c: Content; f: Facts; links: Links }> = ({ c, f, links }) => {
  const a = c.apply;
  return (
    <section class="section section--sun" id="apply" aria-labelledby="apply-title">
      <div class="wrap apply">
        <div>
          <h2 id="apply-title">{a.title}</h2>
          <p class="apply-sub">{a.subtitle}</p>
          <ol class="next-steps">
            {a.steps.map((s) => (
              <li>{s}</li>
            ))}
          </ol>
        </div>
        <div class="panel" id="apply-panel">
          <form id="lead-form" novalidate>
            <p class="step-label">{a.step(1)}</p>
            <div class="field">
              <label for="f-name">{a.name}</label>
              <input id="f-name" name="name" autocomplete="given-name" required maxlength={80} aria-describedby="e-name" />
              <p class="error" id="e-name"></p>
            </div>
            <div class="field">
              <label for="f-phone">{a.phone}</label>
              <input
                id="f-phone"
                name="phone"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="+7 7__ ___ __ __"
                required
                maxlength={24}
                aria-describedby="h-phone e-phone"
              />
              <p class="hint" id="h-phone">
                {a.phoneHint}
              </p>
              <p class="error" id="e-phone"></p>
            </div>
            <div class="hp" aria-hidden="true">
              <label>
                Website
                <input name="website" tabindex={-1} autocomplete="off" />
              </label>
            </div>
            <div class="form-actions">
              <button class="btn btn--block" type="submit" data-label={a.next}>
                {a.next}
              </button>
            </div>
            <p class="consent">
              {a.consent[0]}
              <a href={c.lang === 'kk' ? '/kz/privacy' : '/privacy'}>{a.consent[1]}</a>
            </p>
            <p class="error form-error" role="alert"></p>
          </form>

          <div id="quiz" hidden>
            <p class="step-label">{a.step(2)}</p>
            <p>{a.quizTitle}</p>
            <div class="quiz-progress" aria-hidden="true">
              {QUIZ_FIELDS.map(() => (
                <i></i>
              ))}
            </div>
            {QUIZ_FIELDS.map((field) => {
              const q = a.quiz[field];
              const label = typeof q.label === 'function' ? q.label(f) : q.label;
              const options = q.options as Record<string, string>;
              return (
                <fieldset class="quiz-q" data-q={field} hidden style="border:0;padding:0;margin-inline:0">
                  <legend>
                    <h3>
                      <T>{label}</T>
                    </h3>
                  </legend>
                  <div class="options">
                    {QUIZ_OPTIONS[field].map((v) => (
                      <button type="button" class="option" data-v={v} aria-pressed="false">
                        {options[v]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <button type="button" class="quiz-back" hidden>
              {a.back}
            </button>
            <p class="error form-error" role="alert"></p>
          </div>

          <div id="success" class="success" hidden tabindex={-1}>
            {(['hot', 'warm', 'cold'] as const).map((tier) => (
              <div data-tier={tier} hidden>
                <h3>{a.success[tier].title}</h3>
                <p>{links.telegram ? a.success[tier].text : a.noBot}</p>
              </div>
            ))}
            {links.telegram ? (
              <a class="btn btn--tg btn--block" id="tg-go" href={links.telegram} data-cta="success_tg">
                <TelegramIcon />
                {a.success.hot.cta}
              </a>
            ) : null}
            {links.telegram ? <p class="alt">{a.noTelegram}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
};

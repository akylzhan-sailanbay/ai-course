import type { FC } from 'hono/jsx';
import type { Course } from '../../config/course';
import type { LegalDoc } from '../../content/legal';
import type { Content } from '../../content/types';
import { T } from '../components/ui';
import { Footer, type Links } from './Footer';
import { Layout } from './Layout';

export const Legal: FC<{ c: Content; doc: LegalDoc; brand: string; course: Course; links: Links; assetV: string; canonical: string }> = ({
  c,
  doc,
  brand,
  course,
  links,
  assetV,
  canonical,
}) => (
  <Layout
    c={c}
    brand={brand}
    assetV={assetV}
    navCta={false}
    meta={{ title: `${doc.title} — ${brand}`, description: doc.title, canonical }}
    footer={<Footer c={c} brand={brand} course={course} links={links} />}
  >
    <section class="section">
      <div class="wrap legal">
        <h1>{doc.title}</h1>
        <p class="note">
          <T>{doc.note}</T>
        </p>
        {doc.sections.map((s) => (
          <>
            <h2>{s.h}</h2>
            {s.p.map((p) => (
              <p>
                <T>{p}</T>
              </p>
            ))}
          </>
        ))}
        <p style="margin-top:40px">
          <a class="link" href={c.path}>
            {brand}
          </a>
        </p>
      </div>
    </section>
  </Layout>
);

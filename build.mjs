import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'src');
const out = path.join(root, 'public');
const read = (file) => readFile(file, 'utf8');
const replace = (template, key, value) => template.replaceAll(`{{${key}}}`, value);

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'assets'), { recursive: true });

const [layout, header, footer, auditForm, pagesJson, siteJson] = await Promise.all([
  read(path.join(src, 'layout.html')),
  read(path.join(src, 'partials', 'header.html')),
  read(path.join(src, 'partials', 'footer.html')),
  read(path.join(src, 'partials', 'audit-form.html')),
  read(path.join(src, 'pages.json')),
  read(path.join(src, 'site.json'))
]);

const pages = JSON.parse(pagesJson);
const site = JSON.parse(siteJson);
const siteUrl = site.url.replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);
const schema = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: site.name,
  url: siteUrl,
  email: site.email,
  description: site.description,
  areaServed: ['United States', 'United Kingdom', 'Europe'],
  serviceType: ['Website design', 'Search engine optimisation', 'Google Ads management']
});

for (const page of pages) {
  const rawContent = await read(path.join(src, 'pages', page.source));
  const content = replace(rawContent, 'AUDIT_FORM', auditForm);
  const pageUrl = page.output === 'index.html' ? `${siteUrl}/` : `${siteUrl}/${page.output}`;
  let html = layout;
  html = replace(html, 'TITLE', page.title);
  html = replace(html, 'DESCRIPTION', page.description);
  html = replace(html, 'CANONICAL', pageUrl);
  html = replace(html, 'OG_IMAGE', `${siteUrl}/assets/hero-orbit.png`);
  html = replace(html, 'SCHEMA', schema);
  html = replace(html, 'HEADER', header);
  html = replace(html, 'CONTENT', content);
  html = replace(html, 'FOOTER', footer);
  await writeFile(path.join(out, page.output), html);
}

await cp(path.join(src, 'styles.css'), path.join(out, 'assets', 'styles.css'));
await cp(path.join(src, 'app.js'), path.join(out, 'assets', 'app.js'));
await cp(path.join(src, 'admin.html'), path.join(out, 'admin.html'));
await cp(path.join(src, 'admin.css'), path.join(out, 'assets', 'admin.css'));
await cp(path.join(src, 'admin.js'), path.join(out, 'assets', 'admin.js'));
await cp(path.join(src, '404.html'), path.join(out, '404.html'));
await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });

const sitemapUrls = pages.map((page) => {
  const url = page.output === 'index.html' ? `${siteUrl}/` : `${siteUrl}/${page.output}`;
  return `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`;
}).join('\n');
await writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>\n`);
await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin.html\nSitemap: ${siteUrl}/sitemap.xml\n`);
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ name: site.name, short_name: 'GDR', start_url: '/', display: 'standalone', background_color: '#07111f', theme_color: '#07111f', icons: [{ src: '/assets/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2));

const generated = (await readdir(out)).filter((name) => name.endsWith('.html'));
console.log(`Built ${generated.length} HTML pages plus CRM/admin assets into ${path.relative(root, out)}/`);
console.log(generated.map((name) => `  • ${name}`).join('\n'));

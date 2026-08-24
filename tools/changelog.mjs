#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   changelog.mjs — typeset the change record as a PDF.

   The record itself is markdown in docs/, one file per round of comment,
   written as the work is done. This turns those files into the one document
   that goes out with the deck: same cover, same footer and the same typography
   as reviewdoc.mjs, so the two read as a pair.

   The markdown subset is deliberate rather than lazy — headings, paragraphs,
   lists, tables, fenced code, blockquotes, links, bold, italic and inline code
   — because that is what the change record uses, and a full parser is a
   dependency this repo has no other reason to carry. Anything outside the
   subset prints as its own source, which is loud enough to notice.

   Run:  npm run changelog
         node tools/changelog.mjs --out /tmp/changes.pdf
   --------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const WORK = join(ROOT, '.changelog');
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : fallback;
};

const { MOCKUP_VERSION, SPEC_VERSION } = await import(pathToFileURL(join(ROOT, 'app', 'meta.js')));
const OUT = resolve(flag('--out', join(ROOT, 'docs', `Wafra_Mockup_Changes_v${MOCKUP_VERSION}.pdf`)));

/* The rounds, in the order they happened. A round that is not listed is not in
   the document — which is the point: this is the record of one version, not a
   listing of the directory. */
const ROUNDS = [
  { file: 'Mockup_Changes_v154.md', label: 'Round 1 — the recorded call' },
  { file: 'Mockup_Changes_v154_round2.md', label: 'Rounds 2 and 3 — the first comments on the deck' },
  { file: 'Mockup_Changes_v154_round4.md', label: 'Round 4 — flows, rectangles and the deck markers' },
  { file: 'Mockup_Changes_v154_round5.md', label: 'Round 5 — adding a farm, and the last of the deck' },
];

const esc = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* -- the markdown subset --------------------------------------------------
   Inline first, because every block that carries text runs its content through
   it. Code spans come out before anything else, so a backtick can hold markup
   that must not be interpreted, and go back in at the end. */
function inline(src) {
  const spans = [];
  // The placeholder is a character no change record contains and no later rule
  // matches — a bare index would have turned every "15" in the prose into code.
  let out = esc(src).replace(/`([^`]+)`/g, (_, c) => `⦙${spans.push(c) - 1}⦙`);
  out = out
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) =>
      (/^https?:/.test(href) ? `<a href="${href}">${text}</a>` : `<span class="ref">${text}</span>`))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>');
  return out.replace(/⦙(\d+)⦙/g, (_, i) => `<code>${spans[Number(i)]}</code>`);
}

const cells = (row) => row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

function blocks(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (line.startsWith('```')) {
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) { body.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<pre>${esc(body.join('\n'))}</pre>`);
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) { out.push('<hr>'); i += 1; continue; }

    const head = line.match(/^(#{1,4})\s+(.*)$/);
    if (head) {
      // The file's own H1 is the round title, printed by the wrapper below, so
      // it is not printed a second time here.
      const level = head[1].length;
      if (level > 1) out.push(`<h${level}>${inline(head[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (line.trim().startsWith('|') && (lines[i + 1] ?? '').includes('---')) {
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i += 1; }
      out.push(`<table><thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
        + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }

    if (line.trim().startsWith('>')) {
      const body = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { body.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      out.push(`<blockquote>${inline(body.join(' ').trim())}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
        if (/^\s*[-*]\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i += 1;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\s*[-*#>|]/.test(lines[i]) && !lines[i].startsWith('```')) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    else i += 1;
  }
  return out.join('\n');
}

/* -- the document ---------------------------------------------------------- */

const logoB64 = (await readFile(join(ROOT, 'app', 'imgs', 'logo.avif'))).toString('base64');
const LOGO_URI = `data:image/avif;base64,${logoB64}`;

const sections = [];
for (const round of ROUNDS) {
  const md = await readFile(join(ROOT, 'docs', round.file), 'utf8');
  const title = (md.match(/^#\s+(.*)$/m) ?? [, round.label])[1];
  sections.push(`<section class="round">
    <div class="roundhead"><span class="kicker">${esc(round.label)}</span><h1>${inline(title)}</h1></div>
    ${blocks(md)}
  </section>`);
}

const TITLE = `Wafra Farm App — mockup changes, v${MOCKUP_VERSION}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 9.6pt/1.55 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #10201a; }
  .cover { height: 247mm; display: flex; flex-direction: column; justify-content: flex-end;
    page-break-after: always; }
  .cover .logo { height: 15mm; width: auto; margin-bottom: auto; }
  .cover .rule { height: 1.2mm; width: 34mm; background: #145c40; margin-bottom: 6mm; }
  .cover h1 { font-size: 30pt; line-height: 1.12; margin: 0 0 5mm; letter-spacing: -.4pt; }
  .cover p { margin: 0 0 3mm; color: #4a5852; max-width: 132mm; }
  .cover .author { margin-top: 9mm; font-weight: 700; }
  .cover .meta { color: #93a19a; font-size: 8pt; margin-top: 1mm; }

  section.round { page-break-before: always; }
  .roundhead { border-bottom: .5mm solid #145c40; padding-bottom: 3mm; margin-bottom: 6mm; }
  .kicker { display: block; font-size: 7.6pt; font-weight: 700; letter-spacing: 1.4pt;
    text-transform: uppercase; color: #145c40; margin-bottom: 2mm; }
  .roundhead h1 { font-size: 19pt; margin: 0; letter-spacing: -.2pt; }

  h2 { font-size: 13pt; margin: 8mm 0 2.5mm; page-break-after: avoid; }
  h3 { font-size: 10.6pt; margin: 6mm 0 1.5mm; color: #145c40; page-break-after: avoid; }
  h4 { font-size: 9.6pt; margin: 5mm 0 1mm; page-break-after: avoid; }
  p { margin: 0 0 2.6mm; }
  ul { margin: 0 0 3mm; padding-left: 5mm; }
  li { margin-bottom: 1.4mm; }
  hr { border: 0; border-top: .3mm solid #dde4e1; margin: 6mm 0; }
  a { color: #145c40; text-decoration: none; }
  code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 8.4pt;
    background: #f1f5f3; padding: .3mm 1mm; border-radius: 1mm; }
  pre { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 7.6pt; line-height: 1.45;
    background: #f1f5f3; border-left: 1mm solid #a9c6b6; padding: 3mm 4mm; margin: 0 0 4mm;
    white-space: pre-wrap; page-break-inside: avoid; }
  blockquote { margin: 0 0 4mm; padding: 2.5mm 4mm; background: #f6f9f7;
    border-left: 1mm solid #145c40; color: #38473f; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 5mm; font-size: 8.6pt; }
  th { text-align: left; border-bottom: .5mm solid #145c40; padding: 1.6mm 2mm 1.6mm 0;
    font-size: 7.6pt; letter-spacing: .8pt; text-transform: uppercase; color: #145c40; }
  td { border-bottom: .2mm solid #e4eae7; padding: 2mm 2mm 2mm 0; vertical-align: top; }
  tr { page-break-inside: avoid; }
  td:first-child, th:first-child { width: 26mm; padding-right: 4mm; }
  .ref { color: #145c40; font-weight: 600; }
</style></head><body>
<div class="cover">
  <img class="logo" src="${LOGO_URI}" alt="Wafra">
  <div class="rule"></div>
  <h1>What changed in the mockup</h1>
  <p>Every change made to the Wafra Farm App UI mockup at version ${MOCKUP_VERSION}, round by round,
     in the order the comments arrived — the recorded call of 22 August and the four rounds of
     comment on the deck that followed it.</p>
  <p>The build number is held at ${MOCKUP_VERSION} on instruction: one deck, one number, while the
     review cycle is in flight. The requirement set underneath it is at ${SPEC_VERSION}.</p>
  <div class="author">Romain Bigare</div>
  <div class="meta">Wafra Farm App · UI mockup v${MOCKUP_VERSION} · Build Specification v${SPEC_VERSION}</div>
</div>
${sections.join('\n')}
</body></html>`;

await rm(WORK, { recursive: true, force: true });
await mkdir(WORK, { recursive: true });
const htmlPath = join(WORK, 'changes.html');
await writeFile(htmlPath, html);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
await mkdir(resolve(OUT, '..'), { recursive: true });
await page.pdf({
  path: OUT, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:7pt;color:#93a19a;padding:0 15mm;
    font-family:Helvetica,Arial,sans-serif;display:flex;justify-content:space-between;">
    <span>${esc(TITLE)}</span><span class="pageNumber"></span></div>`,
  margin: { top: '15mm', bottom: '16mm', left: '15mm', right: '15mm' },
});
await browser.close();
await rm(WORK, { recursive: true, force: true });
console.log(`${ROUNDS.length} rounds -> ${OUT}`);

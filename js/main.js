const STUDIO = 'https://hasnainstudiox.com';
const PICKS = ['spatiax-ultra', 'hsx-fototensor', 'pc-tunex', 'dreammint-ai', 'hsx-workx-suite', 'hsx-socialdeck-pro'];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style') n.style.cssText = v;
    else n.setAttribute(k, v);
  }
  if (text != null) n.textContent = text;
  return n;
}

$$('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });

const bar = $('.bar');
const onScroll = () => bar.classList.toggle('solid', window.scrollY > 24);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const menu = $('#menu');
const nav = $('#nav');
menu.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
nav.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
  }
});

$$('[data-copy]').forEach((b) => {
  b.addEventListener('click', async () => {
    const text = document.getElementById(b.dataset.copy)?.textContent.trim() ?? '';
    try {
      await navigator.clipboard.writeText(text);
      const was = b.textContent;
      b.textContent = 'Copied';
      setTimeout(() => { b.textContent = was; }, 1600);
    } catch { /* clipboard blocked; the text is still selectable */ }
  });
});

const revealer = 'IntersectionObserver' in window && !reduced
  ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); revealer.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px' })
  : null;
const reveal = (n) => (revealer ? revealer.observe(n) : n.classList.add('in'));
$$('.reveal').forEach(reveal);

const links = new Map($$('.nav a').map((a) => [a.getAttribute('href').slice(1), a]));
let scene = null;
const sections = $$('main section[data-shape]');
const ratios = new Map();
const watcher = new IntersectionObserver((entries) => {
  for (const e of entries) ratios.set(e.target, e.intersectionRatio);
  let best = null;
  let top = 0;
  for (const [s, r] of ratios) if (r > top) { top = r; best = s; }
  if (!best) return;
  scene?.setShape(best.dataset.shape);
  links.forEach((a) => a.classList.remove('on'));
  links.get(best.id)?.classList.add('on');
}, { threshold: [0, 0.15, 0.3, 0.5, 0.7, 0.9] });
sections.forEach((s) => watcher.observe(s));

function currentShape() {
  let best = sections[0];
  let top = -1;
  for (const [s, r] of ratios) if (r > top) { top = r; best = s; }
  return best.dataset.shape;
}

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

let catalogue = null;

async function startScene() {
  if (!webgl()) { document.documentElement.classList.add('no-webgl'); return; }
  try {
    const { createScene } = await import('./scene.js');
    scene = createScene($('#scene'), { reduced });
    scene.setShape(currentShape());
    if (catalogue) feedScene(catalogue);
    document.fonts?.ready.then(() => scene.refreshText());
  } catch {
    document.documentElement.classList.add('no-webgl');
  }
}

function feedScene(data) {
  if (!scene) return;
  const suites = (data.cs || []).map((s) => ({ k: s.k, a: s.a, c: s.c }));
  scene.setApps(data.ps.map((p) => ({ s: p.s, a: p.a })), suites);
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fill(data) {
  const apps = data.ps || [];
  if (!apps.length) return;
  $$('[data-count]').forEach((n) => { n.textContent = apps.length; });

  const suites = $('#suites');
  suites.replaceChildren(...(data.cs || []).map((s) => {
    const chip = el('span', { class: 'suite', style: `--c:${s.a}` });
    chip.append(el('i'), document.createTextNode(`${s.n}, ${s.c} apps`));
    return chip;
  }));

  const byId = new Map(apps.map((p) => [p.h, p]));
  const chosen = PICKS.map((h) => byId.get(h)).filter(Boolean);
  for (const p of apps) {
    if (chosen.length >= 6) break;
    if (p.f && !chosen.includes(p)) chosen.push(p);
  }
  const suiteName = new Map((data.cs || []).map((s) => [s.k, s.s]));
  $('#picks').replaceChildren(...chosen.map((p) => {
    const a = el('a', { class: 'pick', href: p.su || `${STUDIO}/`, style: `--c:${p.a}` });
    a.append(
      el('small', {}, `${suiteName.get(p.s) || p.s} · ${p.pf === 'and' ? 'Android' : 'Windows'}`),
      el('h3', {}, p.n),
      el('p', {}, p.t),
    );
    return a;
  }));

  const pageOf = new Map(apps.map((p) => [p.i, p]));
  const releases = (data.ns || []).filter((n) => n.k === 'release').slice(0, 4);
  const events = $('#events');
  const fixed = $$('.event', events);
  const items = releases.map((n) => {
    const p = pageOf.get(n.p);
    const li = el('li', { class: 'event reveal', style: p ? `--c:${p.a}` : '' });
    li.append(el('time', { datetime: n.d }, formatDate(n.d)));
    const h = el('h3');
    if (p?.su) h.append(el('a', { href: p.su }, n.t)); else h.textContent = n.t;
    li.append(h, el('p', {}, n.b));
    return li;
  });
  const dated = [...items, ...fixed.filter((f) => f.querySelector('time[datetime]'))]
    .sort((a, b) => b.querySelector('time').getAttribute('datetime').localeCompare(a.querySelector('time').getAttribute('datetime')));
  const undated = fixed.filter((f) => !f.querySelector('time[datetime]'));
  events.replaceChildren(...dated, ...undated);
  items.forEach(reveal);
}

fetch(`${STUDIO}/hub-catalog.json`, { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => {
    if (!data?.ps) return;
    catalogue = data;
    fill(data);
    feedScene(data);
  })
  .catch(() => {});

if ('requestIdleCallback' in window) requestIdleCallback(startScene, { timeout: 1200 });
else setTimeout(startScene, 200);

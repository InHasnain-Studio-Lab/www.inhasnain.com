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
    const { createScene } = await import('./scene.js?v=2');
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

  for (const s of data.cs || []) {
    const card = $(`.suite-banner[data-suite="${s.k}"]`);
    if (!card) continue;
    card.style.setProperty('--c', s.a);
    $('.n', card).textContent = s.c;
    $('h3', card).textContent = s.n;
    if (s.t) $('p', card).textContent = s.t;
  }

  /* newest releases lead the spotlight, then the studio's chosen few */
  const byId = new Map(apps.map((p) => [p.i, p]));
  const byHero = new Map(apps.map((p) => [p.h, p]));
  const live = (p) => p && p.st === 'live';
  const chosen = [];
  for (const n of data.ns || []) {
    const p = byId.get(n.p);
    if (n.k === 'release' && live(p) && !chosen.includes(p)) chosen.push(p);
    if (chosen.length >= 3) break;
  }
  for (const h of PICKS) {
    const p = byHero.get(h);
    if (live(p) && !chosen.includes(p)) chosen.push(p);
  }
  const suiteName = new Map((data.cs || []).map((s) => [s.k, s.s]));
  spotlight(chosen.slice(0, 8), suiteName);
  ribbon(data, byId);

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

/* Plays only while it can be seen: off screen, in a hidden tab, or for
   someone who prefers reduced motion, nothing advances. */
function autoplay(node, step, every) {
  let timer = 0, seen = false, held = false;
  const run = () => {
    clearInterval(timer);
    if (!reduced && seen && !held && !document.hidden) timer = setInterval(step, every);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { seen = e[0].isIntersecting; run(); }, { threshold: 0.25 }).observe(node);
  } else { seen = true; run(); }
  node.addEventListener('pointerenter', () => { held = true; run(); });
  node.addEventListener('pointerleave', () => { held = false; run(); });
  node.addEventListener('focusin', () => { held = true; run(); });
  node.addEventListener('focusout', () => { held = false; run(); });
  document.addEventListener('visibilitychange', run);
  return run;
}

function spotlight(list, suiteName) {
  if (!list.length) return;
  const stage = $('#spot-stage');
  const dots = $('#spot-dots');
  const slides = list.map((p, i) => {
    const win = p.pf !== 'and';
    const slide = el('div', { class: `spot${i ? '' : ' is-on'}`, style: `--c:${p.a}`, role: 'group',
      'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${list.length}: ${p.n}` });
    if (p.h) {
      const img = el('img', { class: 'spot-art', alt: '', width: '720', height: '405', decoding: 'async',
        src: `${STUDIO}/images/apps/${p.h}-hero.webp`,
        srcset: `${STUDIO}/images/apps/${p.h}-hero-sm.webp 400w, ${STUDIO}/images/apps/${p.h}-hero.webp 720w`,
        sizes: '(max-width: 820px) 100vw, 60vw' });
      if (i) img.loading = 'lazy';
      slide.append(img);
    }
    const copy = el('div', { class: 'spot-copy' });
    copy.append(
      el('small', {}, `${suiteName.get(p.s) || 'Studio'} · ${win ? 'Windows' : 'Android'}`),
      el('h3', {}, p.n),
      el('p', {}, p.t),
    );
    const actions = el('div', { class: 'spot-actions' });
    if (p.u) actions.append(el('a', { class: 'btn btn-small', href: p.u }, win ? 'Try free on Microsoft Store' : 'Get it on Google Play'));
    if (p.su) actions.append(el('a', { class: 'btn btn-small btn-ghost', href: p.su }, 'Details'));
    copy.append(actions);
    slide.append(copy);
    return slide;
  });
  stage.replaceChildren(...slides);

  let at = 0;
  const buttons = list.map((p, i) => {
    const b = el('button', { type: 'button', class: `spot-dot${i ? '' : ' is-on'}`, 'aria-label': `Show ${p.n}`, 'aria-pressed': String(!i) });
    b.addEventListener('click', () => { show(i); run(); });
    return b;
  });
  dots.replaceChildren(...buttons);
  function show(i) {
    slides[at].classList.remove('is-on');
    buttons[at].classList.remove('is-on');
    buttons[at].setAttribute('aria-pressed', 'false');
    at = (i + list.length) % list.length;
    slides[at].classList.add('is-on');
    buttons[at].classList.add('is-on');
    buttons[at].setAttribute('aria-pressed', 'true');
  }
  const run = autoplay($('#spotlight'), () => show(at + 1), 6500);
}

function ribbon(data, byId) {
  const news = (data.ns || []).filter((n) => n.k === 'release' || n.k === 'update').slice(0, 4);
  if (!news.length) return;
  const link = $('#ribbon');
  const text = $('#ribbon-text');
  const tag = $('.ribbon-tag', link);
  let at = -1;
  const step = () => {
    at = (at + 1) % news.length;
    const n = news[at];
    const p = byId.get(n.p);
    link.classList.remove('turn');
    void link.offsetWidth;
    link.classList.add('turn');
    tag.textContent = n.k === 'release' ? 'New' : 'Update';
    text.textContent = n.t;
    link.href = p?.su || `${STUDIO}/`;
  };
  step();
  if (news.length > 1) autoplay(link, step, 4800);
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

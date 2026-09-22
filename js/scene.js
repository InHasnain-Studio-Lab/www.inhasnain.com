import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  Points, ShaderMaterial, AdditiveBlending, Color, Clock,
} from '../vendor/three.min.js';

const PALETTE = ['#f2dfb8', '#f3b3cf', '#c7a5f7', '#9fe8d6', '#bcd9f4'].map((c) => new Color(c));
const SUITE_DEFAULT = [
  { k: 'system', a: '#C7A5F7', c: 24 },
  { k: 'ai', a: '#F2DFB8', c: 15 },
  { k: 'creative', a: '#F3B3CF', c: 33 },
];

const vertex = `
  attribute vec3 color;
  attribute float size;
  uniform float uTime;
  uniform float uWave;
  uniform float uPixel;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec3 p = position;
    float w = sin(p.x * 0.55 + uTime * 0.7) * 0.45 + cos(p.z * 0.6 + uTime * 0.5) * 0.3;
    p.y += w * uWave;
    p += 0.035 * vec3(sin(uTime * 0.6 + p.y * 3.1), cos(uTime * 0.5 + p.x * 2.7), sin(uTime * 0.4 + p.z * 2.3));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uPixel * (12.0 / -mv.z);
    vColor = color;
    vFade = 1.0 - smoothstep(9.0, 24.0, -mv.z);
  }
`;

const fragment = `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = pow(a, 1.6);
    gl_FragColor = vec4(vColor * a * vFade, a * vFade);
  }
`;

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Samples the wordmark from a 2D canvas so the letters use the real display font. */
function sampleText(text, count, width) {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 420;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 330px Unbounded, system-ui, sans-serif';
  g.fillText(text, c.width / 2, c.height / 2);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const hits = [];
  for (let y = 0; y < c.height; y += 3) {
    for (let x = 0; x < c.width; x += 3) {
      if (data[(y * c.width + x) * 4 + 3] > 140) hits.push(x, y);
    }
  }
  const out = new Float32Array(count * 3);
  if (!hits.length) return out;
  const r = rand(7);
  const scale = width / c.width;
  for (let i = 0; i < count; i++) {
    const j = Math.floor(r() * (hits.length / 2)) * 2;
    out[i * 3] = (hits[j] - c.width / 2) * scale + (r() - 0.5) * 0.04;
    out[i * 3 + 1] = -(hits[j + 1] - c.height / 2) * scale + (r() - 0.5) * 0.04;
    out[i * 3 + 2] = (r() - 0.5) * 0.5;
  }
  return out;
}

export function createScene(canvas, { reduced = false } = {}) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const COUNT = small ? 4500 : 9000;

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.setClearColor(0x08070c, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const geo = new BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute('size', new BufferAttribute(size, 1));

  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uTime: { value: 0 }, uWave: { value: 0 }, uPixel: { value: renderer.getPixelRatio() } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);

  const speed = new Float32Array(COUNT);
  const r0 = rand(11);
  for (let i = 0; i < COUNT; i++) speed[i] = 0.6 + r0() * 0.8;

  let apps = null;
  let suites = SUITE_DEFAULT;
  let view = { w: 16, h: 9, wide: true };
  const shapes = {};
  let current = 'sphere';

  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const vh = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    view = { w: vh * camera.aspect, h: vh, wide: camera.aspect > 1.15 };
  }

  function place(arr, offsetX, scale) {
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = arr[i] * scale + offsetX;
      arr[i + 1] *= scale;
      arr[i + 2] *= scale;
    }
    return arr;
  }

  function sphere() {
    const p = new Float32Array(COUNT * 3);
    const c = new Float32Array(COUNT * 3);
    const s = new Float32Array(COUNT);
    const r = rand(3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const shell = Math.floor(COUNT * 0.62);
    for (let i = 0; i < COUNT; i++) {
      let x, y, z;
      if (i < shell) {
        const t = i / shell;
        const yy = 1 - 2 * t;
        const rad = Math.sqrt(1 - yy * yy);
        const th = golden * i;
        const R = 2.6 + (r() - 0.5) * 0.12;
        x = Math.cos(th) * rad * R;
        y = yy * R;
        z = Math.sin(th) * rad * R;
      } else {
        const a = r() * Math.PI * 2;
        const d = 3.4 + Math.pow(r(), 1.6) * 2.6;
        x = Math.cos(a) * d;
        y = (r() - 0.5) * 0.18;
        z = Math.sin(a) * d;
        const tilt = 0.42;
        const yt = y * Math.cos(tilt) - z * Math.sin(tilt);
        z = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = yt;
      }
      p.set([x, y, z], i * 3);
      const k = PALETTE[Math.floor(((y / 5.2) + 0.5) * PALETTE.length + r() * 1.2) % PALETTE.length];
      const b = 0.55 + r() * 0.45;
      c.set([k.r * b, k.g * b, k.b * b], i * 3);
      s[i] = 2.4 + r() * 2.6;
    }
    const scale = view.wide ? 1 : 0.78;
    return { p: place(p, view.wide ? view.w * 0.2 : 0, scale), c, s, spin: 0.08, wave: 0 };
  }

  function mark() {
    const width = Math.min(view.wide ? view.w * 0.42 : view.w * 0.86, 8.5);
    const p = sampleText('HSX', COUNT, width);
    const c = new Float32Array(COUNT * 3);
    const s = new Float32Array(COUNT);
    const r = rand(5);
    for (let i = 0; i < COUNT; i++) {
      const t = (p[i * 3] / width) + 0.5;
      const a = PALETTE[Math.min(3, Math.floor(t * 4))];
      const b = 0.6 + r() * 0.4;
      c.set([a.r * b, a.g * b, a.b * b], i * 3);
      s[i] = 2.0 + r() * 1.8;
    }
    const offsetX = view.wide ? view.w * 0.24 : 0;
    const offsetY = view.wide ? 0 : view.h * 0.22;
    for (let i = 0; i < COUNT; i++) { p[i * 3] += offsetX; p[i * 3 + 1] += offsetY; }
    return { p, c, s, spin: 0, wave: 0 };
  }

  /* One bright star per app, grouped by suite, with a dim cloud around each group. */
  function constellation() {
    const p = new Float32Array(COUNT * 3);
    const c = new Float32Array(COUNT * 3);
    const s = new Float32Array(COUNT);
    const r = rand(9);
    const list = apps && apps.length ? apps : suites.flatMap((g) => Array.from({ length: g.c }, () => ({ s: g.k, a: g.a })));
    const keys = suites.map((g) => g.k);
    const spread = view.wide ? Math.min(view.w * 0.16, 3.2) : Math.min(view.w * 0.3, 2.4);
    const centres = keys.map((_, i) => {
      const a = (i / keys.length) * Math.PI * 2 + Math.PI / 2;
      return [Math.cos(a) * spread, Math.sin(a) * spread * 0.8, (i - 1) * 0.6];
    });
    const seen = {};
    const stars = Math.min(list.length, COUNT);
    for (let i = 0; i < stars; i++) {
      const app = list[i];
      const g = Math.max(0, keys.indexOf(app.s));
      const n = (seen[g] = (seen[g] || 0) + 1);
      const ang = n * 2.399963;
      const rad = 0.28 * Math.sqrt(n);
      const [cx, cy, cz] = centres[g];
      p.set([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, cz + (r() - 0.5) * 0.6], i * 3);
      const k = new Color(app.a || suites[g].a);
      c.set([k.r * 1.4, k.g * 1.4, k.b * 1.4], i * 3);
      s[i] = 12 + r() * 4;
    }
    for (let i = stars; i < COUNT; i++) {
      const g = i % keys.length;
      const [cx, cy, cz] = centres[g];
      const a = r() * Math.PI * 2;
      const d = Math.pow(r(), 0.7) * 2.3;
      p.set([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, cz + (r() - 0.5) * 2.4], i * 3);
      const k = new Color(suites[g].a);
      const b = 0.18 + r() * 0.3;
      c.set([k.r * b, k.g * b, k.b * b], i * 3);
      s[i] = 1.6 + r() * 1.8;
    }
    return { p: place(p, view.wide ? view.w * 0.22 : 0, 1), c, s, spin: 0.03, wave: 0 };
  }

  function wave() {
    const p = new Float32Array(COUNT * 3);
    const c = new Float32Array(COUNT * 3);
    const s = new Float32Array(COUNT);
    const r = rand(13);
    const cols = Math.round(Math.sqrt(COUNT * 1.8));
    const rows = Math.ceil(COUNT / cols);
    const W = view.w * 1.3;
    const D = 12;
    for (let i = 0; i < COUNT; i++) {
      const gx = i % cols;
      const gz = Math.floor(i / cols);
      const x = (gx / (cols - 1) - 0.5) * W;
      const z = (gz / rows - 0.7) * D;
      p.set([x, -2.4 + (r() - 0.5) * 0.05, z], i * 3);
      const k = PALETTE[Math.floor((gx / cols) * 4) % 4];
      const b = 0.28 + r() * 0.3;
      c.set([k.r * b, k.g * b, k.b * b], i * 3);
      s[i] = 1.8 + r() * 1.4;
    }
    return { p, c, s, spin: 0, wave: 1 };
  }

  const builders = { sphere, mark, constellation, wave };

  function build() {
    layout();
    for (const k of Object.keys(builders)) shapes[k] = builders[k]();
  }

  build();
  const start = shapes[current];
  pos.set(start.p);
  col.set(start.c);
  size.set(start.s);

  const clock = new Clock();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let waveNow = 0;
  let spinNow = start.spin;
  let raf = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const target = shapes[current];
    let moving = false;

    const base = reduced ? 1 : 1 - Math.pow(1 - 0.045, dt * 60);
    for (let i = 0; i < COUNT; i++) {
      const k = Math.min(1, base * speed[i]);
      const j = i * 3;
      for (let a = 0; a < 3; a++) {
        const d = target.p[j + a] - pos[j + a];
        if (d > 0.001 || d < -0.001) moving = true;
        pos[j + a] += d * k;
        col[j + a] += (target.c[j + a] - col[j + a]) * k;
      }
      size[i] += (target.s[i] - size[i]) * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;

    waveNow += (target.wave - waveNow) * (reduced ? 1 : Math.min(1, dt * 1.5));
    spinNow += (target.spin - spinNow) * Math.min(1, dt * 2);
    material.uniforms.uWave.value = waveNow;
    material.uniforms.uTime.value = reduced ? 0 : t;

    if (!reduced) {
      if (target.spin === 0) {
        const full = Math.PI * 2;
        const goal = Math.round(points.rotation.y / full) * full;
        points.rotation.y += (goal - points.rotation.y) * Math.min(1, dt * 1.8);
      } else {
        points.rotation.y += spinNow * dt;
      }
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
      camera.position.x = pointer.x * 0.6;
      camera.position.y = pointer.y * 0.4;
      camera.lookAt(0, 0, 0);
    }

    renderer.render(scene, camera);

    if (!reduced || moving) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); kick(); }, 150);
  });
  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else { clock.getDelta(); kick(); }
  });

  kick();

  return {
    setShape(name) {
      if (!builders[name] || name === current) return;
      current = name;
      kick();
    },
    setApps(list, suiteList) {
      apps = list;
      if (suiteList && suiteList.length) suites = suiteList;
      shapes.constellation = constellation();
      kick();
    },
    refreshText() {
      shapes.mark = mark();
      kick();
    },
  };
}

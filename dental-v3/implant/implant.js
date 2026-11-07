/* "a new tooth, part by part": the implant take-apart for Canal Street Family Dental.
   Ported from the dental/a.html chairside model (three.js, all geometry built in code, nothing downloaded except three + gsap), restyled to the v3 plum world.
   One master GSAP timeline = window.CALT: 0 = assembled, 4.5 s = taken apart (rest point, labels on), 10.6 s = back together.
   Performance rules: render on demand (a frame is drawn only while the timeline moves, the section is on screen and the tab is visible),
   built late and in slices (implant-loader.js starts it ~1 screen before it is needed), shaders compiled + two frames drawn off-screen first,
   adaptive quality (phone: DPR 1.5, shadow map 1024, fewer segments; if the first ~30 played frames are slow it steps down once, then twice, then
   hands over to pre-rendered stills: implant-stills.js, also used when WebGL is missing or the device is very weak). */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const root = document.querySelector('[data-imp]');
const canvas = root.querySelector('[data-imp-gl]'), stageEl = root.querySelector('[data-imp-stage]');
const btn = root.querySelector('[data-imp-btn]'), lblEl = root.querySelector('[data-imp-lbl]'), statusEl = root.querySelector('[data-imp-status]');
const TXT = JSON.parse(root.dataset.txt);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phoneMQ = matchMedia('(max-width:899px)'), isPhone = () => phoneMQ.matches;
const q = new URLSearchParams(location.search);
const HQ = q.get('hq') === '1';                         // tooling only (qa/make-stills.cjs): full quality at any size
const PH = isPhone() && !HQ;                            // decided once, when the scene is built (segment counts, shadow map size)
let dprCap = HQ ? 3 : PH ? 1.5 : 2;                     // adaptive: may step down to 1.25 and 1
const PR = () => Math.min(devicePixelRatio || 1, dprCap);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (a, b, t) => a + (b - a) * t;
performance.mark('imp:eval');                           // three + addons evaluated
let nMark = 0;
const yieldMain = () => { performance.mark('imp:slice' + (++nMark)); return new Promise((ok) => setTimeout(ok, 0)); };
let torn = false, teardown = () => {};
// hand over to the pre-rendered stills (no WebGL, too slow, or a very weak device)
async function toStills() {
  if (torn) return; torn = true;
  try { teardown(); } catch (e) { /* ignore */ }
  root.classList.remove('gl-on'); root.classList.add('stills');
  await import(/* @vite-ignore */ root.dataset.fallback);
}

function mkRenderer(cv) {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
  if (!r.getContext()) throw new Error('no gl');
  r.setPixelRatio(PR()); r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.04; r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

/* ---------- geometry helpers + shared materials (from a.html) ---------- */
function superE(th, n) { const c = Math.cos(th), s = Math.sin(th); return [Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]; }
// grid surface: f(u,v) -> [x,y,z,h]; u wraps around, v goes up. Seams/poles are merged so normals are smooth.
function gridGeo(US, VS, f) {
  const pos = new Float32Array((US + 1) * (VS + 1) * 3), hh = new Float32Array((US + 1) * (VS + 1)), idx = [];
  for (let i = 0; i <= VS; i++) for (let j = 0; j <= US; j++) { const k = i * (US + 1) + j, p = f(j / US, i / VS); pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2]; hh[k] = p[3] || 0; }
  for (let i = 0; i < VS; i++) for (let j = 0; j < US; j++) { const a = i * (US + 1) + j, b = a + 1, c = a + US + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aH', new THREE.BufferAttribute(hh, 1)); g.setIndex(idx);
  g = mergeVertices(g, 1e-5); g.computeVertexNormals(); return outward(g);
}
// make a closed surface face outward (flip winding if the normals point in)
function outward(g) {
  g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c);
  const p = g.attributes.position, n = g.attributes.normal; let s = 0;
  for (let i = 0; i < p.count; i += 7) s += (p.getX(i) - c.x) * n.getX(i) + (p.getY(i) - c.y) * n.getY(i) + (p.getZ(i) - c.z) * n.getZ(i);
  if (s < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// a tooth: kind inc | can | pre | mol. W = half width, Df/Db = labial/lingual half depth, H = crown height, R = root length (0 = crown only)
function toothGeo(sp, US = 64, VS = 70) {
  const n = sp.n || 2.7, R = sp.R || 0, vr = R ? .38 : .07;
  return gridGeo(US, VS, (u, v) => {
    const th = u * Math.PI * 2, [cx, cz] = superE(th, n), dep = cz > 0 ? sp.Df : sp.Db;
    if (v < vr) {
      const s = v / vr;
      if (!R) { const a = Math.sin(s * Math.PI / 2); return [cx * sp.W * .8 * a, 0, cz * dep * .86 * a, 0]; }
      const sh = Math.pow(Math.sin(s * Math.PI / 2), .55) * (.4 + .6 * s);
      return [cx * sp.W * .8 * sh * (sp.rootW || 1), -R * (1 - s), cz * dep * .86 * sh, -(1 - s)];
    }
    const t = (v - vr) / (1 - vr); let x, y, z;
    if (sp.kind === 'inc' || sp.kind === 'can') {
      const bl = sp.kind === 'inc';
      const wx = sp.W * (.8 + .2 * sstep(0, .55, t)) * (bl ? 1 : 1 - .18 * sstep(.6, 1, t));
      const wz = dep * (.86 + .14 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2)) * (1 - .78 * Math.pow(t, 1.5)) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 7)));
      const top = bl ? 1 - .08 * Math.pow(Math.abs(cx), 5) : 1 - .3 * Math.pow(Math.abs(cx), 1.25);
      x = cx * wx; z = cz * wz + (cz > 0 ? .055 * Math.sin(t * Math.PI) * sp.H * (1 - .5 * cx * cx) : 0); y = sp.H * t * top;
    } else if (sp.kind === 'pre') {
      const g = Math.max(0, (t - .72) / .28), rr = Math.pow(Math.cos(g * Math.PI / 2), .65);
      const wx = sp.W * (.82 + .18 * sstep(0, .5, t)) * rr, wz = dep * (.9 + .1 * Math.sin(Math.min(1, t * 1.8) * Math.PI / 2)) * rr;
      x = cx * wx; z = cz * wz; y = sp.H * (t < .72 ? t : .72 + .28 * Math.sin(g * Math.PI / 2)) * (1 - .2 * Math.pow(Math.abs(cx), 1.4) * sstep(.4, 1, t));
    } else { // molar crown: walls, then an occlusal table with four cusps and a central groove
      const cusp = .5 + .5 * Math.cos(4 * th + .5);
      if (t < .66) { const b = Math.sin(Math.min(1, t / .45) * Math.PI / 2); x = cx * sp.W * (.8 + .2 * b); z = cz * dep * (.82 + .18 * b); y = sp.H * t * .98; }
      else {
        const g = (t - .66) / .34, rim = g < .32 ? 1 - .2 * Math.pow(g / .32, 2) : .8 * (1 - (g - .32) / .68);
        x = cx * sp.W * rim; z = cz * dep * .97 * rim;
        y = sp.H * (.65 + (.3 + .07 * cusp) * Math.sin(Math.min(1, g / .32) * Math.PI / 2) - .13 * sstep(.32, 1, g));
      }
    }
    return [x, y, z, t];
  });
}
function rootGeo(len, w, d, tilt) {
  const g = gridGeo(28, 30, (u, v) => {
    const th = u * Math.PI * 2, [cx, cz] = superE(th, 2.2), sh = Math.pow(Math.sin(v * Math.PI / 2), .35) * (.55 + .45 * v);
    return [cx * w * sh + tilt * (1 - v), -len * (1 - v) + .12 * v, cz * d * sh, -(1 - v) * .9 - .05];
  });
  return g;
}

/* ---------- shared materials ---------- */
const GL_NOISE = `
float hsh(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec2 h22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
vec2 wor(vec2 p){ vec2 i = floor(p), f = fract(p); float d = 8.0, s = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), o = h22(i + g), r = g + o - f; float dd = dot(r, r); if (dd < d) { d = dd; s = o.x; } }
  return vec2(sqrt(d), s); }`;
function patch(m, vars, frag, after = '#include <color_fragment>', extra = '') {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u || {});
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aH;\nvarying float vH;\nvarying vec3 vOP;\nvarying vec3 vON;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH; vOP = transformed; vON = objectNormal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;\nvarying vec3 vOP;\nvarying vec3 vON;\n' + vars + GL_NOISE)
      .replace(after, after + '\n' + frag) + '';
    if (extra) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + extra);
  };
  m.customProgramCacheKey = () => m.name; return m;
}
// enamel: shade from the uniform, warmer at the neck, translucent grey-blue at the biting edge, optional stain; root = matte dentin
function enamelMat(name, u) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .17, metalness: 0, clearcoat: .8, clearcoatRoughness: .1, sheen: PH ? 0 : .35, sheenColor: 0xffffff, sheenRoughness: .45, specularIntensity: .75, ior: 1.62 });
  m.name = name; m.userData.u = u;
  return patch(m, 'uniform vec3 uEn; uniform float uStain; uniform float uTr;\n', `
    float crown = smoothstep(-0.03, 0.05, vH), cerv = 1.0 - smoothstep(0.0, 0.5, vH);
    vec3 en = uEn;
    en = mix(en, en * vec3(0.95, 0.88, 0.74), cerv * 0.55);
    float edge = smoothstep(0.72, 1.0, vH) * uTr;
    en = mix(en, vec3(0.66, 0.72, 0.79) * (0.3 + 0.7 * en.g), edge * 0.62);
    float n1 = vn(vOP * 7.0), n2 = vn(vOP * 21.0 + 3.1);
    float st = uStain * (0.55 * cerv + 0.45 * smoothstep(0.35, 0.8, n1 * 0.75 + n2 * 0.25) * (0.3 + 0.7 * cerv));
    en = mix(en, en * vec3(0.86, 0.76, 0.58), st * 0.6);
    en *= 0.985 + 0.03 * n2;
    en *= 0.99 + 0.012 * sin(vOP.y * 140.0 + n1 * 3.0) * smoothstep(0.2, 0.8, vH);
    diffuseColor.rgb = mix(vec3(0.88, 0.78, 0.60), en, crown);`, '#include <color_fragment>',
    'totalEmissiveRadiance += diffuseColor.rgb * 0.035 * smoothstep(-0.03, 0.05, vH);');
}
function gumMat(name, cutColor, base = '0.84, 0.43, 0.49') {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .36, clearcoat: .6, clearcoatRoughness: .22, sheen: PH ? 0 : .25, sheenColor: 0xffc9cf, sheenRoughness: .5 });
  m.name = name;
  return patch(m, '', `
    vec3 g = vec3(${base});
    float n = vn(vOP * 26.0), nb = vn(vOP * 6.0);
    g *= 0.94 + 0.08 * n + 0.04 * nb;
    float margin = 1.0 - smoothstep(0.0, 0.16, vH);
    g = mix(g, vec3(0.80, 0.42, 0.47), margin * 0.5);
    ${cutColor ? 'float cut = step(0.9, vON.z) * step(-0.01, vOP.z);\n vec3 cc = vec3(0.90, 0.56, 0.59) * (0.97 + 0.05 * n);\n float sock = cut * (1.0 - smoothstep(0.155, 0.17, abs(vOP.x)));\n cc *= 1.0 - 0.18 * sock * (1.0 - abs(vOP.x) / 0.17);\n g = mix(g, cc, cut);' : ''}
    diffuseColor.rgb = g;`);
}
const titanium = new THREE.MeshPhysicalMaterial({ color: 0xc3c8ce, metalness: 1, roughness: .2, clearcoat: PH ? 0 : .3, clearcoatRoughness: .2 });
const anodized = new THREE.MeshPhysicalMaterial({ color: 0xdcc493, metalness: 1, roughness: .24 });
const hexMat = new THREE.MeshStandardMaterial({ color: 0x3c4146, metalness: .8, roughness: .45 });

/* =====================================================================================
   the model: implant in a cut-away of gum + jawbone (x = along the jaw, y = up, z = toward you)
   ===================================================================================== */
performance.mark('imp:pre-renderer');
let R1 = null;
try { R1 = mkRenderer(canvas); } catch (e) { R1 = null; }
performance.mark('imp:renderer');
if (!R1) await toStills();
else {
  // ---- render-on-demand state (declared first: the timeline below calls invalidate) ----
  let visible = false, dirty = true, raf = 0, lastDraw = 0, deltas = [], level = 0, nDraw = 0;
  // while the timeline plays, gsap's own rAF tick calls onUpdate: draw right there (one render per tick; scheduling another rAF would halve the frame rate)
  const drawNow = () => { if (visible && !document.hidden && !torn) { dirty = false; drawFrame(); watch(performance.now()); } else dirty = true; };
  const invalidate = () => { dirty = true; if (!raf && visible && !document.hidden && !torn) raf = requestAnimationFrame(tick); };

  // ---- master timeline + label state (the 3D tweens are added below) ----
  const FX = window.FX = { l1: 0, l2: 0, l3: 0, l4: 0, heal: 1, click: 0 };
  const DUR = 10.6, REST = 4.5;
  const CALT = window.CALT = gsap.timeline({ paused: true, onUpdate: () => { sync(); drawNow(); } });
  // a seek from outside (CALT.time(x), tests) may be silent: make sure it is drawn, but never twice when onUpdate already drew it
  { const _time = CALT.time; CALT.time = function (v) { const n = nDraw, r = _time.apply(CALT, arguments); if (arguments.length) { sync(); if (n === nDraw) invalidate(); } return r; }; }
  CALT.to({}, { duration: DUR }, 0);
  const lab = (k, at, d = .45) => CALT.fromTo(FX, { [k]: 0 }, { [k]: 1, duration: d, ease: 'power2.out', immediateRender: false }, at);
  const unl = (k, at) => CALT.fromTo(FX, { [k]: 1 }, { [k]: 0, duration: .3, ease: 'power2.in', immediateRender: false }, at);
  lab('l1', 1.0); lab('l2', 2.05); lab('l3', 3.25); lab('l4', 3.65);
  unl('l1', 4.6); unl('l2', 4.68); unl('l3', 4.76); unl('l4', 4.84);
  lab('l4', 7.25, .4); unl('l4', 8.75);           // "grows around the post" while the bone heals
  const state = () => { const t = CALT.time(); return t < .02 ? 'start' : t < REST - .02 ? 'out' : Math.abs(t - REST) < .03 ? 'rest' : t < DUR - .03 ? 'in' : 'end'; };
  let lastK = '';
  function sync() {
    const s = state();
    const k = s === 'rest' ? 'back' : s === 'start' ? 'apart' : s === 'end' ? 'again' : s === 'out' ? 'back' : 'again';
    if (k !== lastK) {
      lastK = k; lblEl.textContent = TXT[k];
      statusEl.textContent = s === 'rest' ? TXT.sApart : (s === 'start' || s === 'end') ? TXT.sTogether : '';
    }
    btn.setAttribute('aria-disabled', (s === 'out' || s === 'in') ? 'true' : 'false');
    btn.classList.toggle('back', k === 'back');
  }
  function play() {
    const s = state();
    if (btn.getAttribute('aria-disabled') === 'true') return;
    if (RM) { CALT.time(s === 'rest' ? DUR : REST); return; }
    if (s === 'start' || s === 'end') { CALT.time(0); CALT.tweenTo(REST, { duration: REST, ease: 'none' }); }
    else if (s === 'rest') CALT.tweenTo(DUR, { duration: DUR - REST, ease: 'none' });
  }
  btn.addEventListener('click', play);

  R1.shadowMap.enabled = true; R1.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  await yieldMain();
  const pmrem = new THREE.PMREMGenerator(R1);
  const roomEnv = new RoomEnvironment();
  performance.mark('imp:pre-pmrem');
  scene.environment = pmrem.fromScene(roomEnv, .04, .1, 100, { size: PH ? 64 : 256 }).texture; scene.environmentIntensity = .62;
  performance.mark('imp:pmrem');
  const camera = new THREE.PerspectiveCamera(26, 1, .1, 80);
  // warm studio key from the upper left, a pink-warm bounce from below and a pale rim from behind so every edge reads on the plum
  const key = new THREE.DirectionalLight(0xfff0e0, 3.0); key.position.set(-2.6, 9, 4.2); key.castShadow = true;
  key.shadow.mapSize.set(PH ? 1024 : 2048, PH ? 1024 : 2048); key.shadow.radius = 6; key.shadow.bias = -.0006; key.shadow.normalBias = .02;
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -5, near: 1, far: 24 });
  scene.add(key, key.target);
  const fill = new THREE.HemisphereLight(0xfff3ea, 0xc79bb4, .55); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe3ee, 1.7); rim.position.set(5, 4, -6); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffd9c4, .8); rim2.position.set(-6, 1, -3); scene.add(rim2);
  await yieldMain();

  const L = 3.6, BH = 2.0;
  const bw = y => { const u = Math.min(1, Math.max(0, -y / BH)); return .40 + .34 * Math.sin(Math.min(1, u * 1.2) * Math.PI / 2); };
  // bone half-profile in (z, y), z <= 0 (the front half is cut away at z = 0)
  const boneProf = (() => {
    const p = [], w0 = bw(-.16);
    for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI / 2; p.push([-w0 * Math.sin(a), -.16 * (1 - Math.cos(a))]); }
    for (let k = 1; k <= 22; k++) { const y = -.16 - (1.56 * k / 22); p.push([-bw(y), y]); }
    const wb = bw(-1.72); for (let k = 1; k <= 10; k++) { const a = k / 10 * Math.PI / 2; p.push([-wb * Math.cos(a), -1.72 - .28 * Math.sin(a)]); }
    return p;
  })();
  const gumOuter = (() => { const c = new THREE.SplineCurve([[0, .3], [-.22, .29], [-.4, .23], [-.53, .1], [-.585, -.1], [-.6, -.32], [-.575, -.5]].map(a => new THREE.Vector2(a[0], a[1]))); return c.getPoints(30).map(v => [v.x, v.y]); })();
  const gumProf = gumOuter.concat([[-.52, -.47], [-.48, -.28], [-.43, -.1], [-.3, -.05], [-.12, -.03], [0, -.02]]);
  // build a sliced block: smooth side wall from a 2D profile, flat cut face at z = 0, flat ends at x = +-L/2
  function sliceGeo(prof, faceY0, faceY1, zf = 0) {
    const n = prof.length, pos = [], nor = [], aH = [], idx = [];
    const nrm = k => { const a = prof[Math.max(0, k - 1)], b = prof[Math.min(n - 1, k + 1)], tz = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tz, ty) || 1; return [ty / l, -tz / l]; };
    for (let k = 0; k < n; k++) { const [z, y] = prof[k], [nz, ny] = nrm(k); for (const x of [-L / 2, L / 2]) { pos.push(x, y, z); nor.push(0, ny, nz); aH.push(1); } }
    for (let k = 0; k < n - 1; k++) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    let side = new THREE.BufferGeometry(); side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); side.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); side.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1)); side.setIndex(idx);
    fixWind(side);
    const face = new THREE.PlaneGeometry(L, faceY1 - faceY0, 1, 1); face.translate(0, (faceY0 + faceY1) / 2, zf); face.deleteAttribute('uv'); face.setAttribute('aH', new THREE.Float32BufferAttribute([1, 1, 1, 1], 1));
    const sh = new THREE.Shape(prof.map(a => new THREE.Vector2(a[0], a[1])));
    const caps = [-1, 1].map(sx => { const g = new THREE.ShapeGeometry(sh, 2); g.deleteAttribute('uv'); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const X = p.getX(i), Y = p.getY(i); p.setXYZ(i, sx * (L / 2 + (zf ? .002 : 0)), Y, X); }
      const nn = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) nn[i * 3] = sx; g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
      g.setAttribute('aH', new THREE.Float32BufferAttribute(new Array(p.count).fill(1), 1)); fixWind(g); return g; });
    return mergeGeometries([side.toNonIndexed(), face.toNonIndexed(), caps[0].toNonIndexed(), caps[1].toNonIndexed()]);
  }
  // flip triangles whose winding disagrees with their stored normals
  function fixWind(g) {
    const p = g.attributes.position, nn = g.attributes.normal, ix = g.index ? g.index.array : null; if (!ix) return;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), N = new THREE.Vector3();
    for (let i = 0; i < ix.length; i += 3) {
      A.fromBufferAttribute(p, ix[i]); B.fromBufferAttribute(p, ix[i + 1]); Cc.fromBufferAttribute(p, ix[i + 2]);
      B.sub(A); Cc.sub(A); B.cross(Cc); N.fromBufferAttribute(nn, ix[i]);
      if (B.dot(N) < 0) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    }
  }
  // jawbone: cortical shell + porous (cancellous) inside, procedurally in the shader. uHeal fills the bone back in around the post.
  const boneU = { uHeal: { value: 1 } };
  const boneMat = patch(Object.assign(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .82, metalness: 0 }), { name: 'bone' }), 'uniform float uHeal;\nfloat BW(float y){ float u = clamp(-y / 2.0, 0.0, 1.0); return 0.40 + 0.34 * sin(min(1.0, u * 1.2) * 1.5707963); }\n', `
    vec3 cort = vec3(0.95, 0.915, 0.84), canc = vec3(0.915, 0.835, 0.715), pore = vec3(0.70, 0.55, 0.43);
    vec3 col = cort;
    bool face = vON.z > 0.9 && vOP.z > -0.01, endf = abs(vON.x) > 0.9;
    if (face || endf) {
      vec2 p = face ? vOP.xy : vec2(vOP.z, vOP.y);
      float d = face ? min(min(-vOP.y, vOP.y + 2.0), 1.8 - abs(vOP.x)) : min(min(BW(vOP.y) - abs(vOP.z), vOP.y + 2.0), -vOP.y + 0.02);
      vec2 w1 = wor(p * 5.2), w2 = wor(p * 11.0 + 7.3);
      float r1 = 0.24 + 0.17 * w1.y, r2 = 0.2 + 0.14 * w2.y;
      float holes = max((1.0 - smoothstep(r1 - 0.06, r1, w1.x)) * step(0.28, w1.y), (1.0 - smoothstep(r2 - 0.07, r2, w2.x)) * 0.8);
      float rim = 1.0 - smoothstep(0.05, 0.1, d);
      float inner = smoothstep(r1 * 0.2, r1, w1.x);
      col = mix(canc, pore * (0.9 + 0.12 * inner), holes * 0.85);
      if (face) {
        // the socket the post sits in: a threaded half-groove, fresh when the post is out, filled in again as it heals
        float ax = abs(vOP.x), y = vOP.y;
        float inSock = (1.0 - smoothstep(0.205, 0.215, ax)) * step(-1.17, y);
        float ring = (1.0 - smoothstep(0.21, 0.21 + 0.16 * uHeal + 0.02, ax)) * step(-1.2, y);
        col = mix(col, mix(cort, vec3(0.97, 0.95, 0.9), 0.4), ring * uHeal * 0.85);
        float cyl = sqrt(max(0.0, 1.0 - pow(ax / 0.21, 2.0)));
        float thr = 0.5 + 0.5 * sin((y + vOP.x * 0.12) / 0.092 * 6.2832);
        float sx = clamp(vOP.x / 0.21, -1.0, 1.0); float lit = clamp(-sx * -0.55 + cyl * 0.75, 0.0, 1.0);
        vec3 sk = vec3(0.80, 0.68, 0.57) * (0.42 + 0.4 * lit) * (0.84 + 0.2 * thr);
        col = mix(col, sk, inSock);
      }
      col = mix(col, cort, rim);
    }
      col *= face ? (0.86 + 0.14 * smoothstep(-2.0, -0.2, vOP.y)) : 1.0;
    diffuseColor.rgb = col;`);
  boneMat.userData.u = boneU;
  const bone = new THREE.Mesh(sliceGeo(boneProf, -BH, 0), boneMat);
  const gumHero = gumMat('gumHero', true);
  const gumG = sliceGeo(gumProf, -.02, .3, .003);
  { const a = gumG.attributes.position, h = gumG.attributes.aH; for (let i = 0; i < a.count; i++) h.setX(i, a.getY(i) > .25 && Math.abs(a.getX(i)) < .34 ? (a.getY(i) - .25) / .05 * .0 + 1 : 1); }
  const gum = new THREE.Mesh(gumG, gumHero);
  bone.receiveShadow = gum.receiveShadow = true; bone.castShadow = gum.castShadow = true;
  const jaw = new THREE.Group(); jaw.add(bone, gum); scene.add(jaw);

  await yieldMain();
  // neighbouring natural molars, roots shown in the cut-away
  const enU = { uEn: { value: new THREE.Color(.93, .9, .84) }, uStain: { value: 0 }, uTr: { value: .25 } };
  const enHero = enamelMat('enHero', enU);
  const molSpec = { kind: 'mol', W: .5, Df: .46, Db: .44, H: .78, n: 2.9 };
  const molCrown = toothGeo(molSpec, PH ? 52 : 72, PH ? 46 : 64);
  await yieldMain();
  const natural = mergeGeometries([molCrown, rootGeo(.42, .36, .36, 0).translate(0, .02, 0), rootGeo(1.3, .16, .21, .1).translate(-.19, 0, 0), rootGeo(1.22, .16, .21, -.1).translate(.19, 0, 0)]);
  [-1.13, 1.13].forEach(x => { const m = new THREE.Mesh(natural, enHero); m.position.set(x, .25, -.08); m.rotation.y = x * .06; m.castShadow = m.receiveShadow = true; scene.add(m); });

  await yieldMain();
  // the implant: titanium post with a real helical thread, an abutment, and a crown
  const PL = 1.15, PITCH = .092;
  const postGeo = gridGeo(PH ? 56 : 110, PH ? 120 : 240, (u, v) => {
    const th = u * Math.PI * 2; let y, r;
    const core = y => .162 + .036 * sstep(-PL, -PL + .55, y);
    const thread = y => { const ph = ((y / PITCH + u) % 1 + 1) % 1; const f = sstep(.08, .36, ph) * (1 - sstep(.52, .8, ph)); return .043 * f * sstep(-PL + .02, -PL + .16, y) * (1 - sstep(-.17, -.11, y)); };
    if (v < .05) { const a = v / .05; y = -PL + .06 * (1 - Math.cos(a * Math.PI / 2)); r = core(y) * Math.sin(a * Math.PI / 2); }
    else if (v > .965) { const a = (v - .965) / .035; y = 0; r = .205 * (1 - a); }
    else { const a = (v - .05) / .915; y = -PL + .06 + a * (PL - .06); r = y > -.1 ? .205 : y > -.13 ? C(core(y) + .0, .205, sstep(-.13, -.1, y)) : core(y) + thread(y); }
    return [Math.cos(th) * r, y, Math.sin(th) * r, 0];
  });
  await yieldMain();
  const post = new THREE.Group(), postM = new THREE.Mesh(postGeo, titanium);
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .012, 6), hexMat); hex.position.y = .002;
  post.add(postM, hex); postM.castShadow = postM.receiveShadow = true;
  const abPts = [[0, -.12], [.1, -.12], [.11, -.02], [.17, 0], [.205, .02], [.235, .13], [.24, .2], [.225, .25], [.17, .27], [.16, .3], [.13, .6], [.1, .63], [0, .635]].map(a => new THREE.Vector2(a[0], a[1]));
  const abut = new THREE.Group(), abM = new THREE.Mesh(new THREE.LatheGeometry(abPts, PH ? 52 : 72), anodized); abM.castShadow = true; abut.add(abM);
  const crown = new THREE.Group(), crM = new THREE.Mesh(molCrown, enHero); crM.position.y = .24; crM.castShadow = crM.receiveShadow = true; crown.add(crM);
  scene.add(post, abut, crown);

  await yieldMain();
  // soft studio floor shadow
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x14040f, opacity: .22 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -BH - .001; floor.receiveShadow = true; scene.add(floor);
  const blob = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(18,4,13,.55)'); gr.addColorStop(1, 'rgba(18,4,13,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false })); ao.rotation.x = -Math.PI / 2; ao.position.set(0, -BH + .004, -.3); scene.add(ao);

  // label anchors
  const anchor = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const AN = [anchor(crown, .5, .62, .1), anchor(abut, -.22, .42, .05), anchor(post, .2, -.2, .08), anchor(jaw, -.7, -1.1, 0)];

  /* ---- the break-apart, as tweens on the master timeline ---- */
  const ST = new Map();
  const cur = (o, k) => { let s = ST.get(o); if (!s) ST.set(o, s = {}); if (!(k in s)) s[k] = o[k]; return s[k]; };
  function mv(o, to, at, dur = 1, ease = 'power3.inOut') { const from = {}; for (const k in to) from[k] = cur(o, k); Object.assign(ST.get(o), to); CALT.fromTo(o, from, { ...to, duration: dur, ease, immediateRender: false }, at); }
  const TURN = Math.PI * 2;
  // apart (0 - 4.5): crown lifts, abutment rises, the post unscrews (turns while it climbs its own thread) and rises clear
  mv(crown.position, { y: 1.1 }, 0, 1.0, 'power2.inOut'); mv(crown.position, { y: 2.55 }, 1.0, 1.8, 'power2.inOut'); mv(crown.rotation, { z: -.05 }, 0, .8, 'power2.out'); mv(crown.rotation, { z: 0 }, .8, .9, 'power2.inOut');
  mv(abut.position, { y: 1.95 }, 1.05, 1.7, 'power2.inOut');
  mv(post.rotation, { y: -6 * TURN }, 1.3, 2.6, 'power1.inOut');
  mv(post.position, { y: .38 }, 1.3, 1.5, 'power1.in'); mv(post.position, { y: 1.5 }, 2.8, 1.25, 'power2.out');
  mv(boneU.uHeal, { value: 0 }, 2.0, 1.6, 'power1.inOut');
  // back together (4.5 - 10.6): post comes down and screws in, the bone fills in around it, abutment drops, crown clicks home
  mv(post.position, { y: .4 }, 4.75, 1.2, 'power2.inOut'); mv(abut.position, { y: 1.3 }, 4.9, 1.3, 'power2.inOut'); mv(crown.position, { y: 1.78 }, 5.0, 1.35, 'power2.inOut'); mv(post.rotation, { y: -4 * TURN }, 4.75, 1.2, 'power1.inOut');
  mv(post.position, { y: 0 }, 5.95, 1.35, 'power1.inOut'); mv(post.rotation, { y: 0 }, 5.95, 1.35, 'power1.inOut');
  mv(boneU.uHeal, { value: 1 }, 7.1, 1.6, 'power2.out');
  mv(abut.position, { y: 0 }, 7.45, 1.05, 'power3.inOut');
  mv(crown.position, { y: .05 }, 8.25, 1.05, 'power3.inOut'); mv(crown.position, { y: 0 }, 9.3, .16, 'power2.in');
  mv(FX, { click: 1 }, 9.3, .07, 'none'); mv(FX, { click: 0 }, 9.37, .45, 'power2.out');
  { const t = CALT.time(); CALT.time(Math.min(t + .001, CALT.duration())); CALT.time(t); }
  await yieldMain();

  /* ---- camera: one spline through the whole timeline ---- [t, az, el, visibleHeight(world units at the target), tx, ty, tz] */
  const K = [[0, .6, .34, 4.1, 0, -.42, 0], [.9, .55, .31, 4.7, 0, -.15, 0], [2.2, .48, .27, 5.7, 0, .5, 0], [3.4, .44, .25, 6.3, 0, .6, 0], [4.5, .4, .23, 6.4, 0, .62, 0],
    [6.0, .36, .25, 6.2, 0, .55, 0], [7.6, .42, .29, 6.0, 0, .5, 0], [8.4, .47, .31, 5.4, 0, .2, 0], [9.2, .52, .33, 4.5, 0, -.25, 0], [10.6, .6, .34, 4.1, 0, -.42, 0]];
  const cam = [0, 0, 0, 0, 0, 0];
  function camAt(t) {
    t = Math.max(0, Math.min(K[K.length - 1][0], t)); let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
    const p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(K.length - 1, i + 2)], h = p2[0] - p1[0], u = (t - p1[0]) / h;
    const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
    for (let k = 1; k < 7; k++) { const m1 = (p2[k] - p0[k]) / Math.max(1e-3, p2[0] - p0[0]) * h, m2 = (p3[k] - p1[k]) / Math.max(1e-3, p3[0] - p1[0]) * h; cam[k - 1] = h00 * p1[k] + h10 * m1 + h01 * p2[k] + h11 * m2; }
    return cam;
  }
  const TAN = Math.tan(13 * Math.PI / 180) * 2;   // visible height = distance * TAN (fov 26)
  const tagEls = [...root.querySelectorAll('[data-imp-tags] .tg')], svg = root.querySelector('[data-imp-lines]');
  const SIDE = ['r', 'l', 'r', 'l'];               // crown right, abutment left, post right, jawbone below-left
  const TG = tagEls.map((el, i) => { const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'), dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', 4); svg.append(ln, dot); return { el, ln, dot, a: AN[i], k: 'l' + (i + 1), side: SIDE[i], w: 0, h: 0, on: false }; });
  let W = 1, H = 1;
  function size() {
    W = stageEl.clientWidth; H = stageEl.clientHeight;
    if (!W || !H) return;
    R1.setPixelRatio(PR()); R1.setSize(W, H, false); camera.aspect = W / H;
    camera.updateProjectionMatrix(); TG.forEach(g => g.w = 0); invalidate();
  }
  addEventListener('resize', size); size();
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(stageEl);
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) invalidate(); }).observe(stageEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(0, -BH, 0);
  function labels() {
    camera.updateMatrixWorld();
    V2.set(0, -BH, 0); V2.project(camera); const jawBottom = (-V2.y * .5 + .5) * H;
    const pad = isPhone() ? 12 : 20;
    for (const g of TG) {
      const r = FX[g.k];
      if (r <= .002) { if (g.on) { g.on = false; g.el.style.visibility = g.ln.style.visibility = g.dot.style.visibility = 'hidden'; } continue; }
      if (!g.on) { g.on = true; g.el.style.visibility = g.ln.style.visibility = g.dot.style.visibility = 'visible'; }
      if (!g.w) { g.w = g.el.offsetWidth; g.h = g.el.offsetHeight; }
      g.a.getWorldPosition(V); V.project(camera); const sx = (V.x * .5 + .5) * W, sy = (-V.y * .5 + .5) * H;
      const left = g.side === 'l', below = g.k === 'l4';
      const ly = below ? Math.min(H - g.h / 2 - 4, jawBottom + 8 + g.h / 2 + (isPhone() ? 6 : 10)) : Math.max(g.h / 2 + 4, Math.min(H - g.h / 2 - 4, sy - 2));
      const x = left ? pad : W - pad - g.w;                      // text sits in the margin; only the line crosses the stage
      const x2 = left ? x + g.w + 8 : x - 8;                      // the line starts at the text's inner edge
      const e = Math.min(1, r * 1.6);
      g.ln.setAttribute('x1', sx.toFixed(1)); g.ln.setAttribute('y1', sy.toFixed(1));
      g.ln.setAttribute('x2', (sx + (x2 - sx) * e).toFixed(1)); g.ln.setAttribute('y2', (sy + (ly - sy) * e).toFixed(1));
      g.dot.setAttribute('cx', sx.toFixed(1)); g.dot.setAttribute('cy', sy.toFixed(1)); g.dot.setAttribute('r', (4 * Math.min(1, r * 2)).toFixed(2));
      const cut = ((1 - Math.max(0, (r - .3) / .7)) * 100).toFixed(1);
      g.el.style.transform = `translate(${x.toFixed(1)}px,${(ly - g.h / 2).toFixed(1)}px)`;
      g.el.style.clipPath = left ? `inset(0 0 0 ${cut}%)` : `inset(0 ${cut}% 0 0)`;
    }
  }

  /* ---- drawing: one frame, only when something changed (see invalidate) ---- */
  function drawFrame() {
    const c = camAt(CALT.time()), aspect = W / H;
    const hv = Math.max(c[2], 4.15 / aspect);                    // always keep the whole jaw block (3.6 long) in the frame width
    const r = hv / TAN, az = c[0], el = c[1], tx = c[3], ty = c[4] - FX.click * .025 + (hv - c[2]) * .12, tz = c[5];
    camera.position.set(tx + r * Math.cos(el) * Math.sin(az), ty + r * Math.sin(el), tz + r * Math.cos(el) * Math.cos(az)); camera.lookAt(tx, ty, tz);
    crown.scale.set(1 + FX.click * .012, 1 - FX.click * .02, 1 + FX.click * .012);
    R1.render(scene, camera); labels();
    window.IMP_STATE.frames++; nDraw++;
  }
  function tick(now) {
    raf = 0;
    if (!visible || document.hidden || torn || !dirty) return;
    dirty = false; drawFrame();
    watch(performance.now());
  }
  // quality watch: while the timeline plays, collect the gaps between drawn frames; after ~30 of them (or 10 if they are terrible), if p95 > 20 ms step down (never back up)
  let lastPlaying = false;
  function watch(now) {
    const st = state(), playing = st === 'out' || st === 'in', gap = now - lastDraw; lastDraw = now;
    const ok = playing && lastPlaying; lastPlaying = playing;
    if (!ok) { if (!playing) deltas = []; return; }                    // idle, or the first frame of a play: not a measurement
    if (level >= 3 || q.get('noadapt')) return;
    deltas.push(Math.min(gap, 250));
    const n = deltas.length; if (n < 13) return;
    const s = deltas.slice(3).sort((x, y) => x - y), med = s[s.length >> 1], p95 = s[Math.floor(.95 * (s.length - 1))];
    if (n < 34 && med < 40) return;                                    // normal-looking so far: keep collecting up to ~30
    window.IMP_STATE.gaps = s.map(x => +x.toFixed(1));
    deltas = [];
    if (p95 > 20) stepDown(p95);
  }
  function shadowsOff() { key.castShadow = false; R1.shadowMap.enabled = false; window.IMP_STATE.shadows = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  function stepDown(p95) {
    level++; window.IMP_STATE.level = level; window.IMP_STATE.steps.push({ p95: +p95.toFixed(1), level });
    if (level === 1) { dprCap = Math.min(dprCap, 1.25); shadowsOff(); }
    else if (level === 2) { dprCap = 1; }
    else { toStills(); return; }
    window.IMP_STATE.dpr = dprCap; size();
  }
  window.IMP_STATE = { level: 0, dpr: dprCap, steps: [], shadows: true, frames: 0 };
  teardown = () => { cancelAnimationFrame(raf); gsap.killTweensOf(CALT); CALT.pause(); try { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); R1.dispose(); R1.forceContextLoss(); } catch (e) { /* ignore */ } canvas.hidden = true; };

  // ---- warm-up, off-screen: compile every shader, then draw the assembled and the taken-apart views once, so the first on-screen frame costs nothing ----
  // (one mesh at a time, so no single slice of main-thread work is long)
  try {
    const meshes = []; scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) { performance.mark('imp:compile'); if (R1.compileAsync) await R1.compileAsync(m, camera, scene); else R1.compile(m, camera, scene); await yieldMain(); }
  } catch (e) { /* ignore */ }
  const t0 = RM ? REST : q.get('t') != null ? +q.get('t') : 0;
  const _time = CALT.time;
  const warm = async (t) => { _time.call(CALT, t); sync(); drawFrame(); await yieldMain(); };
  await warm(0); await warm(REST); await warm(t0);
  window.IMP_STATE.frames = 0;
  window.IMP_UI = { DUR, REST, play, sync, draw: () => { dirty = true; drawFrame(); } };
  window.CAL3D = { scene, camera, renderer: R1, post, abut, crown, jaw, boneU, isRM: RM };
  root.classList.add('gl-on');
  performance.mark('imp:ready');
  invalidate();

  // play the take-apart once, ~1 s after the model scrolls into view
  if (!RM && !q.get('still') && CALT.time() < .01) {
    let done = false;
    const io = new IntersectionObserver(es => {
      if (done || !es[0].isIntersecting) return;
      done = true; io.disconnect();
      setTimeout(() => { if (CALT.time() < .01 && !torn) play(); }, 1000);
    }, { threshold: .55 });
    io.observe(stageEl);
  }
}

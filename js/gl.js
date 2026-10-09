/* gl.js — lapisan render OPNAME berbasis three.js (PBR).
   Mempertahankan API lama (MeshBuilder, Atlas, Engine.batch/geo/texture) sehingga world.js/env.js tetap sama.
   Fitur: material PBR ber-instance, lampu titik terdekat, senter berbayangan, IBL, SSAO (GTAO), bloom, tone mapping filmis. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/* ---------- pembangun mesh ---------- */
const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];
export class MeshBuilder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.uv = []; this.idx = []; }
  _v(p, n, c, uv) { this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]); this.col.push(c[0], c[1], c[2]); this.uv.push(uv[0], uv[1]); return this.pos.length / 3 - 1; }
  box(cx, cy, cz, sx, sy, sz, color = [1, 1, 1]) {
    const c = Array.isArray(color) ? color : hex(color);
    for (const f of FACES) {
      const base = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 1, 2].map((k) => (f.n[k] * 0.5 + f.u[k] * a * 0.5 + f.v[k] * b * 0.5));
        base.push(this._v([cx + p[0] * sx, cy + p[1] * sy, cz + p[2] * sz], f.n, c, [(a + 1) / 2, (b + 1) / 2]));
      }
      this.idx.push(base[0], base[1], base[2], base[0], base[2], base[3]);
    }
    return this;
  }
  /* silinder tegak (tutup atas saja) */
  cyl(cx, cy, cz, r, h, seg = 8, color = [1, 1, 1], cap = true) {
    const c = Array.isArray(color) ? color : hex(color);
    const y0 = cy - h / 2, y1 = cy + h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const n0 = [Math.cos(a0), 0, Math.sin(a0)], n1 = [Math.cos(a1), 0, Math.sin(a1)];
      const b0 = this._v([cx + n0[0] * r, y0, cz + n0[2] * r], n0, c, [i / seg, 0]);
      const b1 = this._v([cx + n1[0] * r, y0, cz + n1[2] * r], n1, c, [(i + 1) / seg, 0]);
      const t0 = this._v([cx + n0[0] * r, y1, cz + n0[2] * r], n0, c, [i / seg, 1]);
      const t1 = this._v([cx + n1[0] * r, y1, cz + n1[2] * r], n1, c, [(i + 1) / seg, 1]);
      this.idx.push(b1, b0, t0, b1, t0, t1);
    }
    if (cap) {
      const up = [0, 1, 0];
      const ctr = this._v([cx, y1, cz], up, c, [0.5, 0.5]);
      const ring = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        ring.push(this._v([cx + Math.cos(a) * r, y1, cz + Math.sin(a) * r], up, c, [0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2]));
      }
      for (let i = 0; i < seg; i++) this.idx.push(ctr, ring[i + 1], ring[i]);
    }
    return this;
  }
  /* bidang tegak menghadap +z, ukuran 1x1 berpusat di origin */
  quad(color = [1, 1, 1]) {
    const c = Array.isArray(color) ? color : hex(color), n = [0, 0, 1];
    const a = this._v([-0.5, -0.5, 0], n, c, [0, 0]), b = this._v([0.5, -0.5, 0], n, c, [1, 0]);
    const d = this._v([0.5, 0.5, 0], n, c, [1, 1]), e = this._v([-0.5, 0.5, 0], n, c, [0, 1]);
    this.idx.push(a, b, d, a, d, e);
    return this;
  }
  /* bidang datar menghadap +y, 1x1 berpusat di origin (uv 0..1) */
  floorQuad(color = [1, 1, 1]) {
    const c = Array.isArray(color) ? color : hex(color), n = [0, 1, 0];
    const a = this._v([-0.5, 0, -0.5], n, c, [0, 0]), b = this._v([-0.5, 0, 0.5], n, c, [0, 1]);
    const d = this._v([0.5, 0, 0.5], n, c, [1, 1]), e = this._v([0.5, 0, -0.5], n, c, [1, 0]);
    this.idx.push(a, b, d, a, d, e);
    return this;
  }
  radius() {
    let m = 0;
    for (let i = 0; i < this.pos.length; i += 3) m = Math.max(m, Math.hypot(this.pos[i], this.pos[i + 1], this.pos[i + 2]));
    return m;
  }
}

/* ---------- atlas tekstur dari canvas ---------- */
export class Atlas {
  constructor(size = 2048, cw = 256, ch = 128) {
    this.size = size; this.cw = cw; this.ch = ch; this.cols = Math.floor(size / cw);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d'); this.map = new Map(); this.n = 0;
    this.ctx.clearRect(0, 0, size, size);
  }
  add(name, draw) {
    const i = this.n++, cx = (i % this.cols) * this.cw, cy = Math.floor(i / this.cols) * this.ch;
    const g = this.ctx; g.save(); g.translate(cx, cy); g.beginPath(); g.rect(0, 0, this.cw, this.ch); g.clip();
    draw(g, this.cw, this.ch); g.restore();
    const pad = 1.5; // hindari rembesan antar-sel
    this.map.set(name, [(cx + pad) / this.size, 1 - (cy + this.ch - pad) / this.size, (this.cw - pad * 2) / this.size, (this.ch - pad * 2) / this.size]);
    return this.map.get(name);
  }
  uv(name) { return this.map.get(name); }
}

/* ---------- material PBR per kelompok batch ---------- */
const MAT = {
  rakstruktur: [0.42, 0.65], lantai: [0.34, 0], 'lantai-kantor': [0.22, 0], aspal: [0.95, 0], plafon: [0.8, 0.2], dinding: [0.85, 0],
  'rolling-door': [0.5, 0.6], kaca: [0.05, 0], 'pallet-kayu': [0.92, 0], barang: [0.6, 0], label: [0.5, 0], papan: [0.4, 0.1],
  'papan-opname': [0.4, 0], decal: [0.45, 0], halo: [1, 0], dekor: [0.65, 0.2], 'dekor-silinder': [0.5, 0.35], dinamis: [0.6, 0.1],
};
const CASTERS = new Set(['rakstruktur', 'pallet-kayu', 'barang', 'dekor', 'dekor-silinder']);

const VS_PRE = `attribute vec4 iTint; attribute vec4 iUv; varying float vEmis; varying vec3 vWP;
void main() {`;
const FS_PRE = `
uniform sampler2D uLM; uniform vec4 uLMB; uniform float uLMOn; uniform float uLamps; uniform float uTime;
varying float vEmis; varying vec3 vWP;
float h31(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float vn(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main() {`;

export class Batch {
  constructor(eng, geo, opt = {}) {
    this.eng = eng; this.geo = geo; this.tex = opt.tex || null; this.transparent = !!opt.transparent;
    this.alpha = opt.alpha ?? 1; this.cap = opt.cap || 256; this.n = 0; this.dynamic = !!opt.dynamic;
    this.data = new Float32Array(this.cap * STRIDE); this.visible = true; this.cull = opt.cull !== false;
    this.cx = 0; this.cy = 0; this.cz = 0; this.rad = 1e9; this.name = opt.name || ''; this.dirty = true; this.finalized = false;
    this.material = eng._material(opt, this.name);
    this.mesh = null; this._mk(this.cap);
  }
  _mk(cap) {
    if (this.mesh) { this.eng.scene.remove(this.mesh); this.mesh.dispose(); }
    const m = new THREE.InstancedMesh(this.geo.g.clone(), this.material, cap);
    m.instanceMatrix.setUsage(this.dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
    this.aT = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.aU = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.aT.setUsage(m.instanceMatrix.usage); this.aU.setUsage(m.instanceMatrix.usage);
    m.geometry.setAttribute('iTint', this.aT); m.geometry.setAttribute('iUv', this.aU);
    m.frustumCulled = false; m.matrixAutoUpdate = false; m.count = 0;
    m.castShadow = CASTERS.has(this.name); m.receiveShadow = !this.transparent;
    if (this.transparent) m.renderOrder = 5;
    this.mesh = m; this.meshCap = cap; this.eng.scene.add(m); this.dirty = true;
    if (this.finalized && this.bs) m.boundingSphere = this.bs;
  }
  _grow() { this.cap *= 2; const d = new Float32Array(this.cap * STRIDE); d.set(this.data); this.data = d; }
  add(px, py, pz, sx = 1, sy = 1, sz = 1, yaw = 0, rz = 0, r = 1, g = 1, b = 1, emis = 0, u0 = 0, v0 = 0, du = 1, dv = 1) {
    if (this.n >= this.cap) this._grow();
    this.set(this.n, px, py, pz, sx, sy, sz, yaw, rz, r, g, b, emis, u0, v0, du, dv);
    this.dirty = true;
    return this.n++;
  }
  set(i, px, py, pz, sx = 1, sy = 1, sz = 1, yaw = 0, rz = 0, r = 1, g = 1, b = 1, emis = 0, u0 = 0, v0 = 0, du = 1, dv = 1) {
    const d = this.data, o = i * STRIDE;
    const cy = Math.cos(yaw), sy_ = Math.sin(yaw), c = Math.cos(rz), s = Math.sin(rz);
    d[o] = cy * c * sx; d[o + 1] = -cy * s * sy; d[o + 2] = sy_ * sz; d[o + 3] = px;
    d[o + 4] = s * sx; d[o + 5] = c * sy; d[o + 6] = 0; d[o + 7] = py;
    d[o + 8] = -sy_ * c * sx; d[o + 9] = sy_ * s * sy; d[o + 10] = cy * sz; d[o + 11] = pz;
    d[o + 12] = r; d[o + 13] = g; d[o + 14] = b; d[o + 15] = emis;
    d[o + 16] = u0; d[o + 17] = v0; d[o + 18] = du; d[o + 19] = dv;
    this.dirty = true;
  }
  clear() { this.n = 0; this.dirty = true; }
  finalize() {
    const d = this.data;
    if (!this.n) { this.rad = 0; this.visible = false; this.upload(); return this; }
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9, pad = 0;
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE, px = d[o + 3], py = d[o + 7], pz = d[o + 11];
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz);
      const sx = Math.hypot(d[o], d[o + 4], d[o + 8]), sy = Math.hypot(d[o + 1], d[o + 5], d[o + 9]), sz = Math.hypot(d[o + 2], d[o + 6], d[o + 10]);
      pad = Math.max(pad, Math.max(sx, sy, sz) * this.geo.radius);
    }
    this.cx = (x0 + x1) / 2; this.cy = (y0 + y1) / 2; this.cz = (z0 + z1) / 2;
    this.rad = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + pad;
    this.visible = true; this.finalized = true;
    this.bs = new THREE.Sphere(new THREE.Vector3(this.cx, this.cy, this.cz), this.rad);
    this.mesh.boundingSphere = this.bs; this.mesh.frustumCulled = this.cull && !this.dynamic;
    this.upload();
    return this;
  }
  upload() {
    if (this.n > this.meshCap) this._mk(Math.max(this.cap, this.n));
    const m = this.mesh, a = m.instanceMatrix.array, T = this.aT.array, U = this.aU.array, d = this.data, n = this.n;
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE, k = i * 16;
      a[k] = d[o]; a[k + 1] = d[o + 4]; a[k + 2] = d[o + 8]; a[k + 3] = 0;
      a[k + 4] = d[o + 1]; a[k + 5] = d[o + 5]; a[k + 6] = d[o + 9]; a[k + 7] = 0;
      a[k + 8] = d[o + 2]; a[k + 9] = d[o + 6]; a[k + 10] = d[o + 10]; a[k + 11] = 0;
      a[k + 12] = d[o + 3]; a[k + 13] = d[o + 7]; a[k + 14] = d[o + 11]; a[k + 15] = 1;
      T[i * 4] = d[o + 12]; T[i * 4 + 1] = d[o + 13]; T[i * 4 + 2] = d[o + 14]; T[i * 4 + 3] = d[o + 15];
      U[i * 4] = d[o + 16]; U[i * 4 + 1] = d[o + 17]; U[i * 4 + 2] = d[o + 18]; U[i * 4 + 3] = d[o + 19];
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; this.aT.needsUpdate = true; this.aU.needsUpdate = true;
    this.dirty = false;
  }
}

const STRIDE = 20; // float per instance: R0 R1 R2 Tint Uv

class Geo {
  constructor(mb) {
    this.radius = mb.radius() || 1;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(mb.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(mb.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(mb.uv, 2));
    g.setIndex(mb.idx);
    this.g = g; this.tris = mb.idx.length / 3;
  }
}

const VIGNETTE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
  float h21(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
  void main(){
    vec3 c=texture2D(tDiffuse,vUv).rgb; vec2 sp=vUv-0.5;
    c*=1.0-0.30*smoothstep(0.30,0.95,length(sp*vec2(uRes.x/uRes.y,1.0))*1.25);
    c+=(h21(gl_FragCoord.xy+fract(uTime)*131.0)-0.5)*0.022;
    gl_FragColor=vec4(c,1.0);
  }`,
};

export class Engine {
  constructor(canvas) {
    let r;
    try { r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false }); }
    catch (e) { throw new Error('WebGL2 tidak tersedia di browser ini.'); }
    this.renderer = r; this.canvas = canvas; this.batches = [];
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.82;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(72, 1.6, 0.1, 330);
    this.scale = 1; this.fogCol = [0.055, 0.07, 0.09]; this.fogNear = 40; this.fogFar = 190; this.lamp = 1;
    this.sky = [0.78, 0.82, 0.9]; this.ground = [0.34, 0.33, 0.33]; this.key = [0.32, 0.30, 0.26];
    this.stats = { draws: 0, tris: 0 }; this.aspect = 1.6; this.tier = 2;
    this.U = { uLM: { value: null }, uLMB: { value: new THREE.Vector4(0, 0, 1, 1) }, uLMOn: { value: 0 }, uLamps: { value: 1 }, uTime: { value: 0 } };
    this.aniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    this.scene.fog = new THREE.Fog(0x101418, 40, 190); this.scene.background = new THREE.Color(0x101418);
    // IBL lembut: pantulan ruangan untuk logam & lantai
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.3; pm.dispose();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1); this.sun.position.set(0.35, 0.88, 0.3); this.scene.add(this.sun);
    this.head = new THREE.SpotLight(0xffe9c4, 100, 32, 0.52, 0.75, 1.3);
    this.head.castShadow = true; this.head.shadow.mapSize.set(1024, 1024); this.head.shadow.camera.near = 0.25; this.head.shadow.camera.far = 30;
    this.head.shadow.bias = -0.0004; this.head.shadow.normalBias = 0.03;
    this.scene.add(this.head); this.scene.add(this.head.target);
    this.lampPos = []; this.lampH = 18.3; this.pools = [];
    for (let i = 0; i < 6; i++) { const p = new THREE.PointLight(0xfff0d8, 0, 26, 2); this.scene.add(p); this.pools.push(p); }
    this._buildComposer(2, 2);
  }
  _buildComposer(w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt); this.composer.setPixelRatio(1);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = new GTAOPass(this.scene, this.camera, w, h);
    this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 12 });
    this.gtao.blendIntensity = 0.9; this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.55, 0.9); this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.fx = new ShaderPass(VIGNETTE); this.composer.addPass(this.fx);
  }
  /* material PBR + suntikan shader: warna sRGB per-instance, UV atlas per-instance, emisi, kotoran, lightmap lantai */
  _material(opt, name) {
    const [rough, metal] = MAT[name] || [0.7, 0.15], tr = !!opt.transparent;
    const m = new THREE.MeshStandardMaterial({
      map: opt.tex || null, vertexColors: true, roughness: rough, metalness: metal, envMapIntensity: metal > 0.3 ? 1.1 : 0.7,
      transparent: tr, opacity: opt.alpha ?? 1, depthWrite: !tr, side: (tr || opt.noCull) ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: (opt.tex && !tr) ? 0.04 : 0,
    });
    if (name === 'decal' || name === 'label' || name === 'papan' || name === 'papan-opname') { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    const U = this.U;
    m.customProgramCacheKey = () => 'opname-v1';
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('void main() {', VS_PRE)
        .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\n vColor.rgb = pow(max(vColor.rgb * iTint.rgb, vec3(0.0)), vec3(2.2));\n#endif')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * iUv.zw + iUv.xy;\n#endif')
        .replace('#include <project_vertex>', '#include <project_vertex>\n vEmis = iTint.w; { vec4 wp4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wp4 = instanceMatrix * wp4;\n#endif\n vWP = (modelMatrix * wp4).xyz; }');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', FS_PRE)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor * (0.78 + 0.44 * vn(vWP * 0.45)), 0.04, 1.0);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * vEmis * 2.4; diffuseColor.rgb *= (1.0 - vEmis);
  float g1 = vn(vWP * 0.33), g2 = vn(vWP * 2.7 + 7.0);
  float nearF = 1.0 - smoothstep(10.0, 45.0, length(vWP - cameraPosition));
  float grime = (0.86 + 0.30 * g1) * mix(1.0, 0.90 + 0.20 * g2, nearF) * (1.0 - 0.20 * exp(-vWP.y * 0.5) * (0.4 + 0.6 * g1));
  diffuseColor.rgb *= mix(grime, 1.0, vEmis);
  vec3 wN = inverseTransformDirection(normal, viewMatrix);
  bool floorS = (wN.y > 0.9 && vWP.y < 0.1);
  vec3 lm = vec3(1.0, 0.0, 0.0);
  if (uLMOn > 0.5) lm = texture2D(uLM, (vWP.xz - uLMB.xy) * uLMB.zw).rgb;
  float gAO = mix(1.0, lm.r, floorS ? 1.0 : exp(-vWP.y * 0.34));`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
  reflectedLight.indirectDiffuse *= gAO; reflectedLight.indirectSpecular *= mix(1.0, gAO, 0.7); reflectedLight.directDiffuse *= mix(1.0, gAO, 0.45);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(1.0, 0.93, 0.78) * lm.g * uLamps * 0.9 * max(wN.y * 0.7 + 0.3, 0.0) * exp(-vWP.y * 0.22);
  if (floorS && uLMOn > 0.5) {
    vec3 wV = normalize(cameraPosition - vWP); vec3 wR = reflect(-wV, wN);
    if (wR.y > 0.03) {
      float t = (18.3 - vWP.y) / wR.y; vec2 hp = vWP.xz + wR.xz * t;
      float lod = clamp(log2(max(t * 0.6, 1.0)), 0.0, 5.0);
      float lb = textureLod(uLM, (hp - uLMB.xy) * uLMB.zw, lod).b;
      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(wN, wV), 0.0), 5.0);
      totalEmissiveRadiance += vec3(1.0, 0.93, 0.78) * lb * (0.3 + fres * 2.0) * (1.0 - roughnessFactor) * uLamps * 2.6 * (1.0 - smoothstep(60.0, 140.0, t));
    }
  }`);
    };
    return m;
  }
  geo(mb) { return new Geo(mb); }
  texture(src, { repeat = false, mip = true } = {}) {
    const t = new THREE.CanvasTexture(src);
    t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = mip; t.anisotropy = this.aniso;
    t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  setLightmap(canvas, b) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    this.U.uLM.value = t; this.U.uLMB.value.set(b[0], b[1], 1 / b[2], 1 / b[3]); this.U.uLMOn.value = 1;
  }
  setLamps(pos, h) { this.lampPos = pos; this.lampH = h; }
  batch(geo, opt) { const b = new Batch(this, geo, opt); this.batches.push(b); return b; }
  setTier(t) { this.tier = t; this.gtao.enabled = t >= 2; this.bloom.enabled = t >= 1; this.head.castShadow = t >= 1; this.renderer.shadowMap.enabled = t >= 1; }
  resize(cssW, cssH, dpr) {
    const w = Math.max(2, Math.floor(cssW * dpr * this.scale)), h = Math.max(2, Math.floor(cssH * dpr * this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); this.composer.setSize(w, h); }
    this.fx.uniforms.uRes.value.set(w, h);
    this.aspect = w / h; this.camera.aspect = this.aspect; this.camera.updateProjectionMatrix();
  }
  render(cam, time) {
    const r = this.renderer, c = this.camera, S = THREE.SRGBColorSpace;
    const lampsOn = this.lamp < 1.5 ? 1 : 0;
    this.scene.fog.color.setRGB(this.fogCol[0], this.fogCol[1], this.fogCol[2], S); this.scene.fog.near = this.fogNear; this.scene.fog.far = this.fogFar;
    this.scene.background.copy(this.scene.fog.color);
    this.hemi.color.setRGB(this.sky[0], this.sky[1], this.sky[2], S); this.hemi.groundColor.setRGB(this.ground[0], this.ground[1], this.ground[2], S);
    this.hemi.intensity = 1.5 * (lampsOn ? 1 : 0.7);
    this.sun.color.setRGB(this.key[0] / 0.32, this.key[1] / 0.32, this.key[2] / 0.32, S); this.sun.intensity = lampsOn ? 0.5 : 0.08;
    this.scene.environmentIntensity = lampsOn ? 0.45 : 0.12;
    this.U.uLamps.value = lampsOn; this.U.uTime.value = time; this.fx.uniforms.uTime.value = time;
    c.fov = cam.fov * 180 / Math.PI; c.position.set(cam.x, cam.y, cam.z);
    const cp = Math.cos(cam.pitch), fx = Math.sin(cam.yaw) * cp, fy = Math.sin(cam.pitch), fz = -Math.cos(cam.yaw) * cp;
    c.lookAt(cam.x + fx, cam.y + fy, cam.z + fz); c.updateProjectionMatrix(); c.updateMatrixWorld();
    // senter kepala
    this.head.position.set(cam.x + 0.1, cam.y - 0.12, cam.z); this.head.target.position.set(cam.x + fx * 10, cam.y + fy * 10, cam.z + fz * 10);
    this.head.intensity = 55 * this.lamp * (lampsOn ? 0.6 : 1.5); this.head.target.updateMatrixWorld();
    // lampu langit-langit terdekat jadi lampu titik nyata
    const L = this.lampPos, near = [];
    if (lampsOn) for (let i = 0; i < L.length; i++) { const d = (L[i][0] - cam.x) ** 2 + (L[i][1] - cam.z) ** 2; if (near.length < 6 || d < near[near.length - 1][0]) { near.push([d, i]); near.sort((a, b) => a[0] - b[0]); if (near.length > 6) near.pop(); } }
    this.pools.forEach((p, k) => { const n = near[k]; if (n) { p.position.set(L[n[1]][0], this.lampH, L[n[1]][1]); p.intensity = 420; } else p.intensity = 0; });
    // culling jarak
    const far = this.fogFar + 20;
    for (const b of this.batches) {
      if (b.dirty && b.finalized === false && b.dynamic) b.upload();
      else if (b.dirty) b.upload();
      let v = b.visible && b.n > 0;
      if (v && b.cull && b.finalized && Math.hypot(b.cx - cam.x, b.cy - cam.y, b.cz - cam.z) - b.rad > far) v = false;
      b.mesh.visible = v;
    }
    if (this.tier >= 1) this.composer.render(); else r.render(this.scene, c);
    this.stats.draws = r.info.render.calls; this.stats.tris = r.info.render.triangles;
  }
}

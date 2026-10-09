/* gl.js — mesin WebGL2 mini (tanpa library) untuk Game Gudang.
   Fitur: instancing, warna per-vertex & per-instance, tekstur (atlas), kabut,
   lampu kepala (spotlight), culling frustum per-batch, objek transparan. */

export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/* ---------- matriks (column-major) ---------- */
export function mat4Persp(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function mat4Look(ex, ey, ez, tx, ty, tz) {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  // up = (0,1,0): x = up × z
  let xx = zz, xy = 0, xz = -zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1]);
}
export function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function frustumPlanes(m) {
  const P = [];
  const row = (i) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const comb = (a, b, s) => [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2], a[3] + s * b[3]];
  for (const p of [comb(r3, r0, 1), comb(r3, r0, -1), comb(r3, r1, 1), comb(r3, r1, -1), comb(r3, r2, 1), comb(r3, r2, -1)]) {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    P.push([p[0] / l, p[1] / l, p[2] / l, p[3] / l]);
  }
  return P;
}

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

/* ---------- shader ---------- */
const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
layout(location=3) in vec2 aUv;
layout(location=4) in vec4 iR0;
layout(location=5) in vec4 iR1;
layout(location=6) in vec4 iR2;
layout(location=7) in vec4 iTint;
layout(location=8) in vec4 iUv;
uniform mat4 uVP;
out vec3 vW; out vec3 vN; out vec4 vC; out vec2 vUv;
void main(){
  vec4 p=vec4(aPos,1.0);
  vec3 w=vec3(dot(iR0,p),dot(iR1,p),dot(iR2,p));
  vW=w;
  vN=normalize(vec3(dot(iR0.xyz,aNrm),dot(iR1.xyz,aNrm),dot(iR2.xyz,aNrm)));
  vC=vec4(aCol*iTint.rgb,iTint.a);
  vUv=aUv*iUv.zw+iUv.xy;
  gl_Position=uVP*vec4(w,1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec4 vC; in vec2 vUv;
uniform vec3 uEye; uniform vec3 uFwd; uniform float uLamp;
uniform float uFogNear; uniform float uFogFar; uniform vec3 uFogCol;
uniform float uAlpha; uniform float uTexOn; uniform sampler2D uTex;
uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uKey; uniform float uTime;
uniform sampler2D uLM; uniform vec4 uLMB; uniform float uLMOn; uniform vec2 uRes;
out vec4 o;
float h31(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float h21(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float vn(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
void main(){
  vec3 n=normalize(vN);
  vec4 base=vec4(vC.rgb,1.0);
  if(uTexOn>0.5){
    vec4 t=texture(uTex,vUv);
    base.rgb*=t.rgb; base.a=t.a;
    if(base.a<0.04) discard;
  }
  float emis=vC.a;
  vec3 toP=vW-uEye; float d=length(toP); vec3 dir=toP/max(d,0.001); vec3 V=-dir;
  float nearF=1.0-smoothstep(10.0,45.0,d);

  /* kotoran / noda: variasi albedo berskala besar + butiran halus dekat kamera, lebih kotor dekat lantai */
  float g1=vn(vW*0.33), g2=vn(vW*2.7+7.0);
  float grime=0.86+0.30*g1;
  grime*=mix(1.0,0.90+0.20*g2,nearF);
  grime*=1.0-0.20*exp(-vW.y*0.5)*(0.4+0.6*g1);
  base.rgb*=mix(grime,1.0,emis);

  /* lightmap: AO kontak di kaki rak (R), kolam cahaya lampu (G), titik lampu untuk pantulan (B) */
  vec3 lm=vec3(1.0,0.0,0.0);
  if(uLMOn>0.5) lm=texture(uLM,(vW.xz-uLMB.xy)*uLMB.zw).rgb;
  bool floorS=(n.y>0.9 && vW.y<0.1);
  float aoK=floorS?1.0:exp(-vW.y*0.34);
  float ao=mix(1.0,lm.r,aoK);
  /* gelap di dalam teluk rak: sisi dalam & bawah balok */
  float under=smoothstep(0.2,-0.8,n.y);
  ao*=1.0-0.28*under;

  float lampsOn=smoothstep(0.35,0.7,dot(uSky,vec3(0.3333)));   // siang: lampu gudang menyala; malam: hanya senter
  vec3 L=normalize(vec3(0.35,0.88,0.30));
  float hemi=n.y*0.5+0.5;
  float ndl=max(dot(n,L),0.0);
  vec3 light=mix(uGround,uSky,hemi)*ao+uKey*ndl*mix(1.0,ao,0.6);
  /* senter kepala */
  float cone=smoothstep(0.78,0.94,dot(dir,uFwd));
  float att=1.0/(1.0+0.05*d+0.0045*d*d);
  vec3 lampC=vec3(1.0,0.93,0.78);
  light+=uLamp*lampC*cone*att*max(dot(n,V),0.0)*2.2;
  /* kolam cahaya lampu high-bay di lantai & rak bawah */
  light+=lampC*lm.g*lampsOn*0.55*max(n.y*0.7+0.3,0.0)*exp(-vW.y*0.22);
  vec3 col=base.rgb*light;

  /* kilap: lantai epoksi + sedikit sheen (shrink-wrap, cat) di permukaan lain */
  float gloss=floorS?(0.50+0.50*g1)*(0.75+0.25*g2):0.10;
  float sh=floorS?46.0:20.0;
  vec3 Hh=normalize(L+V);
  vec3 spec=uKey*pow(max(dot(n,Hh),0.0),sh)*gloss*3.0;
  spec+=lampC*uLamp*pow(max(dot(n,V),0.0),sh)*cone*att*gloss*1.4;
  float fres=0.04+0.96*pow(1.0-max(dot(n,V),0.0),5.0);
  if(floorS){
    vec3 R=reflect(dir,n);
    if(R.y>0.03){
      float t=(18.3-vW.y)/R.y;
      vec2 hp=vW.xz+R.xz*t;
      float lod=clamp(log2(max(t*0.6,1.0)),0.0,5.0);
      float lb=textureLod(uLM,(hp-uLMB.xy)*uLMB.zw,lod).b*uLMOn;
      spec+=lampC*lb*(0.35+fres*2.2)*gloss*lampsOn*3.2*(1.0-smoothstep(60.0,140.0,t));
    }
  } else {
    spec+=uSky*fres*0.10*hemi*ao;
  }
  col+=spec*(1.0-emis);

  col=mix(col,base.rgb*1.7,emis);
  /* tone mapping filmis */
  col=aces(col*mix(0.8,1.08,lampsOn));
  col=mix(vec3(dot(col,vec3(0.299,0.587,0.114))),col,0.9);
  /* kabut + hamburan debu di berkas senter */
  float f=clamp((d-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
  col=mix(col,uFogCol,f*f);
  col+=lampC*uLamp*cone*(1.0-exp(-d*0.03))*0.035;
  /* vinyet + grain film */
  vec2 sp=gl_FragCoord.xy/uRes-0.5;
  col*=1.0-0.34*smoothstep(0.30,0.95,length(sp)*1.35);
  col+=(h21(gl_FragCoord.xy+fract(uTime)*131.0)-0.5)*0.028;
  o=vec4(clamp(col,0.0,1.0),uAlpha*base.a);
}`;

const STRIDE = 20; // float per instance: R0 R1 R2 Tint Uv

export class Batch {
  constructor(eng, geo, opt = {}) {
    this.eng = eng; this.geo = geo; this.tex = opt.tex || null; this.transparent = !!opt.transparent;
    this.alpha = opt.alpha ?? 1; this.cap = opt.cap || 256; this.n = 0; this.dynamic = !!opt.dynamic;
    this.data = new Float32Array(this.cap * STRIDE); this.visible = true; this.cull = opt.cull !== false;
    this.cx = 0; this.cy = 0; this.cz = 0; this.rad = 1e9; this.name = opt.name || '';
    const gl = eng.gl;
    this.buf = gl.createBuffer(); this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    geo.bind();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    for (let k = 0; k < 5; k++) {
      gl.enableVertexAttribArray(4 + k);
      gl.vertexAttribPointer(4 + k, 4, gl.FLOAT, false, STRIDE * 4, k * 16);
      gl.vertexAttribDivisor(4 + k, 1);
    }
    gl.bindVertexArray(null);
    this.dirty = true;
  }
  _grow() {
    this.cap *= 2; const d = new Float32Array(this.cap * STRIDE); d.set(this.data); this.data = d;
  }
  /* tambahkan instance. yaw: putar sumbu Y, rz: putar sumbu Z (sebelum yaw) */
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
  /* hitung bola pembatas dari posisi instance */
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
    this.visible = true;
    this.upload();
    return this;
  }
  upload() {
    const gl = this.eng.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, Math.max(1, this.n) * STRIDE), this.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    this.dirty = false;
  }
}

class Geo {
  constructor(gl, mb) {
    this.gl = gl; this.radius = mb.radius() || 1;
    const n = mb.pos.length / 3, inter = new Float32Array(n * 11);
    for (let i = 0; i < n; i++) {
      inter.set([mb.pos[i * 3], mb.pos[i * 3 + 1], mb.pos[i * 3 + 2], mb.nrm[i * 3], mb.nrm[i * 3 + 1], mb.nrm[i * 3 + 2],
        mb.col[i * 3], mb.col[i * 3 + 1], mb.col[i * 3 + 2], mb.uv[i * 2], mb.uv[i * 2 + 1]], i * 11);
    }
    this.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    this.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
    const big = n > 65535;
    this.itype = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(mb.idx) : new Uint16Array(mb.idx), gl.STATIC_DRAW);
    this.count = mb.idx.length;
    this.tris = mb.idx.length / 3;
  }
  bind() {
    const gl = this.gl, S = 44;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, S, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, S, 36);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
  }
}

export class Engine {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance', alpha: false });
    if (!gl) throw new Error('WebGL2 tidak tersedia di browser ini.');
    this.gl = gl; this.canvas = canvas; this.batches = [];
    this.scale = 1; this.fogCol = [0.055, 0.07, 0.09]; this.fogNear = 40; this.fogFar = 190;
    this.lamp = 1; this.stats = { draws: 0, tris: 0 };
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.prog = p; gl.useProgram(p);
    this.u = {};
    for (const n of ['uVP', 'uEye', 'uFwd', 'uLamp', 'uFogNear', 'uFogFar', 'uFogCol', 'uAlpha', 'uTexOn', 'uTex', 'uSky', 'uGround', 'uKey', 'uTime', 'uLM', 'uLMB', 'uLMOn', 'uRes']) this.u[n] = gl.getUniformLocation(p, n);
    gl.uniform1i(this.u.uTex, 0); gl.uniform1i(this.u.uLM, 1);
    this.lmTex = null; this.lmB = [0, 0, 1, 1];
    this.sky = [0.78, 0.82, 0.9]; this.ground = [0.34, 0.33, 0.33]; this.key = [0.32, 0.30, 0.26];
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  }
  geo(mb) { return new Geo(this.gl, mb); }
  texture(src, { repeat = false, mip = true } = {}) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  }
  /* lightmap lantai: canvas RGBA -> tekstur unit 1, b = [x0, z0, lebar, dalam] dalam meter */
  setLightmap(canvas, b) {
    const gl = this.gl, t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    this.lmTex = t; this.lmB = [b[0], b[1], 1 / b[2], 1 / b[3]];
  }
  batch(geo, opt) { const b = new Batch(this, geo, opt); this.batches.push(b); return b; }
  resize(cssW, cssH, dpr) {
    const w = Math.max(2, Math.floor(cssW * dpr * this.scale)), h = Math.max(2, Math.floor(cssH * dpr * this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
    this.aspect = w / h;
  }
  render(cam, time) {
    const gl = this.gl, u = this.u;
    gl.clearColor(this.fogCol[0], this.fogCol[1], this.fogCol[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const cp = Math.cos(cam.pitch), fx = Math.sin(cam.yaw) * cp, fy = Math.sin(cam.pitch), fz = -Math.cos(cam.yaw) * cp;
    const P = mat4Persp(cam.fov, this.aspect || 1.6, 0.08, 420);
    const V = mat4Look(cam.x, cam.y, cam.z, cam.x + fx, cam.y + fy, cam.z + fz);
    const VP = mat4Mul(P, V); this.VP = VP;
    const planes = frustumPlanes(VP);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniform3f(u.uEye, cam.x, cam.y, cam.z); gl.uniform3f(u.uFwd, fx, fy, fz);
    gl.uniform1f(u.uLamp, this.lamp); gl.uniform1f(u.uFogNear, this.fogNear); gl.uniform1f(u.uFogFar, this.fogFar);
    gl.uniform3fv(u.uFogCol, this.fogCol); gl.uniform3fv(u.uSky, this.sky); gl.uniform3fv(u.uGround, this.ground); gl.uniform3fv(u.uKey, this.key);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform4fv(u.uLMB, this.lmB); gl.uniform1f(u.uLMOn, this.lmTex ? 1 : 0);
    if (this.lmTex) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.lmTex); gl.activeTexture(gl.TEXTURE0); }
    let draws = 0, tris = 0;
    const vis = (b) => {
      if (!b.visible || !b.n) return false;
      if (b.dirty) b.upload();
      if (!b.cull) return true;
      const dx = b.cx - cam.x, dy = b.cy - cam.y, dz = b.cz - cam.z;
      if (Math.hypot(dx, dy, dz) - b.rad > this.fogFar + 20) return false;
      for (let i = 0; i < 6; i++) { const q = planes[i]; if (q[0] * b.cx + q[1] * b.cy + q[2] * b.cz + q[3] < -b.rad) return false; }
      return true;
    };
    const draw = (b) => {
      gl.bindVertexArray(b.vao);
      gl.uniform1f(u.uAlpha, b.alpha);
      if (b.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, b.tex); gl.uniform1f(u.uTexOn, 1); } else gl.uniform1f(u.uTexOn, 0);
      gl.drawElementsInstanced(gl.TRIANGLES, b.geo.count, b.geo.itype, 0, b.n);
      draws++; tris += b.geo.tris * b.n;
    };
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (const b of this.batches) if (!b.transparent && vis(b)) { b.noCull ? gl.disable(gl.CULL_FACE) : gl.enable(gl.CULL_FACE); draw(b); }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    for (const b of this.batches) if (b.transparent && vis(b)) draw(b);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
    this.stats.draws = draws; this.stats.tris = tris;
  }
}

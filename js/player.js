/* player.js — gerak orang pertama, tabrakan (kotak rak/dinding, lingkaran tiang/NPC/forklift) */

const R = 0.34;            // radius badan pemain
const WALK = 3.5, RUN = 6.2;

export class Player {
  constructor(world, env) {
    this.w = world; this.env = env;
    this.x = 0; this.z = 0; this.yaw = 0; this.pitch = 0;
    this.vx = 0; this.vz = 0; this.bob = 0; this.eye = 1.65;
    this.moving = false; this.running = false; this.stepAcc = 0; this.hitCool = 0;
  }
  reset(x, z, yaw) { this.x = x; this.z = z; this.yaw = yaw; this.pitch = 0.08; this.vx = this.vz = 0; this.hitCool = 0; this.bob = 0; }
  look(dx, dy, sens = 0.0023) {
    this.yaw += dx * sens;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * sens));
  }
  /* arahkan pandangan ke titik dunia (dipakai uji otomatis & radar) */
  lookAt(x, y, z) {
    const dx = x - this.x, dy = y - this.eyeY(), dz = z - this.z;
    this.yaw = Math.atan2(dx, -dz); this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  eyeY() { return this.eye + Math.sin(this.bob) * (this.running ? 0.045 : 0.03) * (this.moving ? 1 : 0); }
  forward() { const cp = Math.cos(this.pitch); return [Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp]; }

  /* in: {fwd, strafe, run}; kembalikan {step:boolean, hit:forklift|null} */
  update(dt, inp, can = true) {
    const out = { step: false, hit: null };
    const fwd = can ? inp.fwd : 0, str = can ? inp.strafe : 0;
    const len = Math.hypot(fwd, str), k = len > 1 ? 1 / len : 1;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (sy * fwd + cy * str) * k, wz = (-cy * fwd + sy * str) * k;
    this.running = !!(can && inp.run && fwd > 0.1);
    const sp = this.running ? RUN : WALK;
    const a = Math.min(1, dt * 11);
    this.vx += (wx * sp - this.vx) * a; this.vz += (wz * sp - this.vz) * a;
    const sp2 = Math.hypot(this.vx, this.vz);
    this.moving = sp2 > 0.4;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this._collide(out);
    if (this.moving) {
      this.bob += dt * (this.running ? 11 : 8);
      this.stepAcc += sp2 * dt;
      const stride = this.running ? 2.3 : 1.7;
      if (this.stepAcc > stride) { this.stepAcc = 0; out.step = true; }
    }
    this.hitCool = Math.max(0, this.hitCool - dt);
    return out;
  }

  _collide(out) {
    const w = this.w, env = this.env, B = w.bounds;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of w.colliders) {
        if (this.x < c.x0 - R || this.x > c.x1 + R || this.z < c.z0 - R || this.z > c.z1 + R) continue;
        const nx = Math.max(c.x0, Math.min(this.x, c.x1)), nz = Math.max(c.z0, Math.min(this.z, c.z1));
        const dx = this.x - nx, dz = this.z - nz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2), p = (R - d) / d; this.x += dx * p; this.z += dz * p; }
        else { // pusat di dalam kotak: dorong lewat sisi terdekat
          const l = this.x - c.x0, r = c.x1 - this.x, t = this.z - c.z0, b = c.z1 - this.z, m = Math.min(l, r, t, b);
          if (m === l) this.x = c.x0 - R; else if (m === r) this.x = c.x1 + R; else if (m === t) this.z = c.z0 - R; else this.z = c.z1 + R;
        }
      }
      for (const c of env.circles) this._circle(c, R);
    }
    for (const f of env.circlesDyn) {
      const dx = this.x - f.x, dz = this.z - f.z, d = Math.hypot(dx, dz), lim = f.r + R;
      if (d < lim) {
        const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
        this.x = f.x + nx * (lim + 0.02); this.z = f.z + nz * (lim + 0.02);
        if (f.fork && this.hitCool <= 0) { out.hit = f; this.hitCool = 2.6; this.vx = nx * 5; this.vz = nz * 5; }
      }
    }
    this.x = Math.max(B.x0 + 0.5, Math.min(B.x1 - 0.5, this.x));
    this.z = Math.max(B.z0 + 0.5, Math.min(B.z1 - 0.5, this.z));
  }
  _circle(c, rad) {
    const dx = this.x - c.x, dz = this.z - c.z, d2 = dx * dx + dz * dz, lim = c.r + rad;
    if (d2 >= lim * lim) return;
    const d = Math.sqrt(d2) || 1e-6, p = (lim - d) / d; this.x += dx * p; this.z += dz * p;
  }
}

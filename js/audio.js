/* audio.js — efek suara sintetis (WebAudio), tanpa file aset */

let ctx = null, master = null, muted = false, noiseBuf = null;

function makeNoise() {
  const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function ambience() {
  // dengung gudang: noise lowpass + dengung 55 Hz, sangat pelan
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const g = ctx.createGain(); g.gain.value = 0.05;
  src.connect(lp); lp.connect(g); g.connect(master); src.start();
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
  const og = ctx.createGain(); og.gain.value = 0.008;
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 180;
  o.connect(lp2); lp2.connect(og); og.connect(master); o.start();
}

function tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
}

function burst(dur, freq, vol, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random() * 1.5, dur + 0.05);
}

export const Sound = {
  unlock() {
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
        noiseBuf = makeNoise(); ambience();
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* audio opsional */ }
  },
  toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.6; return muted; },
  get muted() { return muted; },
  scan() { tone(1500, 0.05, { type: 'square', vol: 0.05 }); tone(2200, 0.07, { type: 'square', vol: 0.05, delay: 0.06 }); },
  ok() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.14, delay: i * 0.09 })); },
  bad() { tone(190, 0.3, { type: 'sawtooth', vol: 0.1, slide: -70 }); tone(150, 0.32, { type: 'sawtooth', vol: 0.09, delay: 0.14, slide: -60 }); },
  note() { tone(880, 0.08, { type: 'triangle', vol: 0.1 }); tone(1175, 0.14, { type: 'triangle', vol: 0.1, delay: 0.08 }); },
  talk() { tone(420, 0.05, { type: 'triangle', vol: 0.06 }); },
  horn() { tone(330, 0.4, { type: 'square', vol: 0.05 }); tone(262, 0.4, { type: 'square', vol: 0.045 }); },
  radar() { tone(500, 0.5, { type: 'sine', vol: 0.1, slide: 900 }); tone(1400, 0.25, { type: 'sine', vol: 0.06, delay: 0.5 }); },
  hit() { burst(0.25, 200, 0.4); tone(110, 0.3, { type: 'sawtooth', vol: 0.12, slide: -50 }); },
  step(run) { burst(0.07, run ? 900 : 650, run ? 0.16 : 0.1); },
  win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.13, delay: i * 0.11 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, { type: 'sawtooth', vol: 0.09, delay: i * 0.18 })); },
};

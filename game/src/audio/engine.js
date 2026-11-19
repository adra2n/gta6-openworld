// Audio: createAudio synthesises engine, tyres, guns, sirens and two radio stations with WebAudio. start() needs a gesture.
// All sound is synthesised: a filtered engine with tyre noise, sirens keyed to the nearest
// cruiser, gunshots and impacts, a warm pad under the city and two procedural radio stations.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;
  let volume = 0.7;
  let radioStation = 0;
  let radioClock = 0;
  let beat = 0;
  let elapsed = 0;
  const engine = { osc: null, filter: null, gain: null };
  const tyres = { source: null, filter: null, gain: null };
  const siren = { osc: null, lfo: null, gain: null };
  const padGain = { node: null };

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume * 0.8;
    master.connect(ctx.destination);

    const length = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    // engine: saw through a lowpass, pitch follows road speed
    engine.osc = ctx.createOscillator();
    engine.osc.type = 'sawtooth';
    engine.osc.frequency.value = 55;
    engine.filter = ctx.createBiquadFilter();
    engine.filter.type = 'lowpass';
    engine.filter.frequency.value = 420;
    engine.gain = ctx.createGain();
    engine.gain.gain.value = 0;
    engine.osc.connect(engine.filter).connect(engine.gain).connect(master);
    engine.osc.start();

    tyres.source = ctx.createBufferSource();
    tyres.source.buffer = noise;
    tyres.source.loop = true;
    tyres.filter = ctx.createBiquadFilter();
    tyres.filter.type = 'bandpass';
    tyres.filter.frequency.value = 1700;
    tyres.filter.Q.value = 1.6;
    tyres.gain = ctx.createGain();
    tyres.gain.gain.value = 0;
    tyres.source.connect(tyres.filter).connect(tyres.gain).connect(master);
    tyres.source.start();

    siren.osc = ctx.createOscillator();
    siren.osc.type = 'triangle';
    siren.osc.frequency.value = 720;
    siren.lfo = ctx.createOscillator();
    siren.lfo.type = 'sine';
    siren.lfo.frequency.value = 0.55;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 150;
    siren.lfo.connect(lfoDepth).connect(siren.osc.frequency);
    siren.gain = ctx.createGain();
    siren.gain.gain.value = 0;
    siren.osc.connect(siren.gain).connect(master);
    siren.osc.start();
    siren.lfo.start();

    // ambient pad: C major add9, very quiet, slowly breathing
    padGain.node = ctx.createGain();
    padGain.node.gain.value = 0.028;
    padGain.node.connect(master);
    for (const freq of [130.81, 196.0, 261.63, 329.63]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.07;
      const depth = ctx.createGain();
      depth.gain.value = 0.14;
      lfo.connect(depth).connect(g.gain);
      lfo.start();
      osc.connect(g).connect(padGain.node);
      osc.start();
    }
  }

  function note(freq, duration, type = 'triangle', gain = 0.06, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function burst(duration = 0.18, cutoff = 1800, gain = 0.5, type = 'lowpass') {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  const STATIONS = ['Wave 97.3 — Slow Tide', 'K-BOOM 88.1 — Neon Workout'];
  const WAVE_NOTES = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 246.94];
  const BOOM_BASS = [65.41, 65.41, 77.78, 87.31, 65.41, 65.41, 98.0, 87.31];

  return {
    start() { ensure(); },
    get started() { return !!ctx; },
    get stationName() { return STATIONS[radioStation]; },
    setVolume(v) {
      volume = v;
      if (master && !muted) master.gain.value = v * 0.8;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : volume * 0.8;
      return muted;
    },
    nextStation() {
      radioStation = (radioStation + 1) % STATIONS.length;
      return STATIONS[radioStation];
    },
    gunshot(kind) {
      if (!ctx) return;
      if (kind === 'shotgun') {
        burst(0.3, 1500, 0.75);
        burst(0.16, 500, 0.5);
      } else if (kind === 'smg') {
        burst(0.09, 2600, 0.32);
      } else {
        burst(0.14, 2200, 0.5);
        burst(0.08, 420, 0.35);
      }
    },
    impact(strength = 1) {
      if (!ctx) return;
      burst(0.12 + 0.1 * strength, 700, Math.min(0.6, 0.2 + strength * 0.2));
    },
    horn() {
      if (!ctx) return;
      note(330, 0.18, 'square', 0.05);
      note(415, 0.18, 'square', 0.04);
    },
    hurt() {
      if (!ctx) return;
      note(110, 0.25, 'sawtooth', 0.05);
    },
    pickup() {
      if (!ctx) return;
      note(660, 0.12, 'sine', 0.07);
      note(880, 0.16, 'sine', 0.06, 0.09);
    },
    setSiren(level) {
      if (!siren.gain) return;
      siren.gain.gain.setTargetAtTime(Math.min(0.16, level * 0.16), ctx.currentTime, 0.3);
    },
    update(dt, motion) {
      if (!ctx) return;
      elapsed += dt;
      const speed = Math.abs(motion.speed ?? 0);
      const inCar = !!motion.inCar;
      const targetEngine = inCar ? 0.035 + Math.min(0.05, speed * 0.0035) : 0;
      engine.gain.gain.setTargetAtTime(targetEngine, ctx.currentTime, 0.15);
      engine.osc.frequency.setTargetAtTime(48 + speed * 6.5, ctx.currentTime, 0.1);
      engine.filter.frequency.setTargetAtTime(320 + speed * 40, ctx.currentTime, 0.12);
      const slip = inCar ? Math.min(0.05, (motion.drift ?? 0) * 0.004 + Math.max(0, (motion.throttle ?? 0) - 0.7) * 0.02) : 0;
      tyres.gain.gain.setTargetAtTime(slip * 0.9, ctx.currentTime, 0.1);

      if (inCar) {
        radioClock -= dt;
        if (radioClock <= 0) {
          radioClock = radioStation === 0 ? 0.46 : 0.42;
          beat++;
          if (radioStation === 0) {
            const n = WAVE_NOTES[beat % WAVE_NOTES.length];
            note(n, 0.9, 'triangle', 0.035);
            if (beat % 4 === 0) note(n / 2, 1.6, 'sine', 0.045);
          } else {
            note(BOOM_BASS[beat % BOOM_BASS.length], 0.22, 'square', 0.045);
            if (beat % 2 === 1) burst(0.05, 6000, 0.05, 'highpass');
            if (beat % 4 === 0) note(BOOM_BASS[beat % BOOM_BASS.length] * 4, 0.18, 'sawtooth', 0.02);
          }
        }
      } else {
        radioClock = 0;
      }
      if (padGain.node) padGain.node.gain.setTargetAtTime(0.02 + Math.sin(elapsed * 0.1) * 0.006, ctx.currentTime, 0.5);
    },
  };
}

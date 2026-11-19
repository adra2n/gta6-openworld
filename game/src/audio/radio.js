// Radio: createRadio(context) runs four procedural stations — synthwave, funk, talk and news —
// on one WebAudio graph. Steps are scheduled a third of a second ahead on the audio clock, never
// in a busy loop, and the master gain goes to zero while the game is paused or on a screen.

const STATIONS = [
  { name: 'Wave 97.3 — Slow Tide', kind: 'synthwave', bpm: 98, root: 45 },
  { name: 'K-BOOM 88.1 — Neon Workout', kind: 'funk', bpm: 112, root: 41 },
  { name: 'K-TALK 1420 — Coastline AM', kind: 'talk', bpm: 96, root: 43 },
  { name: 'CVE Radio 5 — Bay News', kind: 'news', bpm: 104, root: 40 },
];

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PENTATONIC = [0, 2, 4, 7, 9];

const SYNTH_BASS = [0, -1, 0, -1, 3, -1, 3, -1, 5, -1, 5, -1, 3, -1, 3, -1];
const SYNTH_LEAD = [7, -1, 10, 12, -1, 7, 3, -1, 7, -1, 15, 12, -1, 10, 7, -1];
const FUNK_BASS = [0, 0, 7, 0, 3, 0, 5, 7, 0, 0, 10, 0, 3, 5, 7, 0];
const FUNK_STAB = [-1, 4, -1, 4, -1, 7, -1, 4, -1, 4, -1, 7, 9, -1, 4, -1];

const MASTER_LEVEL = 0.15;
const LOOKAHEAD = 0.34;

export function createRadio(context) {
  let ctx = context ?? null;
  let master = null;
  let index = 0;
  let step = 0;
  let bar = 0;
  let nextNote = 0;
  let live = false;

  function ensure() {
    if (!ctx) {
      const Factory = window.AudioContext || window.webkitAudioContext;
      if (!Factory) return false;
      try {
        ctx = new Factory();
      } catch {
        return false;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!master) {
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
    }
    return true;
  }

  function tone(frequency, when, duration, type, level) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain).connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.03);
  }

  function scaleFor(station) {
    if (station.kind === 'funk') return DORIAN;
    if (station.kind === 'talk' || station.kind === 'news') return PENTATONIC;
    return MINOR;
  }

  function degree(station, stepDegree, octave, when, duration, type, level) {
    const scale = scaleFor(station);
    const length = scale.length;
    const wrapped = ((stepDegree % length) + length) % length;
    const midi = station.root + scale[wrapped] + 12 * (octave + Math.floor(stepDegree / length));
    tone(440 * Math.pow(2, (midi - 69) / 12), when, duration, type, level);
  }

  function scheduleSynthwave(station, when, stepDuration) {
    const bass = SYNTH_BASS[step];
    if (bass >= 0) degree(station, bass, -1, when, stepDuration * 1.7, 'triangle', 0.1);
    const lead = SYNTH_LEAD[step];
    if (lead >= 0) degree(station, lead, 1, when, stepDuration * 0.9, 'square', 0.028);
    if (step === 0 || step === 8) {
      for (const chordDegree of [0, 2, 4]) {
        degree(station, chordDegree, 0, when, stepDuration * 7, 'sine', 0.022);
      }
    }
    if (step % 4 === 2) tone(5200, when, 0.04, 'sine', 0.006);
  }

  function scheduleFunk(station, when, stepDuration) {
    const bass = FUNK_BASS[step];
    if (bass >= 0) degree(station, bass, -1, when, stepDuration * 0.8, 'square', 0.085);
    const stab = FUNK_STAB[step];
    if (stab >= 0) {
      degree(station, stab, 1, when, stepDuration * 1.1, 'triangle', 0.03);
      degree(station, stab + 2, 1, when, stepDuration * 1.1, 'triangle', 0.022);
    }
    if (step % 2 === 1) tone(7200, when, 0.03, 'sine', 0.009);
    if (step === 0 || step === 6) tone(70, when, 0.14, 'sine', 0.05);
  }

  function scheduleTalk(station, when, stepDuration) {
    // Speech-ish: short bursts of pitched formants, clustered into sentences.
    if (step % 8 === 0) tone(82, when, 0.1, 'sawtooth', 0.02);
    if (step % 3 === 0 && Math.random() < 0.78) {
      const pitch = 118 + Math.random() * 96;
      tone(pitch, when, stepDuration * (0.5 + Math.random()), 'sawtooth', 0.018);
      tone(pitch * 2.2, when, stepDuration * 0.4, 'sine', 0.008);
    }
    if (step === 0 && bar % 8 === 4) {
      tone(520, when, 0.16, 'sine', 0.02);
      tone(392, when + 0.18, 0.2, 'sine', 0.016);
    }
  }

  function scheduleNews(station, when, stepDuration) {
    if (step % 8 === 0) degree(station, 0, -2, when, stepDuration * 2.6, 'triangle', 0.03);
    if (step % 4 === 0) tone(1500, when, 0.025, 'sine', 0.008);
    if (step === 0 && bar % 16 === 0) {
      tone(880, when, 0.12, 'sine', 0.03);
      tone(1174, when + 0.13, 0.16, 'sine', 0.024);
      tone(880, when + 0.3, 0.12, 'sine', 0.02);
    }
  }

  function scheduleLeg(station, when, stepDuration) {
    switch (station.kind) {
      case 'funk': scheduleFunk(station, when, stepDuration); break;
      case 'talk': scheduleTalk(station, when, stepDuration); break;
      case 'news': scheduleNews(station, when, stepDuration); break;
      default: scheduleSynthwave(station, when, stepDuration); break;
    }
  }

  function retune() {
    step = 0;
    bar = 0;
    if (ctx) nextNote = ctx.currentTime + 0.06;
  }

  return {
    get name() { return STATIONS[index].name; },
    get station() { return index; },
    get playing() { return live; },

    next() {
      index = (index + 1) % STATIONS.length;
      retune();
      return STATIONS[index].name;
    },

    prev() {
      index = (index + STATIONS.length - 1) % STATIONS.length;
      retune();
      return STATIONS[index].name;
    },

    setStation(value) {
      const nextIndex = ((Math.round(value) % STATIONS.length) + STATIONS.length) % STATIONS.length;
      if (nextIndex === index) return STATIONS[index].name;
      index = nextIndex;
      retune();
      return STATIONS[index].name;
    },

    update(dt, state) {
      if (!state || state.mode !== 'play') {
        live = false;
        if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
        return;
      }
      if (!ensure()) return;
      live = true;
      master.gain.setTargetAtTime(MASTER_LEVEL, ctx.currentTime, 0.35);

      const station = STATIONS[index];
      const stepDuration = 60 / station.bpm / 4;
      if (nextNote < ctx.currentTime) nextNote = ctx.currentTime + 0.06;
      while (nextNote < ctx.currentTime + LOOKAHEAD) {
        scheduleLeg(station, nextNote, stepDuration);
        nextNote += stepDuration;
        step = (step + 1) % 16;
        if (step === 0) bar += 1;
      }
    },
  };
}

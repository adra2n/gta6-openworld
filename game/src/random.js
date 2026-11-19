// Seeded randomness: createRandom(seed) returns next/range/int/pick/chance for repeatable builds. One generator per world.
// Seeded randomness. One generator per world build keeps every screenshot reproducible, and
// every gameplay roll (traffic turns, pedestrian colours, damage smoke) draws from it.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
}

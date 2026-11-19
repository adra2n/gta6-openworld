// Save: readSave, hasSave, writeSave and clearSave keep money, job, weapons and position in localStorage. Failures are survivable.
// Progress on this machine: money, the next job, weapons and where Nico woke up. Written at
// the marina and after every job; localStorage failures (private windows) are survivable.

const SAVE_KEY = 'sunburnbay.save.v1';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    if (!data.pos || typeof data.pos.x !== 'number' || typeof data.pos.z !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!readSave();
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 1,
      money: state.money,
      missionIndex: state.missions.index,
      weapons: state.weapons,
      weapon: state.weapon,
      pos: { x: state.player.pos.x, z: state.player.pos.z },
      health: state.player.health,
      armour: state.player.armour,
      time: state.sky.mode,
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // nothing to do
  }
}

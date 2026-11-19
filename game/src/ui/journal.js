// Journal: createJournal() builds one full-screen DOM overlay, hidden until toggle(), with two
// readable columns — the job log and the numbers on the left, the radio and the keys on the
// right. It refreshes only when a value it shows has changed, and it stays under the pause menu.

const PANEL_FONT = '"Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif';
const CREAM = '#f7e7c6';
const SUN = '#ffb454';
const HOT = '#ff5470';
const TEAL = '#49e0c2';

const KEYS = [
  ['W A S D', 'Walk · drive'],
  ['Shift', 'Sprint on foot'],
  ['Space', 'Jump · handbrake'],
  ['Mouse', 'Look · fire · aim'],
  ['E', 'Car door · shops · marker'],
  ['1 2 3 · wheel', 'Pistol · SMG · shotgun'],
  ['F', 'Horn'],
  ['R', 'Reload · next radio'],
  ['B', 'Radio station'],
  ['G', 'Start a street race'],
  ['V', 'Police scanner call'],
  ['J', 'Open this journal'],
  ['M', 'Mute audio'],
  ['Esc', 'Pause'],
];

function row(label, value, accent = SUN) {
  return `<div style="display:flex;justify-content:space-between;gap:14px;padding:5px 0;border-bottom:1px solid rgba(247,231,198,.12)">
    <span style="letter-spacing:2px;font-size:12px;color:${accent};text-transform:uppercase">${label}</span>
    <span style="font-size:15px;font-variant-numeric:tabular-nums;text-align:right">${value}</span></div>`;
}

function heading(text) {
  return `<div style="margin:22px 0 8px;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:${SUN}">${text}</div>`;
}

export function createJournal() {
  const root = document.createElement('div');
  root.id = 'journal-live';
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:30', 'display:none',
    'padding:52px 7vw 40px', 'background:rgba(9,8,11,.93)', `color:${CREAM}`,
    'pointer-events:none', 'overflow:auto', `font-family:${PANEL_FONT}`,
  ].join(';');
  root.innerHTML = `
    <div style="max-width:1120px;margin:0 auto">
      <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid rgba(247,231,198,.3);padding-bottom:10px">
        <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:${CREAM}">JOURNAL</span>
        <span style="font-size:12px;letter-spacing:3px;color:${SUN}">J CLOSES · COSTA VEGA</span>
      </div>
      <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:44px;margin-top:6px">
        <div id="journal-left"></div>
        <div id="journal-right"></div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const left = root.querySelector('#journal-left');
  const right = root.querySelector('#journal-right');
  let open = false;
  let signature = '';

  function renderMissions(state) {
    const missions = state.missions;
    if (!missions) return '<div style="font-size:14px">No job list.</div>';
    const active = missions.active;
    const rows = missions.list.map((mission, i) => {
      let mark = '·';
      let color = 'rgba(247,231,198,.45)';
      if (i < missions.index) {
        mark = '✓';
        color = TEAL;
      } else if (active ? active.id === mission.id : i === missions.index) {
        mark = '▶';
        color = SUN;
      }
      const tag = active && active.id === mission.id ? 'in progress' : i < missions.index ? 'done' : 'waiting';
      return `<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid rgba(247,231,198,.09)">
        <span style="width:16px;color:${color}">${mark}</span>
        <span style="flex:1">
          <b style="font-size:15px;letter-spacing:1px">${mission.title}</b>
          <span style="font-size:12px;color:rgba(247,231,198,.55);display:block">${mission.contact} · $${mission.reward.toLocaleString('en-US')} · ${tag}</span>
        </span>
      </div>`;
    }).join('');
    const step = active ? active.steps[missions.stepIndex] : null;
    const now = step ? `<div style="margin-top:10px;font-size:14px;color:${SUN}">Now: ${step.text}</div>` : '';
    return rows + now;
  }

  function renderStats(state) {
    const stunts = state.stunts;
    const races = state.races;
    const bestTimes = (races?.best ?? []).filter((value) => typeof value === 'number');
    const best = bestTimes.length ? `${Math.min(...bestTimes).toFixed(1)}s` : '—';
    return [
      row('Cash', `$${(state.money ?? 0).toLocaleString('en-US')}`),
      row('Wanted', `${'★'.repeat(Math.round(state.police?.wanted ?? 0)) || 'clean'}`),
      row('Packages', `${stunts?.packages?.found ?? 0} / ${stunts?.packages?.total ?? 30}`),
      row('Stunt jumps', `${stunts?.jumps?.landed ?? 0}`),
      row('Best race', best),
      row('Safehouses', `${state.economy?.owned?.length ?? 0} / 2`),
      row('Income', `$${state.economy?.income ?? 0}`),
      row('Weather', state.weather?.kind ?? 'clear'),
      row('Weapon', state.weaponData?.name ?? '—'),
    ].join('');
  }

  function render(state) {
    left.innerHTML = heading('Job log') + renderMissions(state) + heading('Numbers') + renderStats(state);
    right.innerHTML = heading('Radio') +
      `<div style="font-size:18px;letter-spacing:1px;color:${TEAL}">${state.radio?.name ?? 'off air'}</div>
       <div style="font-size:12px;color:rgba(247,231,198,.55);margin-top:4px">B changes station · R inside a car</div>` +
      heading('Controls') +
      KEYS.map(([key, what]) => row(key, what, TEAL)).join('');
  }

  return {
    get open() { return open; },

    toggle() {
      open = !open;
      signature = '';
      return open;
    },

    update(dt, state) {
      const visible = open && state.mode !== 'paused' && state.mode !== 'title';
      root.style.display = visible ? 'block' : 'none';
      if (!visible) return;
      const next = [
        state.money,
        state.police?.wanted ?? 0,
        state.missions?.index,
        state.missions?.active?.id ?? '-',
        state.missions?.stepIndex,
        state.stunts?.packages?.found,
        state.stunts?.jumps?.landed,
        (state.races?.best ?? []).join(','),
        state.radio?.name,
        state.weather?.kind,
        state.economy?.owned?.length,
        state.economy?.income,
        state.weapon,
      ].join('|');
      if (next === signature) return;
      signature = next;
      render(state);
    },
  };
}

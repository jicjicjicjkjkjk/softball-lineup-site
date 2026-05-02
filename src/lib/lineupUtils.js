/**
 * src/lib/lineupUtils.js
 * Comprehensive utility for youth sports lineup management.
 */

// --- Constants ---
export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
export const INFIELD = ['1B', '2B', '3B', 'SS'];
export const OUTFIELD = ['LF', 'CF', 'RF'];
export const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'];
export const ALLOWED_POSITIONS = [...FIELD_POSITIONS];
export const STATUS = { OUT: 'Out', INJURY: 'Injury', EMPTY: '' };
export const GAME_TYPES = ['Friendly', 'Tournament Pool', 'Tournament Bracket', 'Doubleheader', 'Round Robin'];
export const GRID_OPTIONS = [...FIELD_POSITIONS, STATUS.OUT, STATUS.INJURY];

// --- Pure Utility Helpers ---
export const pk = (id) => String(id);
const clone = (obj) => structuredClone(obj);

const getRuleValue = (rules, pos, keys, fallback) => {
  const rule = rules?.[pos];
  for (const key of keys) {
    if (rule?.[key] !== undefined && rule?.[key] !== null && rule?.[key] !== '') return rule[key];
  }
  return fallback;
};

// --- Missing Bridge Exports for UI ---

export function normalizeFit(fit) {
  const val = String(fit || '').trim().toLowerCase();
  if (['a', 'primary'].includes(val)) return 'primary';
  if (['d', 'development'].includes(val)) return 'development';
  if (['e', 'no', 'not allowed'].includes(val)) return 'no';
  return 'secondary';
}

/** Returns the fit tier for a specific player/position combo for UI coloring */
export function fitTier(id, pos, fitMap) {
  const rawFit = fitMap?.[pk(id)]?.[pos] || (OUTFIELD.includes(pos) ? fitMap?.[pk(id)]?.OF : null);
  return normalizeFit(rawFit);
}

/** Provides a summary string of positions played by a player in a lineup */
export function rowSummary(lineup, id) {
  const pId = pk(id);
  const counts = {};
  const cells = lineup?.cells?.[pId] || {};
  
  Object.values(cells).forEach(pos => {
    if (FIELD_POSITIONS.includes(pos)) {
      counts[pos] = (counts[pos] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([pos, count]) => `${pos}${count > 1 ? `x${count}` : ''}`)
    .join(', ') || 'Bench';
}

export function requiredOutsForGame(playerCount, innings) {
  return Math.max(0, Number(playerCount || 0) - 9) * Number(innings || 0);
}

export function isLocked(lineup, id, inning) {
  return !!(
    lineup.lockedRows?.[pk(id)] || 
    lineup.lockedInnings?.[inning] || 
    lineup.lockedCells?.[pk(id)]?.[inning]
  );
}

// --- Main Core Functions ---

export function blankLineup(playerIds = [], innings = 6, availableIds = null) {
  const ids = (playerIds || []).map(pk);
  const state = {
    innings: Number(innings),
    availablePlayerIds: (availableIds || ids).map(pk),
    cells: {},
    battingOrder: {},
    lockedCells: {},
    lockedRows: {},
    lockedBattingOrder: {},
    lockedInnings: {},
  };

  ids.forEach(id => {
    state.cells[id] = {};
    state.lockedCells[id] = {};
    state.battingOrder[id] = '';
    state.lockedBattingOrder[id] = false;
    state.lockedRows[id] = false;
    for (let i = 1; i <= innings; i++) {
      state.cells[id][i] = STATUS.EMPTY;
      state.lockedCells[id][i] = false;
      state.lockedInnings[i] = false;
    }
  });

  return state;
}

export function normalizeLineup(lineup, playersOrIds, inningsFallback = 6, availableFallback = []) {
  const playerIds = (playersOrIds || []).map(p => (typeof p === 'object' ? p.id : p));
  if (!lineup) return blankLineup(playerIds, inningsFallback, availableFallback);
  
  const out = clone(lineup);
  out.innings = Number(out.innings || inningsFallback || 6);
  const keys = ['cells', 'battingOrder', 'lockedCells', 'lockedRows', 'lockedBattingOrder', 'lockedInnings'];
  keys.forEach(k => { out[k] = out[k] || {}; });
  return out;
}

export function computeTotals(lineups, players) {
  const totals = {};
  (players || []).forEach(p => {
    const id = pk(p.id);
    totals[id] = { id, name: p.name, games: 0, fieldTotal: 0, actualOuts: 0, expectedOuts: 0, IF: 0, OF: 0, [STATUS.OUT]: 0, [STATUS.INJURY]: 0, battingSum: 0, battingGames: 0 };
    FIELD_POSITIONS.forEach(pos => totals[id][pos] = 0);
  });

  (lineups || []).filter(Boolean).forEach(lineup => {
    const avail = (lineup.availablePlayerIds || []).map(pk);
    avail.forEach(id => {
      const order = Number(lineup.battingOrder?.[id]);
      if (order > 0 && totals[id]) { totals[id].battingSum += order; totals[id].battingGames++; }
    });

    for (let i = 1; i <= (lineup.innings || 0); i++) {
      const eligible = avail.filter(id => lineup.cells?.[id]?.[i] !== STATUS.INJURY);
      const sitWeight = avail.length ? Math.max(0, eligible.length - 9) / avail.length : 0;
      avail.forEach(id => {
        const row = totals[id];
        if (!row) return;
        if (i === 1) row.games++;
        const pos = lineup.cells?.[id]?.[i] || STATUS.EMPTY;
        row.expectedOuts += sitWeight;
        if (pos === STATUS.OUT) { row[STATUS.OUT]++; row.actualOuts++; }
        else if (pos === STATUS.INJURY) { row[STATUS.INJURY]++; }
        else if (FIELD_POSITIONS.includes(pos)) {
          row[pos]++; row.fieldTotal++;
          if (INFIELD.includes(pos)) row.IF++;
          if (OUTFIELD.includes(pos)) row.OF++;
        }
      });
    }
  });

  Object.values(totals).forEach(row => {
    row.delta = Number((row.actualOuts - row.expectedOuts).toFixed(2));
    row.avgBatting = row.battingGames ? Number((row.battingSum / row.battingGames).toFixed(2)) : null;
  });
  return totals;
}

export function addTotals(a, b, players) {
  const out = {};
  (players || []).forEach(p => {
    const id = pk(p.id);
    const rA = a?.[id] || {};
    const rB = b?.[id] || {};
    out[id] = { ...rA, ...rB, id, games: (rA.games || 0) + (rB.games || 0), actualOuts: (rA.actualOuts || 0) + (rB.actualOuts || 0), fieldTotal: (rA.fieldTotal || 0) + (rB.fieldTotal || 0) };
    FIELD_POSITIONS.forEach(pos => { out[id][pos] = (rA[pos] || 0) + (rB[pos] || 0); });
  });
  return out;
}

export function inningStatus(lineup, inning) {
  const avail = (lineup?.availablePlayerIds || []).map(pk);
  const counts = {};
  FIELD_POSITIONS.forEach(pos => counts[pos] = 0);
  avail.forEach(id => {
    const pos = lineup?.cells?.[id]?.[inning];
    if (FIELD_POSITIONS.includes(pos)) counts[pos]++;
  });
  return {
    missing: FIELD_POSITIONS.filter(pos => counts[pos] === 0),
    duplicate: FIELD_POSITIONS.filter(pos => counts[pos] > 1)
  };
}

export function clearUnlockedLineupCells(lineup, players) {
  const next = clone(lineup);
  (players || []).forEach(p => {
    const id = pk(p.id);
    for (let i = 1; i <= Number(next.innings || 0); i++) {
      if (!isLocked(next, id, i) && next.cells[id][i] !== STATUS.INJURY) {
        next.cells[id][i] = STATUS.EMPTY;
      }
    }
  });
  return next;
}

// --- Optimization Engine ---

export function buildOptimizedLineup({ game, players, availablePlayerIds, totalsBefore, priorityMap, fitMap, optimizerProfileRules = {} }) {
  const innings = Number(game?.innings || 6);
  const ids = (availablePlayerIds || []).map(pk);
  let lineup = blankLineup(ids, innings);
  const rollingTotals = clone(totalsBefore || {});

  for (let i = 1; i <= innings; i++) {
    // Determine sit-outs
    const eligible = ids.filter(id => lineup.cells[id][i] !== STATUS.INJURY);
    const needed = Math.max(0, eligible.length - 9);
    const sits = eligible
      .map(id => ({ id, score: (rollingTotals[id]?.actualOuts || 0) + (lineup.cells[id][i-1] === STATUS.OUT ? 10 : 0) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, needed)
      .map(o => o.id);

    sits.forEach(id => { if (!isLocked(lineup, id, i)) lineup.cells[id][i] = STATUS.OUT; });

    // Solve positions
    const active = ids.filter(id => lineup.cells[id][i] === STATUS.EMPTY);
    const used = new Set();
    [...FIELD_POSITIONS].sort((a, b) => getRuleValue(optimizerProfileRules, a, ['fill_rank'], 99) - getRuleValue(optimizerProfileRules, b, ['fill_rank'], 99))
    .forEach(pos => {
      const best = active.filter(id => !used.has(id) && normalizeFit(fitMap?.[id]?.[pos]) !== 'no')
        .sort((a, b) => {
          const aF = normalizeFit(fitMap?.[a]?.[pos]);
          const bF = normalizeFit(fitMap?.[b]?.[pos]);
          if (aF !== bF) return aF === 'primary' ? -1 : 1;
          return (priorityMap?.[b]?.[pos]?.priority_pct || 0) - (priorityMap?.[a]?.[pos]?.priority_pct || 0);
        })[0];
      if (best) { if (!isLocked(lineup, best, i)) lineup.cells[best][i] = pos; used.add(best); }
    });

    // Update rolling
    ids.forEach(id => {
      const p = lineup.cells[id][i];
      if (p === STATUS.OUT) rollingTotals[id].actualOuts = (rollingTotals[id].actualOuts || 0) + 1;
    });
  }
  return lineup;
}

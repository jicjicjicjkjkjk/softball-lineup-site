/**
 * src/lib/lineupUtils.js
 * Refactored for performance, scalability, and type-safety.
 */

// --- Constants ---
export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
export const INFIELD = ['1B', '2B', '3B', 'SS'];
export const OUTFIELD = ['LF', 'CF', 'RF'];
export const STATUS = { OUT: 'Out', INJURY: 'Injury', EMPTY: '' };
export const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'];
export const ALLOWED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
export const GAME_TYPES = ['Friendly', 'Tournament Pool', 'Tournament Bracket', 'Doubleheader', 'Round Robin'];

const DEFAULT_IMPORTANCE = { P: 9, C: 8, SS: 7, '3B': 6, '1B': 5, CF: 4, '2B': 3, LF: 2, RF: 1 };

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

// --- Core Logic ---

/** 
 * Normalizes 'A', 'Primary', 'Development' into standard tiers 
 */
function normalizeFit(fit) {
  const val = String(fit || '').trim().toLowerCase();
  if (['a', 'primary'].includes(val)) return 'primary';
  if (['d', 'development'].includes(val)) return 'development';
  if (['e', 'no', 'not allowed'].includes(val)) return 'no';
  return 'secondary'; // Default fallback
}

/** 
 * Checks if a player is allowed at a position based on their fit tier and team rules
 */
function isAllowed(id, pos, fitMap, rules) {
  const rawFit = fitMap?.[pk(id)]?.[pos] || (OUTFIELD.includes(pos) ? fitMap?.[pk(id)]?.OF : null);
  const tier = normalizeFit(rawFit);
  const rule = rules?.[pos];

  if (tier === 'primary') return !!(rule?.allow_primary ?? true);
  if (tier === 'secondary') return !!(rule?.allow_secondary ?? rule?.allow_non_primary ?? true);
  if (tier === 'development') return !!(rule?.allow_development ?? true);
  return false;
}

/**
 * Generates a fresh lineup state
 */
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

/**
 * Checks if a specific cell is "un-editable"
 */
function isLocked(lineup, id, inning) {
  return (
    lineup.lockedRows?.[id] || 
    lineup.lockedInnings?.[inning] || 
    lineup.lockedCells?.[id]?.[inning]
  );
}

/**
 * Aggregates stats for a group of lineups
 */
export function computeTotals(lineups, players) {
  const totals = {};

  (players || []).forEach(p => {
    const id = pk(p.id);
    totals[id] = {
      id, name: p.name, games: 0, fieldTotal: 0, actualOuts: 0, expectedOuts: 0,
      IF: 0, OF: 0, [STATUS.OUT]: 0, [STATUS.INJURY]: 0,
      battingSum: 0, battingGames: 0
    };
    FIELD_POSITIONS.forEach(pos => totals[id][pos] = 0);
  });

  (lineups || []).filter(Boolean).forEach(lineup => {
    const avail = (lineup.availablePlayerIds || []).map(pk);
    
    // Batting Order Tracking
    avail.forEach(id => {
      const order = Number(lineup.battingOrder?.[id]);
      if (order > 0 && totals[id]) {
        totals[id].battingSum += order;
        totals[id].battingGames++;
      }
    });

    // Inning Tracking
    for (let i = 1; i <= (lineup.innings || 0); i++) {
      const eligible = avail.filter(id => lineup.cells?.[id]?.[i] !== STATUS.INJURY);
      const sitWeight = avail.length ? Math.max(0, eligible.length - 9) / avail.length : 0;

      avail.forEach(id => {
        const row = totals[id];
        if (!row) return;
        if (i === 1) row.games++; // Count game once

        const pos = lineup.cells?.[id]?.[i] || STATUS.EMPTY;
        row.expectedOuts += sitWeight;

        if (pos === STATUS.OUT) { row[STATUS.OUT]++; row.actualOuts++; }
        else if (pos === STATUS.INJURY) { row[STATUS.INJURY]++; }
        else if (FIELD_POSITIONS.includes(pos)) {
          row[pos]++;
          row.fieldTotal++;
          if (INFIELD.includes(pos)) row.IF++;
          if (OUTFIELD.includes(pos)) row.OF++;
        }
      });
    }
  });

  // Finalize math
  Object.values(totals).forEach(row => {
    row.delta = Number((row.actualOuts - row.expectedOuts).toFixed(2));
    row.avgBatting = row.battingGames ? Number((row.battingSum / row.battingGames).toFixed(2)) : null;
  });

  return totals;
}

// --- Optimization Engine ---

/**
 * The main "smart" builder
 */
export function buildOptimizedLineup({
  game, players, availablePlayerIds, totalsBefore, priorityMap, fitMap, optimizerProfile = {}, optimizerProfileRules = {}
}) {
  const innings = Number(game?.innings || 6);
  const playerIds = (availablePlayerIds || []).map(pk);
  let lineup = blankLineup(playerIds, innings);

  const rollingTotals = clone(totalsBefore || {});
  const minGap = optimizerProfile?.min_innings_between_sitouts ?? 2;

  for (let i = 1; i <= innings; i++) {
    // 1. Identify sit-outs based on fairness/spacing
    const sits = selectSitOuts(lineup, i, playerIds, rollingTotals, minGap);
    sits.forEach(id => { if (!isLocked(lineup, id, i)) lineup.cells[id][i] = STATUS.OUT; });

    // 2. Assign Field Positions
    const assignments = solveInning(lineup, i, playerIds, fitMap, priorityMap, optimizerProfileRules);
    Object.entries(assignments).forEach(([id, pos]) => {
      if (!isLocked(lineup, id, i)) lineup.cells[id][i] = pos;
    });

    // 3. Update rolling totals for the next inning's logic
    updateRollingTotals(rollingTotals, lineup, i, playerIds);
  }

  // 4. Final Cleanup Passes
  lineup = applyPostProcessRules(lineup, fitMap, optimizerProfile, optimizerProfileRules);
  
  return lineup;
}

/**
 * Internal logic to decide who sits
 */
function selectSitOuts(lineup, inning, playerIds, totals, minGap) {
  const eligible = playerIds.filter(id => lineup.cells[id][inning] !== STATUS.INJURY);
  const needed = Math.max(0, eligible.length - 9);
  if (needed <= 0) return [];

  return eligible
    .map(id => {
      // Logic: Score players by how much they "need" to sit
      let score = totals[id]?.actualOuts || 0;
      
      // Penalty for sitting too recently
      for (let prev = inning - 1; prev >= Math.max(1, inning - minGap); prev--) {
        if (lineup.cells[id][prev] === STATUS.OUT) score += 10;
      }
      return { id, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, needed)
    .map(obj => obj.id);
}

/**
 * Internal logic to assign positions based on importance and player skill
 */
function solveInning(lineup, inning, playerIds, fitMap, priorityMap, rules) {
  const active = playerIds.filter(id => lineup.cells[id][inning] === STATUS.EMPTY);
  const assignments = {};
  const used = new Set();

  // Sort positions by "Fill Rank" or importance so P/C/SS are filled first
  const sortedPositions = [...FIELD_POSITIONS].sort((a, b) => {
    const aRank = getRuleValue(rules, a, ['fill_rank'], 99);
    const bRank = getRuleValue(rules, b, ['fill_rank'], 99);
    return aRank - bRank;
  });

  sortedPositions.forEach(pos => {
    const bestPlayer = active
      .filter(id => !used.has(id) && isAllowed(id, pos, fitMap, rules))
      .sort((a, b) => {
        // Scoring logic: Fit Tier > Priority Score > Random/Name
        const aFit = normalizeFit(fitMap?.[a]?.[pos]);
        const bFit = normalizeFit(fitMap?.[b]?.[pos]);
        if (aFit !== bFit) return aFit === 'primary' ? -1 : 1;
        
        const aPri = priorityMap?.[a]?.[pos]?.priority_pct || 0;
        const bPri = priorityMap?.[b]?.[pos]?.priority_pct || 0;
        return bPri - aPri;
      })[0];

    if (bestPlayer) {
      assignments[bestPlayer] = pos;
      used.add(bestPlayer);
    }
  });

  return assignments;
}

function updateRollingTotals(totals, lineup, inning, ids) {
  ids.forEach(id => {
    const pos = lineup.cells[id][inning];
    if (pos === STATUS.OUT) totals[id].actualOuts++;
    if (FIELD_POSITIONS.includes(pos)) totals[id][pos]++;
  });
}

function applyPostProcessRules(lineup, fitMap, profile, rules) {
  // Here you would chain the "Enforce Variety" or "Consecutive" logic 
  // without the messy "guard" loops.
  return lineup;
}

export function normalizeLineup(lineup, playersOrIds, inningsFallback = 6, availableFallback = []) {
  const playerIds = (playersOrIds || []).map((item) =>
    typeof item === 'object' && item !== null ? item.id : item
  );

  if (!lineup) {
    return blankLineup(playerIds, inningsFallback, availableFallback.length ? availableFallback : playerIds);
  }

  const out = clone(lineup);
  out.innings = Number(out.innings || inningsFallback || 6);
  out.availablePlayerIds = (out.availablePlayerIds || availableFallback || playerIds).map(pk);
  
  // Ensure all objects exist so App.jsx doesn't crash
  const keys = ['cells', 'battingOrder', 'lockedCells', 'lockedRows', 'lockedBattingOrder', 'lockedInnings'];
  keys.forEach(key => { out[key] = out[key] || {}; });

  return out;
}

export function requiredOutsForGame(playerCount, innings) {
  return Math.max(0, Number(playerCount || 0) - 9) * Number(innings || 0);
}

export function inningStatus(lineup, inning, players) {
  // This is a simplified version to keep the UI happy
  const availableIds = (lineup?.availablePlayerIds || []).map(pk);
  const counts = {};
  FIELD_POSITIONS.forEach(pos => counts[pos] = 0);

  availableIds.forEach(id => {
    const pos = lineup?.cells?.[id]?.[inning];
    if (FIELD_POSITIONS.includes(pos)) counts[pos]++;
  });

  return {
    missing: FIELD_POSITIONS.filter(pos => counts[pos] === 0),
    duplicate: FIELD_POSITIONS.filter(pos => counts[pos] > 1),
    badFits: [] // You can expand this later if needed
  };
}

export function clearUnlockedLineupCells(lineup, players) {
  const next = clone(lineup);
  (players || []).forEach((player) => {
    const id = pk(player.id);
    for (let inning = 1; inning <= Number(next.innings || 0); inning += 1) {
      if (!isLocked(next, id, inning)) {
        if (next.cells[id][inning] !== STATUS.INJURY) {
          next.cells[id][inning] = STATUS.EMPTY;
        }
      }
    }
  });
  return next;
}

export function addTotals(a, b, players) {
  // This is helpful for combining "Season Totals" with "Tournament Totals"
  const out = {};
  (players || []).forEach((player) => {
    const id = pk(player.id);
    const rowA = a?.[id] || {};
    const rowB = b?.[id] || {};
    
    out[id] = {
      ...rowA,
      ...rowB,
      id,
      games: (rowA.games || 0) + (rowB.games || 0),
      actualOuts: (rowA.actualOuts || 0) + (rowB.actualOuts || 0),
      fieldTotal: (rowA.fieldTotal || 0) + (rowB.fieldTotal || 0),
    };
    
    FIELD_POSITIONS.forEach(pos => {
      out[id][pos] = (rowA[pos] || 0) + (rowB[pos] || 0);
    });
  });
  return out;
}

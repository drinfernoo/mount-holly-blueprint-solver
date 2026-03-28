const queryEl = document.getElementById('queryJson');
const resultEl = document.getElementById('resultJson');
const summaryEl = document.getElementById('summary');
const graphSvg = document.getElementById('graphSvg');
const viewShowRoomIdInput = document.getElementById('viewShowRoomIdInput');
const viewShowRoomLetterInput = document.getElementById('viewShowRoomLetterInput');
const viewShowRoomNameInput = document.getElementById('viewShowRoomNameInput');
const viewColorBordersByRoomInput = document.getElementById('viewColorBordersByRoomInput');

const resultCardsEl = document.getElementById('resultCards');
const resultWarningsWrapEl = document.getElementById('resultWarningsWrap');
const resultWarningsListEl = document.getElementById('resultWarningsList');
const resultUnmetWrapEl = document.getElementById('resultUnmetWrap');
const resultUnmetListEl = document.getElementById('resultUnmetList');
const resultSimulationTimelineWrapEl = document.getElementById('resultSimulationTimelineWrap');
const resultSimulationTimelineEl = document.getElementById('resultSimulationTimeline');
const resultMovesCardEl = document.getElementById('resultMovesCard');
const resultMovesCountEl = document.getElementById('resultMovesCount');
const resultMovesListEl = document.getElementById('resultMovesList');
const resultVisitedRoomsCardEl = document.getElementById('resultVisitedRoomsCard');
const resultVisitedRoomsCountEl = document.getElementById('resultVisitedRoomsCount');
const resultVisitedRoomsEl = document.getElementById('resultVisitedRooms');
const resultPathDetailsEl = document.getElementById('resultPathDetails');
const resultPathCountEl = document.getElementById('resultPathCount');
const resultPathNodesEl = document.getElementById('resultPathNodes');
const resultRawDetailsEl = document.getElementById('resultRawDetails');

const loadDefaultBtn = document.getElementById('loadDefaultBtn');
const solveBtn = document.getElementById('solveBtn');
const shareBtn = document.getElementById('shareBtn');
const editModeBtn = document.getElementById('editModeBtn');
const saveMapBtn = document.getElementById('saveMapBtn');

const startIdInput = document.getElementById('startIdInput');
const endIdInput = document.getElementById('endIdInput');
const maxStepsInput = document.getElementById('maxStepsInput');
const maxStatesInput = document.getElementById('maxStatesInput');
const letterModeInput = document.getElementById('letterModeInput');
const mustUseLettersInput = document.getElementById('mustUseLettersInput');
const runModeInput = document.getElementById('runModeInput');
const simplePathInput = document.getElementById('simplePathInput');
const searchModeInput = document.getElementById('searchModeInput');
const simulationHeadingInput = document.getElementById('simulationHeadingInput');
const simulationStopOnLoopInput = document.getElementById('simulationStopOnLoopInput');

const constraintTypeInput = document.getElementById('constraintTypeInput');
const constraintValueInput = document.getElementById('constraintValueInput');
const constraintValueTextInput = document.getElementById('constraintValueTextInput');
const addConstraintBtn = document.getElementById('addConstraintBtn');
const constraintListEl = document.getElementById('constraintList');

const turnRuleKeyInput = document.getElementById('turnRuleKeyInput');
const turnRuleValueInput = document.getElementById('turnRuleValueInput');
const addTurnRuleBtn = document.getElementById('addTurnRuleBtn');
const turnRuleListEl = document.getElementById('turnRuleList');

const useQueryOverrideInput = document.getElementById('useQueryOverrideInput');
const pickStartBtn = document.getElementById('pickStartBtn');
const pickEndBtn = document.getElementById('pickEndBtn');
const pickHint = document.getElementById('pickHint');
const settingsTabButtons = [...document.querySelectorAll('[data-settings-tab]')];
const settingsModeSections = [...document.querySelectorAll('[data-visible-modes]')];
const settingsPanelRoot = document.querySelector('[data-settings-mode-root]');
const saveMapCardBtn = document.getElementById('saveMapCardBtn');

let examples = {};
let currentMap = null;
let lastPathNodes = [];
let lastRunInfo = null;
let lastResult = null;
let editMode = false;
let nodePickMode = null;
let settingsMode = 'solve';
let builderConstraints = [];
let builderTurnRules = [];
let defaultMapTemplate = null;
let browserSolve = null;
let mapSaveHandle = null;

const SHARE_TOKEN_PREFIX = 's1.';
const MAX_STATIC_SHARE_CHARS = 7000;

const STATIC_PATHS = {
  defaultMap: 'data/map.default.json',
  examples: 'data/examples.json',
};

const LANTERN_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const TURN_RULE_KEYS = ['intersection', ...LANTERN_COLORS];

const SLOT_COLOR_CYCLE = ['red', 'orange', 'purple', 'blue', 'green', 'yellow'];
const DIRS = ['N', 'E', 'S', 'W'];
const OPP_DIR = { N: 'S', E: 'W', S: 'N', W: 'E' };
const LEFT_OF = { N: 'W', E: 'N', S: 'E', W: 'S' };
const RIGHT_OF = { N: 'E', E: 'S', S: 'W', W: 'N' };
const DIR_MASK_VALUES = Array.from({ length: 15 }, (_, i) => i + 1);

const DEFAULT_QUERY = {
  startId: 'g(vC1)',
  endId: 'C9',
  maxSteps: 120,
};

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function setSummary(text, isError = false) {
  summaryEl.textContent = text;
  summaryEl.classList.toggle('error', isError);
}

function deepClone(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function resolveAppUrl(path) {
  return new URL(String(path || ''), document.baseURI).toString();
}

async function fetchJson(path, init = {}) {
  const resp = await fetch(resolveAppUrl(path), init);
  const data = await resp.json().catch(() => ({}));
  return { resp, data };
}

async function getBrowserSolve() {
  if (typeof browserSolve === 'function') return browserSolve;

  const mod = await import('./solver.browser.js');
  if (!mod || typeof mod.solve !== 'function') {
    throw new Error('Browser solver module failed to load.');
  }

  browserSolve = mod.solve;
  return browserSolve;
}

function focusMapView() {
  if (!graphSvg) return;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  graphSvg.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start',
    inline: 'nearest',
  });
}

function normalizeSettingsMode(modeRaw) {
  const mode = String(modeRaw || '').trim().toLowerCase();
  if (mode.startsWith('sim')) return 'simulate';
  return 'solve';
}

function setSettingsMode(modeRaw, { syncRunMode = true } = {}) {
  const mode = normalizeSettingsMode(modeRaw);
  const previousMode = settingsMode;
  settingsMode = mode;

  if (previousMode !== mode) {
    clearMostRecentResults();
  }

  if (settingsPanelRoot) {
    settingsPanelRoot.setAttribute('data-settings-mode', mode);
  }

  for (const btn of settingsTabButtons) {
    const isActive = normalizeSettingsMode(btn.getAttribute('data-settings-tab')) === mode;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }

  for (const section of settingsModeSections) {
    const modes = String(section.getAttribute('data-visible-modes') || '')
      .split(',')
      .map((x) => normalizeSettingsMode(x))
      .filter(Boolean);
    const visible = modes.includes(mode);
    section.hidden = !visible;
  }

  if (runModeInput && syncRunMode) {
    runModeInput.value = mode === 'simulate' ? 'simulate' : 'solve';
  }

  setEditModeState(false, { silent: true });

  if (!useQueryOverrideInput?.checked) {
    syncQueryPreview();
  }
}

function setEditModeState(nextEditMode, { silent = false } = {}) {
  const desired = !!nextEditMode;
  if (editMode === desired) {
    updateEditModeButton();
    return;
  }

  editMode = desired;

  if (editMode && nodePickMode) {
    nodePickMode = null;
    if (!silent) {
      setSummary('Exited start/end pick mode because edit mode is on.');
    }
  }

  updateEditModeButton();

  if (currentMap) {
    renderGraph(currentMap, lastPathNodes);
  }
}

function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n ?? '—');
  return num.toLocaleString();
}

function humanizeStopReason(reasonRaw) {
  const reason = String(reasonRaw || '').trim();
  if (!reason) return 'stopped';
  const map = {
    maxMovesReached: 'max moves reached',
    deadEnd: 'dead end',
    loopDetected: 'loop detected',
    endReached: 'end reached',
  };
  if (map[reason]) return map[reason];
  return reason.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
}

function clearResultPanels() {
  if (resultCardsEl) resultCardsEl.innerHTML = '';

  if (resultWarningsListEl) resultWarningsListEl.innerHTML = '';
  if (resultWarningsWrapEl) resultWarningsWrapEl.hidden = true;

  if (resultUnmetListEl) resultUnmetListEl.innerHTML = '';
  if (resultUnmetWrapEl) resultUnmetWrapEl.hidden = true;

  if (resultSimulationTimelineEl) resultSimulationTimelineEl.innerHTML = '';
  if (resultSimulationTimelineWrapEl) resultSimulationTimelineWrapEl.hidden = true;

  if (resultMovesListEl) resultMovesListEl.innerHTML = '';
  if (resultMovesCountEl) resultMovesCountEl.textContent = '0';
  if (resultMovesCardEl) {
    resultMovesCardEl.hidden = true;
  }

  if (resultVisitedRoomsEl) resultVisitedRoomsEl.innerHTML = '';
  if (resultVisitedRoomsCountEl) resultVisitedRoomsCountEl.textContent = '0';
  if (resultVisitedRoomsCardEl) {
    resultVisitedRoomsCardEl.hidden = true;
  }

  if (resultPathNodesEl) resultPathNodesEl.innerHTML = '';
  if (resultPathCountEl) resultPathCountEl.textContent = '0';
  if (resultPathDetailsEl) {
    resultPathDetailsEl.hidden = true;
    resultPathDetailsEl.open = false;
  }

  if (resultRawDetailsEl) {
    resultRawDetailsEl.open = false;
  }
}

function clearMostRecentResults({ rerender = true } = {}) {
  if (resultEl) resultEl.textContent = '';
  clearResultPanels();
  lastPathNodes = [];
  lastRunInfo = null;
  lastResult = null;
  setSummary('');

  if (rerender && currentMap) {
    renderGraph(currentMap, lastPathNodes);
  }
}

function addResultCard(label, value, extraClass = '') {
  if (!resultCardsEl) return;
  const card = document.createElement('div');
  card.className = `result-card ${extraClass}`.trim();

  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = value;

  card.appendChild(labelEl);
  card.appendChild(valueEl);
  resultCardsEl.appendChild(card);
}

function setResultList(wrapEl, listEl, items) {
  if (!wrapEl || !listEl) return;
  listEl.innerHTML = '';
  const arr = Array.isArray(items) ? items : [];
  wrapEl.hidden = arr.length === 0;
  for (const item of arr) {
    const li = document.createElement('li');
    li.textContent = String(item);
    listEl.appendChild(li);
  }
}

function summarizeLetters(result) {
  const letters = Array.isArray(result?.lettersPassed)
    ? result.lettersPassed.map((x) => String(x?.letter || '').toUpperCase()).filter(Boolean)
    : [];
  return letters.join('');
}

function summarizeLanterns(result) {
  const nodes = Array.isArray(result?.path?.nodes) ? result.path.nodes : [];
  if (!nodes.length || !currentMap?.nodes) return '';

  const counts = new Map();
  for (const nodeId of nodes) {
    const node = currentMap.nodes[nodeId];
    const kind = String(node?.kind || '').toLowerCase();
    if (kind !== 'lantern') continue;

    const color = String(node?.lantern || '').toLowerCase();
    if (!color) continue;

    counts.set(color, (counts.get(color) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([color, count]) => `${color}×${count}`)
    .join(', ');
}

function directionGlyph(dirRaw) {
  const dir = String(dirRaw || '').toUpperCase();
  if (dir === 'N') return '↑';
  if (dir === 'E') return '→';
  if (dir === 'S') return '↓';
  if (dir === 'W') return '←';
  return dir || '?';
}

function turnRelationLabel(prevDirRaw, nextDirRaw) {
  const prevDir = String(prevDirRaw || '').toUpperCase();
  const nextDir = String(nextDirRaw || '').toUpperCase();
  if (!DIRS.includes(prevDir) || !DIRS.includes(nextDir)) return null;
  if (nextDir === prevDir) return 'straight';
  if (nextDir === LEFT_OF[prevDir]) return 'left';
  if (nextDir === RIGHT_OF[prevDir]) return 'right';
  if (nextDir === OPP_DIR[prevDir]) return 'back';
  return null;
}

function renderSimulationTimeline(result, isSimulation = false) {
  if (!resultSimulationTimelineWrapEl || !resultSimulationTimelineEl) return;

  resultSimulationTimelineEl.innerHTML = '';
  resultSimulationTimelineWrapEl.hidden = true;

  if (!isSimulation) return;

  const edges = Array.isArray(result?.path?.edges) ? result.path.edges : [];
  if (!edges.length) return;

  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i] && typeof edges[i] === 'object' ? edges[i] : null;
    if (!edge) continue;

    const from = String(edge.from || '?');
    const to = String(edge.to || '?');
    const dir = String(edge.dir || '?').toUpperCase();

    const prevDir = i > 0 ? String(edges[i - 1]?.dir || '').toUpperCase() : null;
    const rel = turnRelationLabel(prevDir, dir);

    const toNode = currentMap?.nodes?.[to];
    const toKind = String(toNode?.kind || '').toLowerCase();

    const roomName =
      (toKind === 'room' || toKind === 'room-center')
        ? ((typeof toNode?.roomName === 'string' && toNode.roomName.trim())
          ? toNode.roomName.trim()
          : ((typeof toNode?.name === 'string' && toNode.name.trim()) ? toNode.name.trim() : null))
        : null;

    const lanternColor =
      (toKind === 'lantern')
        ? (typeof toNode?.lantern === 'string' ? toNode.lantern.trim().toLowerCase() : null)
        : null;

    const li = document.createElement('li');
    li.className = 'sim-timeline-item';

    const stepEl = document.createElement('span');
    stepEl.className = 'sim-step';
    stepEl.textContent = `${i + 1}.`;

    const dirEl = document.createElement('span');
    dirEl.className = 'sim-dir';
    dirEl.textContent = directionGlyph(dir);

    const mainEl = document.createElement('div');
    mainEl.className = 'sim-main';

    const routeEl = document.createElement('span');
    routeEl.className = 'sim-route';
    routeEl.textContent = `${from} → ${to}`;
    mainEl.appendChild(routeEl);

    if (i === 0) {
      const metaEl = document.createElement('span');
      metaEl.className = 'sim-meta';
      metaEl.textContent = 'start';
      mainEl.appendChild(metaEl);
    } else if (rel) {
      const metaEl = document.createElement('span');
      metaEl.className = 'sim-meta';
      metaEl.textContent = `turn: ${rel}`;
      mainEl.appendChild(metaEl);
    }

    if (lanternColor) {
      const lanternEl = document.createElement('span');
      lanternEl.className = 'move-lantern move-lantern-chip';
      lanternEl.textContent = lanternColor;
      if (['red', 'orange', 'yellow', 'green', 'blue', 'purple'].includes(lanternColor)) {
        lanternEl.classList.add(`room-color-${lanternColor}`);
      }
      mainEl.appendChild(lanternEl);
    }

    if (roomName) {
      const roomEl = document.createElement('span');
      roomEl.className = 'move-room move-room-chip';
      const roomColor = String(toNode?.roomColor || '').toLowerCase();
      if (['red', 'orange', 'yellow', 'green', 'blue', 'purple'].includes(roomColor)) {
        roomEl.classList.add(`room-color-${roomColor}`);
      }
      roomEl.textContent = roomName;
      mainEl.appendChild(roomEl);
    }

    li.appendChild(stepEl);
    li.appendChild(dirEl);
    li.appendChild(mainEl);
    resultSimulationTimelineEl.appendChild(li);
  }

  resultSimulationTimelineWrapEl.hidden = false;
}

function renderMoveList(result) {
  if (!resultMovesListEl || !resultMovesCountEl || !resultMovesCardEl) return;

  const edges = Array.isArray(result?.path?.edges) ? result.path.edges : [];
  const moves = Array.isArray(result?.path?.moves) ? result.path.moves : [];
  const count = Math.max(edges.length, moves.length);

  resultMovesListEl.innerHTML = '';
  resultMovesCountEl.textContent = formatNumber(count);
  resultMovesCardEl.hidden = count === 0;

  if (!count) return;

  const knownLanternColors = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'purple']);

  for (let i = 0; i < count; i += 1) {
    const edge = (edges[i] && typeof edges[i] === 'object') ? edges[i] : null;
    const dir = String(edge?.dir || moves[i] || '?').toUpperCase();
    const glyph = directionGlyph(dir);

    const toNode = edge?.to && currentMap?.nodes ? currentMap.nodes[edge.to] : null;
    const toNodeKind = String(toNode?.kind || '').toLowerCase();
    const entersRoom = toNodeKind === 'room' || toNodeKind === 'room-center';
    const roomLabel = entersRoom
      ? (
          (typeof toNode?.roomName === 'string' && toNode.roomName.trim())
            ? toNode.roomName.trim()
            : ((typeof toNode?.name === 'string' && toNode.name.trim()) ? toNode.name.trim() : String(edge?.to || ''))
        )
      : null;

    const roomColorRaw = String(toNode?.roomColor || '').toLowerCase();
    const roomColor = knownLanternColors.has(roomColorRaw) ? roomColorRaw : null;

    const toNodeLantern = String(toNode?.lantern || '').toLowerCase();
    const primaryLantern = knownLanternColors.has(toNodeLantern) ? toNodeLantern : null;

    const chip = document.createElement('span');
    chip.className = 'move-chip';

    const stepEl = document.createElement('span');
    stepEl.className = 'move-step';
    stepEl.textContent = `${i + 1}.`;

    const dirEl = document.createElement('span');
    dirEl.className = 'move-dir';
    dirEl.textContent = glyph;

    chip.appendChild(stepEl);
    chip.appendChild(dirEl);

    if (primaryLantern) {
      const lanternEl = document.createElement('span');
      lanternEl.className = 'move-lantern move-lantern-chip';
      lanternEl.classList.add(`room-color-${primaryLantern}`);
      lanternEl.textContent = primaryLantern;
      chip.appendChild(lanternEl);
    }

    if (roomLabel) {
      const roomEl = document.createElement('span');
      roomEl.className = 'move-room move-room-chip';
      if (roomColor) {
        roomEl.classList.add(`room-color-${roomColor}`);
      }
      roomEl.textContent = roomLabel;
      chip.appendChild(roomEl);
    }

    const from = edge?.from || '?';
    const to = edge?.to || '?';
    const lanternTitle = primaryLantern ? ` · enters ${primaryLantern} lantern` : '';
    const roomTitle = roomLabel
      ? ` · enters room: ${to} (${roomLabel}${roomColor ? `, ${roomColor}` : ''})`
      : '';
    chip.title = `${i + 1}. ${dir} · ${from} → ${to}${lanternTitle}${roomTitle}`;

    resultMovesListEl.appendChild(chip);
  }
}

function renderVisitedRooms(result) {
  if (!resultVisitedRoomsEl || !resultVisitedRoomsCountEl || !resultVisitedRoomsCardEl) return 0;

  const nodes = Array.isArray(result?.path?.nodes) ? result.path.nodes : [];
  const seen = new Set();
  const rooms = [];

  for (const nodeId of nodes) {
    if (seen.has(nodeId)) continue;
    const node = currentMap?.nodes?.[nodeId];
    const kind = String(node?.kind || '').toLowerCase();
    if (kind !== 'room' && kind !== 'room-center') continue;

    seen.add(nodeId);

    const roomName =
      typeof node?.roomName === 'string' && node.roomName.trim()
        ? node.roomName.trim()
        : (typeof node?.name === 'string' && node.name.trim() ? node.name.trim() : null);

    const letter = node?.letter ? String(node.letter).toUpperCase() : null;
    const roomColor =
      typeof node?.roomColor === 'string' && node.roomColor.trim()
        ? node.roomColor.trim().toLowerCase()
        : null;

    rooms.push({ id: nodeId, roomName, letter, roomColor });
  }

  resultVisitedRoomsEl.innerHTML = '';
  resultVisitedRoomsCountEl.textContent = formatNumber(rooms.length);
  resultVisitedRoomsCardEl.hidden = rooms.length === 0;

  if (!rooms.length) return 0;

  const roomColors = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'purple']);

  for (const room of rooms) {
    const chip = document.createElement('span');
    chip.className = 'path-node-chip visited-room-chip';

    if (room.roomColor && roomColors.has(room.roomColor)) {
      chip.classList.add(`room-color-${room.roomColor}`);
    }

    const parts = [room.id];
    if (room.roomName) parts.push(room.roomName);
    if (room.letter) parts.push(`(${room.letter})`);
    chip.textContent = parts.join(' · ');

    if (room.roomColor) {
      chip.title = `Room color: ${room.roomColor}`;
    }

    resultVisitedRoomsEl.appendChild(chip);
  }

  return rooms.length;
}

function renderPathNodeChips(nodes) {
  if (!resultPathNodesEl || !resultPathCountEl || !resultPathDetailsEl) return;

  const arr = Array.isArray(nodes) ? nodes : [];
  resultPathNodesEl.innerHTML = '';
  resultPathCountEl.textContent = formatNumber(arr.length);
  resultPathDetailsEl.hidden = arr.length === 0;

  if (!arr.length) return;

  for (let i = 0; i < arr.length; i += 1) {
    const chip = document.createElement('span');
    chip.className = 'path-node-chip';
    chip.textContent = `${i + 1}:${arr[i]}`;
    resultPathNodesEl.appendChild(chip);
  }
}

function formatNodeResultName(nodeIdRaw) {
  const nodeId = String(nodeIdRaw || '').trim();
  if (!nodeId) return '—';

  const node = currentMap?.nodes?.[nodeId];
  if (!node) return nodeId;

  const friendly = getNodeFriendlyLabel(nodeId, node);
  return friendly || nodeId;
}

function renderResultPanels(result, isHttpOk = true) {
  clearResultPanels();

  if (!result || typeof result !== 'object') return;

  const success = !!(isHttpOk && result.success !== false);
  const mode = String(result.mode || '').toLowerCase();
  const isSimulation = mode === 'simulation' || mode === 'simulate';

  addResultCard(
    'Status',
    isSimulation ? (success ? 'Simulation run' : 'Simulation failed') : (success ? 'Solved' : 'No solution'),
    success ? 'status-ok' : 'status-fail'
  );
  const resolvedStartId = result.startId || null;
  const resolvedEndId = result.endId || (
    isSimulation && Array.isArray(result?.path?.nodes) && result.path.nodes.length
      ? result.path.nodes[result.path.nodes.length - 1]
      : null
  );

  addResultCard('Start', formatNodeResultName(resolvedStartId));
  addResultCard(isSimulation && !result.endId ? 'End (sim)' : 'End', formatNodeResultName(resolvedEndId));

  if (Number.isFinite(Number(result?.path?.steps))) {
    addResultCard('Steps (room in/out)', formatNumber(result.path.steps));
  }

  const moveCount = Number.isFinite(Number(result?.path?.moveCount))
    ? Number(result.path.moveCount)
    : (Array.isArray(result?.path?.moves) ? result.path.moves.length : null);
  if (Number.isFinite(Number(moveCount))) {
    addResultCard('Moves (total)', formatNumber(moveCount));
  }

  if (Number.isFinite(Number(result.exploredStates))) {
    addResultCard('Explored states', formatNumber(result.exploredStates));
  }

  if (result.cappedByMaxStates) {
    addResultCard('Search capped', 'Yes');
  }

  if (isSimulation && result.stopReason) {
    addResultCard('Simulation stop', humanizeStopReason(result.stopReason));
  }

  const letters = summarizeLetters(result);
  if (letters) {
    addResultCard('Letters', letters);
  }

  const lanternSummary = summarizeLanterns(result);
  if (lanternSummary) {
    addResultCard('Lanterns', lanternSummary);
  }

  setResultList(resultWarningsWrapEl, resultWarningsListEl, result.warnings);
  setResultList(resultUnmetWrapEl, resultUnmetListEl, result.unmet);

  renderSimulationTimeline(result, isSimulation);

  renderMoveList(result);
  const visitedRoomsCount = renderVisitedRooms(result);

  const nodes = result?.path?.nodes || [];
  renderPathNodeChips(nodes);

  addResultCard('Visited rooms', formatNumber(visitedRoomsCount));

  if (resultPathDetailsEl) {
    resultPathDetailsEl.open = false;
  }
}

function dirsToMask(dirs) {
  let mask = 0;
  const set = new Set((dirs || []).map((d) => String(d).toUpperCase()));
  if (set.has('N')) mask |= 1;
  if (set.has('E')) mask |= 2;
  if (set.has('S')) mask |= 4;
  if (set.has('W')) mask |= 8;
  return mask;
}

function maskToDirs(mask) {
  const out = [];
  if (mask & 1) out.push('N');
  if (mask & 2) out.push('E');
  if (mask & 4) out.push('S');
  if (mask & 8) out.push('W');
  return out;
}

function nodeSupportsEditableConnections(node) {
  if (!node || typeof node !== 'object') return false;
  return node.kind === 'room' || node.kind === 'room-center' || node.kind === 'intersection';
}

function getNodeEnabledDirs(node) {
  if (!node || typeof node !== 'object') return DIRS.slice();

  const dirs = Array.isArray(node.enabledDirs)
    ? node.enabledDirs
        .map((d) => String(d || '').toUpperCase())
        .filter((d) => DIRS.includes(d))
    : [];

  if (dirs.length > 0) return [...new Set(dirs)];
  if (nodeSupportsEditableConnections(node)) return DIRS.slice();
  return DIRS.slice();
}

function setNodeEnabledDirs(nodeId, dirs) {
  if (!currentMap?.nodes?.[nodeId]) return;
  const node = currentMap.nodes[nodeId];
  const normalized = [...new Set((dirs || []).map((d) => String(d || '').toUpperCase()))]
    .filter((d) => DIRS.includes(d));

  if (!normalized.length) return;
  node.enabledDirs = normalized;
}

function cycleNodeConnections(nodeId) {
  if (!currentMap?.nodes?.[nodeId]) return null;

  const node = currentMap.nodes[nodeId];
  if (!nodeSupportsEditableConnections(node)) return null;

  const currentMask = dirsToMask(getNodeEnabledDirs(node));
  const idx = DIR_MASK_VALUES.indexOf(currentMask);
  const nextMask = DIR_MASK_VALUES[(idx + 1 + DIR_MASK_VALUES.length) % DIR_MASK_VALUES.length];
  const nextDirs = maskToDirs(nextMask);

  setNodeEnabledDirs(nodeId, nextDirs);
  return nextDirs;
}

function isNodeDirEnabled(node, dir) {
  const d = String(dir || '').toUpperCase();
  if (!DIRS.includes(d)) return false;
  return getNodeEnabledDirs(node).includes(d);
}

function ensureMapStructures(map) {
  if (!map || typeof map !== 'object') return;
  if (!map.nodes || typeof map.nodes !== 'object') map.nodes = {};
  if (!map.lanternSlots || typeof map.lanternSlots !== 'object') map.lanternSlots = {};
  if (!map.sideToSlot || typeof map.sideToSlot !== 'object') map.sideToSlot = {};

  for (const [nodeId, nodeRaw] of Object.entries(map.nodes)) {
    const node = nodeRaw && typeof nodeRaw === 'object' ? nodeRaw : {};
    map.nodes[nodeId] = node;

    if (!node.neighbors || typeof node.neighbors !== 'object') node.neighbors = {};

    if (nodeSupportsEditableConnections(node) && !Array.isArray(node.enabledDirs)) {
      node.enabledDirs = DIRS.slice();
    }
  }

  for (const [slotId, slotRaw] of Object.entries(map.lanternSlots)) {
    const slot = slotRaw && typeof slotRaw === 'object' ? slotRaw : {};
    map.lanternSlots[slotId] = slot;
  }
}

function setCurrentMap(map, { rerender = true } = {}) {
  currentMap = map && typeof map === 'object' ? map : null;
  if (currentMap) {
    ensureMapStructures(currentMap);
    refreshNodeSelectOptions(currentMap);
  }

  if (rerender && currentMap) {
    renderGraph(currentMap, lastPathNodes);
  }
}

function updateLastRunInfoFromResult(result) {
  const resultMode = String(result?.mode || '').toLowerCase();
  const simulatedEndNode =
    (resultMode === 'simulation' || resultMode === 'simulate') &&
    Array.isArray(lastPathNodes) && lastPathNodes.length > 0
      ? lastPathNodes[lastPathNodes.length - 1]
      : null;

  lastRunInfo = {
    mode: resultMode || 'solve',
    simulatedEndNode,
  };
}

function applyResultState(result, { isHttpOk = true, summaryText = '', isError = false } = {}) {
  const safeResult = result && typeof result === 'object' ? result : {};

  if (resultEl) {
    resultEl.textContent = Object.keys(safeResult).length ? pretty(safeResult) : '';
  }

  renderResultPanels(safeResult, isHttpOk);

  lastResult = Object.keys(safeResult).length ? safeResult : null;
  lastPathNodes = Array.isArray(safeResult?.path?.nodes) ? safeResult.path.nodes : [];
  updateLastRunInfoFromResult(safeResult);

  if (currentMap) {
    renderGraph(currentMap, lastPathNodes);
  }

  if (summaryText) {
    setSummary(summaryText, isError);
  }
}

function updateEditModeButton() {
  if (editModeBtn) {
    editModeBtn.textContent = `Edit gaps: ${editMode ? 'On' : 'Off'}`;
    editModeBtn.classList.toggle('toggle-on', editMode);
  }

  updateNodePickUI();
}

function setSlotColor(slotId, color) {
  if (!currentMap?.lanternSlots?.[slotId]) return;

  const slot = currentMap.lanternSlots[slotId];
  const normalized = String(color || '').trim().toLowerCase();

  slot.color = normalized || SLOT_COLOR_CYCLE[0];

  if (currentMap.nodes?.[slotId]) {
    currentMap.nodes[slotId].lantern = slot.color;
    currentMap.nodes[slotId].lanternRef = slot.ref || slotId;
  }
}

function cycleSlotColor(slotId, step = 1) {
  if (!currentMap?.lanternSlots?.[slotId]) return null;

  const slot = currentMap.lanternSlots[slotId];
  const current = String(slot.color || '').trim().toLowerCase();
  const idx = SLOT_COLOR_CYCLE.indexOf(current);

  let nextIdx;
  if (idx < 0) {
    nextIdx = step >= 0 ? 0 : SLOT_COLOR_CYCLE.length - 1;
  } else {
    const delta = step >= 0 ? 1 : -1;
    nextIdx = (idx + delta + SLOT_COLOR_CYCLE.length) % SLOT_COLOR_CYCLE.length;
  }

  const next = SLOT_COLOR_CYCLE[nextIdx];
  setSlotColor(slotId, next);
  return next;
}

function handleSlotDotClick(slotId, event) {
  if (!editMode || !slotId || !currentMap) return;

  event.preventDefault();

  const slot = currentMap?.lanternSlots?.[slotId];
  if (!slot) return;

  const next = cycleSlotColor(slotId, event.shiftKey ? -1 : 1);
  setSummary(`Gap ${slotId} color=${next || SLOT_COLOR_CYCLE[0]}`);

  renderGraph(currentMap, lastPathNodes);
}

function handleNodeClick(nodeId, event) {
  if (!editMode || !nodeId || !currentMap?.nodes?.[nodeId]) return;

  const node = currentMap.nodes[nodeId];
  if (!nodeSupportsEditableConnections(node)) return;

  event.preventDefault();

  const dirs = cycleNodeConnections(nodeId);
  if (!dirs) return;

  setSummary(`Node ${nodeId} dirs=${dirs.join('')}`);
  renderGraph(currentMap, lastPathNodes);
}

function downloadTextFile(filename, text) {
  const blob = new Blob([String(text || '')], { type: 'application/json' });
  const href = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(href);
}

async function pickMapSaveHandle() {
  if (typeof window.showSaveFilePicker !== 'function') return null;

  try {
    return await window.showSaveFilePicker({
      suggestedName: 'map.default.json',
      excludeAcceptAllOption: false,
      types: [
        {
          description: 'JSON files',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
    });
  } catch (err) {
    if (err && err.name === 'AbortError') return null;
    throw err;
  }
}

async function writeTextToFileHandle(handle, text) {
  const writer = await handle.createWritable();
  await writer.write(String(text || ''));
  await writer.close();
}

async function saveMapToServer() {
  if (!currentMap || typeof currentMap !== 'object') {
    setSummary('No map loaded to save.', true);
    return;
  }

  const text = `${pretty(currentMap)}\n`;

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      if (!mapSaveHandle) {
        mapSaveHandle = await pickMapSaveHandle();
      }

      if (mapSaveHandle) {
        await writeTextToFileHandle(mapSaveHandle, text);
        setSummary('Saved map.default.json.');
        return;
      }
    } catch (err) {
      mapSaveHandle = null;
      setSummary(`Save picker failed (${err.message || String(err)}). Downloading instead...`, true);
    }
  }

  downloadTextFile('map.default.json', text);
  setSummary('Downloaded map.default.json (static mode).');
}

function buildShareUrl(shareToken) {
  const url = new URL(window.location.href);
  url.searchParams.set('share', shareToken);
  return url.toString();
}

function utf8ToBase64Url(text) {
  const bytes = new TextEncoder().encode(String(text || ''));
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToUtf8(tokenRaw) {
  const token = String(tokenRaw || '').trim();
  if (!token) return '';

  const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${'='.repeat(padLen)}`;

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}

function normalizePatchColor(value) {
  if (value === null || value === undefined) return null;
  const color = String(value).trim().toLowerCase();
  return color || null;
}

function buildMapPatch(baseMap, map) {
  if (!baseMap || typeof baseMap !== 'object' || !map || typeof map !== 'object') {
    return { fullMap: deepClone(map) };
  }

  const baseSlots = baseMap.lanternSlots && typeof baseMap.lanternSlots === 'object'
    ? baseMap.lanternSlots
    : {};
  const currentSlots = map.lanternSlots && typeof map.lanternSlots === 'object'
    ? map.lanternSlots
    : {};

  const baseNodes = baseMap.nodes && typeof baseMap.nodes === 'object'
    ? baseMap.nodes
    : {};
  const currentNodes = map.nodes && typeof map.nodes === 'object'
    ? map.nodes
    : {};

  const patch = {};
  const slotColors = {};

  for (const [slotId, slotRaw] of Object.entries(currentSlots)) {
    if (!baseSlots[slotId]) {
      return { fullMap: deepClone(map) };
    }

    const currentColor = normalizePatchColor(slotRaw && typeof slotRaw === 'object' ? slotRaw.color : null);
    const baseColor = normalizePatchColor(baseSlots[slotId] && typeof baseSlots[slotId] === 'object' ? baseSlots[slotId].color : null);

    if (currentColor !== baseColor) {
      slotColors[slotId] = currentColor;
    }
  }

  if (Object.keys(slotColors).length > 0) {
    patch.slotColors = slotColors;
  }

  const nodeEnabledDirs = {};
  for (const [nodeId, nodeRaw] of Object.entries(currentNodes)) {
    if (!baseNodes[nodeId]) {
      return { fullMap: deepClone(map) };
    }

    const currentDirs = normalizeDirList(nodeRaw && typeof nodeRaw === 'object' ? nodeRaw.enabledDirs : []);
    const baseDirs = normalizeDirList(baseNodes[nodeId] && typeof baseNodes[nodeId] === 'object' ? baseNodes[nodeId].enabledDirs : []);

    if (currentDirs.join(',') !== baseDirs.join(',')) {
      nodeEnabledDirs[nodeId] = currentDirs;
    }
  }

  if (Object.keys(nodeEnabledDirs).length > 0) {
    patch.nodeEnabledDirs = nodeEnabledDirs;
  }

  if (map.startId !== baseMap.startId) {
    patch.startId = map.startId || null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function applyMapPatch(baseMap, patchRaw) {
  const patch = patchRaw && typeof patchRaw === 'object' ? patchRaw : null;
  if (!patch) return deepClone(baseMap);

  if (patch.fullMap && typeof patch.fullMap === 'object') {
    return deepClone(patch.fullMap);
  }

  const map = deepClone(baseMap);
  if (!map || typeof map !== 'object') return null;

  ensureMapStructures(map);

  if (patch.slotColors && typeof patch.slotColors === 'object') {
    for (const [slotId, colorRaw] of Object.entries(patch.slotColors)) {
      if (!map.lanternSlots?.[slotId]) continue;

      const color = normalizePatchColor(colorRaw);
      map.lanternSlots[slotId].color = color;
      if (map.nodes?.[slotId]) {
        map.nodes[slotId].lantern = color;
      }
    }
  }

  if (patch.nodeEnabledDirs && typeof patch.nodeEnabledDirs === 'object') {
    for (const [nodeId, dirsRaw] of Object.entries(patch.nodeEnabledDirs)) {
      if (!map.nodes?.[nodeId]) continue;

      const dirs = normalizeDirList(dirsRaw);
      if (dirs.length === 0) continue;
      map.nodes[nodeId].enabledDirs = dirs;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'startId')) {
    map.startId = patch.startId || null;
  }

  return map;
}

function buildStaticShareToken({ query, map, result }) {
  if (!defaultMapTemplate || typeof defaultMapTemplate !== 'object') {
    throw new Error('Default map is not loaded.');
  }

  const payload = {
    v: 1,
    createdAt: new Date().toISOString(),
    q: query,
  };

  const patch = buildMapPatch(defaultMapTemplate, map);
  if (patch) {
    payload.mp = patch;
  }

  if (result && typeof result === 'object') {
    payload.r = result;
  }

  let droppedResult = false;
  let token = `${SHARE_TOKEN_PREFIX}${utf8ToBase64Url(JSON.stringify(payload))}`;

  if (token.length > MAX_STATIC_SHARE_CHARS && payload.r) {
    delete payload.r;
    droppedResult = true;
    token = `${SHARE_TOKEN_PREFIX}${utf8ToBase64Url(JSON.stringify(payload))}`;
  }

  if (token.length > MAX_STATIC_SHARE_CHARS) {
    throw new Error('Share URL is too large for static mode.');
  }

  return { token, droppedResult };
}

function decodeStaticShareToken(shareTokenRaw) {
  const shareToken = String(shareTokenRaw || '').trim();
  if (!shareToken.startsWith(SHARE_TOKEN_PREFIX)) {
    throw new Error('Invalid static share token.');
  }

  const encoded = shareToken.slice(SHARE_TOKEN_PREFIX.length);
  const json = base64UrlToUtf8(encoded);
  const payload = JSON.parse(json);

  if (!payload || typeof payload !== 'object' || !payload.q || typeof payload.q !== 'object') {
    throw new Error('Shared payload is malformed.');
  }

  return {
    query: payload.q,
    result: payload.r && typeof payload.r === 'object' ? payload.r : null,
    map: applyMapPatch(defaultMapTemplate, payload.mp),
    createdAt: payload.createdAt || null,
  };
}

async function copyTextToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to legacy copy path.
    }
  }

  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.left = '-9999px';
    area.style.top = '-9999px';

    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);

    const copied =
      typeof document.execCommand === 'function' &&
      document.execCommand('copy');

    document.body.removeChild(area);
    return !!copied;
  } catch {
    return false;
  }
}

async function shareCurrentState() {
  if (!currentMap) {
    setSummary('No map loaded.', true);
    return;
  }

  let query;
  try {
    query = getQueryForSolve();
  } catch (err) {
    setSummary(err.message, true);
    return;
  }

  setSummary('Creating share...');

  const { token: shareToken, droppedResult } = buildStaticShareToken({
    map: currentMap,
    query,
    result: lastResult,
  });

  const shareUrl = buildShareUrl(shareToken);
  window.history.replaceState({}, '', shareUrl);

  const copied = await copyTextToClipboard(shareUrl);
  if (droppedResult) {
    setSummary(copied
      ? 'Share link copied (result omitted to keep URL size safe).'
      : `Share link ready (result omitted): ${shareUrl}`);
    return;
  }

  setSummary(copied ? 'Share link copied.' : `Share link ready: ${shareUrl}`);
}

function colorForLantern(color) {
  const c = String(color || '').toLowerCase();
  if (c === 'red') return '#ff5b5b';
  if (c === 'orange') return '#ffab4d';
  if (c === 'yellow') return '#f6e35d';
  if (c === 'green') return '#60da67';
  if (c === 'purple') return '#b481ff';
  if (c === 'blue') return '#59c9ff';
  return '#7186aa';
}

function parseRoomId(id) {
  const m = String(id).trim().toUpperCase().match(/^([A-Z]+)(-?\d+)$/);
  if (!m) return null;
  return { file: m[1], rank: Number(m[2]) };
}

function inferNodePosition(nodeId, node, files) {
  if (typeof node?.x === 'number' && typeof node?.y === 'number') {
    return { x: node.x, y: node.y };
  }

  const room = parseRoomId(nodeId);
  if (room) {
    const fi = files.indexOf(room.file);
    return fi >= 0 ? { x: fi, y: room.rank } : null;
  }

  const side = String(nodeId).match(/^([A-Z]+-?\d+):([NESW])$/i);
  if (side) {
    const roomId = side[1].toUpperCase();
    const dir = side[2].toUpperCase();
    const rp = parseRoomId(roomId);
    if (!rp) return null;
    const fi = files.indexOf(rp.file);
    if (fi < 0) return null;

    let x = fi;
    let y = rp.rank;
    if (dir === 'N') y += 0.5;
    if (dir === 'S') y -= 0.5;
    if (dir === 'E') x += 0.5;
    if (dir === 'W') x -= 0.5;
    return { x, y };
  }

  const boundary = String(nodeId).match(/^X:([^_]+)(?:__.+)?$/);
  if (boundary) {
    const token = boundary[1];
    const m = token.match(/^([A-Z]+-?\d+):([NESW])$/i);
    if (m) {
      const roomId = m[1].toUpperCase();
      const dir = m[2].toUpperCase();
      const rp = parseRoomId(roomId);
      if (!rp) return null;
      const fi = files.indexOf(rp.file);
      if (fi < 0) return null;

      let x = fi;
      let y = rp.rank;
      if (dir === 'N') y += 0.5;
      if (dir === 'S') y -= 0.5;
      if (dir === 'E') x += 0.5;
      if (dir === 'W') x -= 0.5;
      return { x, y };
    }
  }

  return null;
}

function flattenEdgeValue(value) {
  if (Array.isArray(value)) return value;
  return [value];
}

function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function makeSvg(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

function addSvgTitle(el, text) {
  if (!el || !text) return;
  const title = makeSvg('title');
  title.textContent = String(text);
  el.appendChild(title);
}

function extractLanternColors(edgeRaw, map) {
  if (!edgeRaw || typeof edgeRaw !== 'object' || Array.isArray(edgeRaw)) return [];
  const out = [];
  const add = (c) => {
    const s = String(c || '').trim().toLowerCase();
    if (!s || out.includes(s)) return;
    out.push(s);
  };

  if (edgeRaw.lantern) add(edgeRaw.lantern);
  if (Array.isArray(edgeRaw.lanterns)) edgeRaw.lanterns.forEach(add);

  if (edgeRaw.lanternSlot && map?.lanternSlots?.[edgeRaw.lanternSlot]) {
    add(map.lanternSlots[edgeRaw.lanternSlot].color);
  }

  if (Array.isArray(edgeRaw.passLanternSlots) && map?.lanternSlots) {
    for (const slotId of edgeRaw.passLanternSlots) {
      const slot = map.lanternSlots[slotId];
      if (slot) add(slot.color);
    }
  }

  return out;
}

function renderGraph(map, pathNodes = []) {
  if (!graphSvg) return;
  clearSvg(graphSvg);

  if (!map || typeof map !== 'object' || !map.nodes || typeof map.nodes !== 'object') {
    const txt = makeSvg('text', {
      x: 20,
      y: 30,
      fill: '#ff6b6b',
      'font-size': 16,
      'font-family': 'ui-monospace, monospace',
    });
    txt.textContent = 'No graph nodes found in map JSON.';
    graphSvg.appendChild(txt);
    return;
  }

  const files = Array.isArray(map.coordinateSystem?.files)
    ? map.coordinateSystem.files.map((x) => String(x).trim().toUpperCase())
    : ['A', 'B', 'C', 'D', 'E'];

  const nodeIds = Object.keys(map.nodes);
  const posById = new Map();
  for (const id of nodeIds) {
    const p = inferNodePosition(id, map.nodes[id], files);
    if (p) posById.set(id, p);
  }

  const centerIds = nodeIds.filter((id) => {
    const node = map.nodes[id] || {};
    if (node.kind === 'room' || node.kind === 'room-center') return true;

    return (
      /^[A-Z]+-?\d+$/.test(id) &&
      node.kind !== 'intersection' &&
      node.kind !== 'lantern' &&
      node.kind !== 'lantern-slot'
    );
  });

  const centersWithPos = centerIds.filter((id) => posById.has(id));

  if (centersWithPos.length === 0) {
    const txt = makeSvg('text', {
      x: 20,
      y: 30,
      fill: '#ff6b6b',
      'font-size': 16,
      'font-family': 'ui-monospace, monospace',
    });
    txt.textContent = 'No room centers with positions found.';
    graphSvg.appendChild(txt);
    return;
  }

  const bounds = graphSvg.getBoundingClientRect();
  const widthFromLayout = graphSvg.clientWidth || graphSvg.parentElement?.clientWidth || bounds.width || window.innerWidth || 900;
  const heightFromLayout = graphSvg.clientHeight || bounds.height || 760;
  const width = Math.max(360, Math.floor(widthFromLayout));
  const height = Math.max(420, Math.floor(heightFromLayout));
  graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const blueprint = {
    boardFill: '#0b4d86',
    boardStroke: '#cde9ff',
    gridLine: '#93c5ee',
    roomFill: '#0f5c98',
    roomFillLetter: '#1467a7',
    roomBorder: '#f3fbff',
    roomId: '#cde9ff',
    roomName: '#e3f2ff',
    roomLetter: '#ffffff',
    mapTextFont: '"Caveat", "Gloria Hallelujah", "Patrick Hand", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
    roomConnText: '#d8eeff',
    intersectionFill: '#e0f2ff',
    intersectionStroke: '#0a4778',
    edgeDefault: '#e3f2ff',
    edgeOpacity: 0.62,
    slotFallback: '#9cc9eb',
    slotStroke: '#0b4d86',
    conflict: '#ff9bab',
  };

  const showRoomFileRank = viewShowRoomIdInput?.checked ?? true;
  const showRoomLetter = viewShowRoomLetterInput?.checked ?? true;
  const showRoomName = viewShowRoomNameInput?.checked ?? false;
  const colorBordersByRoom = viewColorBordersByRoomInput?.checked ?? false;

  const centerXs = centersWithPos.map((id) => posById.get(id).x);
  const centerYs = centersWithPos.map((id) => posById.get(id).y);
  const minX = Math.min(...centerXs);
  const maxX = Math.max(...centerXs);
  const minY = Math.min(...centerYs);
  const maxY = Math.max(...centerYs);

  const cols = Math.max(1, Math.round(maxX - minX + 1));
  const rows = Math.max(1, Math.round(maxY - minY + 1));

  // Keep room tiles square while fitting the available viewport.
  const sidePad = Math.max(10, Math.min(40, Math.floor(width * 0.04)));
  const topPad = Math.max(18, Math.min(52, Math.floor(height * 0.065)));

  const cell = Math.max(
    8,
    Math.min(
      (width - sidePad * 2) / cols,
      (height - topPad * 2) / rows
    )
  );

  const cellX = cell;
  const cellY = cell;

  const gridW = cols * cellX;
  const gridH = rows * cellY;
  const originX = (width - gridW) / 2;
  const originY = (height - gridH) / 2;

  const ROOM_TO_GAP_RATIO = 2;
  const roomScale = (2 * ROOM_TO_GAP_RATIO) / (ROOM_TO_GAP_RATIO + 1); // 4/3 when ratio=2
  const roomW = cellX * roomScale;
  const roomH = cellY * roomScale;
  const roomOverflowX = Math.max(0, (roomW - cellX) * 2.5);
  const roomOverflowY = Math.max(0, (roomH - cellY) * 2.5);

  function toScreen(pos) {
    return {
      x: originX + (pos.x - minX + 0.5) * cellX,
      y: originY + (maxY - pos.y + 0.5) * cellY,
    };
  }

  const effectivePathNodes = editMode ? [] : (pathNodes || []);

  const pathEdgeSet = new Set();
  const pathNodeSet = new Set(effectivePathNodes);
  const selectedStartId = editMode ? null : (startIdInput?.value || null);

  const selectedEndInputId = endIdInput?.value || null;
  const lastMode = String(lastRunInfo?.mode || '').toLowerCase();
  const inferredSimulationEndId =
    !selectedEndInputId &&
    (lastMode === 'simulation' || lastMode === 'simulate') &&
    typeof lastRunInfo?.simulatedEndNode === 'string'
      ? lastRunInfo.simulatedEndNode
      : null;

  const selectedEndId = editMode ? null : (selectedEndInputId || inferredSimulationEndId || null);
  const selectedEndLabel = inferredSimulationEndId ? 'SIM END' : 'END';

  const screenPosById = new Map();

  for (let i = 0; i < effectivePathNodes.length - 1; i += 1) {
    pathEdgeSet.add(`${effectivePathNodes[i]}->${effectivePathNodes[i + 1]}`);
  }

  // board background
  graphSvg.appendChild(makeSvg('rect', {
    x: originX - roomOverflowX,
    y: originY - roomOverflowY,
    width: gridW + roomOverflowX * 2,
    height: gridH + roomOverflowY * 2,
    fill: blueprint.boardFill,
    stroke: '#ffffff',
    'stroke-width': 1.35,
    rx: 0,
  }));

  // square grid lines
  const gridGroup = makeSvg('g', { opacity: 0.46 });
  for (let c = 0; c <= cols; c += 1) {
    const x = originX + c * cellX;
    gridGroup.appendChild(makeSvg('line', {
      x1: x,
      y1: originY - roomOverflowY,
      x2: x,
      y2: originY + gridH + roomOverflowY,
      stroke: blueprint.gridLine,
      'stroke-width': 1,
    }));
  }
  for (let r = 0; r <= rows; r += 1) {
    const y = originY + r * cellY;
    gridGroup.appendChild(makeSvg('line', {
      x1: originX - roomOverflowY,
      y1: y,
      x2: originX + gridW + roomOverflowX,
      y2: y,
      stroke: blueprint.gridLine,
      'stroke-width': 1,
    }));
  }
  graphSvg.appendChild(gridGroup);

  // room cells
  const roomGroup = makeSvg('g');
  const sortedCenters = [...centersWithPos].sort((a, b) => {
    const pa = posById.get(a);
    const pb = posById.get(b);
    if (pb.y !== pa.y) return pb.y - pa.y;
    return pa.x - pb.x;
  });

  function hasRoomConnectionOnDir(roomId, roomNode, dir) {
    const d = String(dir || '').toUpperCase();
    if (!DIRS.includes(d)) return false;
    if (!isNodeDirEnabled(roomNode, d)) return false;

    const fromPos = posById.get(roomId);
    if (!fromPos) return false;

    const rawVal = roomNode?.neighbors?.[d];
    const variants = flattenEdgeValue(rawVal);

    for (const raw of variants) {
      const toId = typeof raw === 'string' ? raw : raw?.to;
      if (!toId) continue;

      const toNode = map.nodes?.[toId];
      if (!toNode) continue;
      if (!isNodeDirEnabled(toNode, OPP_DIR[d])) continue;

      const toPos = posById.get(toId);
      if (!toPos) continue;

      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;

      if (d === 'N' && Math.abs(dx) < 1e-6 && dy > 0) return true;
      if (d === 'S' && Math.abs(dx) < 1e-6 && dy < 0) return true;
      if (d === 'E' && Math.abs(dy) < 1e-6 && dx > 0) return true;
      if (d === 'W' && Math.abs(dy) < 1e-6 && dx < 0) return true;
    }

    return false;
  }

  for (const id of sortedCenters) {
    const pos = posById.get(id);
    const s = toScreen(pos);
    const node = map.nodes[id] || {};

    const inPath = pathNodeSet.has(id);
    const hasLetter = !!node.letter;

    const roomRect = makeSvg('rect', {
      x: s.x - roomW * 0.5,
      y: s.y - roomH * 0.5,
      width: roomW,
      height: roomH,
      fill: hasLetter ? blueprint.roomFillLetter : blueprint.roomFill,
      stroke: 'none',
      rx: 0,
      cursor: (editMode || nodePickMode) ? 'pointer' : 'default',
    });

    addSvgTitle(roomRect, getNodeOptionText(id, node));

    if (editMode) {
      roomRect.addEventListener('click', (event) => handleNodeClick(id, event));
    } else {
      maybeAttachNodePick(roomRect, id);
    }

    roomGroup.appendChild(roomRect);

    const roomColorRaw = String(node.roomColor || '').trim().toLowerCase();
    const roomColorStroke =
      colorBordersByRoom && LANTERN_COLORS.includes(roomColorRaw)
        ? colorForLantern(roomColorRaw)
        : blueprint.roomBorder;

    const borderColor = roomColorStroke;
    const borderWidth = inPath ? 3 : 1.35;
    const x0 = s.x - roomW * 0.5;
    const x1 = s.x + roomW * 0.5;
    const y0 = s.y - roomH * 0.5;
    const y1 = s.y + roomH * 0.5;

    const bx0 = x0;
    const bx1 = x1;
    const by0 = y0;
    const by1 = y1;

    const addBorderSegment = (attrs) => {
      roomGroup.appendChild(makeSvg('line', {
        ...attrs,
        stroke: borderColor,
        'stroke-width': borderWidth,
        'stroke-linecap': 'square',
        'pointer-events': 'none',
      }));
    };

    // When a side is connected, leave a center gap but keep square corner L marks.
    const stubX = Math.max(4, Math.min(roomW * 0.26, roomW * 0.45));
    const stubY = Math.max(4, Math.min(roomH * 0.26, roomH * 0.45));
    const borderStubX = Math.min(Math.max(stubX, 4), (bx1 - bx0) * 0.45);
    const borderStubY = Math.min(Math.max(stubY, 4), (by1 - by0) * 0.45);

    const openN = hasRoomConnectionOnDir(id, node, 'N');
    const openE = hasRoomConnectionOnDir(id, node, 'E');
    const openS = hasRoomConnectionOnDir(id, node, 'S');
    const openW = hasRoomConnectionOnDir(id, node, 'W');

    if (openN) {
      addBorderSegment({ x1: bx0, y1: by0, x2: bx0 + borderStubX, y2: by0 });
      addBorderSegment({ x1: bx1 - borderStubX, y1: by0, x2: bx1, y2: by0 });
    } else {
      addBorderSegment({ x1: bx0, y1: by0, x2: bx1, y2: by0 });
    }

    if (openE) {
      addBorderSegment({ x1: bx1, y1: by0, x2: bx1, y2: by0 + borderStubY });
      addBorderSegment({ x1: bx1, y1: by1 - borderStubY, x2: bx1, y2: by1 });
    } else {
      addBorderSegment({ x1: bx1, y1: by0, x2: bx1, y2: by1 });
    }

    if (openS) {
      addBorderSegment({ x1: bx0, y1: by1, x2: bx0 + borderStubX, y2: by1 });
      addBorderSegment({ x1: bx1 - borderStubX, y1: by1, x2: bx1, y2: by1 });
    } else {
      addBorderSegment({ x1: bx0, y1: by1, x2: bx1, y2: by1 });
    }

    if (openW) {
      addBorderSegment({ x1: bx0, y1: by0, x2: bx0, y2: by0 + borderStubY });
      addBorderSegment({ x1: bx0, y1: by1 - borderStubY, x2: bx0, y2: by1 });
    } else {
      addBorderSegment({ x1: bx0, y1: by0, x2: bx0, y2: by1 });
    }

    screenPosById.set(id, s);

    const roomName =
      typeof node.roomName === 'string' && node.roomName.trim()
        ? node.roomName.trim()
        : (typeof node.name === 'string' && node.name.trim() ? node.name.trim() : '');
    const roomLetter = node.letter ? String(node.letter).toUpperCase() : '';

    const visibleMetaKinds = [];
    if (showRoomFileRank) visibleMetaKinds.push('id');
    if (showRoomName && roomName) visibleMetaKinds.push('name');
    if (showRoomLetter && roomLetter) visibleMetaKinds.push('letter');
    const useCenteredSingleMeta = visibleMetaKinds.length === 1;

    const centerTextY = s.y + Math.max(4, Math.min(roomW, roomH) * 0.08);
    const textPadX = Math.max(2, roomW * 0.1);
    const textPadY = Math.max(2, roomH * 0.08);

    const appendRoomNameText = ({ x, y, anchor = 'middle' }) => {
      const words = roomName.split(/\s+/).filter(Boolean);
      const nameFontSize = Math.max(12, Math.floor(Math.min(roomW, roomH) * 0.112) + 0.5);
      const nameText = makeSvg('text', {
        x,
        y,
        fill: blueprint.roomName,
        'font-size': nameFontSize,
        'font-family': blueprint.mapTextFont,
        'text-anchor': anchor,
        'pointer-events': 'none',
        'font-weight': '600',
        opacity: 0.96,
      });

      if (words.length >= 2) {
        const lineGap = Math.max(6, nameFontSize * 0.92);
        const first = makeSvg('tspan', {
          x,
          dy: `-${Math.max(2.5, nameFontSize * 0.36)}`,
        });
        first.textContent = words.slice(0, -1).join(' ');

        const second = makeSvg('tspan', {
          x,
          dy: lineGap,
        });
        second.textContent = words.slice(-1);

        nameText.appendChild(first);
        nameText.appendChild(second);
      } else {
        nameText.textContent = roomName;
      }

      roomGroup.appendChild(nameText);
    };

    if (showRoomName && roomName) {
      appendRoomNameText({
        x: s.x,
        y: centerTextY,
        anchor: 'middle',
      });
    }

    if (showRoomLetter && roomLetter) {
      const letterFontSize = Math.max(12, Math.floor(Math.min(roomW, roomH) * 0.38));
      const letterTopY = (s.y - roomH * 0.5) + textPadY + letterFontSize * 0.82;

      const letterText = makeSvg('text', {
        x: useCenteredSingleMeta ? s.x : (s.x + roomW * 0.5 - textPadX),
        y: useCenteredSingleMeta ? centerTextY : letterTopY,
        fill: blueprint.roomLetter,
        'font-size': letterFontSize,
        'font-weight': '700',
        'text-anchor': useCenteredSingleMeta ? 'middle' : 'end',
        'font-family': blueprint.mapTextFont,
        'pointer-events': 'none',
      });
      letterText.textContent = roomLetter;
      roomGroup.appendChild(letterText);
    }

    if (showRoomFileRank) {
      const fileRankText = makeSvg('text', {
        x: useCenteredSingleMeta ? s.x : (s.x - roomW * 0.5 + textPadX),
        y: useCenteredSingleMeta ? centerTextY : (s.y + roomH * 0.5 - textPadY * 0.45),
        fill: blueprint.roomId,
        'font-size': useCenteredSingleMeta
          ? Math.max(12, Math.floor(Math.min(roomW, roomH) * 0.24))
          : Math.max(12, Math.floor(Math.min(roomW, roomH) * 0.11)),
        'font-family': blueprint.mapTextFont,
        'font-weight': useCenteredSingleMeta ? '700' : '600',
        'text-anchor': useCenteredSingleMeta ? 'middle' : 'start',
        'pointer-events': 'none',
      });
      fileRankText.textContent = id;
      roomGroup.appendChild(fileRankText);
    }

    if (editMode && nodeSupportsEditableConnections(node)) {
      const conn = makeSvg('text', {
        x: s.x + roomW * 0.2,
        y: s.y - roomH * 0.3,
        fill: blueprint.roomConnText,
        'font-size': Math.max(8, Math.floor(Math.min(roomW, roomH) * 0.1)),
        'font-family': blueprint.mapTextFont,
        'text-anchor': 'middle',
        'pointer-events': 'none',
        opacity: 0.9,
      });
      conn.textContent = getNodeEnabledDirs(node).join('');
      roomGroup.appendChild(conn);
    }
  }
  graphSvg.appendChild(roomGroup);

  // intersection markers (hallway editable nodes)
  const intersectionIds = nodeIds.filter((id) => {
    const node = map.nodes[id] || {};
    return node.kind === 'intersection';
  });

  const renderIntersectionMarkers = false;

  const intersectionGroup = makeSvg('g');
  for (const id of intersectionIds) {
    const pos = posById.get(id);
    if (!pos) continue;

    const node = map.nodes[id] || {};
    const s = toScreen(pos);
    const inPath = pathNodeSet.has(id);

    screenPosById.set(id, s);

    if (!renderIntersectionMarkers) {
      continue;
    }

    if (editMode) {
      const hit = makeSvg('circle', {
        cx: s.x,
        cy: s.y,
        r: 9,
        fill: '#ffffff',
        opacity: 0,
        cursor: 'pointer',
      });
      hit.addEventListener('click', (event) => handleNodeClick(id, event));
      intersectionGroup.appendChild(hit);
    }

    const marker = makeSvg('circle', {
      cx: s.x,
      cy: s.y,
      r: inPath ? 4.2 : 3.2,
      fill: blueprint.intersectionFill,
      opacity: 0.95,
      stroke: inPath ? '#ffffff' : blueprint.intersectionStroke,
      'stroke-width': inPath ? 1.6 : 0.9,
      cursor: (editMode || nodePickMode) ? 'pointer' : 'default',
    });

    addSvgTitle(marker, getNodeOptionText(id, node));

    if (editMode) {
      marker.addEventListener('click', (event) => handleNodeClick(id, event));
    } else {
      maybeAttachNodePick(marker, id);
    }

    intersectionGroup.appendChild(marker);
  }

  if (renderIntersectionMarkers) {
    graphSvg.appendChild(intersectionGroup);
  }

  const allNodePositions = [...posById.values()];
  const minNodeX = Math.min(...allNodePositions.map((p) => p.x));
  const maxNodeX = Math.max(...allNodePositions.map((p) => p.x));
  const minNodeY = Math.min(...allNodePositions.map((p) => p.y));
  const maxNodeY = Math.max(...allNodePositions.map((p) => p.y));
  const perimeterRailOffset = Math.max(7, Math.min(cellX, cellY) * 0.24);

  // base path network lines
  const renderConnectionLines = false;
  const renderPerimeterBorder = true;
  const edgeGroup = makeSvg('g', { 'stroke-linecap': 'round' });
  const perimeterGroup = makeSvg('g', { 'stroke-linecap': 'square' });
  const drawnSegments = new Set();

  for (const from of nodeIds) {
    const fromPos = posById.get(from);
    if (!fromPos) continue;

    const fromNode = map.nodes[from] || {};

    const neighbors = fromNode.neighbors || {};
    for (const [dir, rawVal] of Object.entries(neighbors)) {
      const d = String(dir || '').toUpperCase();
      if (!DIRS.includes(d)) continue;

      const fromDirEnabled = isNodeDirEnabled(fromNode, d);
      const variants = flattenEdgeValue(rawVal);
      for (const raw of variants) {
        const to = typeof raw === 'string' ? raw : raw?.to;
        if (!to) continue;

        const toNode = map.nodes?.[to] || null;
        if (!toNode) continue;

        const toPos = posById.get(to);
        if (!toPos) continue;

        // keep orthogonal grid segments only (no diagonal clutter)
        if (fromPos.x !== toPos.x && fromPos.y !== toPos.y) continue;

        const isVertical = Math.abs(fromPos.x - toPos.x) < 1e-6;
        const isHorizontal = Math.abs(fromPos.y - toPos.y) < 1e-6;
        const isPerimeterRail =
          (isVertical && (Math.abs(fromPos.x - maxNodeX) < 1e-6 || Math.abs(fromPos.x - minNodeX) < 1e-6)) ||
          (isHorizontal && (Math.abs(fromPos.y - maxNodeY) < 1e-6 || Math.abs(fromPos.y - minNodeY) < 1e-6));

        // Perimeter rail should render continuously in blueprint style, even if enabledDirs
        // has custom values on boundary intersections.
        if (!isPerimeterRail && !fromDirEnabled) continue;
        if (!isPerimeterRail && !isNodeDirEnabled(toNode, OPP_DIR[d])) continue;

        const key = `${Math.min(fromPos.x, toPos.x)}:${Math.min(fromPos.y, toPos.y)}:${Math.max(fromPos.x, toPos.x)}:${Math.max(fromPos.y, toPos.y)}`;
        const highlighted = pathEdgeSet.has(`${from}->${to}`);

        if (!renderConnectionLines && !isPerimeterRail && !highlighted) continue;

        if (!highlighted && drawnSegments.has(key)) continue;
        drawnSegments.add(key);

        const a = toScreen(fromPos);
        const b = toScreen(toPos);

        let x1 = a.x;
        let y1 = a.y;
        let x2 = b.x;
        let y2 = b.y;

        const colors = extractLanternColors(raw, map);
        if (!colors.length) {
          const nodeColor = String(toNode?.lantern || '').trim().toLowerCase();
          if (nodeColor) colors.push(nodeColor);
        }

        let stroke = highlighted
          ? '#ffffff'
          : colors.length
            ? colorForLantern(colors[0])
            : blueprint.edgeDefault;
        let strokeWidth = highlighted ? 5 : (colors.length ? 2.2 : 1.15);
        let opacity = highlighted ? 1 : 0;

        const targetGroup = edgeGroup;

        targetGroup.appendChild(makeSvg('line', {
          x1,
          y1,
          x2,
          y2,
          stroke,
          'stroke-width': strokeWidth,
          opacity,
        }));
      }
    }
  }

  if (renderConnectionLines || edgeGroup.childNodes.length > 0) {
    graphSvg.appendChild(edgeGroup);
  }
  if (renderPerimeterBorder) {
    graphSvg.appendChild(perimeterGroup);
  }

  // lantern dots in hallway gaps (slot nodes)
  const dotGroup = makeSvg('g');
  const slotEntries = Object.entries(map.lanternSlots || {});

  for (const [slotId, slotRaw] of slotEntries) {
    const slot = slotRaw && typeof slotRaw === 'object' ? slotRaw : {};
    const color = String(slot.color || '').trim().toLowerCase();

    // Always show gap nodes; unknown colors render as gray placeholders.

    let pos = posById.get(slotId) || null;

    if (!pos && Array.isArray(slot.sides) && slot.sides.length) {
      let sx = 0;
      let sy = 0;
      let count = 0;
      for (const sideId of slot.sides) {
        const p = posById.get(sideId);
        if (!p) continue;
        sx += p.x;
        sy += p.y;
        count += 1;
      }
      if (count) pos = { x: sx / count, y: sy / count };
    }

    if (!pos) continue;

    const s = toScreen(pos);
    const inPath = pathNodeSet.has(slotId);
    const fill = color ? colorForLantern(color) : blueprint.slotFallback;

    if (editMode) {
      const hit = makeSvg('circle', {
        cx: s.x,
        cy: s.y,
        r: 10,
        fill: '#ffffff',
        opacity: 0,
        cursor: 'pointer',
      });

      hit.addEventListener('click', (event) => handleSlotDotClick(slotId, event));
      dotGroup.appendChild(hit);
    }

    const dot = makeSvg('circle', {
      cx: s.x,
      cy: s.y,
      r: inPath ? 5.2 : 4.2,
      fill,
      stroke: inPath ? '#ffffff' : blueprint.slotStroke,
      'stroke-width': inPath ? 1.8 : 1.25,
      opacity: 0.98,
      cursor: (editMode || nodePickMode) ? 'pointer' : 'default',
    });

    addSvgTitle(dot, getNodeOptionText(slotId, map.nodes?.[slotId] || slot));

    if (editMode) {
      dot.addEventListener('click', (event) => handleSlotDotClick(slotId, event));
    } else {
      maybeAttachNodePick(dot, slotId);
    }

    dotGroup.appendChild(dot);
    screenPosById.set(slotId, s);

    if (Array.isArray(slot.conflicts) && slot.conflicts.length > 0) {
      dotGroup.appendChild(makeSvg('circle', {
        cx: s.x,
        cy: s.y,
        r: inPath ? 8.2 : 7,
        fill: 'none',
        stroke: blueprint.conflict,
        'stroke-width': 1.2,
        opacity: 0.9,
        'pointer-events': 'none',
      }));
    }
  }

  graphSvg.appendChild(dotGroup);

  const endpointGroup = makeSvg('g', { 'pointer-events': 'none' });

  function drawEndpointMarker(nodeId, color, label) {
    if (!nodeId) return;
    const s = screenPosById.get(nodeId);
    if (!s) return;

    endpointGroup.appendChild(makeSvg('circle', {
      cx: s.x,
      cy: s.y,
      r: 10,
      fill: 'none',
      stroke: color,
      'stroke-width': 2.4,
      opacity: 0.95,
    }));

    endpointGroup.appendChild(makeSvg('circle', {
      cx: s.x,
      cy: s.y,
      r: 2.2,
      fill: color,
      opacity: 0.95,
    }));

    const txt = makeSvg('text', {
      x: s.x + 8,
      y: s.y - 8,
      fill: color,
      'font-size': 11,
      'font-weight': 700,
      'font-family': blueprint.mapTextFont,
      'text-anchor': 'start',
      'paint-order': 'stroke',
      stroke: blueprint.boardFill,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    });
    txt.textContent = label;
    endpointGroup.appendChild(txt);
  }

  drawEndpointMarker(selectedStartId, '#7cff9a', 'START');
  drawEndpointMarker(selectedEndId, '#ffd166', selectedEndLabel);

  graphSvg.appendChild(endpointGroup);
}

function parseCsvLikeInput(raw) {
  return String(raw || '')
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseLettersInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  if (/[\s,]/.test(text)) {
    return parseCsvLikeInput(text).map((x) => x.toUpperCase());
  }

  return text
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .split('')
    .filter(Boolean);
}

function normalizeDirList(value) {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of list) {
    const d = String(item || '').trim().toUpperCase();
    if (!DIRS.includes(d)) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

function normalizeLanternColor(value) {
  const c = String(value || '').trim().toLowerCase();
  return LANTERN_COLORS.includes(c) ? c : null;
}

const INTERSECTION_TURN_RULE_ALIASES = new Set([
  'intersection',
  'intersections',
  'no_lantern',
  'no-lantern',
  'none',
  'default',
  'hallway',
]);

function normalizeTurnRuleKey(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  if (INTERSECTION_TURN_RULE_ALIASES.has(key)) return 'intersection';
  return normalizeLanternColor(key);
}

function normalizeSelectControl(selectEl) {
  if (!selectEl) return;
  selectEl.multiple = false;
  selectEl.size = 1;
}

function getConstraintItem(type) {
  return builderConstraints.find((x) => x.type === type) || null;
}

function setConstraintItem(type, value) {
  builderConstraints = builderConstraints.filter((x) => x.type !== type);
  builderConstraints.push({ type, value });
}

function removeConstraintItem(type) {
  builderConstraints = builderConstraints.filter((x) => x.type !== type);
}

function syncLegacyPrimaryConstraintControls() {
  const startNode = getConstraintItem('startNode')?.value || DEFAULT_QUERY.startId;
  if (startIdInput && startNode) {
    ensureSelectValue(startIdInput, startNode);
    startIdInput.value = startNode;
  }

  const endNode = getConstraintItem('endNode')?.value;
  if (endIdInput) {
    if (endNode) {
      ensureSelectValue(endIdInput, endNode);
      endIdInput.value = endNode;
    } else {
      endIdInput.value = '';
    }
  }

  const letterMode = getConstraintItem('letterMode')?.value || 'any_order';
  if (letterModeInput) {
    letterModeInput.value = normalizeBuilderLetterMode(letterMode);
  }

  const mustLetters = getConstraintItem('mustUseLetters')?.value;
  if (mustUseLettersInput) {
    mustUseLettersInput.value = Array.isArray(mustLetters) ? formatLettersForInput(mustLetters) : '';
  }
}

function buildConstraintSelectOptions(type) {
  if (type === 'startNode') {
    const opts = [];
    for (const opt of (startIdInput?.querySelectorAll('option') || [])) {
      const value = String(opt.value || '').trim();
      if (!value) continue;
      opts.push({ value, label: opt.textContent || value });
    }
    return opts;
  }

  if (type === 'endNode') {
    const opts = [{ value: '', label: '(none — run until stop)' }];
    for (const opt of (endIdInput?.querySelectorAll('option') || [])) {
      const value = String(opt.value || '').trim();
      if (!value) continue;
      opts.push({ value, label: opt.textContent || value });
    }
    return opts;
  }

  if (type === 'letterMode') {
    return [
      { value: 'any_order', label: 'Any order' },
      { value: 'ordered', label: 'Ordered' },
      { value: 'ordered_strict', label: 'Ordered strict' },
    ];
  }

  if (type === 'startColor' || type === 'allowedColor') {
    return LANTERN_COLORS.map((color) => ({ value: color, label: color }));
  }

  return [];
}

function updateConstraintValueOptions() {
  if (!constraintTypeInput || !constraintValueInput || !constraintValueTextInput) return;

  const type = String(constraintTypeInput.value || 'startNode');
  const useTextInput = type === 'mustUseLetters';

  constraintValueInput.hidden = useTextInput;
  constraintValueTextInput.style.display = useTextInput ? 'block' : 'none';

  if (useTextInput) {
    const existing = getConstraintItem('mustUseLetters');
    constraintValueTextInput.value = Array.isArray(existing?.value)
      ? formatLettersForInput(existing.value)
      : '';
    return;
  }

  const options = buildConstraintSelectOptions(type);
  const prev = String(constraintValueInput.value || '').trim().toLowerCase();

  constraintValueInput.textContent = '';
  for (const item of options) {
    const opt = document.createElement('option');
    opt.value = item.value;
    opt.textContent = item.label;
    constraintValueInput.appendChild(opt);
  }

  const existing = getConstraintItem(type);
  const existingValue = existing?.value;
  if (existingValue !== undefined && existingValue !== null && options.some((x) => x.value === existingValue)) {
    constraintValueInput.value = existingValue;
    return;
  }

  if (prev && options.some((x) => x.value === prev)) {
    constraintValueInput.value = prev;
  } else if (options.length > 0) {
    constraintValueInput.value = options[0].value;
  }
}

function renderConstraintList() {
  if (!constraintListEl) return;
  constraintListEl.innerHTML = '';

  if (!builderConstraints.length) {
    const empty = document.createElement('div');
    empty.className = 'rule-list-empty';
    empty.textContent = 'No constraints added.';
    constraintListEl.appendChild(empty);
    return;
  }

  const typeLabels = {
    startNode: 'Start node',
    endNode: 'End node',
    letterMode: 'Letter mode',
    mustUseLetters: 'Must-use letters',
    startColor: 'Start lantern color',
    allowedColor: 'Allowed lantern color',
  };

  const order = ['startNode', 'endNode', 'letterMode', 'mustUseLetters', 'startColor', 'allowedColor'];
  const indexed = builderConstraints.map((item, index) => ({ item, index }));
  indexed.sort((a, b) => {
    const ai = order.indexOf(a.item.type);
    const bi = order.indexOf(b.item.type);
    if (ai !== bi) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    return a.index - b.index;
  });

  for (const { item, index } of indexed) {
    const row = document.createElement('div');
    row.className = 'rule-item';

    const text = document.createElement('span');
    text.className = 'rule-item-text';

    let valueText = '';
    if (item.type === 'startNode' || item.type === 'endNode') {
      const node = currentMap?.nodes?.[item.value];
      valueText = node ? getNodeOptionText(item.value, node) : String(item.value || '(none)');
    } else if (item.type === 'letterMode') {
      valueText = normalizeBuilderLetterMode(item.value).replace('_', ' ');
    } else if (item.type === 'mustUseLetters') {
      valueText = Array.isArray(item.value) ? item.value.join('') : '';
    } else {
      valueText = String(item.value || '');
    }

    text.textContent = `${typeLabels[item.type] || item.type}: ${valueText || '(none)'}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'rule-item-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', () => {
      builderConstraints.splice(index, 1);
      syncLegacyPrimaryConstraintControls();
      updateConstraintValueOptions();
      renderConstraintList();
      syncQueryPreview();
      if (currentMap) renderGraph(currentMap, lastPathNodes);
    });

    row.appendChild(text);
    row.appendChild(removeBtn);
    constraintListEl.appendChild(row);
  }
}

function renderTurnRuleList() {
  if (!turnRuleListEl) return;
  turnRuleListEl.innerHTML = '';

  if (!builderTurnRules.length) {
    const empty = document.createElement('div');
    empty.className = 'rule-list-empty';
    empty.textContent = 'No turn rules added.';
    turnRuleListEl.appendChild(empty);
    return;
  }

  for (const [index, item] of builderTurnRules.entries()) {
    const row = document.createElement('div');
    row.className = 'rule-item';

    const text = document.createElement('span');
    text.className = 'rule-item-text';
    const keyLabel = item.key === 'intersection' ? 'intersection (no lantern)' : item.key;
    text.textContent = `${keyLabel} → ${item.turn}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'rule-item-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', () => {
      builderTurnRules.splice(index, 1);
      renderTurnRuleList();
      syncQueryPreview();
    });

    row.appendChild(text);
    row.appendChild(removeBtn);
    turnRuleListEl.appendChild(row);
  }
}

function addConstraintFromControls() {
  if (!constraintTypeInput || !constraintValueInput || !constraintValueTextInput) return;

  const type = String(constraintTypeInput.value || '').trim();
  if (!type) return;

  if (type === 'mustUseLetters') {
    const letters = parseLettersInput(constraintValueTextInput.value || '');
    if (!letters.length) {
      removeConstraintItem('mustUseLetters');
    } else {
      setConstraintItem('mustUseLetters', letters);
    }
  } else if (type === 'startNode') {
    const value = String(constraintValueInput.value || '').trim();
    if (!value) return;
    setConstraintItem('startNode', value);
  } else if (type === 'endNode') {
    const value = String(constraintValueInput.value || '').trim();
    if (!value) {
      removeConstraintItem('endNode');
    } else {
      setConstraintItem('endNode', value);
    }
  } else if (type === 'letterMode') {
    const value = normalizeBuilderLetterMode(constraintValueInput.value || 'any_order');
    setConstraintItem('letterMode', value);
  } else if (type === 'startColor') {
    const value = normalizeLanternColor(constraintValueInput.value);
    if (!value) return;
    setConstraintItem('startColor', value);
  } else if (type === 'allowedColor') {
    const value = normalizeLanternColor(constraintValueInput.value);
    if (!value) return;
    if (!builderConstraints.some((x) => x.type === 'allowedColor' && x.value === value)) {
      builderConstraints.push({ type: 'allowedColor', value });
    }
  } else {
    return;
  }

  syncLegacyPrimaryConstraintControls();
  updateConstraintValueOptions();
  renderConstraintList();
  syncQueryPreview();
  if (currentMap) renderGraph(currentMap, lastPathNodes);
}

function addTurnRuleFromControls() {
  if (!turnRuleKeyInput || !turnRuleValueInput) return;

  const keyRaw = String(turnRuleKeyInput.value || '').trim().toLowerCase();
  const turn = String(turnRuleValueInput.value || '').trim().toLowerCase();
  const allowedTurns = new Set(['left', 'right', 'straight', 'back', 'any']);
  if (!allowedTurns.has(turn)) return;

  const key = normalizeTurnRuleKey(keyRaw);
  if (!key) return;

  const existingIndex = builderTurnRules.findIndex((x) => x.key === key);
  if (existingIndex >= 0) {
    builderTurnRules[existingIndex] = { key, turn };
  } else {
    builderTurnRules.push({ key, turn });
  }

  renderTurnRuleList();
  syncQueryPreview();
}

function loadConstraintStateFromQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const lantern = q.lantern && typeof q.lantern === 'object' ? q.lantern : {};

  builderConstraints = [];
  builderTurnRules = [];

  setConstraintItem('startNode', String(q.startId || DEFAULT_QUERY.startId));

  if (q.endId) {
    setConstraintItem('endNode', String(q.endId));
  }

  setConstraintItem('letterMode', normalizeBuilderLetterMode(q.letterMode || 'any_order'));

  const letters = parseLettersInput(
    Array.isArray(q.mustUseLetters)
      ? q.mustUseLetters.join('')
      : (Array.isArray(q.letters) ? q.letters.join('') : '')
  );
  if (letters.length) {
    setConstraintItem('mustUseLetters', letters);
  }

  const startColor = normalizeLanternColor(lantern.startColor || q.startLanternColor || null);
  if (startColor) {
    setConstraintItem('startColor', startColor);
  }

  const allowedColorsRaw = Array.isArray(lantern.allowedColors)
    ? lantern.allowedColors
    : (Array.isArray(q.allowedLanternColors) ? q.allowedLanternColors : []);
  for (const cRaw of allowedColorsRaw) {
    const c = normalizeLanternColor(cRaw);
    if (!c) continue;
    if (!builderConstraints.some((x) => x.type === 'allowedColor' && x.value === c)) {
      builderConstraints.push({ type: 'allowedColor', value: c });
    }
  }

  const turnRules = lantern.turnRules && typeof lantern.turnRules === 'object'
    ? lantern.turnRules
    : (q.turnRules && typeof q.turnRules === 'object' ? q.turnRules : {});

  for (const [keyRaw, turnRaw] of Object.entries(turnRules)) {
    const turn = String(turnRaw || '').trim().toLowerCase();
    if (!['left', 'right', 'straight', 'back', 'any'].includes(turn)) continue;

    const key = normalizeTurnRuleKey(keyRaw);
    if (!key) continue;

    if (!builderTurnRules.some((x) => x.key === key)) {
      builderTurnRules.push({ key, turn });
    }
  }

  if (turnRuleKeyInput) {
    turnRuleKeyInput.value = 'intersection';
  }
  if (turnRuleValueInput) {
    turnRuleValueInput.value = 'left';
  }

  syncLegacyPrimaryConstraintControls();
  updateConstraintValueOptions();
  renderConstraintList();
  renderTurnRuleList();
}

function formatLettersForInput(letters) {
  if (!Array.isArray(letters) || letters.length === 0) return '';
  const allSingle = letters.every((x) => String(x || '').length === 1);
  return allSingle ? letters.join('') : letters.join(', ');
}

function normalizeBuilderLetterMode(modeRaw) {
  const mode = String(modeRaw || '').trim().toLowerCase();
  if (!mode || mode === 'any') return 'any_order';
  if (mode === 'ordered_subsequence' || mode === 'ordered-subsequence' || mode === 'subsequence') {
    return 'ordered';
  }
  if (mode === 'ordered_strict' || mode === 'ordered-strict' || mode === 'strict') {
    return 'ordered_strict';
  }
  if (mode === 'ordered') return 'ordered';
  return 'any_order';
}

function ensureSelectValue(selectEl, value) {
  if (!selectEl || !value) return;
  const normalized = String(value);
  const has = [...selectEl.options].some((opt) => opt.value === normalized);
  if (!has) {
    const opt = document.createElement('option');
    opt.value = normalized;
    opt.textContent = normalized;
    selectEl.appendChild(opt);
  }
  selectEl.value = normalized;
}

function getNodeFriendlyLabel(nodeId, nodeRaw) {
  const node = nodeRaw && typeof nodeRaw === 'object' ? nodeRaw : {};
  const kind = String(node.kind || '').trim().toLowerCase();

  if (kind === 'room' || kind === 'room-center') {
    const roomName =
      typeof node.roomName === 'string' && node.roomName.trim()
        ? node.roomName.trim()
        : (typeof node.name === 'string' && node.name.trim() ? node.name.trim() : null);
    const letter = node.letter ? ` · letter ${String(node.letter).toUpperCase()}` : '';
    if (roomName) return `${roomName}${letter}`;
    return `room${letter}`;
  }

  if (kind === 'intersection') {
    const m = String(nodeId).match(/^i\(([-\d.]+),([-\d.]+)\)$/i);
    if (m) return `intersection (${m[1]}, ${m[2]})`;
    return 'intersection';
  }

  if (kind === 'lantern') {
    const id = String(nodeId);
    let m = id.match(/^g\(([A-Z]+-?\d+)-([A-Z]+-?\d+)\)$/i);
    if (m) return `gap between ${m[1].toUpperCase()} and ${m[2].toUpperCase()}`;
    m = id.match(/^g\(\^([A-Z]+-?\d+)\)$/i);
    if (m) return `gap north of ${m[1].toUpperCase()}`;
    m = id.match(/^g\(v([A-Z]+-?\d+)\)$/i);
    if (m) return `gap south of ${m[1].toUpperCase()}`;
    m = id.match(/^g\(<([A-Z]+-?\d+)\)$/i);
    if (m) return `gap west of ${m[1].toUpperCase()}`;
    m = id.match(/^g\(([A-Z]+-?\d+)>\)$/i);
    if (m) return `gap east of ${m[1].toUpperCase()}`;
    return 'gap / lantern node';
  }

  return kind || 'node';
}

function getNodeOptionText(nodeId, node) {
  return `${nodeId} — ${getNodeFriendlyLabel(nodeId, node)}`;
}

function getSortedNodeEntries(map) {
  const entries = Object.entries(map?.nodes || {});
  const kindOrder = {
    room: 0,
    'room-center': 0,
    lantern: 1,
    intersection: 2,
  };

  entries.sort(([idA, nodeA], [idB, nodeB]) => {
    const a = nodeA || {};
    const b = nodeB || {};

    const ka = kindOrder[String(a.kind || '').toLowerCase()] ?? 9;
    const kb = kindOrder[String(b.kind || '').toLowerCase()] ?? 9;
    if (ka !== kb) return ka - kb;

    if (typeof a.y === 'number' && typeof b.y === 'number' && a.y !== b.y) {
      return b.y - a.y;
    }
    if (typeof a.x === 'number' && typeof b.x === 'number' && a.x !== b.x) {
      return a.x - b.x;
    }

    return idA.localeCompare(idB, undefined, { numeric: true });
  });

  return entries;
}

function refreshNodeSelectOptions(map) {
  if (!startIdInput || !endIdInput) return;

  const entries = getSortedNodeEntries(map);
  const startCurrent = startIdInput.value;
  const endCurrent = endIdInput.value;

  const grouped = {
    rooms: [],
    gaps: [],
    intersections: [],
    other: [],
  };

  for (const [id, node] of entries) {
    const kind = String((node && node.kind) || '').trim().toLowerCase();
    if (kind === 'room' || kind === 'room-center') {
      grouped.rooms.push([id, node]);
    } else if (kind === 'lantern') {
      grouped.gaps.push([id, node]);
    } else if (kind === 'intersection') {
      grouped.intersections.push([id, node]);
    } else {
      grouped.other.push([id, node]);
    }
  }

  const groupsInOrder = [
    ['Rooms', grouped.rooms],
    ['Gaps / Lantern nodes', grouped.gaps],
    ['Intersections', grouped.intersections],
    ['Other', grouped.other],
  ];

  function populateNodeSelect(selectEl, { includeNone = false } = {}) {
    if (!selectEl) return;
    selectEl.textContent = '';

    if (includeNone) {
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = '(none — run until stop)';
      selectEl.appendChild(noneOpt);
    }

    for (const [label, list] of groupsInOrder) {
      if (!list.length) continue;
      const groupEl = document.createElement('optgroup');
      groupEl.label = label;

      for (const [id, node] of list) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = getNodeOptionText(id, node);
        groupEl.appendChild(opt);
      }

      selectEl.appendChild(groupEl);
    }
  }

  populateNodeSelect(startIdInput, { includeNone: false });
  populateNodeSelect(endIdInput, { includeNone: true });

  ensureSelectValue(startIdInput, startCurrent || map?.startId || DEFAULT_QUERY.startId);

  if (endCurrent === '') {
    endIdInput.value = '';
  } else {
    ensureSelectValue(endIdInput, endCurrent || DEFAULT_QUERY.endId);
  }

  updateConstraintValueOptions();
}

function updateNodePickUI() {
  if (pickStartBtn) {
    pickStartBtn.classList.toggle('pick-active', nodePickMode === 'start');
  }
  if (pickEndBtn) {
    pickEndBtn.classList.toggle('pick-active', nodePickMode === 'end');
  }

  if (pickHint) {
    if (editMode && nodePickMode) {
      pickHint.textContent = 'Turn off edit mode to pick start/end from the map.';
    } else if (nodePickMode === 'start') {
      pickHint.textContent = 'Click a node on the map to set the start node.';
    } else if (nodePickMode === 'end') {
      pickHint.textContent = 'Click a node on the map to set the end node.';
    } else {
      pickHint.textContent = 'Tip: use these to click start/end directly on the map.';
    }
  }
}

function setNodePickMode(mode) {
  if (editMode) {
    setSummary('Turn off edit mode before selecting start/end from the map.', true);
    return;
  }

  nodePickMode = nodePickMode === mode ? null : mode;
  updateNodePickUI();
  if (currentMap) renderGraph(currentMap, lastPathNodes);
}

function handleGraphNodePick(nodeId, event) {
  if (!nodePickMode || editMode) return false;
  if (!nodeId) return false;

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (nodePickMode === 'start') {
    setConstraintItem('startNode', nodeId);
  } else if (nodePickMode === 'end') {
    setConstraintItem('endNode', nodeId);
  }

  const pickedMode = nodePickMode;
  nodePickMode = null;
  updateNodePickUI();

  syncLegacyPrimaryConstraintControls();
  updateConstraintValueOptions();
  renderConstraintList();
  syncQueryPreview();
  setSummary(`Set ${pickedMode} node: ${nodeId}`);

  if (currentMap) {
    renderGraph(currentMap, lastPathNodes);
  }

  return true;
}

function maybeAttachNodePick(el, nodeId) {
  if (!el || !nodeId) return;
  if (!nodePickMode || editMode) return;

  el.setAttribute('cursor', 'crosshair');
  el.addEventListener('click', (event) => {
    handleGraphNodePick(nodeId, event);
  });
}

function buildQueryFromBuilder() {
  const query = {};

  const startNode = getConstraintItem('startNode')?.value || DEFAULT_QUERY.startId;
  if (startNode) query.startId = String(startNode);

  const endNode = getConstraintItem('endNode')?.value;
  if (endNode) query.endId = String(endNode);

  const maxSteps = Number(maxStepsInput?.value);
  if (Number.isFinite(maxSteps) && maxSteps > 0) {
    query.maxSteps = Math.floor(maxSteps);
  }

  const maxStates = Number(maxStatesInput?.value);
  if (Number.isFinite(maxStates) && maxStates > 0) {
    query.maxStates = Math.floor(maxStates);
  }

  const runMode = String(runModeInput?.value || 'solve').trim().toLowerCase();
  if (runMode === 'simulate') {
    query.mode = 'simulate';
  }

  const letterMode = normalizeBuilderLetterMode(getConstraintItem('letterMode')?.value || 'any_order');
  query.letterMode = letterMode;

  const letters = Array.isArray(getConstraintItem('mustUseLetters')?.value)
    ? getConstraintItem('mustUseLetters').value
    : [];
  if (letters.length) {
    query.mustUseLetters = letters;
  }

  if (simplePathInput && !simplePathInput.checked) {
    query.simplePath = false;
  }

  if (searchModeInput?.value) {
    query.searchMode = searchModeInput.value;
  }

  if (runMode === 'simulate') {
    const simulation = {};

    if (simulationHeadingInput?.value) {
      simulation.initialHeading = String(simulationHeadingInput.value).trim().toUpperCase();
    }

    if (simulationStopOnLoopInput && !simulationStopOnLoopInput.checked) {
      simulation.stopOnLoop = false;
    }

    if (Object.keys(simulation).length > 0) {
      query.simulation = simulation;
    }
  }

  const lantern = {};

  const startColorItem = builderConstraints.find((x) => x.type === 'startColor');
  if (startColorItem?.value) {
    lantern.startColor = startColorItem.value;
  }

  const allowedColors = builderConstraints
    .filter((x) => x.type === 'allowedColor')
    .map((x) => x.value)
    .filter(Boolean);
  if (allowedColors.length) {
    lantern.allowedColors = [...new Set(allowedColors)];
  }

  if (builderTurnRules.length > 0) {
    const turnRules = {};
    for (const item of builderTurnRules) {
      if (!item?.key || !item?.turn) continue;
      turnRules[item.key] = item.turn;
    }
    if (Object.keys(turnRules).length > 0) {
      lantern.turnRules = turnRules;
    }
  }

  if (Object.keys(lantern).length > 0) {
    query.lantern = lantern;
  }

  return query;
}

function setBuilderFromQuery(queryRaw) {
  lastRunInfo = null;

  const query = queryRaw && typeof queryRaw === 'object' ? queryRaw : {};
  const simulationConfig = query.simulation && typeof query.simulation === 'object' ? query.simulation : {};

  const modeRaw = String(query.mode || query.runMode || '').trim().toLowerCase();
  const isSimulation =
    modeRaw.startsWith('sim') ||
    query.simulation === true ||
    (query.simulation && typeof query.simulation === 'object');

  setSettingsMode(isSimulation ? 'simulate' : 'solve', { syncRunMode: true });


  if (maxStepsInput) {
    maxStepsInput.value = Number.isFinite(Number(query.maxSteps))
      ? Math.max(1, Math.floor(Number(query.maxSteps)))
      : (DEFAULT_QUERY.maxSteps || 120);
  }

  if (maxStatesInput) {
    maxStatesInput.value = Number.isFinite(Number(query.maxStates)) && Number(query.maxStates) > 0
      ? Math.floor(Number(query.maxStates))
      : '';
  }


  if (simplePathInput) {
    const simplePathDefault = !(query.allowCrossing || query.allowCircuit || query.allowCircuits || query.allowLoops);
    simplePathInput.checked = query.simplePath !== false && simplePathDefault;
  }

  if (searchModeInput) {
    const mode = String(query.searchMode || '').trim().toLowerCase();
    searchModeInput.value = mode === 'dfs' || mode === 'bfs' ? mode : '';
  }

  if (simulationHeadingInput) {
    const heading = normalizeDirList(
      simulationConfig.initialHeading ||
      simulationConfig.initialDir ||
      query.initialHeading ||
      query.initialDir ||
      query.heading ||
      []
    )[0] || '';
    simulationHeadingInput.value = heading;
  }

  if (simulationStopOnLoopInput) {
    const stopOnLoop = (simulationConfig.stopOnLoop ?? query.stopOnLoop) !== false;
    simulationStopOnLoopInput.checked = stopOnLoop;
  }

  loadConstraintStateFromQuery(query);

  syncQueryPreview({ force: true });
}

function syncQueryPreview({ force = false } = {}) {
  if (!queryEl) return;
  if (useQueryOverrideInput?.checked && !force) return;
  queryEl.value = pretty(buildQueryFromBuilder());
}

function getQueryForSolve() {
  if (useQueryOverrideInput?.checked) {
    return parseJsonFromTextarea(queryEl, 'Query override');
  }
  return buildQueryFromBuilder();
}

async function loadDefaults() {
  const [mapRes, examplesRes] = await Promise.all([
    fetchJson(STATIC_PATHS.defaultMap),
    fetchJson(STATIC_PATHS.examples),
  ]);

  if (!mapRes.resp.ok) throw new Error('Failed to load default map');
  if (!examplesRes.resp.ok) throw new Error('Failed to load example queries');

  const map = mapRes.data;
  const loadedExamples = examplesRes.data;

  examples = loadedExamples && typeof loadedExamples === 'object' ? loadedExamples : {};
  defaultMapTemplate = deepClone(map);

  resultEl.textContent = '';
  clearResultPanels();
  lastPathNodes = [];
  lastRunInfo = null;
  lastResult = null;
  setCurrentMap(map, { rerender: true });

  if (useQueryOverrideInput) {
    useQueryOverrideInput.checked = false;
  }

  setBuilderFromQuery(DEFAULT_QUERY);
  setSummary('Ready (static mode). Build a query and click Solve.');
}

function parseJsonFromTextarea(el, label) {
  const raw = el.value.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${label} JSON is invalid: ${err.message}`);
  }
}

function formatShareTimestamp(createdAt) {
  if (!createdAt) return '';
  const time = new Date(createdAt);
  if (Number.isNaN(time.getTime())) return '';
  return time.toLocaleString();
}

function applyHydratedShareState(shared, { source = 'share' } = {}) {
  const payload = shared && typeof shared === 'object' ? shared : {};

  if (payload.map && typeof payload.map === 'object') {
    setCurrentMap(payload.map, { rerender: false });
  }

  if (useQueryOverrideInput) {
    useQueryOverrideInput.checked = false;
  }

  setBuilderFromQuery(payload.query && typeof payload.query === 'object' ? payload.query : DEFAULT_QUERY);

  const sourceLabel = source === 'static' ? 'URL share' : 'shared state';

  if (payload.result && typeof payload.result === 'object') {
    const timestamp = formatShareTimestamp(payload.createdAt);
    applyResultState(payload.result, {
      isHttpOk: payload.result.success !== false,
      summaryText: timestamp
        ? `Loaded ${sourceLabel} result from ${timestamp}.`
        : `Loaded ${sourceLabel} result.`,
      isError: payload.result.success === false,
    });
  } else {
    clearMostRecentResults({ rerender: false });
    renderGraph(currentMap, lastPathNodes);
    const timestamp = formatShareTimestamp(payload.createdAt);
    setSummary(
      timestamp
        ? `Loaded ${sourceLabel} map and query from ${timestamp}.`
        : `Loaded ${sourceLabel} map and query.`
    );
  }

  return true;
}

async function hydrateFromShareIfPresent() {
  const shareToken = String(new URL(window.location.href).searchParams.get('share') || '').trim();
  if (!shareToken) return false;

  setSummary('Loading shared state...');

  if (!shareToken.startsWith(SHARE_TOKEN_PREFIX)) {
    setSummary('Unsupported share format. Static mode requires ?share=s1.<token>.', true);
    return false;
  }

  try {
    const shared = decodeStaticShareToken(shareToken);
    return applyHydratedShareState(shared, { source: 'static' });
  } catch (err) {
    setSummary(err.message || 'Failed to load static share.', true);
    return false;
  }
}

async function runSolve() {
  if (!currentMap) {
    setSummary('No map loaded.', true);
    return;
  }

  let query;
  try {
    query = getQueryForSolve();
  } catch (err) {
    setSummary(err.message, true);
    return;
  }

  setSummary('Solving...');
  resultEl.textContent = '';
  clearResultPanels();
  lastPathNodes = [];
  lastRunInfo = null;
  lastResult = null;
  renderGraph(currentMap, lastPathNodes);

  let result;
  let isHttpOk = true;

  try {
    const solve = await getBrowserSolve();
    result = solve(currentMap, query);
  } catch (err) {
    result = {
      success: false,
      error: err.message || String(err),
    };
    isHttpOk = false;
  }

  applyResultState(result, { isHttpOk });

  if (!isHttpOk || result.success === false) {
    const msg = result.error || result.message || 'No solution found.';
    setSummary(msg, true);
    if (resultRawDetailsEl) resultRawDetailsEl.open = true;
    return;
  }

  const roomStepCount = Number.isFinite(Number(result?.path?.steps))
    ? Number(result.path.steps)
    : null;
  const moveCount = Number.isFinite(Number(result?.path?.moveCount))
    ? Number(result.path.moveCount)
    : (Array.isArray(result?.path?.moves) ? result.path.moves.length : null);

  const stepText = roomStepCount !== null
    ? `${formatNumber(roomStepCount)} steps`
    : 'unknown steps';
  const moveText = Number.isFinite(Number(moveCount))
    ? `${formatNumber(moveCount)} moves`
    : null;
  const stateText = Number.isFinite(Number(result.exploredStates))
    ? `${formatNumber(result.exploredStates)} states explored`
    : null;

  const parts = [stepText];
  if (moveText) parts.push(moveText);
  if (stateText) parts.push(stateText);

  const mode = String(result.mode || '').toLowerCase();
  const isSimulation = mode === 'simulation' || mode === 'simulate';

  if (isSimulation) {
    const stopText = result.stopReason ? humanizeStopReason(result.stopReason) : 'stopped';
    setSummary(`Simulation run (local): ${parts.join(' · ')} · ${stopText}.`);
  } else {
    setSummary(`Solved (local) in ${parts.join(' · ')}.`);
  }
}

function wireExamples() {
  document.querySelectorAll('[data-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-example');
      const example = examples[key];
      if (!example) return;

      if (useQueryOverrideInput) {
        useQueryOverrideInput.checked = false;
      }

      setBuilderFromQuery(example);
      setSummary(`Loaded example query: ${key}`);
    });
  });
}

if (loadDefaultBtn) {
  loadDefaultBtn.addEventListener('click', async () => {
    try {
      await loadDefaults();
    } catch (err) {
      setSummary(err.message, true);
    }
  });
}

solveBtn.addEventListener('click', async () => {
  try {
    focusMapView();
    await runSolve();
  } catch (err) {
    setSummary(err.message, true);
  }
});

if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    try {
      await shareCurrentState();
    } catch (err) {
      setSummary(err.message || String(err), true);
    }
  });
}

if (saveMapBtn) {
  saveMapBtn.addEventListener('click', async () => {
    try {
      await saveMapToServer();
    } catch (err) {
      setSummary(err.message || String(err), true);
    }
  });
}

if (pickStartBtn) {
  pickStartBtn.addEventListener('click', () => {
    setNodePickMode('start');
  });
}

if (pickEndBtn) {
  pickEndBtn.addEventListener('click', () => {
    setNodePickMode('end');
  });
}

for (const btn of settingsTabButtons) {
  btn.addEventListener('click', () => {
    const nextMode = btn.getAttribute('data-settings-tab') || 'solve';
    setSettingsMode(nextMode, { syncRunMode: true });
  });
}

if (runModeInput) {
  runModeInput.addEventListener('change', () => {
    setSettingsMode(runModeInput.value, { syncRunMode: false });
  });
}

if (saveMapCardBtn) {
  saveMapCardBtn.addEventListener('click', async () => {
    try {
      await saveMapToServer();
    } catch (err) {
      setSummary(err.message || String(err), true);
    }
  });
}

for (const selectEl of [
  startIdInput,
  endIdInput,
  letterModeInput,
  runModeInput,
  searchModeInput,
  simulationHeadingInput,
  constraintTypeInput,
  constraintValueInput,
  turnRuleKeyInput,
  turnRuleValueInput,
]) {
  normalizeSelectControl(selectEl);
}

const builderInputs = [
  maxStepsInput,
  maxStatesInput,
  runModeInput,
  simplePathInput,
  searchModeInput,
  simulationHeadingInput,
  simulationStopOnLoopInput,
  constraintTypeInput,
  constraintValueInput,
  constraintValueTextInput,
  turnRuleKeyInput,
  turnRuleValueInput,
].filter(Boolean);

function handleBuilderInputChange() {
  lastRunInfo = null;
  syncQueryPreview();
  if (currentMap) {
    renderGraph(currentMap, lastPathNodes);
  }
}

for (const inputEl of builderInputs) {
  inputEl.addEventListener('input', handleBuilderInputChange);
  inputEl.addEventListener('change', handleBuilderInputChange);
}

const gridViewInputs = [
  viewShowRoomIdInput,
  viewShowRoomLetterInput,
  viewShowRoomNameInput,
  viewColorBordersByRoomInput,
].filter(Boolean);

for (const inputEl of gridViewInputs) {
  inputEl.addEventListener('change', () => {
    if (currentMap) {
      renderGraph(currentMap, lastPathNodes);
    }
  });
}

if (constraintTypeInput) {
  constraintTypeInput.addEventListener('change', () => {
    updateConstraintValueOptions();
    syncQueryPreview();
  });
}

if (addConstraintBtn) {
  addConstraintBtn.addEventListener('click', () => {
    addConstraintFromControls();
  });
}

if (addTurnRuleBtn) {
  addTurnRuleBtn.addEventListener('click', () => {
    addTurnRuleFromControls();
  });
}

if (useQueryOverrideInput && queryEl) {
  const syncOverrideState = () => {
    queryEl.readOnly = !useQueryOverrideInput.checked;
    if (!useQueryOverrideInput.checked) {
      syncQueryPreview({ force: true });
    }
  };

  useQueryOverrideInput.addEventListener('change', syncOverrideState);
  syncOverrideState();
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!currentMap) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderGraph(currentMap, lastPathNodes);
  }, 80);
});

(async () => {
  try {
    updateEditModeButton();
    await loadDefaults();
    wireExamples();
    await hydrateFromShareIfPresent();
  } catch (err) {
    setSummary(err.message, true);
  }
})();

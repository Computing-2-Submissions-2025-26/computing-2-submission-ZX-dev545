import model from "./model.js";
import R from "./ramda.js";

const CHIP_PALETTE = [
  "#9fd9ff",
  "#ffd38d",
  "#b7f0c1",
  "#ffc0d2",
  "#cab8ff",
  "#a2f0e9",
  "#f8d3a7",
  "#d4ddff",
];

const state = {
  graph: null,
  nodes: [],
  slots: [],
  edges: [],
  placements: new Map(),
  stripOrder: [],
  checking: false,
  drag: null,
  pendingDrag: null,
  initialized: false,
  selectedNodeId: null,
  gameState: "menu",
  timerStart: null,
  timerElapsed: 0,
  timerHandle: null,
  completionHandle: null,
  finalTimeText: "0:00",
  pendingCompletion: false,
  view: { x: 0, y: 0, scale: 1 },
  pan: null,
  hintCount: 0,
  kb: { active: false, nodeIndex: 0, slotIndex: 0 },
  targetInputCount: null,
  pseudonyms: new Map(),
  cheatRevealed: false,
};

const dom = {};

const WORLD_W = 1680;
const WORLD_H = 1040;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(values) {
  const items = values.slice();

  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = temp;
  }

  return items;
}

function formatElapsedTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes + ":" + String(seconds).padStart(2, "0");
}

function updateTimerDisplay() {
  const elapsed = state.timerStart !== null
    ? Date.now() - state.timerStart
    : state.timerElapsed;
  const text = formatElapsedTime(elapsed);

  if (dom.timerText) {
    dom.timerText.textContent = "Time " + text;
  }

  if (dom.menuTime) {
    dom.menuTime.textContent = "Finished in " + text;
  }

  if (dom.finalTime) {
    dom.finalTime.textContent = text;
  }

  state.finalTimeText = text;
}

function stopTimer() {
  if (state.timerHandle !== null) {
    window.clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  if (state.timerStart !== null) {
    state.timerElapsed = Date.now() - state.timerStart;
  }

  state.timerStart = null;
  updateTimerDisplay();
}

function startTimer() {
  stopTimer();
  state.timerElapsed = 0;
  state.timerStart = Date.now();
  updateTimerDisplay();
  state.timerHandle = window.setInterval(updateTimerDisplay, 1000);
}

function setGameState(nextState) {
  state.gameState = nextState;

  if (dom.menuPlayButton) {
    dom.menuPlayButton.textContent = "Play";
  }

  if (dom.playAgainButton) {
    dom.playAgainButton.textContent = "Play again";
  }

  if (dom.app) {
    dom.app.dataset.gameState = nextState;
  }

  if (dom.menuOverlay) {
    dom.menuOverlay.hidden = nextState !== "menu";
  }

  if (dom.completeScreen) {
    dom.completeScreen.hidden = nextState !== "complete";
    dom.completeScreen.setAttribute("aria-hidden", nextState === "complete" ? "false" : "true");
  }

  if (dom.truthTableModal) {
    dom.truthTableModal.hidden = nextState !== "playing";
    dom.truthTableModal.setAttribute("aria-hidden", nextState === "playing" ? "false" : "true");
  }

  if (dom.gameLayout) {
    dom.gameLayout.setAttribute("aria-hidden", nextState === "menu" ? "true" : "false");
  }

  if (nextState !== "playing") {
    stopTimer();
  }
}

function beginPlaying() {
  if (!state.graph) {
    return;
  }

  state.checking = false;
  state.selectedNodeId = null;
  state.hintCount = 0;
  state.kb.active = false;
  generatePseudonyms();
  if (dom.cheatButton) {
    dom.cheatButton.textContent = "Cheat";
  }
  resetPlacements(true);
  setGameState("playing");
  hideTruthTableModal();
  startTimer();
  updateHintDisplay();
  renderBoard();
  fitView();
  window.requestAnimationFrame(fitView);
}

function startFreshGame() {
  if (state.completionHandle !== null) {
    window.clearTimeout(state.completionHandle);
    state.completionHandle = null;
  }

  const buildRandomTruthTable = model.buildRandomTruthTable;
  const buildGraphFromTruthTable = model.buildGraphFromTruthTable;
  
  const inputCount = state.targetInputCount !== null
    ? state.targetInputCount + 1
    : 2 + Math.floor(Math.random() * 3);
  const truthTable = buildRandomTruthTable(inputCount, {
    outputStates: [0, 1],
    shuffleRows: true,
  });
  const freshGraph = buildGraphFromTruthTable(truthTable, "RANDOM");
  
  window.randomTruthTable = truthTable;
  window.graphwrapper = freshGraph;
  
  setGraphSource(freshGraph);
  beginPlaying();
}

function finishGame() {
  if (state.completionHandle !== null) {
    window.clearTimeout(state.completionHandle);
    state.completionHandle = null;
  }

  stopTimer();
  setGameState("complete");
  updateSummary();
  updateHintDisplay();
}

function scheduleFinishGame() {
  if (state.completionHandle !== null) {
    return;
  }

  state.completionHandle = window.setTimeout(function () {
    state.completionHandle = null;
    finishGame();
  }, 500);
}

function loadDom() {
  dom.app = document.getElementById("app");
  dom.menuOverlay = document.getElementById("menuOverlay");
  dom.completeScreen = document.getElementById("completeScreen");
  dom.menuPlayButton = document.getElementById("menuPlayButton");
  dom.playAgainButton = document.getElementById("playAgainButton");
  dom.menuTime = document.getElementById("menuTime");
  dom.finalTime = document.getElementById("finalTime");
  dom.progressText = document.getElementById("progressText");
  dom.timerText = document.getElementById("timerText");
  dom.statusBadge = document.getElementById("statusBadge");
  dom.hintText = document.getElementById("hintText");
  dom.graphTitle = document.getElementById("graphTitle");
  dom.backendLabel = document.getElementById("backendLabel");
  dom.nodeCount = document.getElementById("nodeCount");
  dom.edgeCount = document.getElementById("edgeCount");
  dom.filledCount = document.getElementById("filledCount");
  dom.correctCount = document.getElementById("correctCount");
  dom.shuffleButton = document.getElementById("shuffleButton");
  dom.resetButton = document.getElementById("resetButton");
  dom.checkButton = document.getElementById("checkButton");
  dom.boardViewport = document.getElementById("boardViewport");
  dom.edgeLayer = document.getElementById("edgeLayer");
  dom.slotLayer = document.getElementById("slotLayer");
  dom.tokenLayer = document.getElementById("tokenLayer");
  dom.stripLayer = document.getElementById("stripLayer");
  dom.truthTableModal = document.getElementById("truthPanel");
  dom.truthTableModalTitle = document.getElementById("truthPanelTitle");
  dom.truthTableModalMeta = document.getElementById("truthPanelMeta");
  dom.truthTableModalTable = document.getElementById("truthPanelBody");
  dom.truthTableModalClose = document.getElementById("truthPanelClose");
  dom.truthTableModalEmpty = document.getElementById("truthPanelEmpty");
  dom.batteryShell = document.getElementById("batteryShell");
  dom.batteryReadout = document.getElementById("batteryReadout");
  dom.batteryMeta = document.getElementById("batteryMeta");
  dom.batteryTitle = document.getElementById("batteryTitle");
  dom.worldLayer = document.getElementById("worldLayer");
  dom.multimeterShell = document.getElementById("multimeterShell");
  dom.meterRack = dom.multimeterShell
    ? dom.multimeterShell.parentElement
    : null;
  dom.probeWires = document.getElementById("probeWires");
  dom.finalHints = document.getElementById("finalHints");
  dom.zoomInBtn = document.getElementById("zoomInBtn");
  dom.zoomOutBtn = document.getElementById("zoomOutBtn");
  dom.zoomResetBtn = document.getElementById("zoomResetBtn");
  dom.menuDiffInput = document.getElementById("menuDiffInput");
  dom.completeDiffInput = document.getElementById("completeDiffInput");
  dom.cheatButton = document.getElementById("cheatButton");
}

function readBackendGraph() {
  const backend = window.graphwrapper;

  if (!backend) {
    return null;
  }

  if (typeof backend.getGameData === "function") {
    return backend.getGameData();
  }

  if (typeof backend.getGraphData === "function") {
    return backend.getGraphData();
  }

  if (typeof backend.buildGameData === "function") {
    return backend.buildGameData();
  }

  return backend.graphData || backend.gameData || backend.data || backend;
}

function getNodeName(node, index) {
  return String(node.name || node.label || node.id || "Node " + (index + 1));
}

function generatePseudonyms() {
  state.cheatRevealed = false;
  const gateNodes = R.reject(isFixedNode, state.nodes);
  const letters = gateNodes.map(function (_, i) {
    return String.fromCharCode(65 + i);
  });
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = letters[i];
    letters[i] = letters[j];
    letters[j] = tmp;
  }
  state.pseudonyms = new Map();
  gateNodes.forEach(function (node, i) {
    state.pseudonyms.set(node.id, letters[i]);
  });
}

function getNodeLabel(node) {
  if (state.cheatRevealed) return node.label;
  const pseudo = state.pseudonyms.get(node.id);
  return pseudo !== undefined ? pseudo : node.label;
}

function isGraphWrapper(graph) {
  return Boolean(graph && Array.isArray(graph.neurones));
}

function isFixedNode(node) {
  return Boolean(node) && (node.nodeType === "input" || node.nodeType === "output");
}

function getNodeTypeIndex(node) {
  let index = 0;

  for (let position = 0; position < state.nodes.length; position += 1) {
    const candidate = state.nodes[position];

    if (candidate.nodeType !== node.nodeType) {
      continue;
    }

    if (candidate.id === node.id) {
      return index;
    }

    index += 1;
  }

  return 0;
}

function getRandomTruthTable() {
  return state.graph && state.graph.graphWrapper && state.graph.graphWrapper.truthTable
    ? state.graph.graphWrapper.truthTable
    : window.randomTruthTable || null;
}

function getRandomTruthTableColumnForNode(node) {
  const truthTable = getRandomTruthTable();

  if (!truthTable || !Array.isArray(truthTable.columns) || !Array.isArray(truthTable.rows)) {
    return null;
  }

  const nodeTypeIndex = getNodeTypeIndex(node);
  const columnIndex = node.nodeType === "output"
    ? truthTable.columns.length - 1
    : nodeTypeIndex;

  if (columnIndex < 0 || columnIndex >= truthTable.columns.length) {
    return null;
  }

  return {
    columns: [truthTable.columns[columnIndex]],
    rows: truthTable.rows.map(function (row) {
      const cells = Array.isArray(row.cells) ? row.cells : [];
      let value;

      if (node.nodeType === "output") {
        value = row.output !== undefined ? row.output : cells[columnIndex];
      } else if (Array.isArray(row.inputs) && row.inputs.length > nodeTypeIndex) {
        value = row.inputs[nodeTypeIndex];
      } else {
        value = cells[columnIndex];
      }

      return [String(value)];
    }),
    meta: truthTable.rows.length + " row" + (truthTable.rows.length === 1 ? "" : "s"),
  };
}

function buildNodeTypeBuckets(nodes) {
  const grouped = R.groupBy(
    node => node.nodeType || node.kind || "gate", nodes
  );
  return Object.assign({ input: [], gate: [], output: [] }, grouped);
}

function normalizeGraph(source) {
  if (!source) {
    return null;
  }

  if (isGraphWrapper(source)) {
    const nodes = source.neurones.map(function (neurone, index) {
      return {
        id: String(neurone.name || "node-" + (index + 1)),
        label: String(neurone.name || "Node " + (index + 1)),
        nodeType: String(neurone.nodeType || neurone.kind || "gate"),
        color: CHIP_PALETTE[index % CHIP_PALETTE.length],
        truthTable: neurone.truthTable instanceof Map ? neurone.truthTable : new Map(),
        neurone: neurone,
      };
    });
    const buckets = buildNodeTypeBuckets(nodes);

    function generateRandomSlotPosition(existingSlots, minDistance) {
      let position;
      let attempts = 0;
      const maxAttempts = 50;

      do {
        position = {
          x: 15 + Math.random() * 70,
          y: 15 + Math.random() * 70,
        };
        attempts += 1;

        if (attempts >= maxAttempts) {
          break;
        }

        const tooClose = existingSlots.some(function (slot) {
          const dx = position.x - slot.x;
          const dy = position.y - slot.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          return distance < minDistance;
        });

        if (!tooClose) {
          break;
        }
      } while (attempts < maxAttempts);

      return position;
    }

    const slots = [];
    const minDistance = 20;

    nodes.forEach(function (node) {
      const pos = generateRandomSlotPosition(slots, minDistance);
      slots.push({
        id: node.id,
        label: node.label,
        x: pos.x,
        y: pos.y,
        width: 140,
        height: 72,
        nodeId: node.id,
      });
    });

    const nodeById = new Map(nodes.map(function (node) {
      return [node.id, node];
    }));
    const edges = [];

    source.neurones.forEach(function (neurone) {
      if (!neurone || !Array.isArray(neurone.inputs)) {
        return;
      }

      neurone.inputs.forEach(function (inputNeurone, inputIndex) {
        if (!inputNeurone || !inputNeurone.name || !nodeById.has(inputNeurone.name)) {
          return;
        }

        edges.push({ from: String(inputNeurone.name), to: String(neurone.name), toPort: inputIndex + 1 });
      });
    });

    return {
      id: String(source.id || "graphwrapper"),
      title: String(source.title || source.name || "Generated graphwrapper"),
      description: String(source.description || "A graphwrapper generated from a random truth table."),
      sourceLabel: "Loaded graphwrapper",
      nodes: nodes,
      slots: slots,
      edges: edges,
      graphWrapper: source,
    };
  }

  if (Array.isArray(source.nodes) && Array.isArray(source.slots) && Array.isArray(source.edges)) {
    const nodes = source.nodes.map(function (node, index) {
      return {
        id: String(node.id || "node-" + (index + 1)),
        label: String(node.label || node.name || "Node " + (index + 1)),
        nodeType: String(node.nodeType || node.kind || "gate"),
        color: String(node.color || CHIP_PALETTE[index % CHIP_PALETTE.length]),
        truthTable: node.truthTable instanceof Map ? node.truthTable : new Map(),
        neurone: node.neurone || null,
      };
    });

    return {
      id: String(source.id || "graphwrapper"),
      title: String(source.title || source.name || "Generated graphwrapper"),
      description: String(source.description || "A graphwrapper generated from a random truth table."),
      sourceLabel: String(source.sourceLabel || "Loaded graphwrapper"),
      nodes: nodes,
      slots: source.slots.map(function (slot, index) {
        return {
          id: String(slot.id || "slot-" + (index + 1)),
          label: String(slot.label || "Slot " + (index + 1)),
          x: Number.isFinite(Number(slot.x)) ? Number(slot.x) : 50,
          y: Number.isFinite(Number(slot.y)) ? Number(slot.y) : 50,
          width: Number.isFinite(Number(slot.width)) ? Number(slot.width) : 140,
          height: Number.isFinite(Number(slot.height)) ? Number(slot.height) : 72,
          nodeId: String(slot.nodeId || nodes[index % nodes.length].id),
        };
      }),
      edges: source.edges.map(function (edge) {
        return {
          from: String(edge.from || ""),
          to: String(edge.to || ""),
        };
      }),
      graphWrapper: source,
    };
  }

  return null;
}

function getSlotById(slotId) {
  return state.slots.find(function (slot) {
    return slot.id === slotId;
  }) || null;
}

function getNodeById(nodeId) {
  return state.nodes.find(function (node) {
    return node.id === nodeId;
  }) || null;
}

function getNodeAtSlot(slotId) {
  for (const [nodeId, assignedSlotId] of state.placements.entries()) {
    if (assignedSlotId === slotId) {
      return getNodeById(nodeId);
    }
  }

  return null;
}

function boardSize() {
  return {
    width: WORLD_W,
    height: WORLD_H,
  };
}

function slotBounds(slot) {
  const size = boardSize();
  const width = slot.width || 140;
  const height = slot.height || 72;
  const centerX = (slot.x / 100) * size.width;
  const centerY = (slot.y / 100) * size.height;

  return {
    left: clamp(centerX - width / 2, 8, Math.max(8, size.width - width - 8)),
    top: clamp(centerY - height / 2, 8, Math.max(8, size.height - height - 8)),
    width: width,
    height: height,
    cx: centerX,
    cy: centerY,
  };
}

function slotPortPosition(slot, port) {
  const b = slotBounds(slot);
  if (port === "o") {
    return { x: b.left + b.width, y: b.top + b.height / 2 };
  }
  const yFrac = port === 2 ? 0.67 : 0.33;
  return { x: b.left, y: b.top + b.height * yFrac };
}

const PERSONAL_SPACE_RADIUS = 18;
const EDGE_ROUTE_MAX_DEPTH = 8;

function expandBounds(bounds, padding) {
  return {
    left: bounds.left - padding,
    top: bounds.top - padding,
    right: bounds.left + bounds.width + padding,
    bottom: bounds.top + bounds.height + padding,
    cx: bounds.cx,
    cy: bounds.cy,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length,
  };
}

function segmentIntersectsBounds(start, end, bounds) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let t0 = 0;
  let t1 = 1;

  const checks = [
    [-dx, start.x - bounds.left],
    [dx, bounds.right - start.x],
    [-dy, start.y - bounds.top],
    [dy, bounds.bottom - start.y],
  ];

  for (let index = 0; index < checks.length; index += 1) {
    const p = checks[index][0];
    const q = checks[index][1];

    if (p === 0) {
      if (q < 0) {
        return null;
      }
      continue;
    }

    const ratio = q / p;

    if (p < 0) {
      if (ratio > t1) {
        return null;
      }
      if (ratio > t0) {
        t0 = ratio;
      }
    } else {
      if (ratio < t0) {
        return null;
      }
      if (ratio < t1) {
        t1 = ratio;
      }
    }
  }

  if (t0 < 0 || t0 > 1) {
    return null;
  }

  return {
    tEnter: t0,
    tExit: t1,
    point: {
      x: start.x + dx * t0,
      y: start.y + dy * t0,
    },
  };
}

function getSlotCollisionRect(entry) {
  return expandBounds(entry.bounds, PERSONAL_SPACE_RADIUS);
}

function getFirstCollision(start, end, slotBoundsList, ignoreSlotIds) {
  let firstCollision = null;

  for (let index = 0; index < slotBoundsList.length; index += 1) {
    const entry = slotBoundsList[index];

    if (ignoreSlotIds.has(entry.slot.id)) {
      continue;
    }

    const collision = segmentIntersectsBounds(start, end, getSlotCollisionRect(entry));

    if (!collision || collision.tEnter <= 0 || collision.tEnter >= 1) {
      continue;
    }

    if (!firstCollision || collision.tEnter < firstCollision.collision.tEnter) {
      firstCollision = {
        slot: entry.slot,
        bounds: entry.bounds,
        collision: collision,
      };
    }
  }

  return firstCollision;
}

function orthogonalCandidates(start, end) {
  return [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
  ];
}

function scoreCandidate(points, slotBoundsList, ignoreSlotIds) {
  let collisions = 0;
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    length += Math.abs(end.x - start.x) + Math.abs(end.y - start.y);

    if (getFirstCollision(start, end, slotBoundsList, ignoreSlotIds)) {
      collisions += 1;
    }
  }

  return {
    collisions: collisions,
    length: length,
  };
}

function routeOrthogonalPath(start, end, slotBoundsList, ignoreSlotIds, depth) {
  if (depth > EDGE_ROUTE_MAX_DEPTH) {
    return [start, end];
  }

  const candidates = orthogonalCandidates(start, end);
  let bestCandidate = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const points = candidates[index];
    const score = scoreCandidate(points, slotBoundsList, ignoreSlotIds);

    if (score.collisions === 0) {
      return points;
    }

    if (!bestCandidate || score.collisions < bestCandidate.score.collisions || (
      score.collisions === bestCandidate.score.collisions && score.length < bestCandidate.score.length
    )) {
      bestCandidate = {
        points: points,
        score: score,
      };
    }
  }

  if (!bestCandidate) {
    return [start, end];
  }

  let collidingSegmentIndex = -1;
  let collision = null;

  for (let index = 1; index < bestCandidate.points.length; index += 1) {
    const segmentCollision = getFirstCollision(
      bestCandidate.points[index - 1],
      bestCandidate.points[index],
      slotBoundsList,
      ignoreSlotIds,
    );

    if (!segmentCollision) {
      continue;
    }

    collidingSegmentIndex = index - 1;
    collision = segmentCollision;
    break;
  }

  if (!collision) {
    return bestCandidate.points;
  }

  const segmentStart = bestCandidate.points[collidingSegmentIndex];
  const segmentEnd = bestCandidate.points[collidingSegmentIndex + 1];
  const isHorizontal = segmentStart.y === segmentEnd.y;
  const isVertical = segmentStart.x === segmentEnd.x;
  let viaPoint;

  if (isHorizontal) {
    const direction = collision.collision.point.y >= collision.bounds.cy ? 1 : -1;
    viaPoint = {
      x: collision.collision.point.x,
      y: collision.collision.point.y + direction * PERSONAL_SPACE_RADIUS,
    };
  } else if (isVertical) {
    const direction = collision.collision.point.x >= collision.bounds.cx ? 1 : -1;
    viaPoint = {
      x: collision.collision.point.x + direction * PERSONAL_SPACE_RADIUS,
      y: collision.collision.point.y,
    };
  } else {
    viaPoint = {
      x: collision.collision.point.x + PERSONAL_SPACE_RADIUS,
      y: collision.collision.point.y + PERSONAL_SPACE_RADIUS,
    };
  }

  const routeA = routeOrthogonalPath(start, viaPoint, slotBoundsList, ignoreSlotIds, depth + 1);
  const routeB = routeOrthogonalPath(viaPoint, end, slotBoundsList, ignoreSlotIds, depth + 1);

  return routeA.slice(0, -1).concat(routeB);
}

function chooseAnchorPoint(sourceBounds, targetBounds, axis, padding) {
  const anchorPadding = padding === undefined ? PERSONAL_SPACE_RADIUS : padding;

  if (axis === "x") {
    return {
      x: targetBounds.cx >= sourceBounds.cx
        ? sourceBounds.left + sourceBounds.width + anchorPadding
        : sourceBounds.left - anchorPadding,
      y: sourceBounds.cy,
    };
  }

  return {
    x: sourceBounds.cx,
    y: targetBounds.cy >= sourceBounds.cy
      ? sourceBounds.top + sourceBounds.height + anchorPadding
      : sourceBounds.top - anchorPadding,
  };
}

function buildEdgePathPoints(fromBounds, toBounds, slotBoundsList, ignoreSlotIds) {
  const horizontalStart = chooseAnchorPoint(fromBounds, toBounds, "x", 0);
  const horizontalEnd = chooseAnchorPoint(toBounds, fromBounds, "x", 0);
  const verticalStart = chooseAnchorPoint(fromBounds, toBounds, "y", 0);
  const verticalEnd = chooseAnchorPoint(toBounds, fromBounds, "y", 0);

  const horizontalRoute = routeOrthogonalPath(horizontalStart, horizontalEnd, slotBoundsList, ignoreSlotIds, 0);
  const verticalRoute = routeOrthogonalPath(verticalStart, verticalEnd, slotBoundsList, ignoreSlotIds, 0);

  const horizontalScore = scoreCandidate(horizontalRoute, slotBoundsList, ignoreSlotIds);
  const verticalScore = scoreCandidate(verticalRoute, slotBoundsList, ignoreSlotIds);

  const points = horizontalScore.collisions <= verticalScore.collisions
    ? horizontalRoute
    : verticalRoute;

  return points.filter(function (point, index, allPoints) {
    if (index === 0) {
      return true;
    }

    const previous = allPoints[index - 1];
    return previous.x !== point.x || previous.y !== point.y;
  });
}

function chamferPathPoints(points, chamferSize) {
  if (points.length < 3) {
    return points.slice();
  }

  const output = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incomingDx = current.x - previous.x;
    const incomingDy = current.y - previous.y;
    const outgoingDx = next.x - current.x;
    const outgoingDy = next.y - current.y;

    const incomingLength = Math.abs(incomingDx) + Math.abs(incomingDy);
    const outgoingLength = Math.abs(outgoingDx) + Math.abs(outgoingDy);
    const cornerSize = Math.min(chamferSize, incomingLength / 2, outgoingLength / 2);

    if (cornerSize <= 0) {
      output.push(current);
      continue;
    }

    output.push({
      x: current.x - Math.sign(incomingDx) * cornerSize,
      y: current.y - Math.sign(incomingDy) * cornerSize,
    });
    output.push({
      x: current.x + Math.sign(outgoingDx) * cornerSize,
      y: current.y + Math.sign(outgoingDy) * cornerSize,
    });
  }

  output.push(points[points.length - 1]);

  return output.filter(function (point, index, allPoints) {
    if (index === 0) {
      return true;
    }

    const previous = allPoints[index - 1];
    return previous.x !== point.x || previous.y !== point.y;
  });
}

function pointsToPathData(points) {
  if (!points.length) {
    return "";
  }

  const chamferedPoints = chamferPathPoints(points, PERSONAL_SPACE_RADIUS * 0.75);
  let pathData = "M " + chamferedPoints[0].x + " " + chamferedPoints[0].y;

  for (let index = 1; index < chamferedPoints.length; index += 1) {
    pathData += " L " + chamferedPoints[index].x + " " + chamferedPoints[index].y;
  }

  return pathData;
}

function colorToRgba(color, alpha) {
  if (typeof color !== "string" || color[0] !== "#") {
    return "rgba(166, 225, 255, " + alpha + ")";
  }

  let hex = color.slice(1);

  if (hex.length === 3) {
    hex = hex.split("").map(function (part) {
      return part + part;
    }).join("");
  }

  if (hex.length !== 6) {
    return "rgba(166, 225, 255, " + alpha + ")";
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  if ([red, green, blue].some(function (value) {
    return Number.isNaN(value);
  })) {
    return "rgba(166, 225, 255, " + alpha + ")";
  }

  return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
}

function anchorPointOnBounds(sourceBounds, targetBounds, axis, padding) {
  if (axis === "x") {
    return {
      x: targetBounds.cx >= sourceBounds.cx
        ? sourceBounds.left + sourceBounds.width + padding
        : sourceBounds.left - padding,
      y: sourceBounds.cy,
    };
  }

  return {
    x: sourceBounds.cx,
    y: targetBounds.cy >= sourceBounds.cy
      ? sourceBounds.top + sourceBounds.height + padding
      : sourceBounds.top - padding,
  };
}

function trimPathToSlotEdges(points, fromBounds, toBounds) {
  if (points.length < 2) {
    return points.slice();
  }

  const trimmed = points.slice();
  trimmed[0] = anchorPointOnBounds(fromBounds, toBounds, Math.abs(points[1].x - points[0].x) >= Math.abs(points[1].y - points[0].y) ? "x" : "y", 0);
  trimmed[trimmed.length - 1] = anchorPointOnBounds(toBounds, fromBounds, Math.abs(points[points.length - 1].x - points[points.length - 2].x) >= Math.abs(points[points.length - 1].y - points[points.length - 2].y) ? "x" : "y", 0);

  return trimmed;
}

function setStatus(text, tone) {
  if (dom.statusBadge) {
    dom.statusBadge.textContent = text;
    dom.statusBadge.dataset.tone = tone;
  }
}

function countFilled() {
  return state.nodes.reduce(function (count, node) {
    return state.placements.has(node.id) ? count + 1 : count;
  }, 0);
}

function countCorrect() {
  return state.nodes.reduce(function (count, node) {
    return state.placements.get(node.id) === node.id ? count + 1 : count;
  }, 0);
}

function updateSummary() {
  if (!state.graph) {
    if (dom.progressText) {
      dom.progressText.textContent = "0 / 0 placed";
    }
    if (dom.graphTitle) {
      dom.graphTitle.textContent = "Waiting for graph data";
    }
    if (dom.backendLabel) {
      dom.backendLabel.textContent = "No graphwrapper yet";
    }
    if (dom.nodeCount) {
      dom.nodeCount.textContent = "0";
    }
    if (dom.edgeCount) {
      dom.edgeCount.textContent = "0";
    }
    if (dom.filledCount) {
      dom.filledCount.textContent = "0";
    }
    if (dom.correctCount) {
      dom.correctCount.textContent = "0";
    }
    if (dom.hintText) {
      dom.hintText.textContent = "Generate a graphwrapper to populate the board.";
    }
    setStatus("Idle", "neutral");
    return;
  }

  const filled = countFilled();
  const correct = countCorrect();
  const total = state.nodes.length;

  if (dom.progressText) {
    dom.progressText.textContent = filled + " / " + total + " placed";
  }
  if (dom.graphTitle) {
    dom.graphTitle.textContent = state.graph.title;
  }
  if (dom.backendLabel) {
    dom.backendLabel.textContent = state.graph.sourceLabel;
  }
  if (dom.nodeCount) {
    dom.nodeCount.textContent = String(total);
  }
  if (dom.edgeCount) {
    dom.edgeCount.textContent = String(state.edges.length);
  }
  if (dom.filledCount) {
    dom.filledCount.textContent = String(filled);
  }
  if (dom.correctCount) {
    dom.correctCount.textContent = String(correct);
  }
  if (dom.hintText) {
    dom.hintText.textContent = state.checking
      ? correct + " of " + total + " nodes are on their correct slots."
      : state.graph.description;
  }

  if (filled === total && correct === total) {
    setStatus("Solved", "success");
    if (state.gameState === "playing") {
      //scheduleFinishGame();
    }
  } else if (filled === total) {
    setStatus("Ready to check", "warning");
  } else {
    setStatus("In progress", "neutral");
  }
}

function resetPlacements(shuffled) {
  state.placements = new Map();
  state.pendingDrag = null;
  state.drag = null;

  state.nodes.forEach(function (node) {
    if (!isFixedNode(node)) {
      return;
    }

    const slot = state.slots.find(function (candidate) {
      return candidate.nodeId === node.id;
    });

    if (slot) {
      state.placements.set(node.id, slot.id);
    }
  });

  const movableNodeIds = state.nodes
    .filter(function (node) {
      return !isFixedNode(node);
    })
    .map(function (node) {
      return node.id;
    });

  state.stripOrder = shuffled ? shuffle(movableNodeIds) : movableNodeIds;
  state.checking = false;
  state.selectedNodeId = null;
}

function getGraphSlotElements() {
  return state.slots.map(function (slot) {
    const occupant = getNodeAtSlot(slot.id);
    const bounds = slotBounds(slot);
    const element = document.createElement("button");
    const isCorrect = state.checking && occupant && occupant.id === slot.nodeId;
    const isWrong = state.checking && occupant && occupant.id !== slot.nodeId;

    element.type = "button";
    element.className = "slot";
    if (occupant) {
      element.classList.add("is-filled");
    }
    if (isCorrect) {
      element.classList.add("is-correct");
    }
    if (isWrong) {
      element.classList.add("is-wrong");
    }
    element.style.left = bounds.left + "px";
    element.style.top = bounds.top + "px";
    element.style.width = bounds.width + "px";
    element.style.height = bounds.height + "px";
    element.dataset.slotId = slot.id;
    const label = document.createElement("strong");
    label.className = "slot-label";
    label.textContent = slot.label;
    element.appendChild(label);

    const status = document.createElement("span");
    status.className = "slot-status";
    status.textContent = occupant ? occupant.label : "Drop a node here";
    element.appendChild(status);

    const nodeForSlot = state.nodes.find(function (n) {
      return n.id === slot.nodeId;
    });
    const nodeType = nodeForSlot ? nodeForSlot.nodeType : "gate";
    if (nodeType !== "output") {
      const portO = document.createElement("span");
      portO.className = "slot-port slot-port--out";
      portO.setAttribute("aria-hidden", "true");
      element.appendChild(portO);
    }
    if (nodeType !== "input") {
      const port1 = document.createElement("span");
      port1.className = "slot-port slot-port--in1";
      port1.setAttribute("aria-hidden", "true");
      element.appendChild(port1);
      if (nodeType === "gate") {
        const port2 = document.createElement("span");
        port2.className = "slot-port slot-port--in2";
        port2.setAttribute("aria-hidden", "true");
        element.appendChild(port2);
      }
    }

    return element;
  });
}

function maybeFinishGame() {
  if (state.gameState !== "playing") {
    state.pendingCompletion = false;
    return;
  }

  const filled = countFilled();
  const correct = countCorrect();

  if (filled === state.nodes.length && correct === state.nodes.length) {
    finishGame();
  }

  state.pendingCompletion = false;
}

function createNodeToken(node, placed, slot) {
  const element = document.createElement("div");
  const target = slot ? slotBounds(slot) : null;
  const fixedNode = isFixedNode(node);

  element.className = "node-token" + (placed ? " is-placed" : "") + (fixedNode ? " is-fixed" : "");
  element.setAttribute("role", "group");
  element.style.setProperty("--token-color", node.color);
  element.style.setProperty("--token-base", node.color);
  element.dataset.nodeId = node.id;

  if (placed && target) {
    element.style.left = target.left + "px";
    element.style.top = target.top + "px";
    element.style.width = target.width + "px";
    element.style.height = target.height + "px";
  }

  const title = document.createElement("span");
  title.className = "node-token-title";
  title.textContent = getNodeLabel(node);
  element.appendChild(title);

  const meta = document.createElement("span");
  meta.className = "node-token-meta";
  meta.textContent = node.nodeType || "node";
  element.appendChild(meta);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "node-token-action";
  action.textContent = "Probe";
  action.setAttribute("aria-label", getNodeLabel(node) + " truth table");
  action.addEventListener("pointerdown", function (event) {
    event.stopPropagation();
  });
  action.addEventListener("click", function (event) {
    event.stopPropagation();
    event.preventDefault();
    showTruthTableForNode(node.id);
  });
  element.appendChild(action);

  if (!fixedNode) {
    element.addEventListener("pointerdown", startDrag);
  }

  return element;
}

function drawEdges() {
  const size = boardSize();
  dom.edgeLayer.replaceChildren();
  dom.edgeLayer.setAttribute("viewBox", "0 0 " + size.width + " " + size.height);

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  dom.edgeLayer.appendChild(defs);

  state.edges.forEach(function (edge, index) {
    const fromSlot = state.slots.find(function (slot) {
      return slot.nodeId === edge.from || slot.id === edge.from;
    });
    const toSlot = state.slots.find(function (slot) {
      return slot.nodeId === edge.to || slot.id === edge.to;
    });

    if (!fromSlot || !toSlot) {
      return;
    }

    const from = slotPortPosition(fromSlot, "o");
    const to = slotPortPosition(toSlot, edge.toPort || 1);
    const slotBoundsList = state.slots.map(function (slot) {
      return { slot: slot, bounds: slotBounds(slot) };
    });
    const ignoreSlotIds = new Set([fromSlot.id, toSlot.id]);
    const routedPoints = routeOrthogonalPath(
      from, to, slotBoundsList, ignoreSlotIds, 0
    ).filter(function (point, index, allPoints) {
      if (index === 0) return true;
      const prev = allPoints[index - 1];
      return prev.x !== point.x || prev.y !== point.y;
    });
    const pathData = pointsToPathData(routedPoints);

    const originNode = getNodeAtSlot(fromSlot.id);
    const edgeBaseColor = originNode ? originNode.color : "#a6e1ff";
    const edgeStrokeColor = colorToRgba(edgeBaseColor, 0.34);
    const edgeArrowColor = colorToRgba(edgeBaseColor, 0.75);
    const markerId = "arrow-" + index;

    const edgeMarker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    edgeMarker.setAttribute("id", markerId);
    edgeMarker.setAttribute("viewBox", "0 0 10 10");
    edgeMarker.setAttribute("refX", "8");
    edgeMarker.setAttribute("refY", "5");
    edgeMarker.setAttribute("markerWidth", "6");
    edgeMarker.setAttribute("markerHeight", "6");
    edgeMarker.setAttribute("orient", "auto-start-reverse");
    const edgeArrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    edgeArrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    edgeArrow.setAttribute("fill", edgeArrowColor);
    edgeMarker.appendChild(edgeArrow);
    defs.appendChild(edgeMarker);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", edgeStrokeColor);
    path.setAttribute("stroke-width", "2.2");
    path.setAttribute("marker-end", "url(#" + markerId + ")");
    dom.edgeLayer.appendChild(path);
  });
}

function beginDrag(event) {
  const pending = state.pendingDrag;
  if (!pending || state.drag) {
    return;
  }

  const currentRect = pending.element.getBoundingClientRect();
  state.drag = {
    nodeId: pending.nodeId,
    sourceSlotId: pending.sourceSlotId,
    offsetX: pending.offsetX,
    offsetY: pending.offsetY,
    ghost: pending.element.cloneNode(true),
    pointerId: pending.pointerId,
  };

  state.drag.ghost.classList.add("drag-ghost");
  state.drag.ghost.style.width = currentRect.width + "px";
  state.drag.ghost.style.height = currentRect.height + "px";
  state.drag.ghost.style.left = event.clientX - state.drag.offsetX + "px";
  state.drag.ghost.style.top = event.clientY - state.drag.offsetY + "px";
  document.body.appendChild(state.drag.ghost);

  if (state.drag.sourceSlotId) {
    state.placements.delete(state.drag.nodeId);
  }

  scheduleRender();
}

function renderBoard() {
  if (!state.graph) {
    dom.slotLayer.replaceChildren();
    dom.tokenLayer.replaceChildren();
    dom.stripLayer.replaceChildren();
    dom.edgeLayer.replaceChildren();
    updateSummary();
    return;
  }

  drawEdges();

  const slotElements = getGraphSlotElements();
  const placedTokenElements = state.nodes
    .filter(function (node) {
      return state.placements.has(node.id);
    })
    .map(function (node) {
      return createNodeToken(node, true, getSlotById(state.placements.get(node.id)));
    });

  const stripTokenElements = state.stripOrder
    .filter(function (nodeId) {
      return !state.placements.has(nodeId);
    })
    .map(function (nodeId) {
      return createNodeToken(getNodeById(nodeId), false, null);
    });

  dom.slotLayer.replaceChildren.apply(dom.slotLayer, slotElements);
  dom.tokenLayer.replaceChildren.apply(dom.tokenLayer, placedTokenElements);
  dom.stripLayer.replaceChildren.apply(dom.stripLayer, stripTokenElements);
  updateSummary();
  refreshTruthTableModal();
  applyKbHighlight();

  if (state.pendingCompletion) {
    window.requestAnimationFrame(maybeFinishGame);
  }
}

function scheduleRender() {
  window.requestAnimationFrame(renderBoard);
}

function findSlotAtPoint(clientX, clientY) {
  const point = clientToWorld(clientX, clientY);

  return state.slots.find(function (slot) {
    const bounds = slotBounds(slot);
    return point.x >= bounds.left && point.x <= bounds.left + bounds.width && point.y >= bounds.top && point.y <= bounds.top + bounds.height;
  }) || null;
}

function clearGhost() {
  if (state.drag && state.drag.ghost && state.drag.ghost.parentNode) {
    state.drag.ghost.parentNode.removeChild(state.drag.ghost);
  }
}

function updateGhost(event) {
  if (!state.drag || !state.drag.ghost) {
    return;
  }

  state.drag.ghost.style.left = event.clientX - state.drag.offsetX + "px";
  state.drag.ghost.style.top = event.clientY - state.drag.offsetY + "px";

  const hoverSlot = findSlotAtPoint(event.clientX, event.clientY);
  const isOverValidSlot = hoverSlot && getNodeAtSlot(hoverSlot.id) === null;

  if (isOverValidSlot) {
    state.drag.ghost.style.borderColor = "#4ade80";
    state.drag.ghost.style.borderWidth = "3px";
  } else {
    state.drag.ghost.style.borderColor = "rgba(255, 100, 100, 0.6)";
    state.drag.ghost.style.borderWidth = "2px";
  }
}

function onDragMove(event) {
  if (state.gameState !== "playing") {
    return;
  }

  if (state.pendingDrag && !state.drag) {
    const deltaX = Math.abs(event.clientX - state.pendingDrag.originX);
    const deltaY = Math.abs(event.clientY - state.pendingDrag.originY);

    if (deltaX >= 5 || deltaY >= 5) {
      beginDrag(event);
    }
  }

  updateGhost(event);
}

function onDragEnd(event) {
  if (state.gameState !== "playing") {
    return;
  }

  if (state.drag) {
    const draggedNode = getNodeById(state.drag.nodeId);
    const targetSlot = findSlotAtPoint(event.clientX, event.clientY);

    if (draggedNode && targetSlot) {
      const occupant = getNodeAtSlot(targetSlot.id);
  state.pendingCompletion = false;

      if (occupant && occupant.id !== draggedNode.id) {
        if (state.drag.sourceSlotId) {
          state.placements.set(occupant.id, state.drag.sourceSlotId);
        } else {
          state.placements.delete(occupant.id);
        }
      }

      state.placements.set(draggedNode.id, targetSlot.id);
    } else if (!state.drag.sourceSlotId) {
      state.placements.delete(state.drag.nodeId);
    }
  }

  clearGhost();
  dom.boardViewport.removeEventListener("pointermove", onDragMove);
  dom.boardViewport.removeEventListener("pointerup", onDragEnd);
  dom.boardViewport.removeEventListener("pointercancel", onDragEnd);
  state.pendingDrag = null;
  state.drag = null;
  scheduleRender();
  updateSummary();
}

function startDrag(event) {
  event.preventDefault();

  if (state.gameState !== "playing") {
    return;
  }

  const nodeId = event.currentTarget.dataset.nodeId;
  const node = getNodeById(nodeId);

  if (!node || isFixedNode(node)) {
    return;
  }

  const sourceSlotId = state.placements.get(nodeId) || null;
  const currentRect = event.currentTarget.getBoundingClientRect();
  state.pendingDrag = {
    nodeId: nodeId,
    sourceSlotId: sourceSlotId,
    offsetX: event.clientX - currentRect.left,
    offsetY: event.clientY - currentRect.top,
    element: event.currentTarget,
    originX: event.clientX,
    originY: event.clientY,
    pointerId: event.pointerId,
  };

  dom.boardViewport.addEventListener("pointermove", onDragMove);
  dom.boardViewport.addEventListener("pointerup", onDragEnd);
  dom.boardViewport.addEventListener("pointercancel", onDragEnd);

  if (dom.boardViewport.setPointerCapture) {
    dom.boardViewport.setPointerCapture(event.pointerId);
  }

  scheduleRender();
}

function formatTruthTableRows(node) {
  if (isFixedNode(node)) {
    return getRandomTruthTableColumnForNode(node);
  }

  const truthTable = node.neurone && node.neurone.truthTable instanceof Map
    ? node.neurone.truthTable
    : node.truthTable instanceof Map
      ? node.truthTable
      : null;

  if (!truthTable || truthTable.size === 0) {
    return null;
  }

  function cellStr(v) {
    return Array.isArray(v) ? v.join("/") : String(v);
  }

  let inputCount = 0;
  const rawRows = [];
  for (const [inputs, output] of truthTable.entries()) {
    const inArr = Array.isArray(inputs) ? inputs : [inputs];
    if (inArr.length > inputCount) inputCount = inArr.length;
    rawRows.push({ inputs: inArr, output });
  }

  const columns = [];
  for (let i = 0; i < inputCount; i += 1) {
    columns.push("In " + (i + 1));
  }
  columns.push("Out");

  const rows = rawRows.map(function (row) {
    return row.inputs.map(cellStr).concat([cellStr(row.output)]);
  });

  return {
    columns: columns,
    rows: rows,
    meta: rows.length + " row" + (rows.length === 1 ? "" : "s"),
  };
}

function renderTruthTableModal(title, table, meta) {
  if (!dom.truthTableModal || !dom.truthTableModalTitle || !dom.truthTableModalTable) {
    return;
  }

  dom.truthTableModalTitle.textContent = title;
  dom.truthTableModalMeta.textContent = meta;
  dom.truthTableModalTable.replaceChildren();

  if (dom.truthTableModalEmpty) {
    dom.truthTableModalEmpty.hidden = true;
  }

  const section = document.createElement("section");
  section.className = "truth-table-section";

  const tableElement = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const tbody = document.createElement("tbody");

  table.columns.forEach(function (column) {
    const th = document.createElement("th");
    th.textContent = column;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);

  table.rows.forEach(function (row) {
    const tr = document.createElement("tr");
    row.forEach(function (cell) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tableElement.appendChild(thead);
  tableElement.appendChild(tbody);
  section.appendChild(tableElement);
  dom.truthTableModalTable.appendChild(section);
}

function appendTruthTableSection(sectionTitle, sectionTable, sectionMeta) {
  if (!dom.truthTableModalTable) {
    return;
  }

  const section = document.createElement("section");
  section.className = "truth-table-section";

  if (sectionTitle) {
    const heading = document.createElement("h4");
    heading.className = "truth-table-section-title";
    heading.textContent = sectionTitle;
    section.appendChild(heading);
  }

  if (sectionMeta) {
    const subheading = document.createElement("p");
    subheading.className = "truth-table-section-meta";
    subheading.textContent = sectionMeta;
    section.appendChild(subheading);
  }

  const tableElement = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const tbody = document.createElement("tbody");

  sectionTable.columns.forEach(function (column) {
    const th = document.createElement("th");
    th.textContent = column;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);

  sectionTable.rows.forEach(function (row) {
    const tr = document.createElement("tr");
    row.forEach(function (cell) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tableElement.appendChild(thead);
  tableElement.appendChild(tbody);
  section.appendChild(tableElement);
  dom.truthTableModalTable.appendChild(section);
}

function buildPlayerGraph() {
  if (!state.graph || !Array.isArray(state.slots) || state.slots.length === 0) {
    return null;
  }

  const graph = new model.Graph();
  const nodeBySlotId = new Map();

  for (let index = 0; index < state.slots.length; index += 1) {
    const slot = state.slots[index];
    const currentNode = getNodeAtSlot(slot.id);

    if (!currentNode) {
      return null;
    }

    const sourceNeurone = currentNode.neurone || null;
    const neurone = new model.Neurone(
      currentNode.nodeType || (sourceNeurone && sourceNeurone.nodeType) || "gate",
      currentNode.id,
      sourceNeurone && Array.isArray(sourceNeurone.states) ? sourceNeurone.states : [0, 1],
    );

    if (neurone.nodeType === "gate") {
      const truthTable = currentNode.truthTable instanceof Map
        ? currentNode.truthTable
        : sourceNeurone && sourceNeurone.truthTable instanceof Map
          ? sourceNeurone.truthTable
          : new Map();
      const inputStates = sourceNeurone && Array.isArray(sourceNeurone.inputStates)
        ? sourceNeurone.inputStates
        : null;
      const dim = sourceNeurone && typeof sourceNeurone.getDims === "function"
        ? sourceNeurone.getDims()
        : truthTable.size > 0
          ? truthTable.keys().next().value.length
          : 0;

      neurone.setGateFunction(
        dim,
        model.Neurone.createGateFunction(truthTable),
        inputStates,
        truthTable,
      );
    }

    nodeBySlotId.set(slot.id, neurone);
    graph.addNeurone(neurone);
  }

  for (let edgeIndex = 0; edgeIndex < state.edges.length; edgeIndex += 1) {
    const edge = state.edges[edgeIndex];
    const fromSlot = state.slots.find(function (slot) {
      return slot.nodeId === edge.from || slot.id === edge.from;
    });
    const toSlot = state.slots.find(function (slot) {
      return slot.nodeId === edge.to || slot.id === edge.to;
    });

    if (!fromSlot || !toSlot) {
      continue;
    }

    const fromNeurone = nodeBySlotId.get(fromSlot.id);
    const toNeurone = nodeBySlotId.get(toSlot.id);

    if (!fromNeurone || !toNeurone) {
      continue;
    }

    graph.connectNeurones(fromNeurone, toNeurone);
  }

  return graph;
}

function buildPlayerGraphTruthTable() {
  const graph = buildPlayerGraph();

  if (!graph) {
    return null;
  }

  const inputNeurones = graph.neurones.filter(function (neurone) {
    return neurone.nodeType === "input";
  });
  const outputNeurones = graph.neurones.filter(function (neurone) {
    return neurone.nodeType === "output";
  });

  if (outputNeurones.length === 0) {
    return null;
  }

  const inputColumns = inputNeurones.map(function (neurone) {
    return neurone.name;
  });
  const outputColumns = outputNeurones.map(function (neurone) {
    return neurone.name;
  });
  const columns = inputColumns.concat(outputColumns);
  const states = inputNeurones.map(function (neurone) {
    return neurone.getStatesRange();
  });
  const combinations = states.length > 0 ? graph.cartesianProduct(states) : [[]];
  const rows = [];

  for (let comboIndex = 0; comboIndex < combinations.length; comboIndex += 1) {
    const combo = combinations[comboIndex];
    const inputValues = {};

    for (let inputIndex = 0; inputIndex < inputNeurones.length; inputIndex += 1) {
      inputValues[inputNeurones[inputIndex].name] = combo[inputIndex];
    }

    graph.setInputValues(inputValues);
    const values = graph.getCurrentValues();
    const row = [];

    for (let inputColumnIndex = 0; inputColumnIndex < inputColumns.length; inputColumnIndex += 1) {
      row.push(String(values[inputColumns[inputColumnIndex]] ?? model.EMPTY_CELL));
    }

    for (let outputColumnIndex = 0; outputColumnIndex < outputColumns.length; outputColumnIndex += 1) {
      row.push(String(values[outputColumns[outputColumnIndex]] ?? model.EMPTY_CELL));
    }

    rows.push(row);
  }

  return {
    columns: columns,
    rows: rows,
    meta: rows.length + " row" + (rows.length === 1 ? "" : "s"),
  };
}

function buildBatteryData() {
  const target = getRandomTruthTable();
  const rows = target && Array.isArray(target.rows) ? target.rows : [];

  function rowOutput(row) {
    if (row.output !== undefined) {
      return row.output;
    }
    const cells = Array.isArray(row.cells) ? row.cells : [];
    return cells.length ? cells[cells.length - 1] : "";
  }

  const baseCells = rows.map(function (row) {
    return { symbol: String(rowOutput(row)), charged: false };
  });

  if (rows.length === 0) {
    return { connected: false, total: 0, charged: 0, cells: [] };
  }

  const selectedNode = state.selectedNodeId ? getNodeById(state.selectedNodeId) : null;

  if (!selectedNode || !state.placements.has(selectedNode.id)) {
    return { connected: false, total: rows.length, charged: 0, cells: baseCells };
  }

  const probeColumn = buildProbeColumn(selectedNode);

  if (!probeColumn.live) {
    return { connected: false, total: rows.length, charged: 0, cells: baseCells };
  }

  let charged = 0;

  const cells = rows.map(function (row, index) {
    const targetOutput = String(model.normalizeCell(rowOutput(row)));
    const liveValue = probeColumn.cells[index];
    const isCharged = liveValue !== "" && liveValue === targetOutput;

    if (isCharged) {
      charged += 1;
    }

    return { symbol: String(rowOutput(row)), charged: isCharged };
  });

  return { connected: true, total: rows.length, charged: charged, cells: cells };
}

function renderBattery() {
  if (!dom.batteryShell) {
    return;
  }

  const data = buildBatteryData();

  if (dom.batteryReadout) {
    dom.batteryReadout.textContent = data.charged + " / " + data.total;
  }

  if (dom.batteryMeta) {
    if (data.total === 0) {
      dom.batteryMeta.textContent = "Generate a circuit to begin charging.";
    } else if (!data.connected) {
      dom.batteryMeta.textContent = "Output is not driven by the inputs yet — place every card to energise it.";
    } else if (data.charged === data.total) {
      dom.batteryMeta.textContent = "Fully charged — every target row matches.";
    } else {
      dom.batteryMeta.textContent = "Charging — " + data.charged + " of " + data.total + " target rows match.";
    }
  }

  dom.batteryShell.replaceChildren();
  dom.batteryShell.classList.toggle("is-disconnected", !data.connected);
  dom.batteryShell.classList.toggle("is-full", data.connected && data.total > 0 && data.charged === data.total);

  if (data.total === 0) {
    return;
  }

  const battery = document.createElement("div");
  battery.className = "battery";

  const cap = document.createElement("span");
  cap.className = "battery-cap";
  battery.appendChild(cap);

  const body = document.createElement("div");
  body.className = "battery-body";

  data.cells.forEach(function (cell, index) {
    const segment = document.createElement("div");
    segment.className = "battery-segment" + (cell.charged ? " is-charged" : "");
    segment.style.setProperty("--segment-index", String(index));

    const symbol = document.createElement("span");
    symbol.className = "battery-symbol";
    symbol.textContent = cell.symbol;
    segment.appendChild(symbol);

    body.appendChild(segment);
  });

  battery.appendChild(body);
  dom.batteryShell.appendChild(battery);
}

// ---------- pan / zoom view ----------

function clientToWorld(clientX, clientY) {
  const rect = dom.boardViewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.view.x) / state.view.scale,
    y: (clientY - rect.top - state.view.y) / state.view.scale,
  };
}

function applyView() {
  if (dom.worldLayer) {
    dom.worldLayer.style.transform = "translate(" + state.view.x + "px, " + state.view.y + "px) scale(" + state.view.scale + ")";
  }
  updateProbeWires();
}

function fitView() {
  const rect = dom.boardViewport.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H) * 0.96;
  state.view.scale = scale;
  state.view.x = (rect.width - WORLD_W * scale) / 2;
  state.view.y = (rect.height - WORLD_H * scale) / 2;
  applyView();
}

function zoomAround(px, py, factor) {
  const oldScale = state.view.scale;
  const newScale = clamp(oldScale * factor, 0.3, 2.8);
  state.view.x = px - (px - state.view.x) * (newScale / oldScale);
  state.view.y = py - (py - state.view.y) * (newScale / oldScale);
  state.view.scale = newScale;
  applyView();
}

function zoomByButton(factor) {
  const rect = dom.boardViewport.getBoundingClientRect();
  zoomAround(rect.width / 2, rect.height / 2, factor);
}

function onBoardWheel(event) {
  if (state.gameState !== "playing") {
    return;
  }
  event.preventDefault();
  const rect = dom.boardViewport.getBoundingClientRect();
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAround(event.clientX - rect.left, event.clientY - rect.top, factor);
}

function onBoardPointerMove(event) {
  if (!state.pan) {
    return;
  }
  state.view.x = state.pan.ox + (event.clientX - state.pan.startX);
  state.view.y = state.pan.oy + (event.clientY - state.pan.startY);
  applyView();
}

function onBoardPointerUp() {
  state.pan = null;
  if (dom.boardViewport) {
    dom.boardViewport.classList.remove("is-panning");
  }
  window.removeEventListener("pointermove", onBoardPointerMove);
  window.removeEventListener("pointerup", onBoardPointerUp);
}

function onBoardPointerDown(event) {
  if (state.gameState !== "playing") {
    return;
  }
  if (event.target.closest && (event.target.closest(".node-token") || event.target.closest(".zoom-btn"))) {
    return;
  }
  state.pan = {
    startX: event.clientX,
    startY: event.clientY,
    ox: state.view.x,
    oy: state.view.y,
  };
  dom.boardViewport.classList.add("is-panning");
  window.addEventListener("pointermove", onBoardPointerMove);
  window.addEventListener("pointerup", onBoardPointerUp);
}

// ---------- multimeter / probe ----------

function buildPartialPlayerGraph() {
  if (!state.graph) {
    return null;
  }

  const graph = new model.Graph();
  const neuroneBySlotId = new Map();
  const neuroneByNodeId = new Map();

  state.slots.forEach(function (slot) {
    const currentNode = getNodeAtSlot(slot.id);
    if (!currentNode) {
      return;
    }
    const sourceNeurone = currentNode.neurone || null;
    const neurone = new model.Neurone(
      currentNode.nodeType || (sourceNeurone && sourceNeurone.nodeType) || "gate",
      currentNode.id,
      sourceNeurone && Array.isArray(sourceNeurone.states) ? sourceNeurone.states : [0, 1],
    );
    if (neurone.nodeType === "gate") {
      const truthTable = currentNode.truthTable instanceof Map
        ? currentNode.truthTable
        : sourceNeurone && sourceNeurone.truthTable instanceof Map
          ? sourceNeurone.truthTable
          : new Map();
      const inputStates = sourceNeurone && Array.isArray(sourceNeurone.inputStates)
        ? sourceNeurone.inputStates
        : null;
      const dim = sourceNeurone && typeof sourceNeurone.getDims === "function"
        ? sourceNeurone.getDims()
        : truthTable.size > 0
          ? truthTable.keys().next().value.length
          : 0;
      neurone.setGateFunction(dim, model.Neurone.createGateFunction(truthTable), inputStates, truthTable);
    }
    neuroneBySlotId.set(slot.id, neurone);
    neuroneByNodeId.set(currentNode.id, neurone);
    graph.addNeurone(neurone);
  });

  state.edges.forEach(function (edge) {
    const fromSlot = state.slots.find(function (slot) {
      return slot.nodeId === edge.from || slot.id === edge.from;
    });
    const toSlot = state.slots.find(function (slot) {
      return slot.nodeId === edge.to || slot.id === edge.to;
    });
    if (!fromSlot || !toSlot) {
      return;
    }
    const fromNeurone = neuroneBySlotId.get(fromSlot.id);
    const toNeurone = neuroneBySlotId.get(toSlot.id);
    if (fromNeurone && toNeurone) {
      graph.connectNeurones(fromNeurone, toNeurone);
    }
  });

  return { graph: graph, neuroneByNodeId: neuroneByNodeId };
}

function buildProbeColumn(node) {
  const target = getRandomTruthTable();
  const rows = target && Array.isArray(target.rows) ? target.rows : [];
  const blank = { cells: rows.map(function () { return ""; }), live: false };

  if (!node || !state.placements.has(node.id) || rows.length === 0) {
    return blank;
  }

  const built = buildPartialPlayerGraph();
  if (!built) {
    return blank;
  }

  const probe = built.neuroneByNodeId.get(node.id);
  if (!probe) {
    return blank;
  }

  const inputNeurones = built.graph.neurones.filter(function (neurone) {
    return neurone.nodeType === "input";
  });
  inputNeurones.sort(function (a, b) {
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
  });

  function rowInputs(row) {
    if (Array.isArray(row.inputs)) {
      return row.inputs;
    }
    const cells = Array.isArray(row.cells) ? row.cells : [];
    return cells.slice(0, Math.max(0, cells.length - 1));
  }

  let live = false;
  const cells = rows.map(function (row) {
    const inputs = rowInputs(row);
    const inputValues = {};
    for (let index = 0; index < inputNeurones.length; index += 1) {
      inputValues[inputNeurones[index].name] = model.normalizeCell(inputs[index]);
    }
    built.graph.setInputValues(inputValues);
    built.graph.propagateValues();
    const value = probe.value;
    if (value !== null && value !== undefined && value !== model.EMPTY_CELL) {
      live = true;
      return String(model.normalizeCell(value));
    }
    return "";
  });

  return { cells: cells, live: live };
}

function renderMultimeter(node) {
  if (!dom.multimeterShell) {
    return;
  }

  const slotted = Boolean(node && state.placements.has(node.id));
  dom.multimeterShell.replaceChildren();
  dom.multimeterShell.classList.toggle("is-idle", !slotted);

  const meter = document.createElement("div");
  meter.className = "multimeter";

  const head = document.createElement("div");
  head.className = "multimeter-head";
  head.textContent = slotted ? getNodeLabel(node) : "Probe";
  meter.appendChild(head);

  const screen = document.createElement("div");
  screen.className = "multimeter-screen";

  if (slotted) {
    const column = buildProbeColumn(node);
    column.cells.forEach(function (symbol) {
      const cell = document.createElement("div");
      cell.className = "multimeter-cell" + (symbol === "" ? " is-blank" : (symbol.length > 1 ? " is-multi" : ""));
      cell.textContent = symbol === "" ? "\u00b7" : symbol;
      screen.appendChild(cell);
    });
  } else {
    const note = document.createElement("div");
    note.className = "multimeter-idle";
    note.textContent = "Probe a slotted node to read its output column.";
    screen.appendChild(note);
  }

  meter.appendChild(screen);

  const leads = document.createElement("div");
  leads.className = "multimeter-leads";
  const leadPos = document.createElement("span");
  leadPos.className = "lead lead-pos";
  const leadNeg = document.createElement("span");
  leadNeg.className = "lead lead-neg";
  leads.appendChild(leadPos);
  leads.appendChild(leadNeg);
  meter.appendChild(leads);

  dom.multimeterShell.appendChild(meter);
}

function appendWire(svg, start, end, color) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const d = "M " + start.x + " " + start.y
    + " C " + start.x + " " + (start.y + 52)
    + " " + end.x + " " + (end.y + 52)
    + " " + end.x + " " + end.y;
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("opacity", "0.8");
  svg.appendChild(path);
}

function updateProbeWires() {
  const svg = dom.probeWires;
  if (!svg) {
    return;
  }
  svg.replaceChildren();

  const node = state.selectedNodeId ? getNodeById(state.selectedNodeId) : null;
  if (!node || !state.placements.has(node.id) || state.gameState !== "playing") {
    return;
  }
  if (!dom.multimeterShell) {
    return;
  }

  const slot = getSlotById(state.placements.get(node.id));
  const leads = dom.multimeterShell.querySelectorAll(".lead");
  if (!slot || leads.length < 2) {
    return;
  }

  const boardRect = dom.boardViewport.getBoundingClientRect();
  const bounds = slotBounds(slot);
  const left = boardRect.left + state.view.x + bounds.left * state.view.scale;
  const top = boardRect.top + state.view.y + bounds.top * state.view.scale;
  const width = bounds.width * state.view.scale;
  const height = bounds.height * state.view.scale;
  const cx = left + width / 2;
  const cy = top + height / 2;

  if (cx < boardRect.left || cx > boardRect.right || cy < boardRect.top || cy > boardRect.bottom) {
    return;
  }

  const posRect = leads[0].getBoundingClientRect();
  const negRect = leads[1].getBoundingClientRect();
  const startPos = { x: posRect.left + posRect.width / 2, y: posRect.bottom };
  const startNeg = { x: negRect.left + negRect.width / 2, y: negRect.bottom };
  const endRight = { x: left + width, y: cy };
  const endLeft = { x: left, y: cy };

  appendWire(svg, startNeg, endRight, "#8aa0b6");
  appendWire(svg, startPos, endLeft, "#ff5d7a");
}

// ---------- combined meter rack ----------

function alignMeterRows() {
  if (!dom.batteryShell || !dom.multimeterShell) {
    return;
  }
  dom.batteryShell.style.marginTop = "";
  const firstSeg = dom.batteryShell.querySelector(".battery-segment");
  const firstCell = dom.multimeterShell.querySelector(".multimeter-cell");
  if (!firstSeg || !firstCell) {
    return;
  }
  const diff = firstCell.getBoundingClientRect().top
    - firstSeg.getBoundingClientRect().top;
  if (diff > 0) {
    dom.batteryShell.style.marginTop = Math.round(diff) + "px";
  }
}

function renderMeterRack(selectedNode) {
  if (!dom.meterRack) {
    return;
  }

  const batteryData = buildBatteryData();

  if (dom.batteryReadout) {
    dom.batteryReadout.textContent =
      batteryData.charged + " / " + batteryData.total;
  }
  if (dom.batteryMeta) {
    if (batteryData.total === 0) {
      dom.batteryMeta.textContent = "Probe a node to see how it matches.";
    } else if (!batteryData.connected) {
      dom.batteryMeta.textContent =
        "Probe a placed node to read its output column.";
    } else if (batteryData.charged === batteryData.total) {
      dom.batteryMeta.textContent =
        "Fully charged — every target row matches.";
    } else {
      dom.batteryMeta.textContent = "Charging — "
        + batteryData.charged + " of "
        + batteryData.total + " target rows match.";
    }
  }

  if (batteryData.total === 0) {
    dom.meterRack.replaceChildren();
    return;
  }

  const slotted = Boolean(
    selectedNode && state.placements.has(selectedNode.id)
  );
  const probeColumn = slotted ? buildProbeColumn(selectedNode) : null;

  const table = document.createElement("div");
  table.className = "meter-table";

  const battHead = document.createElement("div");
  battHead.className = "meter-col-head";
  battHead.textContent = "Target";
  table.appendChild(battHead);

  const probeHead = document.createElement("div");
  probeHead.className = "meter-col-head meter-col-head--probe";
  probeHead.textContent = selectedNode ? getNodeLabel(selectedNode) : "Probe";
  table.appendChild(probeHead);

  batteryData.cells.forEach(function (cell, index) {
    const seg = document.createElement("div");
    seg.className = "battery-segment"
      + (cell.charged ? " is-charged" : "");
    const sym = document.createElement("span");
    sym.className = "battery-symbol";
    sym.textContent = cell.symbol;
    seg.appendChild(sym);
    table.appendChild(seg);

    const liveVal = probeColumn ? probeColumn.cells[index] : "";
    const mCell = document.createElement("div");
    mCell.className = "multimeter-cell"
      + (!liveVal ? " is-blank" : liveVal.length > 1 ? " is-multi" : "");
    mCell.textContent = liveVal || "·";
    table.appendChild(mCell);
  });

  dom.meterRack.replaceChildren(table);
}

// ---------- keyboard play ----------

function availableNodeIds() {
  return R.reject(id => state.placements.has(id), state.stripOrder);
}

function applyKbHighlight() {
  if (!dom.stripLayer || !dom.slotLayer) {
    return;
  }
  const stripTokens = Array.prototype.slice.call(dom.stripLayer.children);
  stripTokens.forEach(function (element, index) {
    element.classList.toggle("kb-pick", state.kb.active && index === state.kb.nodeIndex);
  });
  const slotElements = Array.prototype.slice.call(dom.slotLayer.children);
  slotElements.forEach(function (element, index) {
    element.classList.toggle("kb-target", state.kb.active && index === state.kb.slotIndex);
  });
}

function hideKeyboardSelection() {
  if (!state.kb.active) {
    return;
  }
  state.kb.active = false;
  applyKbHighlight();
}

function clampKbIndices() {
  const available = availableNodeIds();
  if (available.length === 0) {
    state.kb.nodeIndex = 0;
  } else {
    state.kb.nodeIndex = ((state.kb.nodeIndex % available.length) + available.length) % available.length;
  }
  const slotCount = state.slots.length;
  if (slotCount === 0) {
    state.kb.slotIndex = 0;
  } else {
    state.kb.slotIndex = ((state.kb.slotIndex % slotCount) + slotCount) % slotCount;
  }
}

function placeNodeIntoSlot(nodeId, slotId) {
  const node = getNodeById(nodeId);
  const slot = getSlotById(slotId);
  if (!node || !slot || isFixedNode(node)) {
    return;
  }
  const occupant = getNodeAtSlot(slotId);
  const sourceSlotId = state.placements.get(nodeId) || null;
  if (occupant && occupant.id !== nodeId) {
    if (sourceSlotId) {
      state.placements.set(occupant.id, sourceSlotId);
    } else {
      state.placements.delete(occupant.id);
    }
  }
  state.placements.set(nodeId, slotId);
  state.pendingCompletion = false;
  renderBoard();
  updateSummary();
}

function onKeyDown(event) {
  if (state.gameState !== "playing") {
    return;
  }

  const key = event.key;
  const isArrow = key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";

  if (isArrow) {
    event.preventDefault();
    if (!state.kb.active) {
      state.kb.active = true;
    } else if (key === "ArrowLeft") {
      state.kb.nodeIndex -= 1;
    } else if (key === "ArrowRight") {
      state.kb.nodeIndex += 1;
    } else if (key === "ArrowUp") {
      state.kb.slotIndex -= 1;
    } else if (key === "ArrowDown") {
      state.kb.slotIndex += 1;
    }
    clampKbIndices();
    applyKbHighlight();
    return;
  }

  if (!state.kb.active) {
    return;
  }

  if (key === "Enter") {
    event.preventDefault();
    clampKbIndices();
    const available = availableNodeIds();
    const nodeId = available[state.kb.nodeIndex];
    const slot = state.slots[state.kb.slotIndex];
    if (nodeId && slot) {
      placeNodeIntoSlot(nodeId, slot.id);
      clampKbIndices();
      applyKbHighlight();
    }
    return;
  }

  if (key === " " || key === "Spacebar") {
    event.preventDefault();
    clampKbIndices();
    const slot = state.slots[state.kb.slotIndex];
    const occupant = slot ? getNodeAtSlot(slot.id) : null;
    if (occupant) {
      showTruthTableForNode(occupant.id);
    } else {
      const available = availableNodeIds();
      const nodeId = available[state.kb.nodeIndex];
      if (nodeId) {
        showTruthTableForNode(nodeId);
      }
    }
  }
}

function updateHintDisplay() {
  if (dom.checkButton) {
    dom.checkButton.textContent = state.hintCount > 0 ? "Hint (" + state.hintCount + ")" : "Hint";
  }
  if (dom.finalHints) {
    dom.finalHints.textContent = String(state.hintCount);
  }
}

function hideTruthTableModal() {
  if (!dom.truthTableModal) {
    return;
  }

  state.selectedNodeId = null;
  refreshTruthTableModal();
}

function showTruthTableForNode(nodeId) {
  const node = getNodeById(nodeId);

  if (!node) {
    return;
  }

  state.selectedNodeId = node.id;
  refreshTruthTableModal();
}

function refreshTruthTableModal() {
  if (!dom.truthTableModal || !dom.truthTableModalTitle || !dom.truthTableModalTable) {
    return;
  }

  const selectedNode = state.selectedNodeId ? getNodeById(state.selectedNodeId) : null;
  const selectedTable = selectedNode ? formatTruthTableRows(selectedNode) : null;

  dom.truthTableModalTable.replaceChildren();

  if (selectedNode && selectedTable) {
    dom.truthTableModalTitle.textContent = getNodeLabel(selectedNode);
    dom.truthTableModalMeta.textContent = (selectedNode.nodeType || "node") + " node · " + selectedTable.meta;
    if (dom.truthTableModalEmpty) {
      dom.truthTableModalEmpty.hidden = true;
    }
    appendTruthTableSection("", selectedTable, "");
  } else {
    dom.truthTableModalTitle.textContent = "Select a node";
    dom.truthTableModalMeta.textContent = "Use the View button inside a node to inspect its truth table here.";
    if (dom.truthTableModalEmpty) {
      dom.truthTableModalEmpty.hidden = false;
      dom.truthTableModalEmpty.textContent = "No node selected.";
    }
  }

  renderBattery();
  renderMultimeter(selectedNode);
  alignMeterRows();
  updateProbeWires();
}

function checkLayout() {
  state.checking = true;
  state.hintCount += 1;
  updateHintDisplay();
  updateSummary();
  renderBoard();
}

function updateDifficultyUI() {
  const val = state.targetInputCount !== null
    ? String(state.targetInputCount)
    : "";
  if (dom.menuDiffInput) dom.menuDiffInput.value = val;
  if (dom.completeDiffInput) dom.completeDiffInput.value = val;
}

function initializeControls() {
  if (dom.menuPlayButton) {
    dom.menuPlayButton.addEventListener("click", function () {
      void startFreshGame();
    });
  }

  if (dom.playAgainButton) {
    dom.playAgainButton.addEventListener("click", function () {
      void startFreshGame();
    });
  }

  function onDiffInputChange(input) {
    const raw = input.value.trim();
    const n = parseInt(raw, 10);
    const invalid = raw === "" || n < 1 || !Number.isInteger(n);
    state.targetInputCount = invalid ? null : n;
    updateDifficultyUI();
  }
  if (dom.menuDiffInput) {
    dom.menuDiffInput.addEventListener("change", function () {
      onDiffInputChange(dom.menuDiffInput);
    });
  }
  if (dom.completeDiffInput) {
    dom.completeDiffInput.addEventListener("change", function () {
      onDiffInputChange(dom.completeDiffInput);
    });
  }
  updateDifficultyUI();

  dom.resetButton.addEventListener("click", function () {
    resetPlacements(false);
    setStatus("Reset", "neutral");
    renderBoard();
  });

  dom.checkButton.addEventListener("click", checkLayout);
  if (dom.cheatButton) {
    dom.cheatButton.addEventListener("click", function () {
      state.cheatRevealed = !state.cheatRevealed;
      dom.cheatButton.textContent = state.cheatRevealed ? "Hide" : "Cheat";
      renderBoard();
      if (state.selectedNodeId) refreshTruthTableModal();
    });
  }
  if (dom.truthTableModalClose && dom.truthTableModal) {
    dom.truthTableModalClose.addEventListener("click", hideTruthTableModal);
  }

  if (dom.boardViewport) {
    dom.boardViewport.addEventListener("pointerdown", onBoardPointerDown);
    dom.boardViewport.addEventListener("wheel", onBoardWheel, { passive: false });
  }
  if (dom.zoomInBtn) {
    dom.zoomInBtn.addEventListener("click", function () { zoomByButton(1.18); });
  }
  if (dom.zoomOutBtn) {
    dom.zoomOutBtn.addEventListener("click", function () { zoomByButton(1 / 1.18); });
  }
  if (dom.zoomResetBtn) {
    dom.zoomResetBtn.addEventListener("click", fitView);
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("pointerdown", function () {
    hideKeyboardSelection();
  }, true);
  window.addEventListener("scroll", updateProbeWires, true);
  window.addEventListener("resize", function () {
    scheduleRender();
    applyView();
  });
}

export async function createGameUI() {
  if (state.initialized) {
    return state.graph;
  }

  loadDom();
  initializeControls();
  const graph = normalizeGraph(readBackendGraph());

  if (!graph) {
    state.graph = null;
    state.nodes = [];
    state.slots = [];
    state.edges = [];
    updateSummary();
    state.initialized = true;
    return null;
  }

  state.graph = graph;
  state.nodes = graph.nodes;
  state.slots = graph.slots;
  state.edges = graph.edges;
  resetPlacements(true);
  state.initialized = true;
  state.pendingCompletion = false;
  setStatus("Ready", "neutral");
  setGameState("menu");
  hideTruthTableModal();
  renderBoard();

  return state.graph;
}

export function setGraphSource(source) {
  const graph = normalizeGraph(source);
  state.graph = graph;
  state.nodes = graph ? graph.nodes : [];
  state.slots = graph ? graph.slots : [];
  state.edges = graph ? graph.edges : [];
  resetPlacements(true);
  state.pendingCompletion = false;
  setGameState("menu");
  hideTruthTableModal();
  renderBoard();
  return state.graph;
}

export function getGameUIState() {
  return {
    graph: state.graph,
    nodes: state.nodes.slice(),
    slots: state.slots.slice(),
    edges: state.edges.slice(),
    placements: new Map(state.placements),
    stripOrder: state.stripOrder.slice(),
    checking: state.checking,
  };
}

window.gameUI = {
  createGameUI: createGameUI,
  setGraphSource: setGraphSource,
  getGameUIState: getGameUIState,
  showTruthTableForNode: showTruthTableForNode,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    void createGameUI();
  });
} else {
  void createGameUI();
}

export default window.gameUI;

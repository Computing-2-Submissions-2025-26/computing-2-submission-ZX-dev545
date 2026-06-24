import { Neurone, Imvolution, Graph, buildGraphFromTruthTable, buildStringTruthTable } from './model.js';

// ==================== ESCAPE CHARACTERS ====================
const S = '\u130C0';
const A = '\u13080';
const N = '\u13153';

// ==================== HELPER FUNCTIONS ====================

function arraysEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function findMatchingKey(map, keyArray) {
    for (const [key] of map) {
        if (arraysEqual(key, keyArray)) {
            return key;
        }
    }
    return null;
}

function getFromMap(map, keyArray) {
    const matchedKey = findMatchingKey(map, keyArray);
    return matchedKey !== null ? map.get(matchedKey) : null;
}

function getMatchingKeys(map, patternArray) {
    const results = [];
    for (const [key] of map) {
        if (key.length !== patternArray.length) continue;
        let match = true;
        for (let i = 0; i < key.length; i++) {
            if (patternArray[i] !== A && patternArray[i] !== key[i]) {
                match = false;
                break;
            }
        }
        if (match) results.push(key);
    }
    return results;
}

function mapToObject(map) {
    const obj = {};
    for (const [key, value] of map) {
        obj[JSON.stringify(key)] = value;
    }
    return obj;
}

function objectToMap(obj) {
    const map = new Map();
    for (const [keyStr, value] of Object.entries(obj)) {
        const key = JSON.parse(keyStr);
        map.set(key, value);
    }
    return map;
}


// ==================== NODE CLASS (UI) ====================

class UINode {
    constructor(nodeType, label, x, y, color = 'lightgray', name = null, states = [0, 1]) {
        this.label = label;
        this.x = x;
        this.y = y;
        this.color = color;
        this.angle = 0;
        this.cachedBorderColor = null;
        this.neurone = new Neurone(nodeType, name, states);
        this.selected = false;
        this.hovered = false;
    }

    static fromNeurone(neurone, label, x = 0, y = 0, color = 'lightgray') {
        const node = new UINode(neurone.nodeType, label, x, y, color, neurone.name, neurone.states);
        node.neurone = neurone;
        node.neurone.name = neurone.name || label;
        return node;
    }

    getSourceColor(seed = null) {
        if (this.cachedBorderColor !== null) return this.cachedBorderColor;

        const inputColors = [
            '#FF0000', '#00FF00', '#0000FF', '#FF00FF',
            '#FFFF00', '#00FFFF', '#FFA500', '#800080',
            '#FF69B4', '#32CD32', '#FF1493', '#00CED1',
            '#FF4500', '#9400D3', '#00FA9A', '#DC143C'
        ];

        let inputKey;
        const numericMatch = this.neurone.name ? this.neurone.name.match(/IN(\d+)$/) : null;
        if (seed !== null) {
            inputKey = seed + 1;
            if (inputKey >= 4) inputKey++;
        } else if (numericMatch) {
            inputKey = parseInt(numericMatch[1]) - 1;
        } else {
            inputKey = this.neurone.name ? this.neurone.name.charCodeAt(0) - 65 : 0;
        }

        if (inputKey >= 0 && inputKey < inputColors.length) {
            return inputColors[inputKey];
        }

        const goldenRatio = 0.618033988749;
        const hue = (inputKey * goldenRatio) % 1.0;
        const rgb = this.hsvToRgb(hue, 0.9, 0.9);
        return `#${this.rgbToHex(rgb)}`;
    }

    hsvToRgb(h, s, v) {
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
        return rgb.map(c => Math.round(c * 255));
    }

    rgbToHex(rgb) {
        return rgb.map(c => c.toString(16).padStart(2, '0')).join('');
    }

    getDisplayColor() {
        if (this.neurone.value === null) return this.color;
        if (this.neurone.states.length === 2 && this.neurone.states[0] === 0 && this.neurone.states[1] === 1) {
            if (this.neurone.value === 1) {
                if (this.neurone.nodeType === 'input') return '#4CAF50';
                if (this.neurone.nodeType === 'output') return '#FF9800';
                return '#81C784';
            } else {
                if (this.neurone.nodeType === 'input') return '#e0e0e0';
                if (this.neurone.nodeType === 'output') return '#ef9a9a';
                return '#e0e0e0';
            }
        } else {
            const stateIndex = this.neurone.states.indexOf(this.neurone.value);
            if (stateIndex === -1) return this.color;
            const intensity = this.neurone.states.length > 1 ? stateIndex / (this.neurone.states.length - 1) : 0;
            if (this.neurone.nodeType === 'input') {
                const green = Math.round(255 * intensity);
                const red = Math.round(128 * (1 - intensity));
                return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}80`;
            } else if (this.neurone.nodeType === 'output') {
                const green = Math.round(200 * intensity + 55);
                return `#ff${green.toString(16).padStart(2, '0')}00`;
            } else {
                const blue = Math.round(255 * intensity);
                const other = Math.round(200 * (1 - intensity));
                return `#${other.toString(16).padStart(2, '0')}${other.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
            }
        }
    }

    getReadableTextColor() {
        if (this.neurone.value === null) return 'black';
        if (this.neurone.states.length === 2 && this.neurone.states[0] === 0 && this.neurone.states[1] === 1) {
            return this.neurone.value === 1 ? '#1b5e20' : '#b71c1c';
        } else {
            const stateIndex = this.neurone.states.indexOf(this.neurone.value);
            if (stateIndex === -1) return 'black';
            const intensity = this.neurone.states.length > 1 ? stateIndex / (this.neurone.states.length - 1) : 0;
            const red = Math.round(50 * (1 - intensity));
            const green = Math.round(100 + 100 * intensity);
            const blue = Math.round(150 * (1 - intensity));
            return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
        }
    }
}

// ==================== GRAPH WRAPPER ====================

class GraphWrapper {
    constructor(graph) {
        this.graph = graph;
        this.nodes = [];
        this.inputNodes = {};
        this.nodesByNeurone = new Map();
        this.visibleNodes = null;
    }

    addNode(node) {
        if (!this.graph.neurones.includes(node.neurone)) {
            this.graph.addNeurone(node.neurone);
        }
        if (node.neurone.nodeType === 'input') {
            this.inputNodes[node.neurone.name] = node;
        }
        this.nodes.push(node);
        this.nodesByNeurone.set(node.neurone, node);
    }

    removeNode(node) {
        this.graph.removeNeurone(node.neurone);
        const idx = this.nodes.indexOf(node);
        if (idx !== -1) this.nodes.splice(idx, 1);
        if (node.neurone.nodeType === 'input' && node.neurone.name in this.inputNodes) {
            delete this.inputNodes[node.neurone.name];
        }
        this.nodesByNeurone.delete(node.neurone);
    }

    connectNodes(fromNode, toNode) {
        this.graph.connectNeurones(fromNode.neurone, toNode.neurone);
    }

    getTruthTableColumns() {
        return this.graph.getTruthTableColumns();
    }

    getTruthTableRows() {
        return this.graph.getTruthTableRows();
    }
}

// ==================== MAIN APPLICATION ====================

class LogicCircuitApp {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById(containerId);
        
        // State
        this.graph = new Graph();
        this.graphWrapper = new GraphWrapper(this.graph);
        this.selectedNode = null;
        this.selectedEdge = null;
        this.hoveredNode = null;
        this.connectionMode = false;
        this.connectionStartNode = null;
        this.cumulativeZoom = 1.0;
        this.totalPanX = 0;
        this.totalPanY = 0;
        this.panStartX = 0;
        this.panStartY = 0;
        this.draggingNode = false;
        this.nodeDragStartX = 0;
        this.nodeDragStartY = 0;
        this.debugHitboxes = false;
        this.nextNodeId = 1000;
        this.inputColumnOrder = [];
        this.currentTruthTable = null;
        this.activeTruthTableRowIndex = 0;
        
        // Setup
        this.setupCanvas();
        this.setupControls();
        this.setupTruthTable();
        this.bindTruthTableModal();
        this.render();
        this.updateTruthTable();
                        td.addEventListener('input', function () {
                            this.textContent = this.textContent.trim() || N;
                        }.bind(td));
    }

    setupCanvas() {
        // Handle resize
        const resize = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const width = rect.width - 2;
            const height = Math.max(400, Math.min(600, width * 0.75));
            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
            this.ctx.scale(dpr, dpr);
            this.canvasWidth = width;
            this.canvasHeight = height;
            this.render();
        };
        
        window.addEventListener('resize', resize);
        setTimeout(resize, 100);
        
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    setupControls() {
        const sourceInput = document.getElementById('source-input');
        const modeSelect = document.getElementById('mode-select');

        document.getElementById('resetViewBtn').addEventListener('click', () => this.resetView());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCircuit());

        if (sourceInput && modeSelect) {
            const refreshFromSource = () => this.rebuildTruthTableFromSource();
            sourceInput.addEventListener('input', refreshFromSource);
            modeSelect.addEventListener('change', refreshFromSource);
        }
        
        // Truth table controls
        document.getElementById('refreshTableBtn').addEventListener('click', () => this.rebuildTruthTableFromSource());
        document.getElementById('generateGraphBtn').addEventListener('click', () => this.generateGraphFromTruthTable());
        document.getElementById('showInputsBtn').addEventListener('click', () => this.showInputsOnly());
        document.getElementById('showAllBtn').addEventListener('click', () => this.showAllColumns());
    }

    setupTruthTable() {
        this.truthTableData = [];
        this.visibleColumns = {};
    }

    hideTruthTableModal() {
        const modal = document.getElementById('truth-table-modal');
        modal.classList.remove('is-open');
    }

    renderTruthTableModal(title, columns, rows, meta) {
        const modal = document.getElementById('truth-table-modal');
        const modalTitle = document.getElementById('truth-table-modal-title');
        const modalMeta = document.getElementById('truth-table-modal-meta');
        const modalTable = document.getElementById('truth-table-modal-table');
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const headRow = document.createElement('tr');
        let i;

        modalTitle.textContent = title;
        modalMeta.textContent = meta;

        for (i = 0; i < columns.length; i += 1) {
            const th = document.createElement('th');
            th.textContent = columns[i];
            headRow.appendChild(th);
        }

        thead.appendChild(headRow);

        for (i = 0; i < rows.length; i += 1) {
            const tr = document.createElement('tr');
            const row = rows[i];
            let j;

            for (j = 0; j < row.length; j += 1) {
                const td = document.createElement('td');
                td.textContent = row[j];
                tr.appendChild(td);
            }

            tbody.appendChild(tr);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        modalTable.innerHTML = '';
        modalTable.appendChild(table);
        modal.classList.add('is-open');
    }

    bindTruthTableModal() {
        const modal = document.getElementById('truth-table-modal');
        const closeButton = document.getElementById('truth-table-modal-close');

        closeButton.addEventListener('click', () => this.hideTruthTableModal());
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                this.hideTruthTableModal();
            }
        }.bind(this));
    }

    getSeedStrings() {
        const sourceInput = document.getElementById('source-input');
        return sourceInput.value
            .split(/\r?\n/)
            .map(function (line) {
                return line.trim();
            })
            .filter(function (line) {
                return line.length > 0;
            });
    }

    rebuildTruthTableFromSource() {
        const modeSelect = document.getElementById('mode-select');
        const mode = modeSelect ? modeSelect.value : 'characters';
        this.currentTruthTable = buildStringTruthTable(this.getSeedStrings(), mode);
        this.activeTruthTableRowIndex = 0;
        this.updateTruthTable();
    }

    collectEditableTruthTableRows() {
        const tableBody = document.getElementById('tableBody');
        const headerRow = document.getElementById('headerRow');
        const columns = Array.from(headerRow.querySelectorAll('th')).map(function (th) {
            return th.textContent.replace(/^\[|\]$/g, '');
        });
        const rowNodes = tableBody.querySelectorAll('tr');
        const rows = [];
        let i;

        for (i = 0; i < rowNodes.length; i += 1) {
            const cellNodes = rowNodes[i].querySelectorAll('td');
            const cells = [];
            let j;

            for (j = 0; j < cellNodes.length; j += 1) {
                cells.push(cellNodes[j].textContent.trim() || N);
            }

            if (cells.length > 0) {
                rows.push({
                    id: 'editable-' + (i + 1),
                    cells: cells,
                    inputs: cells.slice(0, Math.max(0, columns.length - 1)),
                    output: cells[cells.length - 1],
                });
            }
        }

        return {
            columns: columns,
            inputCount: Math.max(0, columns.length - 1),
            rows: rows,
        };
    }

    syncCurrentTruthTableCell(rowIndex, columnIndex, value) {
        if (!this.currentTruthTable || !this.currentTruthTable.rows || !this.currentTruthTable.rows[rowIndex]) {
            return;
        }

        const row = this.currentTruthTable.rows[rowIndex];
        const normalizedValue = String(value).trim() || N;

        if (Array.isArray(row.cells) && row.cells[columnIndex] !== undefined) {
            row.cells[columnIndex] = normalizedValue;
        }

        if (Array.isArray(row.inputs) && columnIndex < row.inputs.length) {
            row.inputs[columnIndex] = normalizedValue;
        }

        if (columnIndex === row.cells.length - 1) {
            row.output = normalizedValue;
        }
    }

    applyActiveTruthTableRow() {
        if (!this.currentTruthTable || !this.currentTruthTable.rows || this.currentTruthTable.rows.length === 0) {
            return;
        }

        const row = this.currentTruthTable.rows[this.activeTruthTableRowIndex];
        if (!row || !this.graph || !Array.isArray(this.inputColumnOrder) || this.inputColumnOrder.length === 0) {
            return;
        }

        const values = {};
        for (let i = 0; i < this.inputColumnOrder.length; i += 1) {
            const cellValue = row.inputs && row.inputs[i] !== undefined
                ? row.inputs[i]
                : row.cells && row.cells[i] !== undefined
                    ? row.cells[i]
                    : N;
            values[this.inputColumnOrder[i]] = cellValue;
        }

        this.graph.setInputValues(values);
        this.render();
    }

    setActiveTruthTableRow(rowIndex) {
        if (!this.currentTruthTable || !this.currentTruthTable.rows || this.currentTruthTable.rows.length === 0) {
            return;
        }

        const rowCount = this.currentTruthTable.rows.length;
        this.activeTruthTableRowIndex = ((rowIndex % rowCount) + rowCount) % rowCount;
        this.updateTruthTable();
        this.applyActiveTruthTableRow();
    }

    rebuildUiFromGraph() {
        const graph = this.graph;
        const nodesByType = {
            input: [],
            gate: [],
            output: [],
        };
        const xMap = {
            input: 120,
            gate: 380,
            output: 640,
        };
        const yBase = 120;
        const yStep = 120;
        let index;

        this.graphWrapper = new GraphWrapper(graph);
        this.graphWrapper.nodes = [];
        this.graphWrapper.nodesByNeurone = new Map();

        for (index = 0; index < graph.neurones.length; index += 1) {
            nodesByType[graph.neurones[index].nodeType].push(graph.neurones[index]);
        }

        ['input', 'gate', 'output'].forEach(function (type) {
            let i;
            for (i = 0; i < nodesByType[type].length; i += 1) {
                const neurone = nodesByType[type][i];
                const node = UINode.fromNeurone(
                    neurone,
                    neurone.name,
                    xMap[type],
                    yBase + i * yStep
                );
                this.graphWrapper.addNode(node);
            }
        }, this);

        this.inputColumnOrder = nodesByType.input.map(function (neurone) {
            return neurone.name;
        });
    }

    generateGraphFromTruthTable() {
        const truthTable = this.collectEditableTruthTableRows();
        this.currentTruthTable = truthTable;
        this.graph = buildGraphFromTruthTable(truthTable, 'TABLE');
        this.rebuildUiFromGraph();
        this.activeTruthTableRowIndex = 0;
        this.render();
        this.updateTruthTable();
        this.applyActiveTruthTableRow();
    }

    renderNodeTruthTable(node) {
        const truthTable = node.neurone.truthTable;
        const rows = [];
        const columns = [];
        let key;

        if (!truthTable || truthTable.size === 0) {
            this.renderTruthTableModal(
                node.neurone.name + ' truth table',
                ['Message'],
                [['No truth table available for this node']],
                'This node does not expose a truth table.'
            );
            return;
        }

        for (let i = 0; i < node.neurone.getDims(); i += 1) {
            columns.push('In ' + (i + 1));
        }
        columns.push('Out');

        for (key of truthTable.keys()) {
            const value = truthTable.get(key);
            rows.push(key.concat([value]).map(function (cell) {
                return String(cell);
            }));
        }

        this.renderTruthTableModal(
            node.neurone.name + ' truth table',
            columns,
            rows,
            rows.length + ' row' + (rows.length === 1 ? '' : 's')
        );
    }

    // ==================== RENDERING ====================

    render() {
        const ctx = this.ctx;
        const w = this.canvasWidth || this.canvas.width;
        const h = this.canvasHeight || this.canvas.height;
        
        ctx.clearRect(0, 0, w, h);
        
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(this.cumulativeZoom, this.cumulativeZoom);
        ctx.translate(-w / 2 + this.totalPanX, -h / 2 + this.totalPanY);

        this.drawGraph(ctx);
        
        if (this.debugHitboxes) {
            this.drawDebug(ctx);
        }

        ctx.restore();

        // Update status
        const statusLabel = document.getElementById('statusLabel');
        if (this.connectionMode) {
            statusLabel.textContent = 'Mode: Connect';
            statusLabel.className = 'status connect';
        } else {
            statusLabel.textContent = 'Mode: Select';
            statusLabel.className = 'status select';
        }
    }

    drawGraph(ctx) {
        const nodesToDraw = this.graphWrapper.visibleNodes || this.graphWrapper.nodes;

        // Draw connections
        for (const node of nodesToDraw) {
            this.drawConnections(ctx, node);
        }

        // Draw nodes
        for (const node of nodesToDraw) {
            this.drawNode(ctx, node);
        }
    }

    drawNode(ctx, node) {
        const radius = 20;
        const isSelected = node === this.selectedNode;
        const isHovered = node === this.hoveredNode;
        
        const fillColor = node.getDisplayColor() || node.color || 'lightgray';
        const outlineColor = isSelected ? 'red' : node.getSourceColor() || '#666';
        const outlineWidth = isSelected ? 3 : 2;

        if (node.neurone.nodeType === 'input') {
            // Rotated square
            const angle = node.angle + Math.PI / 2;
            const corners = [
                [-radius, -radius], [radius, -radius],
                [radius, radius], [-radius, radius]
            ];
            ctx.beginPath();
            for (let i = 0; i < corners.length; i++) {
                const [cx, cy] = corners[i];
                const rx = cx * Math.cos(angle) - cy * Math.sin(angle);
                const ry = cx * Math.sin(angle) + cy * Math.cos(angle);
                if (i === 0) ctx.moveTo(node.x + rx, node.y + ry);
                else ctx.lineTo(node.x + rx, node.y + ry);
            }
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = outlineWidth;
            ctx.stroke();

            // Label
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = '#333';
            ctx.fillText(node.label || node.neurone.name, node.x, node.y - radius - 8);

        } else if (node.neurone.nodeType === 'gate') {
            // Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = outlineWidth;
            ctx.stroke();

            if (isHovered) {
                ctx.font = '11px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = '#333';
                ctx.fillText(node.neurone.name || '', node.x, node.y - radius - 8);
            }

        } else if (node.neurone.nodeType === 'output') {
            // Diamond
            ctx.beginPath();
            ctx.moveTo(node.x, node.y - radius);
            ctx.lineTo(node.x + radius, node.y);
            ctx.lineTo(node.x, node.y + radius);
            ctx.lineTo(node.x - radius, node.y);
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = outlineWidth;
            ctx.stroke();

            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = '#333';
            ctx.fillText(node.label || node.neurone.name, node.x, node.y - radius - 8);
        }

        const stateValue = node.neurone.value !== null ? node.neurone.value : N;
        const valueStr = Array.isArray(stateValue) ? stateValue.join(',') : String(stateValue);
        const color = isSelected ? 'darkred' : node.getReadableTextColor() || 'black';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(valueStr, node.x, node.y);
    }

    drawConnections(ctx, fromNode) {
        for (const toNeurone of fromNode.neurone.outputs) {
            const toNode = this.graphWrapper.nodesByNeurone.get(toNeurone);
            if (!toNode) continue;
            
            const radius = 20;
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length === 0) continue;

            const dxNorm = dx / length;
            const dyNorm = dy / length;

            const startX = fromNode.x + dxNorm * radius;
            const startY = fromNode.y + dyNorm * radius;
            const endX = toNode.x - dxNorm * radius;
            const endY = toNode.y - dyNorm * radius;

            const isSelected = this.selectedEdge && 
                this.selectedEdge[0] === fromNode && 
                this.selectedEdge[1] === toNode;

            const color = isSelected ? 'magenta' : toNode.getSourceColor() || '#666';
            const width = isSelected ? 4 : 2;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.stroke();

            // Arrow
            const arrowSize = 10;
            const angle = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - arrowSize * Math.cos(angle - 0.4),
                endY - arrowSize * Math.sin(angle - 0.4)
            );
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - arrowSize * Math.cos(angle + 0.4),
                endY - arrowSize * Math.sin(angle + 0.4)
            );
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.stroke();
        }
    }

    drawDebug(ctx) {
        const radius = 20;
        for (const node of this.graphWrapper.nodes) {
            const color = node === this.selectedNode ? 'red' : 'orange';
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // ==================== TRUTH TABLE ====================

    updateTruthTable() {
        if (this.currentTruthTable) {
            const tableBody = document.getElementById('tableBody');
            const headerRow = document.getElementById('headerRow');
            const columns = this.currentTruthTable.columns || [];
            const rows = this.currentTruthTable.rows || [];

            headerRow.innerHTML = '';
            for (const col of columns) {
                const th = document.createElement('th');
                th.textContent = col;
                headerRow.appendChild(th);
            }

            tableBody.innerHTML = '';
            if (rows.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = Math.max(columns.length, 1);
                td.textContent = 'No data yet';
                td.style.textAlign = 'center';
                td.style.color = '#999';
                td.style.padding = '20px';
                tr.appendChild(td);
                tableBody.appendChild(tr);
            } else {
                for (let i = 0; i < rows.length; i += 1) {
                    const tr = document.createElement('tr');
                    const row = rows[i];
                    tr.dataset.rowIndex = String(i);
                    if (i === this.activeTruthTableRowIndex) {
                        tr.style.outline = '2px solid rgba(125, 211, 252, 0.55)';
                        tr.style.outlineOffset = '-2px';
                    }
                    for (let j = 0; j < columns.length; j += 1) {
                        const td = document.createElement('td');
                        const value = row.cells && row.cells[j] !== undefined ? row.cells[j] : N;
                        td.textContent = String(value);
                        td.contentEditable = 'true';
                        td.dataset.rowIndex = String(i);
                        td.dataset.columnIndex = String(j);
                        td.addEventListener('input', function () {
                            const rowIndex = Number(this.dataset.rowIndex);
                            const columnIndex = Number(this.dataset.columnIndex);
                            const normalized = this.textContent.trim() || N;
                            this.textContent = normalized;
                            this._appInstance?.syncCurrentTruthTableCell(rowIndex, columnIndex, normalized);
                        }.bind(td));
                        td._appInstance = this;
                        tr.appendChild(td);
                    }
                    tr.addEventListener('click', () => this.setActiveTruthTableRow(i));
                    tableBody.appendChild(tr);
                }

                if (tableBody._wheelHandler) {
                    tableBody.removeEventListener('wheel', tableBody._wheelHandler);
                }
                tableBody._wheelHandler = (event) => {
                    if (!(event.target instanceof Element) || !event.target.closest('td')) {
                        return;
                    }
                    event.preventDefault();
                    const direction = event.deltaY > 0 ? 1 : -1;
                    this.setActiveTruthTableRow(this.activeTruthTableRowIndex + direction);
                };
                tableBody.addEventListener('wheel', tableBody._wheelHandler, { passive: false });
            }

            document.getElementById('rowCount').textContent = `${rows.length} rows`;
            document.getElementById('colCount').textContent = `${columns.length} columns`;
            return;
        }

        const columns = this.graph.getTruthTableColumns();
        const rows = this.graph.getTruthTableRows();
        
        const tableBody = document.getElementById('tableBody');
        const headerRow = document.getElementById('headerRow');
        
        // Update header
        headerRow.innerHTML = '';
        for (const col of columns) {
            const th = document.createElement('th');
            const isInput = this.graph.neurones.some(n => n.nodeType === 'input' && n.name === col);
            th.textContent = isInput ? `[${col}]` : col;
            th.style.color = isInput ? '#1565c0' : '#e65100';
            headerRow.appendChild(th);
        }
        
        // Update body
        tableBody.innerHTML = '';
        if (rows.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = Math.max(columns.length, 1);
            td.textContent = 'No data yet';
            td.style.textAlign = 'center';
            td.style.color = '#999';
            td.style.padding = '20px';
            tr.appendChild(td);
            tableBody.appendChild(tr);
        } else {
            for (let i = 0; i < rows.length; i++) {
                const tr = document.createElement('tr');
                const row = rows[i];
                for (const col of columns) {
                    const td = document.createElement('td');
                    const value = row[col] !== undefined ? row[col] : N;
                    td.textContent = String(value);
                    td.contentEditable = 'true';
                    const isInput = this.graph.neurones.some(n => n.nodeType === 'input' && n.name === col);
                    if (isInput) td.className = 'input-col';
                    else td.className = 'output-col';
                    td.addEventListener('input', function () {
                        this.textContent = this.textContent.trim() || N;
                    }.bind(td));
                    tr.appendChild(td);
                }
                if (i % 2 === 0) tr.style.background = '#fafafa';
                tableBody.appendChild(tr);
            }
        }
        
        // Update counts
        document.getElementById('rowCount').textContent = `${rows.length} rows`;
        document.getElementById('colCount').textContent = `${columns.length} columns`;
    }

    showInputsOnly() {
        const columns = this.currentTruthTable ? this.currentTruthTable.columns : this.graph.getTruthTableColumns();

        // Filter table
        const headerRow = document.getElementById('headerRow');
        const ths = headerRow.querySelectorAll('th');
        const toHide = [];
        ths.forEach((th, index) => {
            const colName = columns[index] || th.textContent;
            const isInputColumn = /^\[.*\]$/.test(colName) || /^Input\b/i.test(colName);
            if (!isInputColumn) {
                toHide.push(index);
            }
        });
        
        // Hide columns in table
        const rows = document.querySelectorAll('#tableBody tr');
        for (const row of rows) {
            const tds = row.querySelectorAll('td');
            for (const idx of toHide) {
                if (tds[idx]) tds[idx].style.display = 'none';
            }
        }
        for (const idx of toHide) {
            if (ths[idx]) ths[idx].style.display = 'none';
        }
    }

    showAllColumns() {
        const ths = document.querySelectorAll('#headerRow th');
        const rows = document.querySelectorAll('#tableBody tr');
        for (const th of ths) th.style.display = '';
        for (const row of rows) {
            const tds = row.querySelectorAll('td');
            for (const td of tds) td.style.display = '';
        }
    }

    // ==================== EVENT HANDLERS ====================

    findNodeAt(x, y) {
        const w = this.canvasWidth || this.canvas.width;
        const h = this.canvasHeight || this.canvas.height;
        
        // Convert to world coordinates
        const worldX = (x - w/2) / this.cumulativeZoom + w/2 - this.totalPanX;
        const worldY = (y - h/2) / this.cumulativeZoom + h/2 - this.totalPanY;
        
        const radius = 25;
        let closest = null;
        let closestDist = Infinity;
        
        const nodes = this.graphWrapper.visibleNodes || this.graphWrapper.nodes;
        for (const node of nodes) {
            const dist = Math.sqrt((node.x - worldX) ** 2 + (node.y - worldY) ** 2);
            if (dist <= radius && dist < closestDist) {
                closestDist = dist;
                closest = node;
            }
        }
        return closest;
    }

    findEdgeAt(x, y) {
        const w = this.canvasWidth || this.canvas.width;
        const h = this.canvasHeight || this.canvas.height;
        
        const worldX = (x - w/2) / this.cumulativeZoom + w/2 - this.totalPanX;
        const worldY = (y - h/2) / this.cumulativeZoom + h/2 - this.totalPanY;
        
        const tolerance = 8 / this.cumulativeZoom;
        
        for (const fromNode of this.graphWrapper.nodes) {
            for (const toNeurone of fromNode.neurone.outputs) {
                const toNode = this.graphWrapper.nodesByNeurone.get(toNeurone);
                if (!toNode) continue;
                
                const dist = this.pointToLineDist(
                    worldX, worldY,
                    fromNode.x, fromNode.y,
                    toNode.x, toNode.y
                );
                if (dist <= tolerance) {
                    return [fromNode, toNode];
                }
            }
        }
        return null;
    }

    pointToLineDist(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx === 0 && dy === 0) {
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        const cx = x1 + t * dx;
        const cy = y1 + t * dy;
        return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const node = this.findNodeAt(x, y);

        if (node) {
            if (this.connectionMode) {
                if (!this.connectionStartNode) {
                    this.connectionStartNode = node;
                    this.selectedNode = node;
                    this.render();
                } else if (node !== this.connectionStartNode) {
                    this.connectNodes(this.connectionStartNode, node);
                    this.connectionStartNode = null;
                    this.render();
                    this.updateTruthTable();
                }
            } else {
                this.selectedNode = node;
                this.selectedEdge = null;
                this.draggingNode = true;
                this.nodeDragStartX = x;
                this.nodeDragStartY = y;
                this.render();
            }
        } else {
            const edge = this.findEdgeAt(x, y);
            if (edge && !this.connectionMode) {
                this.selectedEdge = edge;
                this.selectedNode = null;
                this.render();
            } else {
                if (this.connectionMode) {
                    this.connectionStartNode = null;
                } else {
                    this.selectedNode = null;
                    this.selectedEdge = null;
                    this.draggingNode = false;
                    this.panStartX = x;
                    this.panStartY = y;
                }
                this.render();
            }
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Update hover
        const node = this.findNodeAt(x, y);
        if (node !== this.hoveredNode) {
            this.hoveredNode = node;
            this.render();
        }

        if (this.draggingNode && this.selectedNode) {
            const dx = (x - this.nodeDragStartX) / this.cumulativeZoom;
            const dy = (y - this.nodeDragStartY) / this.cumulativeZoom;
            this.selectedNode.x += dx;
            this.selectedNode.y += dy;
            this.nodeDragStartX = x;
            this.nodeDragStartY = y;
            this.render();
        } else if (!this.connectionMode && !this.draggingNode && this.panStartX !== 0) {
            const dx = x - this.panStartX;
            const dy = y - this.panStartY;
            this.totalPanX += dx;
            this.totalPanY += dy;
            this.panStartX = x;
            this.panStartY = y;
            this.render();
        }
    }

    onMouseUp(e) {
        this.draggingNode = false;
        this.panStartX = 0;
        this.panStartY = 0;
    }

    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = this.cumulativeZoom * delta;
        if (newZoom < 0.1 || newZoom > 5) return;
        this.cumulativeZoom = newZoom;
        this.render();
    }

    onContextMenu(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const node = this.findNodeAt(x, y);
        if (node) {
            this.showContextMenu(e.clientX, e.clientY, node);
        }
    }

    onKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedNode) {
                this.deleteNode(this.selectedNode);
                this.selectedNode = null;
                this.render();
                this.updateTruthTable();
            } else if (this.selectedEdge) {
                const [from, to] = this.selectedEdge;
                this.disconnectNodes(from, to);
                this.selectedEdge = null;
                this.render();
                this.updateTruthTable();
            }
        }
    }

    // ==================== CONTEXT MENU ====================

    showContextMenu(x, y, node) {
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: white;
            border: 1px solid #ccc;
            box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
            padding: 5px 0;
            z-index: 1000;
            min-width: 150px;
            border-radius: 4px;
        `;

        const items = [
            { label: `Delete ${node.neurone.name}`, action: () => {
                this.deleteNode(node);
                this.render();
                this.updateTruthTable();
            }},
            { label: 'View Truth Table', action: () => this.viewTruthTable(node) },
        ];

        if (node.neurone.inputs.length > 0) {
            menu.appendChild(document.createElement('hr'));
            for (const inp of node.neurone.inputs) {
                const inNode = this.graphWrapper.nodesByNeurone.get(inp);
                if (inNode) {
                    items.push({
                        label: `Disconnect from ${inp.name}`,
                        action: () => {
                            this.disconnectNodes(inNode, node);
                            this.render();
                            this.updateTruthTable();
                        }
                    });
                }
            }
        }

        for (const item of items) {
            const div = document.createElement('div');
            div.textContent = item.label;
            div.style.cssText = `
                padding: 6px 16px;
                cursor: pointer;
                font-size: 13px;
            `;
            div.onmouseover = () => div.style.background = '#e0e0e0';
            div.onmouseout = () => div.style.background = 'transparent';
            div.onclick = () => {
                item.action();
                document.body.removeChild(menu);
            };
            menu.appendChild(div);
        }

        document.body.appendChild(menu);
        setTimeout(() => {
            document.addEventListener('click', () => {
                if (document.body.contains(menu)) document.body.removeChild(menu);
            }, { once: true });
        }, 10);
    }

    // ==================== ACTIONS ====================

    connectNodes(fromNode, toNode) {
        if (toNode.neurone in fromNode.neurone.outputs) return;
        if (this.wouldCreateCycle(fromNode, toNode)) {
            alert('Would create a cycle!');
            return;
        }
        this.graphWrapper.connectNodes(fromNode, toNode);
    }

    disconnectNodes(fromNode, toNode) {
        const outIdx = fromNode.neurone.outputs.indexOf(toNode.neurone);
        if (outIdx !== -1) fromNode.neurone.outputs.splice(outIdx, 1);
        const inIdx = toNode.neurone.inputs.indexOf(fromNode.neurone);
        if (inIdx !== -1) toNode.neurone.inputs.splice(inIdx, 1);
    }

    wouldCreateCycle(fromNode, toNode) {
        const visited = new Set();
        const canReach = (start, target) => {
            if (start === target) return true;
            if (visited.has(start)) return false;
            visited.add(start);
            for (const output of start.outputs) {
                if (canReach(output, target)) return true;
            }
            return false;
        };
        return canReach(toNode, fromNode);
    }

    deleteNode(node) {
        this.graphWrapper.removeNode(node);
        if (this.selectedNode === node) this.selectedNode = null;
    }

    addInputNode() {
        const name = `IN${this.nextNodeId++}`;
        const neurone = new Neurone('input', name, [0, 1]);
        this.graph.addNeurone(neurone);
        const node = UINode.fromNeurone(
            neurone, 
            name, 
            100 + Math.random() * 300, 
            100 + Math.random() * 300
        );
        this.graphWrapper.addNode(node);
        this.render();
        this.updateTruthTable();
    }

    addGateNode() {
        const name = `GATE${this.nextNodeId++}`;
        const neurone = new Neurone('gate', name, [0, 1]);
        const func = Neurone.createGateFunction(new Map([
            [[0, 0], 0], [[0, 1], 0],
            [[1, 0], 0], [[1, 1], 1]
        ]));
        neurone.setGateFunction(2, func, [[0, 1], [0, 1]]);
        this.graph.addNeurone(neurone);
        const node = UINode.fromNeurone(
            neurone, 
            '∧', 
            300 + Math.random() * 200, 
            100 + Math.random() * 300
        );
        this.graphWrapper.addNode(node);
        this.render();
        this.updateTruthTable();
    }

    viewTruthTable(node) {
        this.renderNodeTruthTable(node);
    }

    toggleConnectionMode() {
        this.connectionMode = !this.connectionMode;
        document.getElementById('connectModeBtn').textContent = 
            this.connectionMode ? 'Exit Connect' : 'Connect Mode';
        if (!this.connectionMode) this.connectionStartNode = null;
        this.render();
    }

    toggleDebug() {
        this.debugHitboxes = !this.debugHitboxes;
        document.getElementById('debugBtn').textContent = 
            this.debugHitboxes ? 'Hide Debug' : 'Debug';
        this.render();
    }

    resetView() {
        this.cumulativeZoom = 1.0;
        this.totalPanX = 0;
        this.totalPanY = 0;
        this.render();
    }

    clearCircuit() {
        if (confirm('Clear the entire circuit?')) {
            this.graph = new Graph();
            this.graphWrapper = new GraphWrapper(this.graph);
            this.selectedNode = null;
            this.selectedEdge = null;
            this.nextNodeId = 1000;
            this.render();
            this.updateTruthTable();
        }
    }
}

// ==================== INITIALISATION ====================

document.addEventListener('DOMContentLoaded', () => {
    const app = new LogicCircuitApp('circuitCanvas', 'truthTableContainer');
    window.app = app;
});
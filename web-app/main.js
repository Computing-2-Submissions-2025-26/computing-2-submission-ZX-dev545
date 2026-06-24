import model from "./model.js";

const EMPTY_CELL = model.EMPTY_CELL;
const buildStringTruthTable = model.buildStringTruthTable;
const normalizeCell = model.normalizeCell;
const synthesizeStringCircuit = model.synthesizeStringCircuit;

const SAMPLE_SOURCE = "hello world\ngoodbye moon\nhello moon\ngoodbye world\nlogic circuit\nstring synthesis";
const SAMPLE_STRINGS = SAMPLE_SOURCE.split("\n");

const state = {
    mode: "characters",
    truthTable: null,
    redrawQueued: false,
};

const dom = {};

function loadDom() {
    dom.modeSelect = document.getElementById("mode-select");
    dom.sourceInput = document.getElementById("source-input");
    dom.generateButton = document.getElementById("generate-button");
    dom.table = document.getElementById("truth-table");
    dom.tableSummary = document.getElementById("table-summary");
    dom.canvasSummary = document.getElementById("canvas-summary");
    dom.canvas = document.getElementById("circuit-canvas");
}

function seedSourceInput() {
    dom.sourceInput.value = SAMPLE_STRINGS.join("\n");
}

function readSourceStrings() {
    return dom.sourceInput.value.split(/\r?\n/).map(function (line) {
        return line.trim();
    }).filter(function (line) {
        return Boolean(line);
    });
}

function debounce(fn, delay) {
    let timer = null;

    return function () {
        const args = arguments;
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
            fn.apply(null, args);
        }, delay);
    };
}

function rebuildTruthTableFromSource() {
    state.mode = dom.modeSelect.value;
    state.truthTable = buildStringTruthTable(readSourceStrings(), state.mode);
    renderTruthTable();
    updateSummary();
    queueCanvasRedraw();
}

function normalizeEditableRows() {
    const rowNodes = dom.table.querySelectorAll("tbody tr");
    const rows = [];

    for (let rowIndex = 0; rowIndex < rowNodes.length; rowIndex += 1) {
        const rowElement = rowNodes[rowIndex];
        const cellNodes = rowElement.querySelectorAll("td");
        const cells = [];

        for (let cellIndex = 0; cellIndex < cellNodes.length; cellIndex += 1) {
            cells.push(normalizeCell(cellNodes[cellIndex].textContent));
        }

        rows.push({
            id: "editable-" + (rowIndex + 1),
            cells: cells,
        });
    }

    const inputCount = Math.max(0, (rows[0] ? rows[0].cells.length : 1) - 1);
    const columns = [];

    for (let index = 0; index < inputCount; index += 1) {
        columns.push("Input " + (index + 1));
    }
    columns.push("Output");

    const filteredRows = [];
    for (const row of rows) {
        const enrichedRow = {
            id: row.id,
            cells: row.cells,
            inputs: row.cells.slice(0, inputCount),
            output: row.cells[inputCount] || EMPTY_CELL,
        };

        if (row.cells.some(function (cell) {
            return cell.length > 0;
        })) {
            filteredRows.push(enrichedRow);
        }
    }

    return {
        mode: state.mode,
        columns: columns,
        inputCount: inputCount,
        rowCount: filteredRows.length,
        maxLength: inputCount + 1,
        rows: filteredRows,
    };
}

function renderTruthTable() {
    if (!state.truthTable) {
        dom.table.innerHTML = "";
        return;
    }

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    for (const column of state.truthTable.columns) {
        const header = document.createElement("th");
        header.textContent = column;
        headRow.appendChild(header);
    }

    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    for (const row of state.truthTable.rows) {
        const tr = document.createElement("tr");

        for (const cellValue of row.cells) {
            const td = document.createElement("td");
            td.contentEditable = "true";
            td.spellcheck = false;
            td.textContent = cellValue || EMPTY_CELL;
            td.addEventListener("input", function () {
                td.textContent = td.textContent.trim() || EMPTY_CELL;
                queueCanvasRedraw();
            });
            td.addEventListener("blur", function () {
                td.textContent = td.textContent.trim() || EMPTY_CELL;
            });
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }

    dom.table.replaceChildren(thead, tbody);
}

function updateSummary() {
    if (!state.truthTable) {
        dom.tableSummary.textContent = "Waiting for data";
        dom.canvasSummary.textContent = "No circuit yet";
        return;
    }

    dom.tableSummary.textContent = state.truthTable.rowCount + " rows";
    dom.canvasSummary.textContent = state.truthTable.inputCount +
        " input columns";
}

function setCanvasSize(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return context;
}

function drawRoundedRect(context, x, y, width, height, radius, fill, stroke) {
    const right = x + width;
    const bottom = y + height;

    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(right, y, right, bottom, radius);
    context.arcTo(right, bottom, x, bottom, radius);
    context.arcTo(x, bottom, x, y, radius);
    context.arcTo(x, y, right, y, radius);
    context.closePath();
    context.fillStyle = fill;
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.fill();
    context.stroke();
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/);
    let line = "";
    let cursorY = y;

    for (const word of words) {
        const candidate = line ? line + " " + word : word;
        if (context.measureText(candidate).width > maxWidth && line) {
            context.fillText(line, x, cursorY);
            line = word;
            cursorY += lineHeight;
        } else {
            line = candidate;
        }
    }

    if (line) {
        context.fillText(line, x, cursorY);
    }
}

function drawArrow(context, startX, startY, endX, endY, color) {
    const controlOffset = Math.max(80, Math.abs(endX - startX) * 0.35);
    const headLength = 10;

    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(
        startX + controlOffset,
        startY,
        endX - controlOffset,
        endY,
        endX,
        endY,
    );
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();

    const angle = Math.atan2(endY - startY, endX - startX);
    context.beginPath();
    context.moveTo(endX, endY);
    context.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6),
        endY - headLength * Math.sin(angle - Math.PI / 6),
    );
    context.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6),
        endY - headLength * Math.sin(angle + Math.PI / 6),
    );
    context.closePath();
    context.fillStyle = color;
    context.fill();
}

function renderCanvas() {
    if (!state.truthTable) {
        return;
    }

    const table = normalizeEditableRows();
    const circuit = synthesizeStringCircuit(table, {
        canvasWidth: 1200,
        canvasHeight: Math.max(720, 180 + table.rowCount * 84 + 160),
    });

    dom.canvasSummary.textContent = circuit.summary.inputCount + " inputs";

    const context = setCanvasSize(dom.canvas, circuit.width, circuit.height);
    context.clearRect(0, 0, circuit.width, circuit.height);

    const background = context.createLinearGradient(
        0,
        0,
        circuit.width,
        circuit.height,
    );
    background.addColorStop(0, "#f6f4ff");
    background.addColorStop(0.5, "#eef6ff");
    background.addColorStop(1, "#f8fbf4");
    context.fillStyle = background;
    context.fillRect(0, 0, circuit.width, circuit.height);

    context.strokeStyle = "rgba(42, 61, 94, 0.08)";
    for (let x = 0; x < circuit.width; x += 36) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, circuit.height);
        context.stroke();
    }
    for (let y = 0; y < circuit.height; y += 36) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(circuit.width, y);
        context.stroke();
    }

    const nodeById = new Map();
    for (const node of circuit.nodes) {
        nodeById.set(node.id, node);
    }

    for (const edge of circuit.edges) {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);

        if (!from || !to) {
            continue;
        }

        drawArrow(
            context,
            from.x + from.width,
            from.y + from.height / 2,
            to.x,
            to.y + to.height / 2,
            edge.color,
        );
    }

    for (const node of circuit.nodes) {
        const nodeHeight = node.type === "gate" ? 88 : 56;
        drawRoundedRect(
            context,
            node.x,
            node.y,
            180,
            nodeHeight,
            18,
            node.fill,
            node.stroke,
        );
        context.fillStyle = "#17202b";
        context.font = node.type === "gate"
            ? "bold 18px Georgia, serif"
            : "bold 15px Georgia, serif";
        context.textAlign = "center";
        context.textBaseline = "top";

        const centerX = node.x + 90;
        const labelY = node.y + 10;

        if (node.type === "gate") {
            wrapText(context, node.label, centerX, labelY, 156, 18);
            context.font = "12px Georgia, serif";
            context.fillStyle = "#4b5b70";
            context.fillText(node.subtitle || "Gate", centerX, labelY + 44);
        } else {
            wrapText(context, node.label, centerX, labelY, 156, 17);
        }
    }

    context.fillStyle = "#2d3a4a";
    context.font = "13px Georgia, serif";
    context.textAlign = "left";
    context.fillText("Generated circuit preview", 24, 24);
}

function queueCanvasRedraw() {
    if (state.redrawQueued) {
        return;
    }

    state.redrawQueued = true;
    window.requestAnimationFrame(function () {
        state.redrawQueued = false;
        renderCanvas();
    });
}

function initialize() {
    loadDom();
    seedSourceInput();

    dom.modeSelect.addEventListener("change", rebuildTruthTableFromSource);
    dom.sourceInput.addEventListener(
        "input",
        debounce(rebuildTruthTableFromSource, 250),
    );
    dom.generateButton.addEventListener("click", function () {
        state.truthTable = normalizeEditableRows();
        updateSummary();
        renderCanvas();
    });

    rebuildTruthTableFromSource();
    renderCanvas();
}

window.addEventListener("DOMContentLoaded", initialize);


<<<<<<< HEAD
import R from "./ramda.js";

const S = "\u130C0";
const A = "\u13080";
const N = "\u13153";
=======
const S = '\u130C0';
const A = '\u13080';
const N = '\u13153';
>>>>>>> parent of 1dab3e8 (lint)

function arraysEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (Array.isArray(a[i]) && Array.isArray(b[i])) {
            if (!arraysEqual(a[i], b[i])) return false;
        } else if (a[i] !== b[i]) return false;
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
        for (let i = 0; i < key.length; i += 1) {
            if (patternArray[i] !== A && patternArray[i] !== key[i]) {
                match = false;
                break;
            }
        }
        if (match) results.push(key);
    }
    return results;
}

<<<<<<< HEAD
function mapToObject(m) {
    return fromPairs(
        [...m.entries()].map(([key, value]) => [JSON.stringify(key), value])
    );
=======
function mapToObject(map) {
    const obj = {};
    for (const [key, value] of map) {
        obj[JSON.stringify(key)] = value;
    }
    return obj;
>>>>>>> parent of 1dab3e8 (lint)
}

function objectToMap(obj) {
    const map = new Map();
    for (const [keyStr, value] of Object.entries(obj || {})) {
        const key = JSON.parse(keyStr);
        map.set(key, value);
    }
    return map;
}

const EMPTY_CELL = N;

function normalizeCell(value) {
    const text = value === null || value === undefined ? '' : String(value).trim();
    return text.length > 0 ? text : EMPTY_CELL;
}

function parseStrings(strings, mode) {
    return (Array.isArray(strings) ? strings : []).map(function (source) {
        const text = String(source || '').trim();
        if (!text) {
            return [];
        }

        if (mode === 'words') {
            return text.split(/\s+/).filter(Boolean);
        }

        if (mode === 'tokens') {
            return text.split(/[\s,;|]+/).filter(Boolean);
        }

        return Array.from(text);
    });
}

function buildStringTruthTable(strings, mode) {
    const sequences = parseStrings(strings, mode);
<<<<<<< HEAD
    const maxLength = R.reduce(
        (acc, seq) => Math.max(acc, seq.length), 0, sequences
    );
=======
    const maxLength = sequences.reduce(function (longest, sequence) {
        return Math.max(longest, sequence.length);
    }, 0);
>>>>>>> parent of 1dab3e8 (lint)
    const inputCount = Math.max(0, maxLength - 1);
    const columns = [];
    const rows = [];

    for (let i = 0; i < inputCount; i += 1) {
        columns.push('Input ' + (i + 1));
    }
    columns.push('Output');

    for (let rowIndex = 0; rowIndex < sequences.length; rowIndex += 1) {
        const sequence = sequences[rowIndex];
        const paddedSequence = sequence.slice();

        while (paddedSequence.length < inputCount + 1) {
            paddedSequence.unshift(EMPTY_CELL);
        }

        const inputs = paddedSequence.slice(0, inputCount);
        const output = paddedSequence[inputCount] || EMPTY_CELL;

        rows.push({
            id: 'seed-' + (rowIndex + 1),
            cells: inputs.concat([output]),
            inputs: inputs,
            output: output,
        });
    }

    return {
        mode: mode,
        columns: columns,
        inputCount: inputCount,
        rowCount: rows.length,
        rows: rows,
    };
}

function buildRandomTruthTable(inputCount, options = {}) {
    const inputTotal = Math.max(0, Number.isFinite(Number(inputCount)) ? Math.floor(Number(inputCount)) : 0);
    const outputStates = Array.isArray(options.outputStates) && options.outputStates.length > 0
        ? options.outputStates.slice()
        : [0, 1];
    const columns = [];
    const rows = [];
    const inputLabels = Array.isArray(options.inputLabels) ? options.inputLabels : [];
    const outputLabel = String(options.outputLabel || 'Output');

    for (let index = 0; index < inputTotal; index += 1) {
        columns.push(String(inputLabels[index] || 'Input ' + (index + 1)));
    }
    columns.push(outputLabel);

    const combinations = [];

    function buildCombinations(prefix, depth) {
        if (depth === inputTotal) {
            combinations.push(prefix.slice());
            return;
        }

        const states = Array.isArray(options.inputStates) && Array.isArray(options.inputStates[depth])
            ? options.inputStates[depth]
            : [0, 1];

        for (const state of states) {
            prefix.push(state);
            buildCombinations(prefix, depth + 1);
            prefix.pop();
        }
    }

    buildCombinations([], 0);

    if (options.shuffleRows === true) {
        for (let index = combinations.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            const temp = combinations[index];
            combinations[index] = combinations[swapIndex];
            combinations[swapIndex] = temp;
        }
    }

    for (let rowIndex = 0; rowIndex < combinations.length; rowIndex += 1) {
        const inputs = combinations[rowIndex].slice();
        const pickedOutput = outputStates[Math.floor(Math.random() * outputStates.length)];
        const output = pickedOutput === undefined ? EMPTY_CELL : pickedOutput;

        rows.push({
            id: 'random-' + (rowIndex + 1),
            cells: inputs.concat([output]),
            inputs: inputs,
            output: output,
        });
    }

    return {
        mode: 'random',
        columns: columns,
        inputCount: inputTotal,
        rowCount: rows.length,
        rows: rows,
    };
}

function synthesizeStringCircuit(table, options = {}) {
    const functionName = options.functionName || 'STRING';
    const inputCount = table && typeof table.inputCount === 'number' ? table.inputCount : 0;
    const rows = table && Array.isArray(table.rows) ? table.rows : [];
    const nodes = [];
    const edges = [];

    for (let i = 0; i < inputCount; i += 1) {
        nodes.push({
            id: functionName + '_IN' + (i + 1),
            kind: 'input',
            label: 'Input ' + (i + 1),
        });
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const gateId = functionName + '_G' + (rowIndex + 1);
        nodes.push({
            id: gateId,
            kind: 'gate',
            label: 'Row ' + (rowIndex + 1),
        });
        for (let i = 0; i < inputCount; i += 1) {
            edges.push({ from: functionName + '_IN' + (i + 1), to: gateId });
        }
    }

    nodes.push({
        id: functionName + '_OUT',
        kind: 'output',
        label: functionName + ' Output',
    });

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        edges.push({ from: functionName + '_G' + (rowIndex + 1), to: functionName + '_OUT' });
    }

    return {
        truthTable: table,
        neurones: nodes,
        nodes: nodes,
        edges: edges,
        summary: {
            inputCount: inputCount,
            rowCount: rows.length,
        },
        layout(width, height) {
            const arrangedNodes = nodes.map(function (node, index) {
                return Object.assign({}, node, {
                    x: 40 + (index * 140) % Math.max(1, width - 80),
                    y: 60 + Math.floor((index * 140) / Math.max(1, width - 80)) * 120,
                    width: 120,
                    height: node.kind === 'gate' ? 88 : 56,
                });
            });

            return {
                width: width,
                height: height,
                nodes: arrangedNodes,
                edges: edges.slice(),
                summary: {
                    inputCount: inputCount,
                    rowCount: rows.length,
                },
            };
        },
    };
}

class Neurone {
    constructor(nodeType, name = null, states = [0, 1]) {
        this.nodeType = nodeType;
        this.name = name;
        this.inputs = [];
        this.outputs = [];
        this.value = null;
        this.gateFunction = null;
        this.dim = null;
        this.states = [...new Set(states)].sort();
        this.inputStates = [];
        this.truthTable = new Map();
        this.inputBases = [];
        this.base = this.states.length;
    }

    getDims() {
        return this.dim !== null ? this.dim : this.inputs.length;
    }

    addInput(inputNeurone) {
        if (!this.inputs.includes(inputNeurone)) {
            this.inputs.push(inputNeurone);
            if (!inputNeurone.outputs.includes(this)) {
                inputNeurone.outputs.push(this);
            }
        }
    }

    removeInput(inputNeurone) {
        const index = this.inputs.indexOf(inputNeurone);
        if (index !== -1) {
            this.inputs.splice(index, 1);
            const outIndex = inputNeurone.outputs.indexOf(this);
            if (outIndex !== -1) {
                inputNeurone.outputs.splice(outIndex, 1);
            }
        }
    }

    static createGateFunction(truthTableMap) {
        return function(...inputs) {
            if (!inputs.includes(A)) {
                const result = getFromMap(truthTableMap, inputs);
                if (result !== null) return result;
                return N;
            } else {
                const possibilities = new Set();
                const matchingKeys = getMatchingKeys(truthTableMap, inputs);
                for (const key of matchingKeys) {
                    const value = truthTableMap.get(key);
                    possibilities.add(value);
                }
                if (possibilities.size === 1) {
                    return possibilities.values().next().value;
                } else if (possibilities.size === 0) {
                    return S;
                } else {
                    return [...possibilities].sort();
                }
            }
        };
    }

    setGateFunction(cin, func, inputStates = null, truthTable = null) {
        if (truthTable instanceof Map) {
            this.truthTable = truthTable;
        } else if (truthTable && typeof truthTable === 'object') {
            this.truthTable = objectToMap(truthTable);
        } else {
            this.truthTable = new Map();
        }
        
        this.gateFunction = func;
        this.dim = cin;
        
        if (inputStates === null) {
            this.inputStates = Array(cin).fill([0, 1]);
        } else {
            this.inputStates = inputStates.slice(0, cin).map(states => {
                if (typeof states === 'number') {
                    return Array.from({length: states}, (_, i) => i);
                }
                return [...states];
            });
        }
        this.inputBases = this.inputStates.map(states => states.length);
        this.base = this.states.length;
    }

    getStatesRange() {
        if (this.states && this.states.length > 0) {
            return this.states;
        }
        return [0, 1];
    }

    evaluate(visited = null) {
        if (visited === null) visited = [];
        if (visited.includes(this)) return this.value;

        visited.push(this);

        if (this.nodeType === 'input') {
            return this.value;
        }

        if (this.nodeType === 'output') {
            this.value = this.inputs.length > 0 ? this.inputs[0].evaluate(visited) : null;
            return this.value;
        }

        if (this.nodeType === 'gate' && this.gateFunction) {
            const inputValues = this.inputs.map(inp => inp.evaluate(visited));
            if (inputValues.some(v => v === null)) {
                this.value = null;
            } else {
                try {
                    this.value = this.gateFunction(...inputValues);
                } catch (e) {
                    this.value = null;
                }
            }
            return this.value;
        }

        return null;
    }

    getInputs(outputsTuple) {
        if (!this.truthTable || this.truthTable.size === 0) return [];
        
        const inputsList = [];
        const outputsArray = Array.isArray(outputsTuple) ? outputsTuple : [outputsTuple];
        
        for (const [inputs, output] of this.truthTable) {
            let match = false;
            if (Array.isArray(output) && Array.isArray(outputsArray)) {
                match = arraysEqual(output, outputsArray);
            } else {
                match = output === outputsTuple;
            }
            
            if (match) {
                const dict = {};
                for (let i = 0; i < this.inputs.length; i++) {
                    dict[this.inputs[i]] = inputs[i];
                }
                inputsList.push(dict);
            }
        }
        
        return inputsList.length > 0 ? inputsList : [{ [this.inputs[0] || '']: N }];
    }

    getStructure() {
        const structure = [];
        for (const [key, value] of this.truthTable) {
            structure.push([key, value]);
        }
        return { structure, mapping: {} };
    }

    static areEqual(table1, table2) {
        if (table1.size !== table2.size) return false;
        for (const [key, value] of table1) {
            if (!table2.has(key)) return false;
            if (table2.get(key) !== value) return false;
        }
        return true;
    }

    updateTruthTable(newTable) {
        if (this.truthTable.size === 0) {
            this.truthTable = newTable instanceof Map ? newTable : new Map(newTable);
        } else {
            for (const [key, value] of newTable) {
                if (this.truthTable.has(key)) {
                    const existing = this.truthTable.get(key);
                    if (existing !== value) {
                        if (Array.isArray(existing) && !existing.includes(value)) {
                            this.truthTable.set(key, [...existing, value]);
                        } else if (!Array.isArray(existing)) {
                            this.truthTable.set(key, [existing, value]);
                        }
                    }
                } else {
                    this.truthTable.set(key, value);
                }
            }
        }
    }

    serialize() {
        const obj = {
            nodeType: this.nodeType,
            name: this.name,
            dim: this.dim,
            states: this.states,
            inputStates: this.inputStates,
            truthTable: mapToObject(this.truthTable)
        };
        return JSON.stringify(obj);
    }

    static deserialize(jsonStr) {
        const obj = JSON.parse(jsonStr);
        const neurone = new Neurone(obj.nodeType, obj.name, obj.states);
        neurone.dim = obj.dim;
        neurone.inputStates = obj.inputStates;
        neurone.truthTable = objectToMap(obj.truthTable);
        return neurone;
    }
}

// ==================== GRAPH CLASS ====================

class Graph {
    constructor() {
        this.neurones = [];
        this.propagationOrder = [];
        this._nameCounter = 1;
        this.isomorphisms = {};
        this.IbP = {};
        this.GbT = {};
    }

    addNeurone(neurone) {
        this.neurones.push(neurone);
        if (neurone.nodeType === 'gate') {
            if (!neurone.name) {
                neurone.name = `x${this._nameCounter}`;
                this._nameCounter++;
            }
            
            let newGate = true;
            for (const [ttKey, gates] of Object.entries(this.GbT)) {
                const tt = JSON.parse(ttKey);
                if (Neurone.areEqual(tt, neurone.truthTable)) {
                    gates.push(neurone);
                    newGate = false;
                    break;
                }
            }
            if (newGate) {
                const ttObj = mapToObject(neurone.truthTable);
                this.GbT[JSON.stringify(ttObj)] = [neurone];
            }
        }
    }

    removeNeurone(neurone) {
        for (const otherNeurone of this.neurones) {
            const outIdx = otherNeurone.outputs.indexOf(neurone);
            if (outIdx !== -1) otherNeurone.outputs.splice(outIdx, 1);
            const inIdx = otherNeurone.inputs.indexOf(neurone);
            if (inIdx !== -1) otherNeurone.inputs.splice(inIdx, 1);
        }
        
        const idx = this.neurones.indexOf(neurone);
        if (idx !== -1) this.neurones.splice(idx, 1);
        
        const ttObj = mapToObject(neurone.truthTable);
        const ttKey = JSON.stringify(ttObj);
        if (ttKey in this.GbT) {
            const gateIdx = this.GbT[ttKey].indexOf(neurone);
            if (gateIdx !== -1) this.GbT[ttKey].splice(gateIdx, 1);
            if (this.GbT[ttKey].length === 0) {
                delete this.GbT[ttKey];
            }
        }
    }

    _calculatePropagationOrder() {
        const visited = new Set();
        const tempVisited = new Set();
        this.propagationOrder = [];

        const visit = (neurone) => {
            if (tempVisited.has(neurone)) return;
            if (visited.has(neurone)) return;
            tempVisited.add(neurone);
            for (const inputNeurone of neurone.inputs) {
                visit(inputNeurone);
            }
            tempVisited.delete(neurone);
            visited.add(neurone);
            if (neurone.nodeType !== 'input') {
                this.propagationOrder.push(neurone);
            }
        };

        for (const neurone of this.neurones) {
            if (neurone.nodeType === 'gate' || neurone.nodeType === 'output') {
                visit(neurone);
            }
        }
    }

    connectNeurones(fromNeurone, toNeurone) {
        toNeurone.addInput(fromNeurone);
    }

    setInputValues(valuesDict) {
        for (const neurone of this.neurones) {
            neurone.value = null;
        }
        for (const [name, value] of Object.entries(valuesDict)) {
            for (const neurone of this.neurones) {
                if (neurone.nodeType === 'input' && neurone.name === name) {
                    neurone.value = value;
                    break;
                }
            }
        }
        this.propagateValues();
    }

    propagateValues() {
        this._calculatePropagationOrder();
        for (const neurone of this.propagationOrder) {
            neurone.evaluate();
        }
    }

    getCurrentValues() {
        const values = {};
        for (const neurone of this.neurones) {
            if (neurone.nodeType === 'input') {
                values[neurone.name] = neurone.value !== null ? neurone.value : N;
            }
        }
        for (const neurone of this.propagationOrder) {
            values[neurone.name] = neurone.value !== null ? neurone.value : N;
        }
        for (const neurone of this.neurones) {
            if (neurone.nodeType === 'output') {
                values[neurone.name] = neurone.value !== null ? neurone.value : N;
            }
        }
        return values;
    }

    clearValues() {
        for (const neurone of this.neurones) {
            neurone.value = null;
        }
    }

    getTruthTableColumns() {
<<<<<<< HEAD
        const inputColumns = R.sort(
            (a, b) => (a < b ? -1 : a > b ? 1 : 0),
            this.neurones
                .filter(n => n.nodeType === "input")
                .map(n => n.name)
        );
=======
        const inputColumns = this.neurones
            .filter(n => n.nodeType === 'input')
            .map(n => n.name)
            .sort();
>>>>>>> parent of 1dab3e8 (lint)
        this._calculatePropagationOrder();
        const intermediateColumns = this.propagationOrder.map(n => n.name);
        return [...inputColumns, ...intermediateColumns];
    }

    getTruthTableRows() {
<<<<<<< HEAD
        const inputColumns = R.sort(
            (a, b) => (a < b ? -1 : a > b ? 1 : 0),
            this.neurones
                .filter(n => n.nodeType === "input")
                .map(n => n.name)
        );
=======
        const inputColumns = this.neurones
            .filter(n => n.nodeType === 'input')
            .map(n => n.name)
            .sort();
>>>>>>> parent of 1dab3e8 (lint)
        
        if (inputColumns.length === 0) return [];
        
        // Get all input neurones
        const inputNeurones = inputColumns.map(name => 
            this.neurones.find(n => n.name === name)
        ).filter(n => n);
        
        // Generate all combinations
        const states = inputNeurones.map(n => n.getStatesRange());
        const combinations = this.cartesianProduct(states);
        
        const rows = [];
        for (const combo of combinations) {
            const inputDict = {};
            for (let i = 0; i < inputNeurones.length; i++) {
                inputDict[inputNeurones[i].name] = combo[i];
            }
            this.setInputValues(inputDict);
            const values = this.getCurrentValues();
            rows.push(values);
        }
        
        return rows;
    }

    cartesianProduct(arrays) {
        if (arrays.length === 0) return [[]];
        const result = [];
        const rest = this.cartesianProduct(arrays.slice(1));
        for (const item of arrays[0]) {
            for (const r of rest) {
                result.push([item, ...r]);
            }
        }
        return result;
    }

    getTruthTableEntries() {
        const entries = [];
        for (const neurone of this.neurones) {
            if (neurone.truthTable && neurone.truthTable.size > 0) {
                for (const [key, value] of neurone.truthTable) {
                    entries.push({ neurone: neurone.name, inputs: key, output: value });
                }
            }
        }
        return entries;
    }

    static obediance(column, targetColumn) {
        const predicate = column.map(function (value, index) {
            return value === targetColumn[index];
        });
        const score = predicate.length > 0
            ? predicate.filter(Boolean).length / predicate.length
            : 0;
        return [score, predicate];
    }

    factorise_truth_table(truthTable, inputBases, outputBase, functionName, neuroneLayers, target) {
        const baseToStates = function (base) {
            if (Array.isArray(base)) {
                return base.slice();
            }
            if (typeof base === 'number' && Number.isFinite(base)) {
                return Array.from({ length: Math.max(0, base) }, function (_, index) {
                    return index;
                });
            }
            if (base === null || base === undefined) {
                return [0, 1];
            }
            return [base];
        };

        const flattenStates = function (values) {
            const seen = new Set();
            const states = [];

            for (const value of values) {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (!seen.has(item)) {
                            seen.add(item);
                            states.push(item);
                        }
                    }
                } else if (!seen.has(value)) {
                    seen.add(value);
                    states.push(value);
                }
            }

            return states.length > 0 ? states : [N];
        };

        const currentLayers = Array.isArray(neuroneLayers) ? neuroneLayers.slice() : [];
        const inputNeurones = currentLayers.length > 0 ? currentLayers[0].slice() : [];
        const functionPrefix = (functionName || 'GRAPH').trim() || 'GRAPH';
        const entries = truthTable instanceof Map ? [...truthTable.entries()] : [];
        const workingTruthTable = new Map(entries);
        const generatedNeurones = [];

        if (inputNeurones.length === 0 || workingTruthTable.size === 0) {
            return generatedNeurones;
        }

        const outputStates = baseToStates(outputBase);
        const outputNeurone = new Neurone('output', functionPrefix + '_OUT', outputStates);
        this.addNeurone(outputNeurone);

        if (inputNeurones.length === 1) {
            const onlyInput = inputNeurones[0];
            const gateTruthTable = new Map();
            for (const [inputs, output] of workingTruthTable) {
                gateTruthTable.set([inputs[0]], output);
            }

            const gate = new Neurone('gate', outputNeurone.name + '_G0.0', flattenStates(gateTruthTable.values()));
            gate.setGateFunction(
                1,
                Neurone.createGateFunction(gateTruthTable),
                [baseToStates(inputBases && inputBases[0] !== undefined ? inputBases[0] : onlyInput.states)],
                gateTruthTable
            );
            gate.addInput(onlyInput);
            this.addNeurone(gate);
            outputNeurone.addInput(gate);
            generatedNeurones.push(gate, outputNeurone);
            return generatedNeurones;
        }

        let workingLayer = inputNeurones.slice();
        let workingInputs = Array.isArray(inputBases)
            ? inputBases.map(baseToStates)
            : workingLayer.map(function (node) { return baseToStates(node.states); });
        let layerIndex = 0;

        while (workingLayer.length > 1) {
            const nextLayer = [];
            const pairMetadata = [];

            for (let pairIndex = 0; pairIndex < workingLayer.length; pairIndex += 2) {
                const leftNode = workingLayer[pairIndex];
                const rightNode = workingLayer[pairIndex + 1] || leftNode;
                const leftStates = workingInputs[pairIndex] || baseToStates(leftNode.states);
                const rightStates = workingInputs[pairIndex + 1] || leftStates;
                const pairTruthTable = new Map();

                for (const [inputs, output] of workingTruthTable) {
                    const leftValue = inputs[pairIndex];
                    const rightValue = inputs[pairIndex + 1] !== undefined ? inputs[pairIndex + 1] : inputs[pairIndex];
                    const pairKey = [leftValue, rightValue];
                    const matchedKey = findMatchingKey(pairTruthTable, pairKey);

                    if (matchedKey !== null) {
                        const existingValue = pairTruthTable.get(matchedKey);
                        if (!arraysEqual(existingValue, output)) {
                            const mergedValues = Array.isArray(existingValue) ? existingValue.slice() : [existingValue];
                            if (Array.isArray(output)) {
                                for (const item of output) {
                                    if (!mergedValues.includes(item)) {
                                        mergedValues.push(item);
                                    }
                                }
                            } else if (!mergedValues.includes(output)) {
                                mergedValues.push(output);
                            }
                            pairTruthTable.set(matchedKey, mergedValues.length === 1 ? mergedValues[0] : mergedValues);
                        }
                    } else {
                        pairTruthTable.set(pairKey, output);
                    }
                }

                const gateOutputStates = flattenStates(pairTruthTable.values());
                const gate = new Neurone(
                    'gate',
                    functionPrefix + '_G' + layerIndex + '.' + (pairIndex / 2 + 1),
                    gateOutputStates
                );
                gate.setGateFunction(
                    2,
                    Neurone.createGateFunction(pairTruthTable),
                    [leftStates, rightStates],
                    pairTruthTable
                );
                gate.addInput(leftNode);
                //if (rightNode !== leftNode) {
                    gate.addInput(rightNode);
                //}
                this.addNeurone(gate);
                nextLayer.push(gate);
                pairMetadata.push({ gate: gate, leftIndex: pairIndex, rightIndex: pairIndex + 1 });
                generatedNeurones.push(gate);
            }

            if (nextLayer.length === 1) {
                outputNeurone.addInput(nextLayer[0]);
                break;
            }

            const nextTruthTable = new Map();
            for (const [inputs, output] of workingTruthTable) {
                const nextInputs = [];
                for (const pair of pairMetadata) {
                    const leftValue = inputs[pair.leftIndex];
                    const rightValue = inputs[pair.rightIndex] !== undefined ? inputs[pair.rightIndex] : inputs[pair.leftIndex];
                    const matchedKey = findMatchingKey(pair.gate.truthTable, [leftValue, rightValue]);
                    nextInputs.push(matchedKey !== null ? pair.gate.truthTable.get(matchedKey) : N);
                }
                nextTruthTable.set(nextInputs, output);
            }

            workingTruthTable.clear();
            for (const [key, value] of nextTruthTable) {
                workingTruthTable.set(key, value);
            }
            workingLayer = nextLayer;
            workingInputs = nextLayer.map(function (node) {
                return baseToStates(node.states);
            });
            layerIndex += 1;
        }

        if (outputNeurone.inputs.length === 0 && workingLayer.length > 0) {
            outputNeurone.addInput(workingLayer[workingLayer.length - 1]);
        }

        generatedNeurones.push(outputNeurone);
        return generatedNeurones;
    }
}

function buildGraphFromTruthTable(truthTable, functionName) {
    const graph = new Graph();
    const rows = truthTable && Array.isArray(truthTable.rows) ? truthTable.rows : [];
    const inputCount = truthTable && Number.isInteger(truthTable.inputCount)
        ? truthTable.inputCount
        : Math.max(0, (rows[0] && Array.isArray(rows[0].cells) ? rows[0].cells.length : 1) - 1);
    const inputStatesList = [];
    const outputStates = new Set();
    const truthTableMap = new Map();
    const inputNodes = [];
    let i;

    for (i = 0; i < inputCount; i += 1) {
        inputStatesList.push(new Set());
    }

    for (i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        const cells = Array.isArray(row.cells) ? row.cells.slice() : [];
        const inputs = Array.isArray(row.inputs) && row.inputs.length > 0
            ? row.inputs.slice(0, inputCount)
            : cells.slice(0, inputCount);
        const output = row.output !== undefined
            ? normalizeCell(row.output)
            : normalizeCell(cells[inputCount]);
        const normalizedInputs = inputs.map(normalizeCell);

        while (normalizedInputs.length < inputCount) {
            normalizedInputs.push(N);
        }

        for (let inputIndex = 0; inputIndex < inputCount; inputIndex += 1) {
            inputStatesList[inputIndex].add(normalizedInputs[inputIndex]);
        }
        outputStates.add(output);
        truthTableMap.set(normalizedInputs, output);
    }

    for (i = 0; i < inputCount; i += 1) {
        const states = Array.from(inputStatesList[i]);
        const input = new Neurone(
            'input',
            (functionName || 'GRAPH') + '_IN' + (i + 1),
            states.length > 0 ? states : [0, 1]
        );
        inputNodes.push(input);
        graph.addNeurone(input);
    }

    if (truthTableMap.size > 0) {
        graph.factorise_truth_table(
            truthTableMap,
            inputNodes.map(function (node) {
                return node.states;
            }),
            Array.from(outputStates),
            functionName || 'GRAPH',
            [inputNodes],
            0
        );
    }

    graph.truthTable = truthTable;
    return graph;
}

class Imvolution extends Graph {
}

const api = {
    Neurone: Neurone,
    Imvolution: Imvolution,
    Graph: Graph,
    buildGraphFromTruthTable: buildGraphFromTruthTable,
    arraysEqual: arraysEqual,
    findMatchingKey: findMatchingKey,
    getFromMap: getFromMap,
    getMatchingKeys: getMatchingKeys,
    EMPTY_CELL: EMPTY_CELL,
    normalizeCell: normalizeCell,
    parseStrings: parseStrings,
    buildStringTruthTable: buildStringTruthTable,
    buildRandomTruthTable: buildRandomTruthTable,
    synthesizeStringCircuit: synthesizeStringCircuit,
    mapToObject: mapToObject,
    objectToMap: objectToMap,
};

export {
    Neurone,
    Imvolution,
    Graph,
    buildGraphFromTruthTable,
    arraysEqual,
    findMatchingKey,
    getFromMap,
    getMatchingKeys,
    EMPTY_CELL,
    normalizeCell,
    parseStrings,
    buildStringTruthTable,
    buildRandomTruthTable,
    synthesizeStringCircuit,
    mapToObject,
    objectToMap,
};

export default api;
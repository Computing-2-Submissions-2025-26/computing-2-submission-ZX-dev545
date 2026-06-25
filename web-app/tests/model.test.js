import assert from "node:assert/strict";
import {
    arraysEqual,
    findMatchingKey,
    getFromMap,
    buildGraphFromTruthTable,
    EMPTY_CELL
} from "../model.js";

// Build a truth table object in the format buildGraphFromTruthTable expects.
function makeTT(pairs, inputCount) {
    return {
        inputCount,
        rows: pairs.map(function ([inputs, output]) {
            return {
                inputs: inputs.map(String),
                output: String(output),
                cells: inputs.map(String).concat([String(output)])
            };
        })
    };
}

// ─── arraysEqual ────────────────────────────────────────────────────────────

describe("arraysEqual", function () {
    it("same reference → true", function () {
        const a = ["0", "1"];
        assert.equal(arraysEqual(a, a), true);
    });

    it("equal flat arrays → true", function () {
        assert.equal(arraysEqual(["0", "1"], ["0", "1"]), true);
    });

    it("different flat values → false", function () {
        assert.equal(arraysEqual(["0", "1"], ["1", "0"]), false);
    });

    it("different lengths → false", function () {
        assert.equal(arraysEqual(["0"], ["0", "1"]), false);
    });

    it("equal nested arrays → true", function () {
        assert.equal(arraysEqual([["0", "1"], "0"], [["0", "1"], "0"]), true);
    });

    it("nested arrays with different content → false", function () {
        assert.equal(arraysEqual([["0", "1"], "0"], [["0", "0"], "0"]), false);
    });

    it("array element vs string → false", function () {
        assert.equal(arraysEqual([["0", "1"]], ["0,1"]), false);
    });

    it("null vs array → false", function () {
        assert.equal(arraysEqual(null, ["0"]), false);
        assert.equal(arraysEqual(["0"], null), false);
    });

    it("null === null → true (same reference shortcut)", function () {
        assert.equal(arraysEqual(null, null), true);
    });
});

// ─── findMatchingKey / getFromMap ────────────────────────────────────────────

describe("findMatchingKey", function () {
    it("finds a plain string key", function () {
        const map = new Map();
        const k = ["0", "1"];
        map.set(k, "yes");
        const result = findMatchingKey(map, ["0", "1"]);
        assert.ok(result !== null);
        assert.equal(map.get(result), "yes");
    });

    it("returns null when key absent", function () {
        const map = new Map();
        map.set(["0", "0"], "x");
        assert.equal(findMatchingKey(map, ["1", "1"]), null);
    });

    it("finds a key with a nested array element", function () {
        const map = new Map();
        map.set([["0", "1"], "0"], "nested");
        const result = findMatchingKey(map, [["0", "1"], "0"]);
        assert.ok(result !== null);
        assert.equal(map.get(result), "nested");
    });

    it("distinguishes two nested keys with swapped inner arrays", function () {
        const map = new Map();
        map.set([["0", "1"], "0"], "A");
        map.set([["1", "0"], "0"], "B");
        const rA = findMatchingKey(map, [["0", "1"], "0"]);
        const rB = findMatchingKey(map, [["1", "0"], "0"]);
        assert.equal(map.get(rA), "A");
        assert.equal(map.get(rB), "B");
    });

    it("finds a key where both elements are nested arrays", function () {
        const map = new Map();
        map.set([["0", "1"], ["0", "1"]], "both");
        const result = findMatchingKey(map, [["0", "1"], ["0", "1"]]);
        assert.ok(result !== null);
        assert.equal(map.get(result), "both");
    });
});

//----------------------------- SETP-BY-STEP DEBUGGING --------------------------------

function evaluateGraph(graph, inputs) {
    graph.setInputValues(inputs);

    const output = graph.neurones.find(n => n.nodeType === "output");

    return output.value;
}

function getGateValues(graph) {
    return graph.neurones
        .filter(n => n.nodeType === "gate")
        .map(n => n.value);
}

describe("buildGraphFromTruthTable", function () {
    it("factorises a 1-input identity function", () => {
        const table = {
            inputCount: 1,
            rows: [
                { inputs: ["0"], output: "0", cells: ["0","0"] },
                { inputs: ["1"], output: "1", cells: ["1","1"] },
            ]
        };

        const graph = buildGraphFromTruthTable(table, "ID");

        assert.equal(evaluateGraph(graph, { ID_IN1: "0" }), "0");
        assert.equal(evaluateGraph(graph, { ID_IN1: "1" }), "1");
    });

    it("reproduces XOR exactly", () => {
        const table = {
            inputCount: 2,
            rows: [
                { inputs: ["0","0"], output: "0", cells:["0","0","0"] },
                { inputs: ["0","1"], output: "1", cells:["0","1","1"] },
                { inputs: ["1","0"], output: "1", cells:["1","0","1"] },
                { inputs: ["1","1"], output: "0", cells:["1","1","0"] },
            ]
        };

        const graph = buildGraphFromTruthTable(table, "XOR");

        assert.equal(evaluateGraph(graph,{XOR_IN1:"0",XOR_IN2:"0"}), "0");
        assert.equal(evaluateGraph(graph,{XOR_IN1:"0",XOR_IN2:"1"}), "1");
        assert.equal(evaluateGraph(graph,{XOR_IN1:"1",XOR_IN2:"0"}), "1");
        assert.equal(evaluateGraph(graph,{XOR_IN1:"1",XOR_IN2:"1"}), "0");
    });

    it("creates uncertainty in intermediate gates when multiple outputs remain possible", () => {
        const table = {
            inputCount: 4,
            rows: []
        };

        for (let a=0;a<2;a++) {
            for (let b=0;b<2;b++) {
                for (let c=0;c<2;c++) {
                    for (let d=0;d<2;d++) {
                        const inputs = [a,b,c,d].map(String);
                        const output = String((a+b+c+d) % 2);
                        table.rows.push({ inputs, output, cells: [inputs[0], inputs[1], inputs[2], inputs[3]] });
                    }
                }
            }
        }

        const graph = buildGraphFromTruthTable(table, "PARITY");

        graph.setInputValues({
            PARITY_IN1: "0",
            PARITY_IN2: "0",
            PARITY_IN3: "0",
            PARITY_IN4: "0"
        });

        const gateValues = getGateValues(graph);

        assert.equal(gateValues.some(v => Array.isArray(v)), true);
    });

    it("matches every row of the original truth table", () => {
        const table = {
            inputCount: 3,
            rows: []
        };

        for (let a=0;a<2;a++) {
            for (let b=0;b<2;b++) {
                for (let c=0;c<2;c++) {

                    const result = (a && b) || c;

                    table.rows.push({ inputs: [String(a), String(b), String(c)], output: String(result), cells: [String(a), String(b), String(c)] });
                }
            }
        }

        const graph = buildGraphFromTruthTable(table, "TEST");

        assert.equal(graph.neurones.length > 0, true);

        for (const [inputRow, expected] of table.rows.map(r => [r.inputs, r.output])) {

            graph.setInputValues({
                TEST_IN1: inputRow[0],
                TEST_IN2: inputRow[1],
                TEST_IN3: inputRow[2]
            });

            const output = graph.neurones.find(
                n => n.nodeType === "output"
            );

            assert.equal(output.value, expected);
            assert.equal(Array.isArray(output.value), false);
        }
    });

    it("all uncertainty must disappear before the output layer", () => {
        const graph = buildGraphFromTruthTable(table, "TEST");

        const output = graph.neurones.find(
            n => n.nodeType === "output"
        );

        const rows = graph.getTruthTableRows();

        for (const row of rows) {

            const inputs = {};

            Object.keys(row)
                .filter(k => k.startsWith("TEST_IN"))
                .forEach(k => {
                    inputs[k] = row[k];
                });

            graph.setInputValues(inputs);

            assert.equal(Array.isArray(output.value), false);
        }
    });
});

// ─── 2-input AND ─────────────────────────────────────────────────────────────

describe("factorise_truth_table – 2-input AND", function () {
    let graph;

    before(function () {
        const tt = makeTT([
            [["0", "0"], "0"],
            [["0", "1"], "0"],
            [["1", "0"], "0"],
            [["1", "1"], "1"],
        ], 2);
        graph = buildGraphFromTruthTable(tt, "AND2");
    });

    it("graph has 4 neurones (IN1, IN2, gate, output)", function () {
        assert.equal(graph.neurones.length, 4);
    });

    it("produces exactly one gate", function () {
        const gates = graph.neurones.filter(n => n.nodeType === "gate");
        assert.equal(gates.length, 1);
    });

    it("gate truth table is correct AND", function () {
        const gate = graph.neurones.find(n => n.nodeType === "gate");
        assert.equal(getFromMap(gate.truthTable, ["0", "0"]), "0");
        assert.equal(getFromMap(gate.truthTable, ["0", "1"]), "0");
        assert.equal(getFromMap(gate.truthTable, ["1", "0"]), "0");
        assert.equal(getFromMap(gate.truthTable, ["1", "1"]), "1");
    });

    it("output is connected to the gate", function () {
        const output = graph.neurones.find(n => n.nodeType === "output");
        const gate   = graph.neurones.find(n => n.nodeType === "gate");
        assert.equal(output.inputs.length, 1);
        assert.equal(output.inputs[0], gate);
    });

    it("evaluates all 4 AND rows correctly", function () {
        const output = graph.neurones.find(n => n.nodeType === "output");
        for (const [[a, b], expected] of [
            [["0", "0"], "0"], [["0", "1"], "0"],
            [["1", "0"], "0"], [["1", "1"], "1"],
        ]) {
            graph.setInputValues({ "AND2_IN1": a, "AND2_IN2": b });
            assert.equal(output.value, expected, `AND(${a},${b})`);
        }
    });
});

// ─── 4-input clean factorisation: (a∧b)∧(c∧d) ───────────────────────────────

describe("factorise_truth_table – 4-input (a∧b)∧(c∧d)", function () {
    let graph;

    before(function () {
        const pairs = [];
        for (const a of ["0", "1"])
            for (const b of ["0", "1"])
                for (const c of ["0", "1"])
                    for (const d of ["0", "1"])
                        pairs.push([[a, b, c, d],
                            (a === "1" && b === "1" && c === "1" && d === "1") ? "1" : "0"]);
        graph = buildGraphFromTruthTable(makeTT(pairs, 4), "AND4");
    });

    it("graph has 8 neurones (4 in + 2 L0 gates + 1 L1 gate + 1 out)", function () {
        const t1 = graph.neurones.length;
        console.log("graph.neurones.length =", t1);
        assert.equal(t1, 8);
    });

    it("produces 3 gate neurones", function () {
        assert.equal(graph.neurones.filter(n => n.nodeType === "gate").length, 3);
    });

    it("layer-0 gate AND4_G0.1 has AND truth table", function () {
        const g = graph.neurones.find(n => n.name === "AND4_G0.1");
        assert.ok(g, "AND4_G0.1 missing");
        assert.equal(getFromMap(g.truthTable, ["0", "0"]), "0");
        assert.equal(getFromMap(g.truthTable, ["0", "1"]), "0");
        assert.equal(getFromMap(g.truthTable, ["1", "0"]), "0");
        assert.equal(JSON.stringify(getFromMap(g.truthTable, ["1", "1"])), JSON.stringify(["0", "1"]));
    });

    it("layer-0 gate AND4_G0.2 has AND truth table", function () {
        const g = graph.neurones.find(n => n.name === "AND4_G0.2");
        assert.ok(g, "AND4_G0.2 missing");
        assert.equal(getFromMap(g.truthTable, ["0", "0"]), "0");
        assert.equal(getFromMap(g.truthTable, ["0", "1"]), "0");
        assert.equal(getFromMap(g.truthTable, ["1", "0"]), "0");
        assert.equal(JSON.stringify(getFromMap(g.truthTable, ["1", "1"])), JSON.stringify(["0", "1"]));
    });

    it("layer-1 gate AND4_G1.1 has correct truth table", function () {
        const g = graph.neurones.find(n => n.name === "AND4_G1.1");
        assert.ok(g, "AND4_G1.1 missing");
        assert.equal(getFromMap(g.truthTable, ["0", "0"]), "0");
        assert.equal(getFromMap(g.truthTable, ["0", ["0", "1"]]), "0");
        assert.equal(getFromMap(g.truthTable, [["0", "1"], "0"]), "0");
        assert.equal(getFromMap(g.truthTable, [["0", "1"], ["0", "1"]]), "1");
    });

    it("layer-1 gate AND4_G1.1 truth table is non-empty (debug)", function () {
        const g = graph.neurones.find(n => n.name === "AND4_G1.1");
        assert.ok(g, "AND4_G1.1 missing");
        console.log("G1.1 truthTable size:", g.truthTable.size);
        for (const [k, v] of g.truthTable) {
            console.log(" key:", JSON.stringify(k), "→", JSON.stringify(v));
        }
        assert.ok(g.truthTable.size > 0, "G1.1 truth table is empty");
    });

    it("output feeds from AND4_G1.1", function () {
        const out = graph.neurones.find(n => n.nodeType === "output");
        const g11 = graph.neurones.find(n => n.name === "AND4_G1.1");
        assert.equal(out.inputs[0], g11);
    });

    it("evaluates all 16 inputs correctly", function () {
        const output = graph.neurones.find(n => n.nodeType === "output");
        for (const a of ["0", "1"])
            for (const b of ["0", "1"])
                for (const c of ["0", "1"])
                    for (const d of ["0", "1"]) {
                        const expected = (a==="1"&&b==="1"&&c==="1"&&d==="1") ? "1" : "0";
                        graph.setInputValues({
                            AND4_IN1: a, AND4_IN2: b, AND4_IN3: c, AND4_IN4: d,
                        });
                        assert.equal(output.value, expected,
                            `(${a}∧${b})∧(${c}∧${d})`);
                    }
    });
});

// ─── 4-input non-factorisable: f(a,b,c,d) = a∧c ─────────────────────────────
// Pairing (a,b) and (c,d) means neither layer-0 gate cleanly captures a or c,
// so both gates produce merged/ambiguous outputs for some inputs.
// With recursive arraysEqual, getFromMap must still work on the resulting
// layer-1 truth table whose keys contain nested arrays.

describe("factorise_truth_table – 4-input non-factorisable (a∧c)", function () {
    let graph;

    before(function () {
        const pairs = [];
        for (const a of ["0", "1"])
            for (const b of ["0", "1"])
                for (const c of ["0", "1"])
                    for (const d of ["0", "1"])
                        pairs.push([[a, b, c, d],
                            (a === "1" && c === "1") ? "1" : "0"]);
        graph = buildGraphFromTruthTable(makeTT(pairs, 4), "AC");
    });

    it("layer-0 gate AC_G0.1 outputs ambiguous array when a=1", function () {
        const g = graph.neurones.find(n => n.name === "AC_G0.1");
        assert.ok(g, "AC_G0.1 missing");
        // a=0: output is always "0" (f=0 regardless of c)
        assert.equal(getFromMap(g.truthTable, ["0", "0"]), "0");
        assert.equal(getFromMap(g.truthTable, ["0", "1"]), "0");
        // a=1: output depends on c (not b!), so gate merges "0" and "1"
        const out10 = getFromMap(g.truthTable, ["1", "0"]);
        assert.ok(Array.isArray(out10), "(1,0) should give merged array");
        assert.deepEqual([...out10].sort(), ["0", "1"]);
        const out11 = getFromMap(g.truthTable, ["1", "1"]);
        assert.ok(Array.isArray(out11), "(1,1) should give merged array");
        assert.deepEqual([...out11].sort(), ["0", "1"]);
    });

    it("layer-0 gate AC_G0.2 outputs ambiguous array when c=1", function () {
        const g = graph.neurones.find(n => n.name === "AC_G0.2");
        assert.ok(g, "AC_G0.2 missing");
        assert.equal(getFromMap(g.truthTable, ["0", "0"]), "0");
        assert.equal(getFromMap(g.truthTable, ["0", "1"]), "0");
        const out10 = getFromMap(g.truthTable, ["1", "0"]);
        assert.ok(Array.isArray(out10));
        assert.deepEqual([...out10].sort(), ["0", "1"]);
    });

    it("layer-1 gate AC_G1.1 can be looked up with nested-array keys", function () {
        const g = graph.neurones.find(n => n.name === "AC_G1.1");
        assert.ok(g, "AC_G1.1 missing");
        // The key [["0","1"],["0","1"]] was built from merged gate outputs –
        // findMatchingKey must use recursive arraysEqual to find it.
        const val = getFromMap(g.truthTable, [["0", "1"], ["0", "1"]]);
        assert.notEqual(val, null, "nested-array key lookup returned null");
        assert.equal(val, "1");  // when both gates are ambiguous, f = a∧c = 1
    });

    it("layer-1 gate maps unambiguous key [['0','1'],'0'] → '0'", function () {
        const g = graph.neurones.find(n => n.name === "AC_G1.1");
        // g0.1 = ["0","1"] (a=1, ambiguous), g0.2 = "0" (c=0, unambiguous) → f=0
        const val = getFromMap(g.truthTable, [["0", "1"], "0"]);
        assert.equal(val, "0");
    });

    it("evaluates all 16 inputs correctly despite ambiguous intermediates", function () {
        const output = graph.neurones.find(n => n.nodeType === "output");
        for (const a of ["0", "1"])
            for (const b of ["0", "1"])
                for (const c of ["0", "1"])
                    for (const d of ["0", "1"]) {
                        const expected = (a === "1" && c === "1") ? "1" : "0";
                        graph.setInputValues({
                            AC_IN1: a, AC_IN2: b, AC_IN3: c, AC_IN4: d,
                        });
                        assert.equal(output.value, expected,
                            `a∧c with (${a},${b},${c},${d})`);
                    }
    });
});

// ─── EMPTY_CELL propagation ──────────────────────────────────────────────────
// If a gate lookup fails (key not in truth table), it should return EMPTY_CELL,
// not throw or silently return null.

describe("gate function returns EMPTY_CELL for unknown inputs", function () {
    it("unknown input key returns EMPTY_CELL, not null/undefined", function () {
        const tt = makeTT([
            [["0", "0"], "0"],
            [["1", "1"], "1"],
        ], 2);
        const graph = buildGraphFromTruthTable(tt, "SPARSE");
        const gate = graph.neurones.find(n => n.nodeType === "gate");
        // "0","1" is not in the truth table
        graph.setInputValues({ SPARSE_IN1: "0", SPARSE_IN2: "1" });
        const output = graph.neurones.find(n => n.nodeType === "output");
        assert.equal(output.value, EMPTY_CELL);
    });
});
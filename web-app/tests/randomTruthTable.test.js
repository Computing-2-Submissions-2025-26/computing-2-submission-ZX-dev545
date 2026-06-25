import assert from "node:assert/strict";
import { buildRandomTruthTable, buildGraphFromTruthTable } from "../model.js";

describe("buildRandomTruthTable", function () {
  it("creates all binary input combinations for the requested input count", function () {
    const table = buildRandomTruthTable(3);

    assert.equal(table.inputCount, 3);
    assert.equal(table.rowCount, 8);
    assert.deepEqual(table.columns, ["Input 1", "Input 2", "Input 3", "Output"]);
    assert.equal(table.rows.length, 8);

    for (const row of table.rows) {
      assert.equal(row.cells.length, 4);
      assert.equal(row.inputs.length, 3);
      assert.ok([0, 1].includes(row.output));
    }
  });

  it("supports custom output states and remains graph-compatible", function () {
    const table = buildRandomTruthTable(2, {
      outputStates: ["LOW", "HIGH"],
      outputLabel: "Result",
      shuffleRows: true,
    });

    assert.equal(table.columns[2], "Result");
    assert.equal(table.rowCount, 4);

    const graph = buildGraphFromTruthTable(table, "RAND");
    assert.ok(graph);
    assert.ok(Array.isArray(graph.neurones));
    assert.ok(graph.neurones.length > 0);
  });
});

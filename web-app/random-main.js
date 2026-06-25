import model from "./model.js";

const buildRandomTruthTable = model.buildRandomTruthTable;
const buildGraphFromTruthTable = model.buildGraphFromTruthTable;

function pickRandomInputCount() {
  return 2 + Math.floor(Math.random() * 3);
}

function buildRandomGraphWrapper() {
  const inputCount = pickRandomInputCount();
  const truthTable = buildRandomTruthTable(inputCount, {
    outputStates: [0, 1],
    shuffleRows: true
  });
  const graphWrapper = buildGraphFromTruthTable(truthTable, "RANDOM");

  window.randomTruthTable = truthTable;
  window.graphwrapper = graphWrapper;

  return graphWrapper;
}

function bootstrapRandomGame() {
  buildRandomGraphWrapper();

  return import("./gameui.js").then(function (gameUIModule) {
    const gameUI = gameUIModule.default || gameUIModule;

    if (gameUI && typeof gameUI.setGraphSource === "function") {
      gameUI.setGraphSource(window.graphwrapper);
    }

    return window.graphwrapper;
  });
}

function startNewRandomGame() {
  const graphWrapper = buildRandomGraphWrapper();

  if (window.gameUI && typeof window.gameUI.setGraphSource === "function") {
    window.gameUI.setGraphSource(graphWrapper);
  }

  return graphWrapper;
}

// bootstrapRandomGame();

window.randomGame = {
  buildRandomGraphWrapper: buildRandomGraphWrapper,
  bootstrapRandomGame: bootstrapRandomGame,
  startNewRandomGame: startNewRandomGame
};

export { buildRandomGraphWrapper, bootstrapRandomGame, startNewRandomGame };
export default bootstrapRandomGame;

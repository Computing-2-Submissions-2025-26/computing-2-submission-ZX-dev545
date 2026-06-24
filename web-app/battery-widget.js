/**
 * battery-widget.js
 *
 * Drop-in progressive enhancement for the truth panel.
 * Renders an SVG battery where each slice = one truth-table row.
 * Slices glow when the live circuit output matches the desired output.
 *
 * Usage: add   <script type="module" src="battery-widget.js"></script>
 * after gameui loads (e.g. at the bottom of <body>).
 *
 * Reads from window.randomTruthTable  (desired output)
 * and window.gameUI.buildPlayerGraphTruthTable() if exposed,
 * or falls back to the same internal path gameui uses.
 */

(function () {
  "use strict";

  /* ── palette ─────────────────────────────────────────────── */
  const COLOURS = {
    batteryBody:   "rgba(14, 22, 36, 0.92)",
    batteryBorder: "rgba(166, 225, 255, 0.22)",
    batteryShine:  "rgba(166, 225, 255, 0.06)",
    cap:           "rgba(166, 225, 255, 0.35)",
    sliceIdle:     "rgba(255, 255, 255, 0.04)",
    sliceBorder:   "rgba(255, 255, 255, 0.06)",
    sliceMatch:    "rgba(132, 232, 162, 0.18)",   /* glow fill   */
    sliceMatchBdr: "rgba(132, 232, 162, 0.55)",   /* glow border */
    symbolIdle:    "rgba(179, 191, 211, 0.9)",
    symbolMatch:   "#d6ffe3",
    label:         "rgba(166, 225, 255, 0.7)",
    dimLabel:      "rgba(179, 191, 211, 0.5)",
  };

  /* ── geometry ────────────────────────────────────────────── */
  const BODY_W  = 72;   /* battery body width  */
  const CAP_W   = 32;   /* terminal cap width  */
  const CAP_H   = 10;   /* terminal cap height */
  const R       = 10;   /* corner radius        */
  const SLICE_H = 36;   /* height per row slice */
  const GAP     = 3;    /* gap between slices   */
  const PAD_X   = 8;    /* body padding x       */
  const PAD_Y   = 8;    /* body padding y       */

  /* ── container ───────────────────────────────────────────── */
  let container = null;

  function ensureContainer() {
    if (container) return container;

    const panel = document.getElementById("batteryWidget");
    if (!panel) return null;

    /* insert battery container above existing table sections */
    const wrapper = document.createElement("div");
    wrapper.id = "batteryWidgetWrap";
    wrapper.style.cssText = [
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "gap:16px",
      "padding:12px 0 16px",
    ].join(";");

    panel.insertBefore(wrapper, panel.firstChild);
    container = wrapper;
    return container;
  }

  /* ── data helpers ────────────────────────────────────────── */

  /**
   * Returns the desired-output column as an array of strings,
   * one entry per truth-table row, in the same order as the table.
   */
  function getDesiredOutputColumn() {
    const tt = window.randomTruthTable;
    if (!tt || !Array.isArray(tt.rows) || tt.rows.length === 0) return null;

    return tt.rows.map(function (row) {
      if (row.output !== undefined) return String(row.output);
      if (Array.isArray(row.cells) && row.cells.length > 0)
        return String(row.cells[row.cells.length - 1]);
      if (Array.isArray(row.inputs)) {
        /* last cell of inputs fallback – unlikely but safe */
        return String(row.inputs[row.inputs.length - 1] ?? "?");
      }
      return "?";
    });
  }

  /**
   * Returns the live-output column as an array of strings.
   * Tries to call the same internal path gameui uses.
   */
  function getLiveOutputColumn() {
    /* gameui doesn't export buildPlayerGraphTruthTable directly,
       so we try a few hooks in order of preference. */

    /* Option A: gameui exposed it on window.gameUI */
    if (window.gameUI && typeof window.gameUI.buildPlayerGraphTruthTable === "function") {
      const live = window.gameUI.buildPlayerGraphTruthTable();
      if (live && Array.isArray(live.rows)) {
        return live.rows.map(function (row) {
          return String(row[row.length - 1]);
        });
      }
    }

    /* Option B: window.liveGraphTruthTable set by gameui patch below */
    if (window._batteryLiveTT && Array.isArray(window._batteryLiveTT.rows)) {
      return window._batteryLiveTT.rows.map(function (row) {
        return String(row[row.length - 1]);
      });
    }

    return null;
  }

  /* ── SVG helpers ─────────────────────────────────────────── */

  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs || {}).forEach(function ([k, v]) {
      el.setAttribute(k, v);
    });
    return el;
  }

  function svgText(content, attrs) {
    const el = svgEl("text", attrs);
    el.textContent = content;
    return el;
  }

  /* ── symbol map ──────────────────────────────────────────── */
  function symbolFor(value) {
    if (value === "1" || value === "true")  return "1";
    if (value === "0" || value === "false") return "0";
    if (value === "?") return "·";
    return value.length > 2 ? value.slice(0, 2) : value;
  }

  /* ── glow filter defs ────────────────────────────────────── */
  function buildDefs(svg) {
    const defs = svgEl("defs", {});

    /* glow filter for matched slices */
    const filter = svgEl("filter", { id: "bw-glow", x: "-30%", y: "-30%", width: "160%", height: "160%" });
    const blur   = svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "3", result: "blur" });
    const merge  = svgEl("feMerge", {});
    const m1     = svgEl("feMergeNode", { in: "blur" });
    const m2     = svgEl("feMergeNode", { in: "SourceGraphic" });
    merge.appendChild(m1);
    merge.appendChild(m2);
    filter.appendChild(blur);
    filter.appendChild(merge);
    defs.appendChild(filter);

    /* linear gradient for battery body shine */
    const grad = svgEl("linearGradient", { id: "bw-shine", x1: "0", y1: "0", x2: "1", y2: "0" });
    const s1   = svgEl("stop", { offset: "0%",   "stop-color": "rgba(255,255,255,0.0)" });
    const s2   = svgEl("stop", { offset: "40%",  "stop-color": "rgba(255,255,255,0.05)" });
    const s3   = svgEl("stop", { offset: "60%",  "stop-color": "rgba(255,255,255,0.08)" });
    const s4   = svgEl("stop", { offset: "100%", "stop-color": "rgba(255,255,255,0.0)" });
    [s1, s2, s3, s4].forEach(function (s) { grad.appendChild(s); });
    defs.appendChild(grad);

    svg.appendChild(defs);
  }

  /* ── main render ─────────────────────────────────────────── */

  function renderBattery(desired, live) {
    const wrap = ensureContainer();
    if (!wrap) return;

    /* clear previous battery */
    const prev = wrap.querySelector("svg.bw-svg");
    if (prev) prev.remove();

    const rowCount  = desired.length;
    const bodyH     = PAD_Y + rowCount * SLICE_H + (rowCount - 1) * GAP + PAD_Y;
    const totalH    = CAP_H + bodyH;
    const svgW      = BODY_W + 24;   /* some breathing room */
    const svgH      = totalH + 4;
    const bodyX     = (svgW - BODY_W) / 2;
    const bodyY     = CAP_H;

    const svg = svgEl("svg", {
      class:   "bw-svg",
      viewBox: "0 0 " + svgW + " " + svgH,
      width:   svgW,
      height:  svgH,
      style:   "display:block;overflow:visible",
      "aria-hidden": "true",
    });

    buildDefs(svg);

    /* ── terminal cap ── */
    const capX = bodyX + (BODY_W - CAP_W) / 2;
    svg.appendChild(svgEl("rect", {
      x: capX, y: 0, width: CAP_W, height: CAP_H,
      rx: 4, ry: 4,
      fill: COLOURS.cap,
    }));

    /* ── battery body shell ── */
    svg.appendChild(svgEl("rect", {
      x: bodyX, y: bodyY, width: BODY_W, height: bodyH,
      rx: R, ry: R,
      fill: COLOURS.batteryBody,
      stroke: COLOURS.batteryBorder,
      "stroke-width": 1.5,
    }));

    /* shine overlay */
    svg.appendChild(svgEl("rect", {
      x: bodyX, y: bodyY, width: BODY_W, height: bodyH,
      rx: R, ry: R,
      fill: "url(#bw-shine)",
    }));

    /* ── slices ── */
    const sliceX = bodyX + PAD_X;
    const sliceW = BODY_W - PAD_X * 2;

    for (let i = 0; i < rowCount; i++) {
      const desiredVal = desired[i];
      const liveVal    = live ? live[i] : null;
      const matched    = liveVal !== null && liveVal === desiredVal;
      const symbol     = symbolFor(desiredVal);

      const sliceY = bodyY + PAD_Y + i * (SLICE_H + GAP);
      const sliceR = 6;

      /* slice background */
      const sliceGroup = svgEl("g", {
        filter: matched ? "url(#bw-glow)" : "",
      });

      sliceGroup.appendChild(svgEl("rect", {
        x: sliceX, y: sliceY, width: sliceW, height: SLICE_H,
        rx: sliceR, ry: sliceR,
        fill: matched ? COLOURS.sliceMatch : COLOURS.sliceIdle,
        stroke: matched ? COLOURS.sliceMatchBdr : COLOURS.sliceBorder,
        "stroke-width": matched ? 1.2 : 0.8,
      }));

      /* row index label (small, left-aligned) */
      sliceGroup.appendChild(svgText(String(i), {
        x: sliceX + 7,
        y: sliceY + SLICE_H / 2 + 4,
        fill: matched ? COLOURS.symbolMatch : COLOURS.dimLabel,
        "font-size": "9",
        "font-family": "ui-monospace, 'Cascadia Code', 'Fira Mono', monospace",
        "font-weight": "700",
        "text-anchor": "start",
        opacity: "0.7",
      }));

      /* main output symbol (centred) */
      sliceGroup.appendChild(svgText(symbol, {
        x: sliceX + sliceW / 2,
        y: sliceY + SLICE_H / 2 + 6,
        fill: matched ? COLOURS.symbolMatch : COLOURS.symbolIdle,
        "font-size": "16",
        "font-family": "ui-monospace, 'Cascadia Code', 'Fira Mono', monospace",
        "font-weight": "800",
        "text-anchor": "middle",
        filter: matched ? "url(#bw-glow)" : "",
      }));

      /* live value indicator (small, right-aligned) */
      if (live && live[i] !== undefined) {
        const liveSym = symbolFor(live[i]);
        const liveColour = matched
          ? COLOURS.symbolMatch
          : "rgba(255,152,172,0.8)";

        sliceGroup.appendChild(svgText(liveSym, {
          x: sliceX + sliceW - 7,
          y: sliceY + SLICE_H / 2 + 4,
          fill: liveColour,
          "font-size": "9",
          "font-family": "ui-monospace, 'Cascadia Code', 'Fira Mono', monospace",
          "font-weight": "700",
          "text-anchor": "end",
          opacity: "0.85",
        }));
      }

      svg.appendChild(sliceGroup);
    }

    /* ── column labels below battery ── */
    const labelsY = svgH - 2;
    svg.appendChild(svgText("row   desired   live", {
      x: svgW / 2,
      y: labelsY,
      fill: COLOURS.dimLabel,
      "font-size": "7.5",
      "font-family": "ui-monospace, 'Cascadia Code', 'Fira Mono', monospace",
      "text-anchor": "middle",
    }));

    wrap.appendChild(svg);
  }

  /* ── live match counter ──────────────────────────────────── */
  function renderMatchCount(desired, live) {
    const wrap = ensureContainer();
    if (!wrap) return;

    const prev = wrap.querySelector(".bw-count");
    if (prev) prev.remove();

    if (!live) return;

    const matched = desired.filter(function (d, i) {
      return live[i] === d;
    }).length;

    const pill = document.createElement("div");
    pill.className = "bw-count";
    pill.style.cssText = [
      "font-size:0.78rem",
      "font-weight:700",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:" + (matched === desired.length ? "#d6ffe3" : "rgba(179,191,211,0.8)"),
      "background:" + (matched === desired.length
        ? "rgba(132,232,162,0.14)"
        : "rgba(255,255,255,0.05)"),
      "border:1px solid " + (matched === desired.length
        ? "rgba(132,232,162,0.35)"
        : "rgba(255,255,255,0.08)"),
      "border-radius:999px",
      "padding:4px 14px",
    ].join(";");
    pill.textContent = matched + " / " + desired.length + " rows match";

    wrap.appendChild(pill);
  }

  /* ── public update function ──────────────────────────────── */
  function updateBattery() {
    const desired = getDesiredOutputColumn();
    if (!desired || desired.length === 0) {
      /* nothing to show yet */
      const wrap = ensureContainer();
      if (wrap) {
        wrap.innerHTML = "";
        const note = document.createElement("p");
        note.style.cssText = "color:rgba(179,191,211,0.6);font-size:0.88rem;text-align:center;margin:0;";
        note.textContent = "Battery loads once a puzzle is active.";
        wrap.appendChild(note);
      }
      return;
    }

    const live = getLiveOutputColumn();
    renderBattery(desired, live);
    renderMatchCount(desired, live);
  }

  /* ── patch gameui's refreshTruthTableModal ───────────────── */
  /**
   * gameui calls refreshTruthTableModal after every board change.
   * We intercept it to also refresh the battery. The cleanest hook
   * is a MutationObserver on truthPanelBody, since gameui calls
   * replaceChildren() there on every refresh.
   */
  function installObserver() {
    const panel = document.getElementById("truthPanelBody");
    if (!panel) return;

    const observer = new MutationObserver(function () {
      /* Re-run after gameui has written its table sections */
      window.requestAnimationFrame(updateBattery);
    });

    observer.observe(panel, { childList: true, subtree: false });
  }

  /* ── also patch window.randomTruthTable assignment ────────── */
  /**
   * When a new puzzle is generated, random-main.js sets
   * window.randomTruthTable.  We need to clear the old battery.
   */
  function watchTruthTableSwap() {
    let current = window.randomTruthTable;

    Object.defineProperty(window, "randomTruthTable", {
      get: function () { return current; },
      set: function (val) {
        current = val;
        /* clear container so it rebuilds fresh */
        if (container) {
          container.innerHTML = "";
        }
        window.requestAnimationFrame(updateBattery);
      },
      configurable: true,
    });
  }

  /* ── bootstrap ───────────────────────────────────────────── */
  function init() {
    installObserver();
    watchTruthTableSwap();
    updateBattery();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* expose for manual refresh if needed */
  window.batteryWidget = { update: updateBattery };
})();
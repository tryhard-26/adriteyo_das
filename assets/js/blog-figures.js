document.addEventListener("DOMContentLoaded", function () {
  const contentElem = document.getElementById("post-content");
  if (!contentElem) return;

  if (typeof mermaid !== "undefined") {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        darkMode: true,
        background: "#141414",
        primaryColor: "#f4f4f2",
        primaryTextColor: "#f4f4f2",
        primaryBorderColor: "#333333",
        lineColor: "#9a9a96",
        secondaryColor: "#1a1a1a",
        tertiaryColor: "#141414",
      },
    });
  }

  const codeBlocks = contentElem.querySelectorAll("pre code.language-mermaid, pre code.lang-mermaid");
  codeBlocks.forEach((block) => {
    const pre = block.parentElement;
    const div = document.createElement("div");
    div.className = "mermaid";
    div.textContent = block.textContent;
    pre.replaceWith(div);
  });

  if (typeof mermaid !== "undefined" && contentElem.querySelector(".mermaid")) {
    mermaid.run({ querySelector: ".mermaid" });
  }

  initInteractiveFigures();

  if (typeof renderMathInElement === "function") {
    renderMathInElement(contentElem, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  } else if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
    window.MathJax.startup.promise.then(() => {
      if (window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([contentElem]).catch(() => {});
      }
    }).catch(() => {});
  }

  function initInteractiveFigures() {
    initPatchScalingFig();
    initRoPEExplorerFig();
    initDinoExplorerFig();
    initSiglipExplorerFig();
  }

  function initPatchScalingFig() {
    const fig = document.getElementById("fig-patch-scaling");
    if (!fig) return;

    let patchSize = 16;
    let resolution = 224;

    const badge = fig.querySelector("#patch-stats-badge");
    const svg = fig.querySelector("#patch-scaling-svg");
    const patchBtns = fig.querySelectorAll("#patch-btn-group .fig-btn");
    const resBtns = fig.querySelectorAll("#res-btn-group .fig-btn");

    function render() {
      const nSide = Math.floor(resolution / patchSize);
      const N = nSide * nSide;
      const matrixCells = N * N;
      const baselineCells = 196 * 196;
      const mult = (matrixCells / baselineCells).toFixed(1);

      let statusText = `N = ${N.toLocaleString()} tokens · Matrix = `;
      if (matrixCells >= 1000000) {
        statusText += `${(matrixCells / 1000000).toFixed(2)}M cells`;
      } else {
        statusText += `${(matrixCells / 1000).toFixed(1)}k cells`;
      }
      statusText += ` · ${mult}× Baseline FLOPs`;
      if (badge) badge.textContent = statusText;

      const gridDim = Math.min(nSide, 14);
      const cellSize = 130 / gridDim;

      let gridCells = "";
      for (let r = 0; r < gridDim; r++) {
        for (let c = 0; c < gridDim; c++) {
          const isPicked = r === 1 && c === 2;
          const fill = isPicked ? "#d4d4d0" : (r + c) % 2 === 0 ? "#333333" : "#333333";
          const stroke = isPicked ? "#b7b7b3" : "#333333";
          gridCells += `<rect x="${35 + c * cellSize}" y="${45 + r * cellSize}" width="${cellSize - 1}" height="${cellSize - 1}" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="${isPicked ? "1.5" : "0.5"}"/>`;
        }
      }

      let attnRep = "";
      if (nSide <= 14) {
        const attnCell = 130 / gridDim;
        for (let i = 0; i < gridDim; i++) {
          for (let j = 0; j < gridDim; j++) {
            const isDiag = i === j;
            const fill = isDiag ? "#f4f4f2" : (i + j) % 3 === 0 ? "#333333" : "#333333";
            attnRep += `<rect x="${300 + j * attnCell}" y="${45 + i * attnCell}" width="${attnCell - 0.5}" height="${attnCell - 0.5}" fill="${fill}" opacity="${isDiag ? "0.9" : "0.65"}"/>`;
          }
        }
      } else {
        attnRep = `
                    <defs>
                        <radialGradient id="attnGlow" cx="40%" cy="40%" r="60%">
                            <stop offset="0%" stop-color="#d4d4d0" stop-opacity="0.9"/>
                            <stop offset="35%" stop-color="#b7b7b3" stop-opacity="0.8"/>
                            <stop offset="70%" stop-color="#8a8a86" stop-opacity="0.6"/>
                            <stop offset="100%" stop-color="#333333" stop-opacity="0.4"/>
                        </radialGradient>
                    </defs>
                    <rect x="300" y="45" width="130" height="130" rx="4" fill="url(#attnGlow)"/>
                    <line x1="300" y1="45" x2="430" y2="175" stroke="#f4f4f2" stroke-width="2.5" stroke-dasharray="3 3"/>
                `;
      }

      const flopColor = mult > 8 ? "#8a8a86" : mult > 1.5 ? "#9a9a96" : "#f4f4f2";
      const flopBadgeText = mult > 8 ? "QUADRATIC OOM RISK" : mult > 1.5 ? "HIGH COMPUTE LOAD" : "EFFICIENT BASELINE";

      svg.innerHTML = `
                <rect x="20" y="20" width="160" height="210" rx="8" fill="#141414" stroke="#333333" stroke-width="1"/>
                <text x="100" y="38" text-anchor="middle" fill="#9a9a96" font-size="11" font-family="monospace" font-weight="600">INPUT IMAGE ${resolution}×${resolution}</text>
                ${gridCells}
                <text x="100" y="195" text-anchor="middle" fill="#b7b7b3" font-size="11" font-family="monospace">${nSide}×${nSide} = ${N} patches</text>
                <text x="100" y="215" text-anchor="middle" fill="#636360" font-size="10" font-family="monospace">P = ${patchSize}px</text>

                <path d="M 195 110 L 285 110" stroke="#d4d4d0" stroke-width="2"/>
                <polygon points="285,110 277,105 277,115" fill="#d4d4d0"/>
                <text x="240" y="98" text-anchor="middle" fill="#b7b7b3" font-size="10" font-family="monospace">Linear Proj E</text>
                <text x="240" y="128" text-anchor="middle" fill="#636360" font-size="9" font-family="monospace">z = X_p E + E_pos</text>

                <rect x="285" y="20" width="160" height="210" rx="8" fill="#141414" stroke="#333333" stroke-width="1"/>
                <text x="365" y="38" text-anchor="middle" fill="#9a9a96" font-size="11" font-family="monospace" font-weight="600">ATTENTION MATRIX A</text>
                ${attnRep}
                <text x="365" y="195" text-anchor="middle" fill="#f4f4f2" font-size="11" font-family="monospace">N × N = ${matrixCells >= 1e6 ? (matrixCells / 1e6).toFixed(1) + "M" : (matrixCells / 1e3).toFixed(1) + "k"} cells</text>
                <text x="365" y="215" text-anchor="middle" fill="#636360" font-size="10" font-family="monospace">Softmax(QK^T / √d)</text>

                <rect x="460" y="20" width="200" height="210" rx="8" fill="#141414" stroke="#333333" stroke-width="1"/>
                <text x="560" y="38" text-anchor="middle" fill="#c7c7c3" font-size="11" font-family="monospace" font-weight="600">COMPUTE BOTTLENECK</text>

                <rect x="475" y="55" width="170" height="40" rx="5" fill="#141414" stroke="#333333" stroke-width="0.8"/>
                <text x="485" y="70" fill="#9a9a96" font-size="9" font-family="monospace">SEQUENCE LENGTH (N)</text>
                <text x="485" y="88" fill="#f4f4f2" font-size="13" font-family="monospace" font-weight="700">${N.toLocaleString()} tokens</text>

                <rect x="475" y="105" width="170" height="40" rx="5" fill="#141414" stroke="#333333" stroke-width="0.8"/>
                <text x="485" y="120" fill="#9a9a96" font-size="9" font-family="monospace">RELATIVE ATTN FLOPs</text>
                <text x="485" y="138" fill="${flopColor}" font-size="13" font-family="monospace" font-weight="700">${mult}× Baseline</text>

                <text x="475" y="165" fill="#9a9a96" font-size="9" font-family="monospace">PAIRWISE ACTIVATION</text>
                <rect x="475" y="172" width="170" height="12" rx="3" fill="#333333"/>
                <rect x="475" y="172" width="${Math.min(170, Math.max(8, (matrixCells / baselineCells) * 10))}" height="12" rx="3" fill="${flopColor}"/>

                <rect x="475" y="195" width="170" height="22" rx="4" fill="${flopColor}22" stroke="${flopColor}66" stroke-width="0.8"/>
                <text x="560" y="210" text-anchor="middle" fill="${flopColor}" font-size="9" font-family="monospace" font-weight="700">${flopBadgeText}</text>
            `;
    }

    patchBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        patchBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        patchSize = parseInt(btn.dataset.patch);
        render();
      });
    });

    resBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        resBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        resolution = parseInt(btn.dataset.res);
        render();
      });
    });

    render();
  }

  function initRoPEExplorerFig() {
    const fig = document.getElementById("fig-rope-explorer");
    if (!fig) return;

    let shift = 0;
    let dx = 2;

    const badge = fig.querySelector("#rope-stats-badge");
    const svg = fig.querySelector("#rope-svg");
    const shiftBtns = fig.querySelectorAll("#rope-shift-group .fig-btn");
    const dxSlider = fig.querySelector("#rope-dx-slider");

    function render() {
      const theta = 0.4;
      const m = shift;
      const n = m + dx;
      const angleQ = m * theta;
      const angleK = n * theta;
      const deltaAngle = (n - m) * theta;
      const score = Math.cos(deltaAngle);

      const deltaDeg = ((deltaAngle * 180) / Math.PI).toFixed(1);
      const qDeg = (((angleQ * 180) / Math.PI) % 360).toFixed(0);
      const kDeg = (((angleK * 180) / Math.PI) % 360).toFixed(0);

      if (badge) {
        badge.textContent = `Shift = +${shift} · Δx = ${dx} · Score = ${score.toFixed(4)} (Invariant)`;
      }

      const cx = 130,
        cy = 115,
        r = 70;
      const qx = cx + r * Math.cos(angleQ);
      const qy = cy - r * Math.sin(angleQ);
      const kx = cx + r * Math.cos(angleK);
      const ky = cy - r * Math.sin(angleK);

      const startA = Math.min(angleQ, angleK);
      const endA = Math.max(angleQ, angleK);
      const arcR = 38;
      const arcX1 = cx + arcR * Math.cos(startA);
      const arcY1 = cy - arcR * Math.sin(startA);
      const arcX2 = cx + arcR * Math.cos(endA);
      const arcY2 = cy - arcR * Math.sin(endA);
      const largeArc = endA - startA > Math.PI ? 1 : 0;
      const arcPath = `M ${arcX1} ${arcY1} A ${arcR} ${arcR} 0 ${largeArc} 0 ${arcX2} ${arcY2}`;

      svg.innerHTML = `
                <rect x="15" y="15" width="230" height="200" rx="8" fill="#141414" stroke="#333333" stroke-width="1"/>
                <text x="130" y="32" text-anchor="middle" fill="#9a9a96" font-size="10" font-family="monospace" font-weight="600">COMPLEX UNIT CIRCLE (SO(2))</text>

                <line x1="${cx - r - 10}" y1="${cy}" x2="${cx + r + 10}" y2="${cy}" stroke="#333333" stroke-width="1"/>
                <line x1="${cx}" y1="${cy - r - 10}" x2="${cx}" y2="${cy + r + 10}" stroke="#333333" stroke-width="1"/>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#333333" stroke-width="1.2" stroke-dasharray="3 3"/>

                <path d="${arcPath}" fill="none" stroke="#b7b7b3" stroke-width="2.5"/>
                <text x="${cx + 10}" y="${cy - 12}" fill="#b7b7b3" font-size="10" font-family="monospace" font-weight="700">Δθ = ${deltaDeg}°</text>

                <line x1="${cx}" y1="${cy}" x2="${qx}" y2="${qy}" stroke="#f4f4f2" stroke-width="2.5"/>
                <circle cx="${qx}" cy="${qy}" r="4" fill="#f4f4f2"/>
                <text x="${qx + (qx > cx ? 6 : -28)}" y="${qy + (qy > cy ? 12 : -6)}" fill="#f4f4f2" font-size="11" font-family="monospace" font-weight="700">q(m)</text>

                <line x1="${cx}" y1="${cy}" x2="${kx}" y2="${ky}" stroke="#b7b7b3" stroke-width="2.5"/>
                <circle cx="${kx}" cy="${ky}" r="4" fill="#b7b7b3"/>
                <text x="${kx + (kx > cx ? 6 : -28)}" y="${ky + (ky > cy ? 12 : -6)}" fill="#b7b7b3" font-size="11" font-family="monospace" font-weight="700">k(n)</text>

                <rect x="260" y="15" width="405" height="200" rx="8" fill="#141414" stroke="#333333" stroke-width="1"/>
                <text x="462" y="32" text-anchor="middle" fill="#c7c7c3" font-size="11" font-family="monospace" font-weight="600">ROTATIONAL PHASE CANCELLATION</text>

                <rect x="275" y="45" width="115" height="42" rx="4" fill="#1a1a1a" stroke="#333333" stroke-width="0.8"/>
                <text x="285" y="60" fill="#f4f4f2" font-size="9" font-family="monospace">QUERY PHASE θ_m</text>
                <text x="285" y="77" fill="#f4f4f2" font-size="12" font-family="monospace" font-weight="700">${qDeg}°</text>

                <rect x="405" y="45" width="115" height="42" rx="4" fill="#1a1a1a" stroke="#333333" stroke-width="0.8"/>
                <text x="415" y="60" fill="#b7b7b3" font-size="9" font-family="monospace">KEY PHASE θ_n</text>
                <text x="415" y="77" fill="#f4f4f2" font-size="12" font-family="monospace" font-weight="700">${kDeg}°</text>

                <rect x="535" y="45" width="115" height="42" rx="4" fill="#1a1a1a" stroke="#f4f4f2" stroke-width="1"/>
                <text x="545" y="60" fill="#f4f4f2" font-size="9" font-family="monospace">DIFFERENCE Δθ</text>
                <text x="545" y="77" fill="#f4f4f2" font-size="12" font-family="monospace" font-weight="700">${deltaDeg}°</text>

                <rect x="275" y="98" width="375" height="52" rx="5" fill="#141414" stroke="#333333" stroke-width="0.8"/>
                <text x="287" y="116" fill="#b7b7b3" font-size="10" font-family="monospace">Attention Logit: ⟨R_m q, R_n k⟩ = q^T R_(n-m) k</text>
                <text x="287" y="138" fill="#e8e8e5" font-size="11" font-family="monospace" font-weight="700">= cos((n - m) θ) = cos(${dx} · θ) = <tspan fill="#f4f4f2">${score.toFixed(4)}</tspan></text>

                <rect x="275" y="160" width="375" height="42" rx="5" fill="#1a1a1a" stroke="#f4f4f266" stroke-width="0.8"/>
                <text x="462" y="177" text-anchor="middle" fill="#f4f4f2" font-size="10" font-family="monospace" font-weight="700">TRANSLATION INVARIANCE CONFIRMED</text>
                <text x="462" y="193" text-anchor="middle" fill="#9a9a96" font-size="9" font-family="monospace">Shift ${shift > 0 ? "+" + shift : "0"} rotated both vectors, but relative angle Δθ &amp; inner product stayed identical.</text>
            `;
    }

    shiftBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        shiftBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        shift = parseInt(btn.dataset.shift);
        render();
      });
    });

    if (dxSlider) {
      dxSlider.addEventListener("input", () => {
        dx = parseInt(dxSlider.value);
        render();
      });
    }

    render();
  }

  function initDinoExplorerFig() {
    const fig = document.getElementById("fig-dino-explorer");
    if (!fig) return;

    let isCenteringOn = true;
    let tau = 0.04;

    const badge = fig.querySelector("#dino-stats-badge");
    const svg = fig.querySelector("#dino-svg");
    const btnOn = fig.querySelector("#dino-btn-on");
    const btnOff = fig.querySelector("#dino-btn-off");
    const tempSlider = fig.querySelector("#dino-temp-slider");

    function render() {
      const protoLabels = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      let logits = [];

      if (isCenteringOn) {
        logits = [1.2, 0.8, 3.4, 0.5, 2.1, 1.1, 1.7, 0.9];
        if (badge) badge.textContent = `Centering: ON · τ_t = ${tau} (Target Sharpened, Stable)`;
      } else {
        logits = [0.2, 0.1, 15.0, 0.1, 0.3, 0.2, 0.1, 0.1];
        if (badge) badge.textContent = `Centering: OFF · τ_t = ${tau} (MODE COLLAPSE: P3 Dominates)`;
      }

      const maxL = Math.max(...logits);
      const expVals = logits.map((l) => Math.exp((l - maxL) / tau));
      const sumExp = expVals.reduce((a, b) => a + b, 0);
      const probs = expVals.map((e) => e / sumExp);

      const barW = 24;
      const gap = 14;
      const startX = 40;
      let barsSvg = "";

      for (let i = 0; i < 8; i++) {
        const p = probs[i];
        const barH = Math.max(3, p * 110);
        const bx = startX + i * (barW + gap);
        const by = 160 - barH;
        const pctStr = (p * 100).toFixed(p > 0.95 ? 1 : 0);
        const isDominant = p > 0.4;
        const fill = isCenteringOn ? (isDominant ? "#d4d4d0" : "#8a8a86") : isDominant ? "#8a8a86" : "#4a4a47";

        barsSvg += `
                    <rect x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="3" fill="${fill}"/>
                    <text x="${bx + barW / 2}" y="${by - 5}" text-anchor="middle" fill="${isDominant ? (isCenteringOn ? "#b7b7b3" : "#9a9a96") : "#636360"}" font-size="9" font-family="monospace">${pctStr}%</text>
                    <text x="${bx + barW / 2}" y="175" text-anchor="middle" fill="#9a9a96" font-size="10" font-family="monospace">${protoLabels[i]}</text>
                `;
      }

      const bannerFill = isCenteringOn ? "#1a1a1a" : "#1a1a1a";
      const bannerBorder = isCenteringOn ? "#f4f4f266" : "#8a8a8666";
      const bannerTitle = isCenteringOn ? "PRE-TRAINING STABLE: NO COLLAPSE" : "CRITICAL WARNING: MODE COLLAPSE DETECTED";
      const bannerColor = isCenteringOn ? "#f4f4f2" : "#9a9a96";

      svg.innerHTML = `
                <rect x="15" y="15" width="340" height="200" rx="8" fill="#141414" stroke="#333333" stroke-width="1"/>
                <text x="185" y="32" text-anchor="middle" fill="#c7c7c3" font-size="11" font-family="monospace" font-weight="600">TEACHER PROBABILITY DISTRIBUTION P_t(x)</text>
                ${barsSvg}
                <line x1="30" y1="160" x2="335" y2="160" stroke="#333333" stroke-width="1"/>

                <rect x="370" y="15" width="295" height="200" rx="8" fill="#141414" stroke="#333333" stroke-width="1"/>
                <text x="517" y="32" text-anchor="middle" fill="#c7c7c3" font-size="11" font-family="monospace" font-weight="600">DISTILLATION EQUATION</text>

                <rect x="385" y="45" width="265" height="42" rx="4" fill="#141414" stroke="#333333" stroke-width="0.8"/>
                <text x="395" y="60" fill="#b7b7b3" font-size="10" font-family="monospace">P_t(x) = Softmax((g_t(x) - c) / τ_t)</text>
                <text x="395" y="76" fill="#636360" font-size="9" font-family="monospace">c ← m · c + (1 - m) · (1/B) Σ g_t(x)</text>

                <rect x="385" y="98" width="125" height="40" rx="4" fill="#1a1a1a" stroke="#333333" stroke-width="0.8"/>
                <text x="395" y="112" fill="#9a9a96" font-size="9" font-family="monospace">CENTERING BIAS</text>
                <text x="395" y="130" fill="${isCenteringOn ? "#f4f4f2" : "#9a9a96"}" font-size="11" font-family="monospace" font-weight="700">${isCenteringOn ? "c Active (-μ)" : "c = 0 (Unbounded)"}</text>

                <rect x="525" y="98" width="125" height="40" rx="4" fill="#1a1a1a" stroke="#333333" stroke-width="0.8"/>
                <text x="535" y="112" fill="#9a9a96" font-size="9" font-family="monospace">TEMPERATURE</text>
                <text x="535" y="130" fill="#b7b7b3" font-size="11" font-family="monospace" font-weight="700">τ_t = ${tau}</text>

                <rect x="385" y="148" width="265" height="54" rx="5" fill="${bannerFill}" stroke="${bannerBorder}" stroke-width="0.8"/>
                <text x="517" y="165" text-anchor="middle" fill="${bannerColor}" font-size="9" font-family="monospace" font-weight="700">${bannerTitle}</text>
                <text x="517" y="180" text-anchor="middle" fill="#9a9a96" font-size="8.5" font-family="monospace">${isCenteringOn ? "Stable representation learning" : "All representations collapsed"}</text>
                <text x="517" y="193" text-anchor="middle" fill="#636360" font-size="8" font-family="monospace">${isCenteringOn ? "KoLeo regularizer prevents clustering" : "Dirac delta on dimension P3"}</text>
            `;
    }

    if (btnOn) {
      btnOn.addEventListener("click", () => {
        btnOn.classList.add("active");
        if (btnOff) btnOff.classList.remove("active");
        isCenteringOn = true;
        render();
      });
    }

    if (btnOff) {
      btnOff.addEventListener("click", () => {
        btnOff.classList.add("active");
        if (btnOn) btnOn.classList.remove("active");
        isCenteringOn = false;
        render();
      });
    }

    if (tempSlider) {
      tempSlider.addEventListener("input", () => {
        tau = parseFloat(tempSlider.value);
        render();
      });
    }

    render();
  }

  function initSiglipExplorerFig() {
    const fig = document.getElementById("fig-siglip-explorer");
    if (!fig) return;

    let batch = 32768;

    const badge = fig.querySelector("#siglip-stats-badge");
    const svg = fig.querySelector("#siglip-svg");
    const batchBtns = fig.querySelectorAll("#siglip-batch-group .fig-btn");
    const batchSlider = fig.querySelector("#siglip-batch-slider");

    const batchPresets = [8192, 16384, 32768, 65536, 131072, 524288];

    function render() {
      const B = batch;
      const clipBytes = 2 * B * B;
      const clipMB = clipBytes / (1024 * 1024);
      const clipGB = clipMB / 1024;

      let clipMemStr = "";
      if (clipGB >= 1) {
        clipMemStr = `${clipGB.toFixed(1)} GB`;
      } else {
        clipMemStr = `${clipMB.toFixed(0)} MB`;
      }

      if (badge) {
        badge.textContent = `Batch = ${B.toLocaleString()} · CLIP = ${clipMemStr} · SigLIP = 0.5 MB`;
      }

      const isOOM = clipGB >= 32;
      const clipColor = isOOM ? "#8a8a86" : clipGB >= 2 ? "#9a9a96" : "#d4d4d0";
      const clipBarWidth = Math.min(380, Math.max(15, (Math.log10(clipMB) / Math.log10(600000)) * 380));

      svg.innerHTML = `
                <rect x="15" y="15" width="650" height="92" rx="8" fill="#141414" stroke="#333333" stroke-width="1"/>
                <text x="30" y="34" fill="#8a8a86" font-size="11" font-family="monospace" font-weight="700">CLASSIC CLIP (InfoNCE Softmax with Global AllGather)</text>
                <text x="30" y="52" fill="#9a9a96" font-size="9" font-family="monospace">Distributed sync: ALL GPUs must exchange embeddings synchronously before computing loss</text>
                <text x="30" y="75" fill="#c7c7c3" font-size="10" font-family="monospace">Memory: 2 · B² = <tspan fill="${clipColor}" font-weight="700">${clipMemStr}</tspan></text>
                <rect x="230" y="63" width="415" height="16" rx="4" fill="#333333"/>
                <rect x="230" y="63" width="${clipBarWidth}" height="16" rx="4" fill="${clipColor}"/>
                <text x="${240 + clipBarWidth}" y="75" fill="${clipColor}" font-size="9" font-family="monospace" font-weight="700"> ${isOOM ? "OOM / HARDWARE COLLAPSE" : clipGB >= 2 ? "NETWORK SATURATION" : "SYNC BARRIER"}</text>
                <text x="30" y="94" fill="#636360" font-size="9" font-family="monospace">Loss denominator: Σ_j exp(t · x_i^T y_j) couples all B samples across all workers</text>

                <rect x="15" y="118" width="650" height="95" rx="8" fill="#1a1a1a" stroke="#f4f4f244" stroke-width="1"/>
                <text x="30" y="138" fill="#f4f4f2" font-size="11" font-family="monospace" font-weight="700">GOOGLE SigLIP (Streamed Pairwise Sigmoid)</text>
                <text x="30" y="156" fill="#9a9a96" font-size="9" font-family="monospace">Distributed sync: ZERO global AllGather collective! Ring-pass tiles stream asynchronously</text>
                <text x="30" y="179" fill="#c7c7c3" font-size="10" font-family="monospace">Memory: 2 · b² = <tspan fill="#f4f4f2" font-weight="700">0.5 MB</tspan> (Constant)</text>
                <rect x="230" y="167" width="415" height="16" rx="4" fill="#1a1a1a"/>
                <rect x="230" y="167" width="25" height="16" rx="4" fill="#f4f4f2"/>
                <text x="265" y="179" fill="#f4f4f2" font-size="9" font-family="monospace" font-weight="700">CONSTANT TILE BUFFER (Scales to 1M+ pairs)</text>
                <text x="30" y="198" fill="#f4f4f2aa" font-size="9" font-family="monospace">Loss: -log σ(z_ii) - Σ_j log σ(-z_ij) decouples every pair into independent binary decisions</text>
            `;
    }

    batchBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        batchBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        batch = parseInt(btn.dataset.batch);
        render();
      });
    });

    if (batchSlider) {
      batchSlider.addEventListener("input", () => {
        const idx = parseInt(batchSlider.value) - 1;
        batch = batchPresets[idx] || 32768;
        batchBtns.forEach((b) => {
          if (parseInt(b.dataset.batch) === batch) {
            b.classList.add("active");
          } else {
            b.classList.remove("active");
          }
        });
        render();
      });
    }

    render();
  }
});

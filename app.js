(function() {
  'use strict';

  // Colorblind-safe palette based on Okabe-Ito (2008).
  // The critical pair — prey (bluish green) vs pred (vermillion) — is
  // distinguishable for all major forms of color vision deficiency.
  const C = {
    prey:     '#2E8B57',  // bluish green — Okabe-Ito-inspired
    pred:     '#D55E00',  // vermillion — Okabe-Ito
    K:        '#8B7355',  // taupe (dashed line)
    tick:     '#E69F00',  // amber/orange — Okabe-Ito
    tickFill: 'rgba(230, 159, 0, 0.18)',
    suffer:   '#6A4C93',  // muted purple, darkened for paper bg
    starv:    '#B07A28',  // warm gold
    disease:  '#0072B2',  // blue — Okabe-Ito
    stress:   '#6B5F55',  // warm gray
    hunt:     '#56B4E9',  // sky blue — Okabe-Ito
    ink:      '#2a2520',
    inkSoft:  '#6b5f55',
    rule:     '#d8cdba',
    ruleSoft: '#ece2d0',
    bgPaper:  '#fefcf6'
  };

  // ========== Numerical simulation ==========
  // Populations are in actual animal counts:
  //   x = deer (typical range 0–3000)
  //   y = predators (coyotes/bobcats/fishers, typical range 0–500)
  // Parameters retuned accordingly.
  function simulate(p) {
    const alpha    = p.alpha    != null ? p.alpha    : 1.0;
    const beta     = p.beta     != null ? p.beta     : 0.005;
    const delta    = p.delta    != null ? p.delta    : 0.0025;
    const gamma    = p.gamma    != null ? p.gamma    : 0.7;
    const K        = p.K        != null ? p.K        : 1500;
    const Ksafe    = p.Ksafe    != null ? p.Ksafe    : 600;
    const dStarv   = p.dStarv   != null ? p.dStarv   : 0.5;
    const dDisease = p.dDisease != null ? p.dDisease : 0.08;
    const nDisease = p.nDisease != null ? p.nDisease : 4;
    const x0       = p.x0       != null ? p.x0       : 400;
    const y0       = p.y0       != null ? p.y0       : 100;
    const T        = p.T        != null ? p.T        : Infinity;
    const tMax     = p.tMax     != null ? p.tMax     : 50;
    const dt       = p.dt       != null ? p.dt       : 0.05;
    const useLogistic = p.useLogistic !== false;
    const tickPeak  = p.tickPeak  != null ? p.tickPeak  : 1.0;
    const tickWidth = p.tickWidth != null ? p.tickWidth : 2.0;
    // Bloom-driven mechanisms: predator alpha-gal severity, deer direct toll
    const muMax    = p.muMax    != null ? p.muMax    : 2.0;
    const tauMax   = p.tauMax   != null ? p.tauMax   : 0.8;
    // logisticMode: 'always' — ceiling applies at all times (§III, no predators)
    //               'gated'  — ceiling fades in as predators lose effectiveness
    //                          (§V–VIII: pre-bloom, predation bounds prey instead)
    const logisticMode = p.logisticMode || 'always';
    // Hunting
    const huntRate     = p.huntRate     != null ? p.huntRate     : 0;
    const huntPreT     = p.huntPreT !== false;
    const huntPostT    = p.huntPostT !== false;

    const result = {
      t: [], x: [], y: [], z: [], E: [],
      pred: [], starv: [], disease: [], stress: [], hunt: []
    };

    function huntActive(t) {
      if (t < T && !huntPreT) return false;
      if (t >= T && !huntPostT) return false;
      return huntRate > 0;
    }

    function tickZ(t) {
      if (!isFinite(T)) return 0;
      const u = (t - T) / tickWidth;
      return tickPeak * Math.exp(-u * u);
    }

    // Unified derivs. Predator effectiveness E decays during the bloom and
    // never recovers (alpha-gal sensitization is permanent). The logistic
    // ceiling is either always on (§III) or fades in as predators lose
    // effectiveness (§V–VIII). Density-dependent disease/starvation always
    // ramp in with the phase gate.
    function derivs(t, xv, yv, ev) {
      const z = tickZ(t);
      const phase = 1 - ev;  // 0 pre-bloom (E≈1), 1 post-bloom (E≈0)
      let preyLogistic = 1;
      if (useLogistic) {
        const gate = (logisticMode === 'gated') ? phase : 1;
        preyLogistic = 1 - gate * xv / K;
      }
      const overK = Math.max(0, xv / Ksafe - 1);
      const sTerm = dStarv * overK * overK * phase;
      const dTerm = dDisease * Math.pow(xv / Ksafe, nDisease) * phase;
      const huntTerm = huntActive(t) ? huntRate * xv : 0;
      return {
        dx: alpha * xv * preyLogistic
            - beta * ev * xv * yv          // effective predation, fades as E→0
            - tauMax * z * xv              // deer bloom toll (anemia/infection)
            - (sTerm + dTerm) * xv         // density-dependent disease/starv
            - huntTerm,
        dy: delta * ev * xv * yv - gamma * yv,
        de: -muMax * z * ev                // E decays during bloom, can't recover
      };
    }

    let x = x0, y = y0, E = 1.0;
    let prevX = x;
    const nSteps = Math.floor(tMax / dt) + 1;

    for (let i = 0; i < nSteps; i++) {
      const t = i * dt;
      const z = tickZ(t);
      const phase = 1 - E;

      result.t.push(t);
      result.x.push(x);
      result.y.push(y);
      result.z.push(z);
      result.E.push(E);

      // Rates tracked for suffering accounting. Note pred uses EFFECTIVE β·E.
      const overK = Math.max(0, x / Ksafe - 1);
      result.pred.push(beta * E * x * y);
      result.starv.push(dStarv * overK * overK * x * phase);
      result.disease.push(dDisease * Math.pow(x / Ksafe, nDisease) * x * phase);
      result.stress.push((x > 0.5 && i > 0) ? Math.abs(x - prevX) / dt : 0);
      result.hunt.push(huntActive(t) ? huntRate * x : 0);
      prevX = x;

      // RK4 with three state variables
      const k1 = derivs(t,        x,                  y,                  E);
      const k2 = derivs(t + dt/2, x + dt/2 * k1.dx,   y + dt/2 * k1.dy,   E + dt/2 * k1.de);
      const k3 = derivs(t + dt/2, x + dt/2 * k2.dx,   y + dt/2 * k2.dy,   E + dt/2 * k2.de);
      const k4 = derivs(t + dt,   x + dt   * k3.dx,   y + dt   * k3.dy,   E + dt   * k3.de);
      x = x + dt/6 * (k1.dx + 2*k2.dx + 2*k3.dx + k4.dx);
      y = y + dt/6 * (k1.dy + 2*k2.dy + 2*k3.dy + k4.dy);
      E = E + dt/6 * (k1.de + 2*k2.de + 2*k3.de + k4.de);

      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (E < 0) E = 0;
      if (E > 1) E = 1;
    }

    return result;
  }

  function suffering(sim, weights) {
    const w1 = weights.w1 != null ? weights.w1 : 1;
    const w2 = weights.w2 != null ? weights.w2 : 1;
    const w3 = weights.w3 != null ? weights.w3 : 1;
    const w4 = weights.w4 != null ? weights.w4 : 1;
    const w5 = weights.w5 != null ? weights.w5 : 0.2;
    const S = [];
    for (let i = 0; i < sim.t.length; i++) {
      const huntTerm = (sim.hunt && sim.hunt[i] != null) ? sim.hunt[i] : 0;
      S.push(w1*sim.pred[i] + w2*sim.starv[i] + w3*sim.disease[i] + w4*sim.stress[i] + w5*huntTerm);
    }
    return S;
  }

  function meanBetween(values, tArr, t0, t1) {
    let sum = 0, count = 0;
    for (let i = 0; i < values.length; i++) {
      if (tArr[i] >= t0 && tArr[i] <= t1) { sum += values[i]; count++; }
    }
    return count > 0 ? sum / count : 0;
  }

  function sumBetween(values, tArr, t0, t1, dt) {
    let total = 0;
    for (let i = 0; i < values.length; i++) {
      if (tArr[i] >= t0 && tArr[i] <= t1) total += values[i] * dt;
    }
    return total;
  }

  // ========== Chart class ==========
  class Chart {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      opts = opts || {};
      this.opts = {
        xRange: opts.xRange || [0, 50],
        yRange: opts.yRange || [0, 12],
        xLabel: opts.xLabel || 'time',
        yLabel: opts.yLabel || 'value',
        padding: opts.padding || { top: 30, right: 18, bottom: 32, left: 50 },
        xTicks: opts.xTicks || 6,
        yTicks: opts.yTicks || 5
      };
      this.series = [];
      this.markers = [];
      this.dragging = null;
      this.onMarkerMove = null;
      this._setupCanvas();
      this._attachEvents();
      const self = this;
      window.addEventListener('resize', function() { self._setupCanvas(); });
    }

    _setupCanvas() {
      const dpi = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      this.canvas.width = Math.floor(rect.width * dpi);
      this.canvas.height = Math.floor(rect.height * dpi);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpi, dpi);
      this.w = rect.width;
      this.h = rect.height;
      this.render();
    }

    _attachEvents() {
      const c = this.canvas;
      const self = this;

      function getPos(ev) {
        const r = c.getBoundingClientRect();
        const t = ev.touches ? ev.touches[0] : ev;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      }

      function hitTest(px, py) {
        for (let i = 0; i < self.markers.length; i++) {
          const m = self.markers[i];
          if (!m.draggable) continue;
          const mx = self.xToPx(m.x);
          const my = self.opts.padding.top - 14;
          const dx = px - mx, dy = py - my;
          if (dx*dx + dy*dy < 280) return m;
        }
        return null;
      }

      function onDown(ev) {
        const p = getPos(ev);
        const m = hitTest(p.x, p.y);
        if (m) {
          self.dragging = m;
          c.style.cursor = 'grabbing';
          ev.preventDefault();
        }
      }
      function onMove(ev) {
        const p = getPos(ev);
        if (self.dragging) {
          const newX = self.pxToX(p.x);
          self.dragging.x = Math.max(self.opts.xRange[0] + 0.5,
                            Math.min(self.opts.xRange[1] - 0.5, newX));
          self.render();
          if (self.onMarkerMove) self.onMarkerMove(self.dragging);
          ev.preventDefault();
        } else {
          c.style.cursor = hitTest(p.x, p.y) ? 'grab' : 'default';
        }
      }
      function onUp() {
        if (self.dragging) {
          self.dragging = null;
          c.style.cursor = 'default';
        }
      }

      c.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      c.addEventListener('touchstart', onDown, { passive: false });
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    }

    xToPx(x) {
      const xr = this.opts.xRange, pad = this.opts.padding;
      return pad.left + ((x - xr[0]) / (xr[1] - xr[0])) * (this.w - pad.left - pad.right);
    }
    yToPx(y) {
      const yr = this.opts.yRange, pad = this.opts.padding;
      return this.h - pad.bottom - ((y - yr[0]) / (yr[1] - yr[0])) * (this.h - pad.top - pad.bottom);
    }
    pxToX(px) {
      const xr = this.opts.xRange, pad = this.opts.padding;
      const frac = (px - pad.left) / (this.w - pad.left - pad.right);
      return xr[0] + frac * (xr[1] - xr[0]);
    }

    setSeries(series) { this.series = series; this.render(); }
    setMarkers(markers) { this.markers = markers; this.render(); }

    render() {
      const ctx = this.ctx, w = this.w, h = this.h, opts = this.opts;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      const pa = {
        x: opts.padding.left, y: opts.padding.top,
        w: w - opts.padding.left - opts.padding.right,
        h: h - opts.padding.top - opts.padding.bottom
      };

      ctx.fillStyle = C.bgPaper;
      ctx.fillRect(pa.x, pa.y, pa.w, pa.h);

      // Filled-area series first (drawn under everything else)
      for (const s of this.series) {
        if (!s.visible || !s.filled) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(pa.x, pa.y, pa.w, pa.h);
        ctx.clip();
        ctx.fillStyle = s.fillColor || s.color;
        ctx.beginPath();
        const baseY = this.yToPx(opts.yRange[0]);
        if (s.data.length > 0) {
          ctx.moveTo(this.xToPx(s.data[0].x), baseY);
          for (let i = 0; i < s.data.length; i++) {
            ctx.lineTo(this.xToPx(s.data[i].x), this.yToPx(s.data[i].y));
          }
          ctx.lineTo(this.xToPx(s.data[s.data.length-1].x), baseY);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Gridlines
      ctx.strokeStyle = C.ruleSoft;
      ctx.lineWidth = 1;
      ctx.fillStyle = C.inkSoft;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= opts.yTicks; i++) {
        const yv = opts.yRange[0] + (opts.yRange[1] - opts.yRange[0]) * i / opts.yTicks;
        const py = this.yToPx(yv);
        ctx.beginPath();
        ctx.moveTo(pa.x, py);
        ctx.lineTo(pa.x + pa.w, py);
        ctx.stroke();
        let labelVal;
        if (yv >= 1000) labelVal = (yv / 1000).toFixed(yv >= 10000 ? 0 : 1) + 'k';
        else if (yv >= 10) labelVal = yv.toFixed(0);
        else labelVal = yv.toFixed(1);
        ctx.fillText(labelVal, pa.x - 6, py);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i <= opts.xTicks; i++) {
        const xv = opts.xRange[0] + (opts.xRange[1] - opts.xRange[0]) * i / opts.xTicks;
        const px = this.xToPx(xv);
        ctx.beginPath();
        ctx.moveTo(px, pa.y);
        ctx.lineTo(px, pa.y + pa.h);
        ctx.stroke();
        ctx.fillText(xv.toFixed(0), px, pa.y + pa.h + 5);
      }

      // Axes
      ctx.strokeStyle = C.rule;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pa.x, pa.y + pa.h);
      ctx.lineTo(pa.x + pa.w, pa.y + pa.h);
      ctx.stroke();

      // Marker vertical lines
      for (const m of this.markers) {
        const px = this.xToPx(m.x);
        if (px < pa.x - 1 || px > pa.x + pa.w + 1) continue;
        ctx.strokeStyle = m.color || C.tick;
        ctx.lineWidth = 2;
        if (m.dashed) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, pa.y);
        ctx.lineTo(px, pa.y + pa.h);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Line series (clipped to plot area)
      for (const s of this.series) {
        if (!s.visible || s.filled) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(pa.x, pa.y, pa.w, pa.h);
        ctx.clip();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.lineWidth || 2.2;
        if (s.dashed) ctx.setLineDash([6, 5]);
        ctx.beginPath();
        for (let i = 0; i < s.data.length; i++) {
          const px = this.xToPx(s.data[i].x);
          const py = this.yToPx(s.data[i].y);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Marker handles (drawn last)
      for (const m of this.markers) {
        const px = this.xToPx(m.x);
        if (m.draggable) {
          ctx.fillStyle = m.color || C.tick;
          ctx.beginPath();
          ctx.arc(px, pa.y - 14, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '15px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(m.emoji || '●', px, pa.y - 14);
        }
        if (m.label) {
          ctx.fillStyle = m.color || C.tick;
          ctx.font = 'italic 11px serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(m.label, px + 5, pa.y + 3);
        }
      }

      // Axis labels
      ctx.fillStyle = C.inkSoft;
      ctx.font = 'italic 11px serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(opts.xLabel, pa.x + pa.w, pa.y + pa.h + 16);
      ctx.save();
      ctx.translate(12, pa.y + pa.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.yLabel, 0, 0);
      ctx.restore();
    }
  }

  // ========== UI helpers ==========
  function makeSlider(container, opts) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    const lbl = document.createElement('div');
    lbl.className = 'ctrl-label';
    lbl.innerHTML = opts.label;
    if (opts.accent) lbl.style.color = opts.accent;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = opts.min;
    input.max = opts.max;
    input.step = opts.step;
    input.value = opts.value;
    if (opts.accent) input.style.accentColor = opts.accent;
    const val = document.createElement('div');
    val.className = 'ctrl-value';
    const fmt = opts.format || function(v) { return Number(v).toFixed(2); };
    val.textContent = fmt(opts.value);
    input.addEventListener('input', function() {
      val.textContent = fmt(input.value);
      opts.onChange(parseFloat(input.value));
    });
    row.appendChild(lbl);
    row.appendChild(input);
    row.appendChild(val);
    container.appendChild(row);
    return {
      input: input,
      setValue: function(v) { input.value = v; val.textContent = fmt(v); }
    };
  }

  function makeToggle(container, opts) {
    const lbl = document.createElement('label');
    lbl.className = 'toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = opts.checked !== false;
    cb.addEventListener('change', function() { opts.onChange(cb.checked); });
    const sw = document.createElement('span');
    sw.className = 'swatch' + (opts.dashed ? ' dashed' : '');
    if (!opts.dashed) sw.style.background = opts.color;
    else sw.style.borderColor = opts.color;
    const text = document.createElement('span');
    text.innerHTML = opts.label;
    lbl.appendChild(cb);
    lbl.appendChild(sw);
    lbl.appendChild(text);
    container.appendChild(lbl);
    return cb;
  }

  // Common formatters
  const fmtInt  = function(v) { return Number(v).toFixed(0); };
  const fmtTime = function(v) { return Number(v).toFixed(1); };
  const fmt2    = function(v) { return Number(v).toFixed(2); };
  const fmt3    = function(v) { return Number(v).toFixed(3); };
  const fmt4    = function(v) { return Number(v).toFixed(4); };

  // ========== Ethical presets ==========
  // Weights: [predation, starvation, disease, stress, hunting]
  // w5 (hunting) defaults low: a clean rifle shot is rarely worse than a coyote chase.
  const PRESETS = {
    utilitarian:  { name: 'Utilitarian (all equal)',           w: [1, 1, 1, 1, 1] },
    ecological:   { name: 'Ecological (predation is natural)', w: [0.3, 1.5, 1.2, 0.5, 0.2] },
    welfare:      { name: 'Animal Welfare (slow > fast)',      w: [0.8, 1.5, 1.5, 1.2, 0.2] },
    antihunting:  { name: 'Anti-Hunting (any kill is worst)',  w: [2.5, 0.5, 0.5, 0.3, 2.5] },
    huntercomp:   { name: 'Hunter Compensation (clean shots)', w: [1.2, 1.5, 1.5, 1.0, 0.15] },
    custom:       { name: 'Custom (use sliders below)',        w: [1, 1, 1, 1, 0.2] }
  };

  // ========== §II Exponential ==========
  function initExp() {
    const canvas = document.querySelector('[data-chart="exp"]');
    const controls = document.querySelector('[data-controls="exp"]');
    const chart = new Chart(canvas, {
      xRange: [0, 10], yRange: [0, 8000],
      xLabel: 'time (years)', yLabel: '🦌 deer'
    });
    let alpha = 0.2;
    function update() {
      const data = [];
      for (let t = 0; t <= 10; t += 0.05) {
        data.push({ x: t, y: 400 * Math.exp(alpha * t) });
      }
      chart.setSeries([{ data: data, color: C.prey, visible: true }]);
    }
    makeSlider(controls, {
      label: '🦌🍃 α<br>growth', accent: C.prey, min: 0, max: 0.4, step: 0.01, value: alpha,
      format: fmt2,
      onChange: function(v) { alpha = v; update(); }
    });
    update();
  }

  // ========== §III Logistic ==========
  function initLog() {
    const canvas = document.querySelector('[data-chart="log"]');
    const controls = document.querySelector('[data-controls="log"]');
    const chart = new Chart(canvas, {
      xRange: [0, 20], yRange: [0, 3500],
      xLabel: 'time (years)', yLabel: '🦌 deer'
    });
    let alpha = 0.6, K = 1500;
    function update() {
      const sim = simulate({
        alpha: alpha, beta: 0, delta: 0, gamma: 0, K: K,
        x0: 50, y0: 0, T: Infinity, tMax: 20, dt: 0.05,
        useLogistic: true
      });
      const data = sim.t.map(function(t, i) { return { x: t, y: sim.x[i] }; });
      const kline = [{ x: 0, y: K }, { x: 20, y: K }];
      chart.setSeries([
        { data: kline, color: C.K, visible: true, dashed: true, lineWidth: 1.8 },
        { data: data, color: C.prey, visible: true }
      ]);
    }
    makeSlider(controls, {
      label: '🦌🍃 α<br>growth', accent: C.prey, min: 0, max: 1.5, step: 0.05, value: alpha,
      format: fmt2,
      onChange: function(v) { alpha = v; update(); }
    });
    makeSlider(controls, {
      label: '🌿 K<br>capacity', accent: C.K, min: 100, max: 3000, step: 50, value: K,
      format: fmtInt,
      onChange: function(v) { K = v; update(); }
    });
    update();
  }

  // ========== §IV Lotka-Volterra (pure — no logistic, stable cycles) ==========
  function initLV() {
    const canvas = document.querySelector('[data-chart="lv"]');
    const controls = document.querySelector('[data-controls="lv"]');
    const toggles = document.querySelector('[data-toggles="lv"]');
    const chart = new Chart(canvas, {
      xRange: [0, 40], yRange: [0, 1200],
      xLabel: 'time (years)', yLabel: 'population'
    });
    let alpha = 1.0, beta = 0.005, delta = 0.0025, gamma = 0.7;
    const vis = { prey: true, pred: true };

    function update() {
      const sim = simulate({
        alpha: alpha, beta: beta, delta: delta, gamma: gamma,
        K: 1e9, // effectively no logistic ceiling
        x0: 400, y0: 100,
        T: Infinity, tMax: 40, dt: 0.05,
        useLogistic: false
      });
      const preyData = sim.t.map(function(t, i) { return { x: t, y: sim.x[i] }; });
      const predData = sim.t.map(function(t, i) { return { x: t, y: sim.y[i] }; });
      chart.setSeries([
        { data: preyData, color: C.prey, visible: vis.prey },
        { data: predData, color: C.pred, visible: vis.pred }
      ]);
    }

    makeSlider(controls, { label: '🦌🍃 α<br>prey', accent: C.prey, min: 0, max: 2, step: 0.05, value: alpha,
      format: fmt2,
      onChange: function(v) { alpha = v; update(); } });
    makeSlider(controls, { label: '🐺🦌 β<br>predation', accent: C.pred, min: 0, max: 0.015, step: 0.0005, value: beta,
      format: fmt4,
      onChange: function(v) { beta = v; update(); } });
    makeSlider(controls, { label: '🐺🍖 δ<br>efficiency', accent: C.pred, min: 0, max: 0.006, step: 0.0001, value: delta,
      format: fmt4,
      onChange: function(v) { delta = v; update(); } });
    makeSlider(controls, { label: '🐺💀 γ<br>death', accent: C.pred, min: 0, max: 2, step: 0.05, value: gamma,
      format: fmt2,
      onChange: function(v) { gamma = v; update(); } });

    makeToggle(toggles, { label: '🦌 deer', color: C.prey,
      onChange: function(v) { vis.prey = v; update(); } });
    makeToggle(toggles, { label: '🐺 predators', color: C.pred,
      onChange: function(v) { vis.pred = v; update(); } });

    update();
  }

  // ========== §V Tick event (logistic prey + tick bloom curve) ==========
  function initTick() {
    const canvas = document.querySelector('[data-chart="tick"]');
    const controls = document.querySelector('[data-controls="tick"]');
    const toggles = document.querySelector('[data-toggles="tick"]');
    const chart = new Chart(canvas, {
      xRange: [0, 70], yRange: [0, 2500], xTicks: 7,
      xLabel: 'time (years)', yLabel: 'population'
    });
    let T = 20, tickWidth = 2.0;
    const vis = { prey: true, pred: true, K: true, tick: true };

    function update() {
      const sim = simulate({
        alpha: 1.0, beta: 0.005, delta: 0.0025, gamma: 0.7,
        K: 1500, Ksafe: 1500,
        dStarv: 0, dDisease: 0, nDisease: 4,
        x0: 400, y0: 100,
        T: T, tickPeak: 1, tickWidth: tickWidth,
        tMax: 70, dt: 0.05,
        useLogistic: true, logisticMode: 'gated'
      });
      const tickScale = chart.opts.yRange[1] * 0.25;
      const preyData = sim.t.map(function(t, i) { return { x: t, y: sim.x[i] }; });
      const predData = sim.t.map(function(t, i) { return { x: t, y: sim.y[i] }; });
      const tickData = sim.t.map(function(t, i) { return { x: t, y: sim.z[i] * tickScale }; });
      const kline = [{ x: 0, y: 1500 }, { x: 70, y: 1500 }];
      chart.setSeries([
        { data: tickData, color: C.tick, fillColor: C.tickFill, visible: vis.tick, filled: true },
        { data: kline, color: C.K, visible: vis.K, dashed: true, lineWidth: 1.8 },
        { data: preyData, color: C.prey, visible: vis.prey },
        { data: predData, color: C.pred, visible: vis.pred }
      ]);
      chart.setMarkers([
        { x: T, color: C.tick, emoji: '🦠', draggable: true, label: 'tick bloom (T)' }
      ]);
    }

    chart.onMarkerMove = function(m) { T = m.x; tickSlider.setValue(T); update(); };

    const tickSlider = makeSlider(controls, {
      label: '🦠 T<br>tick bloom', accent: C.tick, min: 1, max: 65, step: 0.5, value: T,
      format: fmtTime,
      onChange: function(v) { T = v; update(); }
    });
    makeSlider(controls, {
      label: '🦠<br>bloom width', accent: C.tick, min: 0.5, max: 6, step: 0.1, value: tickWidth,
      format: fmtTime,
      onChange: function(v) { tickWidth = v; update(); }
    });

    makeToggle(toggles, { label: '🦌 deer', color: C.prey,
      onChange: function(v) { vis.prey = v; update(); } });
    makeToggle(toggles, { label: '🐺 predators', color: C.pred,
      onChange: function(v) { vis.pred = v; update(); } });
    makeToggle(toggles, { label: '🌿 K', color: C.K, dashed: true,
      onChange: function(v) { vis.K = v; update(); } });
    makeToggle(toggles, { label: '🦠 tick bloom (stylized)', color: C.tick,
      onChange: function(v) { vis.tick = v; update(); } });

    update();
  }

  // ========== §VI Crash (chronic post-T pressure) ==========
  function initCrash() {
    const canvas = document.querySelector('[data-chart="crash"]');
    const controls = document.querySelector('[data-controls="crash"]');
    const toggles = document.querySelector('[data-toggles="crash"]');
    const chart = new Chart(canvas, {
      xRange: [0, 70], yRange: [0, 2500], xTicks: 7,
      xLabel: 'time (years)', yLabel: 'population / pressure rate'
    });
    let T = 18, dStarv = 0.5, dDisease = 0.08, Ksafe = 600, tickWidth = 2.0;
    const vis = { prey: true, pred: true, K: true, Ksafe: true, starv: false, disease: false, tick: true };

    function update() {
      const sim = simulate({
        alpha: 1.0, beta: 0.005, delta: 0.0025, gamma: 0.7,
        K: 1800, Ksafe: Ksafe,
        dStarv: dStarv, dDisease: dDisease, nDisease: 4,
        x0: 400, y0: 100,
        T: T, tickWidth: tickWidth,
        tMax: 70, dt: 0.05,
        useLogistic: true, logisticMode: 'gated'
      });
      const tickScale = chart.opts.yRange[1] * 0.2;
      const preyData = sim.t.map(function(t, i) { return { x: t, y: sim.x[i] }; });
      const predData = sim.t.map(function(t, i) { return { x: t, y: sim.y[i] }; });
      const starvData = sim.t.map(function(t, i) { return { x: t, y: sim.starv[i] }; });
      const diseaseData = sim.t.map(function(t, i) { return { x: t, y: sim.disease[i] }; });
      const tickData = sim.t.map(function(t, i) { return { x: t, y: sim.z[i] * tickScale }; });
      const kline = [{ x: 0, y: 1800 }, { x: 70, y: 1800 }];
      const ksafeline = [{ x: 0, y: Ksafe }, { x: 70, y: Ksafe }];
      chart.setSeries([
        { data: tickData, color: C.tick, fillColor: C.tickFill, visible: vis.tick, filled: true },
        { data: kline, color: C.K, visible: vis.K, dashed: true, lineWidth: 1.5 },
        { data: ksafeline, color: C.K, visible: vis.Ksafe, dashed: true, lineWidth: 1.2 },
        { data: starvData, color: C.starv, visible: vis.starv, lineWidth: 1.5 },
        { data: diseaseData, color: C.disease, visible: vis.disease, lineWidth: 1.5 },
        { data: preyData, color: C.prey, visible: vis.prey },
        { data: predData, color: C.pred, visible: vis.pred }
      ]);
      chart.setMarkers([
        { x: T, color: C.tick, emoji: '🦠', draggable: true, label: 'tick (T)' }
      ]);
    }

    chart.onMarkerMove = function(m) { T = m.x; tickS.setValue(T); update(); };

    const tickS = makeSlider(controls, { label: '🦠 T<br>tick bloom', accent: C.tick, min: 1, max: 65, step: 0.5, value: T,
      format: fmtTime,
      onChange: function(v) { T = v; update(); } });
    makeSlider(controls, { label: '🦠<br>bloom width', accent: C.tick, min: 0.5, max: 6, step: 0.1, value: tickWidth,
      format: fmtTime,
      onChange: function(v) { tickWidth = v; update(); } });
    makeSlider(controls, { label: '🌿💚 K<sub>safe</sub><br>safe density', accent: C.K, min: 100, max: 1500, step: 50, value: Ksafe,
      format: fmtInt,
      onChange: function(v) { Ksafe = v; update(); } });
    makeSlider(controls, { label: '🦌🥀 s<br>starvation', accent: C.starv, min: 0, max: 1.5, step: 0.05, value: dStarv,
      format: fmt2,
      onChange: function(v) { dStarv = v; update(); } });
    makeSlider(controls, { label: '🦌🤒 d<br>disease', accent: C.disease, min: 0, max: 0.3, step: 0.005, value: dDisease,
      format: fmt3,
      onChange: function(v) { dDisease = v; update(); } });

    makeToggle(toggles, { label: '🦌 deer', color: C.prey, onChange: function(v) { vis.prey = v; update(); } });
    makeToggle(toggles, { label: '🐺 predators', color: C.pred, onChange: function(v) { vis.pred = v; update(); } });
    makeToggle(toggles, { label: '🌿 K', color: C.K, dashed: true, onChange: function(v) { vis.K = v; update(); } });
    makeToggle(toggles, { label: '🌿💚 K<sub>safe</sub>', color: C.K, dashed: true, onChange: function(v) { vis.Ksafe = v; update(); } });
    makeToggle(toggles, { label: '🦠 tick bloom', color: C.tick, onChange: function(v) { vis.tick = v; update(); } });
    makeToggle(toggles, { label: '🦌🥀 starvation', color: C.starv, checked: false, onChange: function(v) { vis.starv = v; update(); } });
    makeToggle(toggles, { label: '🦌🤒 disease', color: C.disease, checked: false, onChange: function(v) { vis.disease = v; update(); } });

    update();
  }

  // ========== §VII Suffering ==========
  function initSuffer() {
    const canvas = document.querySelector('[data-chart="suffer"]');
    const controls = document.querySelector('[data-controls="suffer"]');
    const toggles = document.querySelector('[data-toggles="suffer"]');
    const readout = document.querySelector('[data-readout="suffer"]');
    const chart = new Chart(canvas, {
      xRange: [0, 70], yRange: [0, 6000], xTicks: 7,
      xLabel: 'time (years)', yLabel: '💀 suffering rate'
    });
    let T = 18;
    let preset = 'utilitarian';
    let w = PRESETS.utilitarian.w.slice();
    const vis = { S: true, pred: true, starv: true, disease: true, stress: false };

    const presetRow = document.createElement('div');
    presetRow.className = 'preset-row';
    const lblPre = document.createElement('span');
    lblPre.textContent = 'Ethical weighting:';
    const sel = document.createElement('select');
    Object.keys(PRESETS).forEach(function(k) {
      const o = document.createElement('option');
      o.value = k; o.textContent = PRESETS[k].name;
      sel.appendChild(o);
    });
    sel.value = preset;
    presetRow.appendChild(lblPre);
    presetRow.appendChild(sel);
    controls.appendChild(presetRow);

    const wSliders = [];
    ['🐺💀 w₁<br>predation', '🦌🥀 w₂<br>starvation', '🦌🤒 w₃<br>disease', '🦌😰 w₄<br>stress', '🏹🦌 w₅<br>hunting'].forEach(function(lbl, i) {
      const s = makeSlider(controls, {
        label: lbl, min: 0, max: 3, step: 0.05, value: w[i],
        format: fmt2,
        onChange: function(v) { w[i] = v; preset = 'custom'; sel.value = 'custom'; update(); }
      });
      wSliders.push(s);
    });

    sel.addEventListener('change', function() {
      preset = sel.value;
      w = PRESETS[preset].w.slice();
      wSliders.forEach(function(s, i) { s.setValue(w[i]); });
      update();
    });

    function update() {
      const sim = simulate({
        alpha: 1.0, beta: 0.005, delta: 0.0025, gamma: 0.7,
        K: 1800, Ksafe: 600,
        dStarv: 0.5, dDisease: 0.08, nDisease: 4,
        x0: 400, y0: 100,
        T: T, tMax: 70, dt: 0.05,
        useLogistic: true, logisticMode: 'gated'
      });
      const S = suffering(sim, { w1: w[0], w2: w[1], w3: w[2], w4: w[3], w5: w[4] });
      const SData = sim.t.map(function(t, i) { return { x: t, y: S[i] }; });
      const predData = sim.t.map(function(t, i) { return { x: t, y: w[0] * sim.pred[i] }; });
      const starvData = sim.t.map(function(t, i) { return { x: t, y: w[1] * sim.starv[i] }; });
      const diseaseData = sim.t.map(function(t, i) { return { x: t, y: w[2] * sim.disease[i] }; });
      const stressData = sim.t.map(function(t, i) { return { x: t, y: w[3] * sim.stress[i] }; });

      chart.setSeries([
        { data: predData, color: C.pred, visible: vis.pred, lineWidth: 1.3, dashed: true },
        { data: starvData, color: C.starv, visible: vis.starv, lineWidth: 1.3, dashed: true },
        { data: diseaseData, color: C.disease, visible: vis.disease, lineWidth: 1.3, dashed: true },
        { data: stressData, color: C.stress, visible: vis.stress, lineWidth: 1.3, dashed: true },
        { data: SData, color: C.suffer, visible: vis.S, lineWidth: 2.8 }
      ]);
      chart.setMarkers([
        { x: T, color: C.tick, emoji: '🦠', draggable: true, label: 'tick (T)' }
      ]);

      // Mean suffering rate: per-year average over each era. Independent of simulation length.
      // For after-T we skip the first 3 years (initial transient) when there's room to do so.
      const tEndPostTransient = Math.min(70, T + 3);
      const meanBefore = meanBetween(S, sim.t, 0, T);
      const meanAfter = meanBetween(S, sim.t, T, 70);
      const meanAfterEq = (70 - tEndPostTransient > 3) ? meanBetween(S, sim.t, tEndPostTransient, 70) : meanAfter;
      const ratio = meanAfter / Math.max(0.01, meanBefore);
      readout.innerHTML =
        '<div class="ro-label">Mean S(t) before tick</div>' +
        '<div class="ro-val">' + meanBefore.toFixed(0) + ' /yr</div>' +
        '<div class="ro-label">Mean S(t) after tick</div>' +
        '<div class="ro-val">' + meanAfter.toFixed(0) + ' /yr</div>' +
        '<div class="ro-label">Long-run (post-transient)</div>' +
        '<div class="ro-val">' + meanAfterEq.toFixed(0) + ' /yr</div>' +
        '<div class="ro-label">Change (after / before)</div>' +
        '<div class="ro-val">' + ratio.toFixed(2) + '×</div>';
    }

    chart.onMarkerMove = function(m) { T = m.x; tickS.setValue(T); update(); };

    const tickS = makeSlider(controls, { label: '🦠 T<br>tick bloom', accent: C.tick, min: 1, max: 65, step: 0.5, value: T,
      format: fmtTime,
      onChange: function(v) { T = v; update(); } });

    makeToggle(toggles, { label: '💀 total S(t)', color: C.suffer, onChange: function(v) { vis.S = v; update(); } });
    makeToggle(toggles, { label: '🐺💀 predation', color: C.pred, onChange: function(v) { vis.pred = v; update(); } });
    makeToggle(toggles, { label: '🦌🥀 starvation', color: C.starv, onChange: function(v) { vis.starv = v; update(); } });
    makeToggle(toggles, { label: '🦌🤒 disease', color: C.disease, onChange: function(v) { vis.disease = v; update(); } });
    makeToggle(toggles, { label: '🦌😰 stress', color: C.stress, checked: false, onChange: function(v) { vis.stress = v; update(); } });

    update();
  }

  // ========== §VIII Master playground ==========
  function initMaster() {
    const canvas = document.querySelector('[data-chart="master"]');
    const controls = document.querySelector('[data-controls="master"]');
    const adv = document.querySelector('[data-controls="master-adv"]');
    const toggles = document.querySelector('[data-toggles="master"]');
    const presetRow = document.querySelector('[data-preset="master"]');
    const readout = document.querySelector('[data-readout="master"]');

    const chart = new Chart(canvas, {
      xRange: [0, 100], yRange: [0, 3000], xTicks: 10,
      xLabel: 'time (years)', yLabel: 'population / pressure rate',
      padding: { top: 36, right: 18, bottom: 36, left: 52 }
    });

    const p = {
      alpha: 1.0, beta: 0.005, delta: 0.0025, gamma: 0.7,
      K: 1800, Ksafe: 600,
      dStarv: 0.5, dDisease: 0.08, nDisease: 4,
      T: 22, tickWidth: 2.0,
      muMax: 2.0, tauMax: 0.8,
      huntRate: 0, huntPreT: false, huntPostT: true
    };
    let w = PRESETS.utilitarian.w.slice();
    let preset = 'utilitarian';

    const vis = {
      prey: true, pred: true, K: true, Ksafe: true, tick: true,
      S: true, starv: false, disease: false, predRate: false, stress: false, hunt: false
    };

    const lblPre = document.createElement('span');
    lblPre.textContent = 'Ethical preset:';
    const sel = document.createElement('select');
    Object.keys(PRESETS).forEach(function(k) {
      const o = document.createElement('option');
      o.value = k; o.textContent = PRESETS[k].name;
      sel.appendChild(o);
    });
    sel.value = preset;
    presetRow.appendChild(lblPre);
    presetRow.appendChild(sel);

    const wSliders = [];
    ['🐺💀 w₁<br>predation', '🦌🥀 w₂<br>starvation', '🦌🤒 w₃<br>disease', '🦌😰 w₄<br>stress', '🏹🦌 w₅<br>hunting'].forEach(function(lbl, i) {
      const s = makeSlider(controls, {
        label: lbl, min: 0, max: 3, step: 0.05, value: w[i],
        format: fmt2,
        onChange: function(v) { w[i] = v; preset = 'custom'; sel.value = 'custom'; update(); }
      });
      wSliders.push(s);
    });

    sel.addEventListener('change', function() {
      preset = sel.value;
      w = PRESETS[preset].w.slice();
      wSliders.forEach(function(s, i) { s.setValue(w[i]); });
      update();
    });

    const tickS = makeSlider(controls, { label: '🦠 T<br>tick bloom', accent: C.tick, min: 1, max: 95, step: 0.5, value: p.T,
      format: fmtTime,
      onChange: function(v) { p.T = v; update(); } });
    makeSlider(controls, { label: '🦠<br>bloom width', accent: C.tick, min: 0.5, max: 6, step: 0.1, value: p.tickWidth,
      format: fmtTime,
      onChange: function(v) { p.tickWidth = v; update(); } });
    makeSlider(controls, { label: '🦠🐺 μ<br>alpha-gal', accent: C.pred, min: 0, max: 5, step: 0.1, value: p.muMax,
      format: fmt2,
      onChange: function(v) { p.muMax = v; update(); } });
    makeSlider(controls, { label: '🦠🦌 τ<br>deer toll', accent: C.prey, min: 0, max: 2, step: 0.05, value: p.tauMax,
      format: fmt2,
      onChange: function(v) { p.tauMax = v; update(); } });
    makeSlider(controls, { label: '🏹 h<br>hunting rate', accent: C.hunt, min: 0, max: 0.6, step: 0.01, value: p.huntRate,
      format: fmt2,
      onChange: function(v) { p.huntRate = v; update(); } });

    makeSlider(adv, { label: '🦌🍃 α<br>prey', accent: C.prey, min: 0, max: 2, step: 0.05, value: p.alpha,
      format: fmt2,
      onChange: function(v) { p.alpha = v; update(); } });
    makeSlider(adv, { label: '🐺🦌 β<br>predation', accent: C.pred, min: 0, max: 0.015, step: 0.0005, value: p.beta,
      format: fmt4,
      onChange: function(v) { p.beta = v; update(); } });
    makeSlider(adv, { label: '🐺🍖 δ<br>efficiency', accent: C.pred, min: 0, max: 0.006, step: 0.0001, value: p.delta,
      format: fmt4,
      onChange: function(v) { p.delta = v; update(); } });
    makeSlider(adv, { label: '🐺💀 γ<br>death', accent: C.pred, min: 0, max: 2, step: 0.05, value: p.gamma,
      format: fmt2,
      onChange: function(v) { p.gamma = v; update(); } });
    makeSlider(adv, { label: '🌿 K<br>capacity', accent: C.K, min: 200, max: 3000, step: 50, value: p.K,
      format: fmtInt,
      onChange: function(v) { p.K = v; update(); } });
    makeSlider(adv, { label: '🌿💚 K<sub>safe</sub><br>safe density', accent: C.K, min: 100, max: 1500, step: 50, value: p.Ksafe,
      format: fmtInt,
      onChange: function(v) { p.Ksafe = v; update(); } });
    makeSlider(adv, { label: '🦌🥀 s<br>starvation', accent: C.starv, min: 0, max: 1.5, step: 0.05, value: p.dStarv,
      format: fmt2,
      onChange: function(v) { p.dStarv = v; update(); } });
    makeSlider(adv, { label: '🦌🤒 d<br>disease', accent: C.disease, min: 0, max: 0.3, step: 0.005, value: p.dDisease,
      format: fmt3,
      onChange: function(v) { p.dDisease = v; update(); } });

    makeToggle(toggles, { label: '🦌 deer', color: C.prey, onChange: function(v) { vis.prey = v; update(); } });
    makeToggle(toggles, { label: '🐺 predators', color: C.pred, onChange: function(v) { vis.pred = v; update(); } });
    makeToggle(toggles, { label: '🌿 K', color: C.K, dashed: true, onChange: function(v) { vis.K = v; update(); } });
    makeToggle(toggles, { label: '🌿💚 K<sub>safe</sub>', color: C.K, dashed: true, onChange: function(v) { vis.Ksafe = v; update(); } });
    makeToggle(toggles, { label: '🦠 tick bloom', color: C.tick, onChange: function(v) { vis.tick = v; update(); } });
    makeToggle(toggles, { label: '💀 S(t) total', color: C.suffer, onChange: function(v) { vis.S = v; update(); } });
    makeToggle(toggles, { label: '🐺💀 predation rate', color: C.pred, dashed: true, checked: false, onChange: function(v) { vis.predRate = v; update(); } });
    makeToggle(toggles, { label: '🏹 hunting rate', color: '#56B4E9', checked: false, onChange: function(v) { vis.hunt = v; update(); } });
    makeToggle(toggles, { label: '🦌🥀 starvation', color: C.starv, checked: false, onChange: function(v) { vis.starv = v; update(); } });
    makeToggle(toggles, { label: '🦌🤒 disease', color: C.disease, checked: false, onChange: function(v) { vis.disease = v; update(); } });
    makeToggle(toggles, { label: '🦌😰 stress', color: C.stress, checked: false, onChange: function(v) { vis.stress = v; update(); } });

    function update() {
      const sim = simulate({
        alpha: p.alpha, beta: p.beta, delta: p.delta, gamma: p.gamma,
        K: p.K, Ksafe: p.Ksafe,
        dStarv: p.dStarv, dDisease: p.dDisease, nDisease: p.nDisease,
        x0: 400, y0: 100,
        T: p.T, tickWidth: p.tickWidth,
        muMax: p.muMax, tauMax: p.tauMax,
        huntRate: p.huntRate, huntPreT: p.huntPreT, huntPostT: p.huntPostT,
        tMax: 100, dt: 0.05,
        useLogistic: true, logisticMode: 'gated'
      });
      const S = suffering(sim, { w1: w[0], w2: w[1], w3: w[2], w4: w[3], w5: w[4] });
      const tickScale = chart.opts.yRange[1] * 0.2;

      const preyData = sim.t.map(function(t, i) { return { x: t, y: sim.x[i] }; });
      const predData = sim.t.map(function(t, i) { return { x: t, y: sim.y[i] }; });
      const SData = sim.t.map(function(t, i) { return { x: t, y: S[i] }; });
      const predRateData = sim.t.map(function(t, i) { return { x: t, y: w[0] * sim.pred[i] }; });
      const starvData = sim.t.map(function(t, i) { return { x: t, y: w[1] * sim.starv[i] }; });
      const diseaseData = sim.t.map(function(t, i) { return { x: t, y: w[2] * sim.disease[i] }; });
      const stressData = sim.t.map(function(t, i) { return { x: t, y: w[3] * sim.stress[i] }; });
      const huntData = sim.t.map(function(t, i) { return { x: t, y: w[4] * (sim.hunt[i] || 0) }; });
      const tickData = sim.t.map(function(t, i) { return { x: t, y: sim.z[i] * tickScale }; });
      const kline = [{ x: 0, y: p.K }, { x: 100, y: p.K }];
      const ksafeline = [{ x: 0, y: p.Ksafe }, { x: 100, y: p.Ksafe }];

      chart.setSeries([
        { data: tickData, color: C.tick, fillColor: C.tickFill, visible: vis.tick, filled: true },
        { data: kline, color: C.K, visible: vis.K, dashed: true, lineWidth: 1.5 },
        { data: ksafeline, color: C.K, visible: vis.Ksafe, dashed: true, lineWidth: 1.2 },
        { data: predRateData, color: C.pred, visible: vis.predRate, lineWidth: 1.2, dashed: true },
        { data: huntData, color: '#56B4E9', visible: vis.hunt, lineWidth: 1.3 },
        { data: starvData, color: C.starv, visible: vis.starv, lineWidth: 1.3 },
        { data: diseaseData, color: C.disease, visible: vis.disease, lineWidth: 1.3 },
        { data: stressData, color: C.stress, visible: vis.stress, lineWidth: 1.3 },
        { data: preyData, color: C.prey, visible: vis.prey, lineWidth: 2.2 },
        { data: predData, color: C.pred, visible: vis.pred, lineWidth: 2.2 },
        { data: SData, color: C.suffer, visible: vis.S, lineWidth: 2.6 }
      ]);
      chart.setMarkers([
        { x: p.T, color: C.tick, emoji: '🦠', draggable: true, label: 'tick T' }
      ]);

      // Mean suffering rates — independent of simulation horizon
      const tEndPostTransient = Math.min(100, p.T + 5);
      const meanBefore = meanBetween(S, sim.t, 0, p.T);
      const meanAfter = meanBetween(S, sim.t, p.T, 100);
      const meanAfterEq = (100 - tEndPostTransient > 5) ? meanBetween(S, sim.t, tEndPostTransient, 100) : meanAfter;
      const ratio = meanAfter / Math.max(0.01, meanBefore);
      readout.innerHTML =
        '<div class="ro-label">Mean S(t) before tick</div>' +
        '<div class="ro-val">' + meanBefore.toFixed(0) + ' /yr</div>' +
        '<div class="ro-label">Mean S(t) after tick</div>' +
        '<div class="ro-val">' + meanAfter.toFixed(0) + ' /yr</div>' +
        '<div class="ro-label">Long-run (post-transient)</div>' +
        '<div class="ro-val">' + meanAfterEq.toFixed(0) + ' /yr</div>' +
        '<div class="ro-label">Change (after / before)</div>' +
        '<div class="ro-val">' + ratio.toFixed(2) + '×</div>';
    }

    chart.onMarkerMove = function(m) { p.T = m.x; tickS.setValue(p.T); update(); };

    update();
  }

  // ========== Bootstrap ==========
  function init() {
    initExp();
    initLog();
    initLV();
    initTick();
    initCrash();
    initSuffer();
    initMaster();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Charts: hand-drawn SVG line chart (hover + keyboard), sparklines, and the
// data-table fallback. No charting library, so there is nothing to vendor.
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function niceTicks(lo, hi, count) {
    if (lo === hi) { lo -= 1; hi += 1; }
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (span / count) / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var start = Math.floor(lo / step) * step, ticks = [];
    for (var v = start; v <= hi + step * 0.001; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  // Linear estimate for a gap day; null outside the first/last real reading.
  function interp(values, i) {
    if (values[i] !== null) return values[i];
    var a = i - 1, b = i + 1;
    while (a >= 0 && values[a] === null) a--;
    while (b < values.length && values[b] === null) b++;
    if (a < 0 || b >= values.length) return null;
    return values[a] + ((values[b] - values[a]) * (i - a)) / (b - a);
  }

  function dayLabel(day) {
    var p = day.split('-');
    return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }

  // opts: {container, title, days, series:[{key,name,color,dash,values,fmt}],
  //        band:{lo,hi,name,color}|null, yFmt, window:{startIdx,endIdx}|null, yMin, yMax}
  var chartCount = 0;
  function lineChart(opts) {
    var box = opts.container;
    box.innerHTML = '';
    box.classList.add('chart-box');

    var legend = document.createElement('ul');
    legend.className = 'legend';
    opts.series.forEach(function (s) {
      var li = document.createElement('li');
      li.innerHTML = '<svg width="28" height="10" aria-hidden="true"><line x1="0" y1="5" x2="28" y2="5" stroke="' +
        s.color + '" stroke-width="2.5"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/></svg>' + esc(s.name);
      legend.appendChild(li);
    });
    if (opts.band) {
      var bl = document.createElement('li');
      bl.innerHTML = '<svg width="28" height="10" aria-hidden="true"><rect width="28" height="10" fill="' +
        opts.band.color + '" opacity="0.25"/></svg>' + esc(opts.band.name);
      legend.appendChild(bl);
    }
    box.appendChild(legend);

    var W = Math.max(280, box.clientWidth || 600), H = 250;
    var m = { l: 56, r: 14, t: 10, b: 28 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n = opts.days.length;
    // The x axis covers opts.range (indices into days); default is every day.
    var from = opts.range ? Math.max(0, opts.range.from) : 0;
    var to = opts.range ? Math.min(n - 1, opts.range.to) : n - 1;
    var span = to - from;
    var clipId = 'clip-' + (++chartCount);

    // The y scale is fitted to what is inside the range, including the
    // estimated value where a line enters and leaves it.
    var vals = [];
    var inRange = function (arr) {
      for (var i = from; i <= to; i++) if (arr[i] !== null) vals.push(arr[i]);
    };
    opts.series.forEach(function (s) {
      inRange(s.values);
      [from, to].forEach(function (i) { var e = interp(s.values, i); if (e !== null) vals.push(e); });
    });
    if (opts.band) { inRange(opts.band.lo); inRange(opts.band.hi); }
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'chart', tabindex: '0', role: 'group',
      'aria-label': opts.title + ' line chart. Press left and right arrow keys to read values for each day. A table of the data follows.' });
    box.appendChild(svg);
    if (!vals.length) {
      var t = el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'axis-label' });
      t.textContent = 'No data for this selection';
      svg.appendChild(t);
      return { destroy: function () {} };
    }

    var lo = opts.yMin !== undefined ? opts.yMin : Math.min.apply(null, vals);
    var hi = opts.yMax !== undefined ? opts.yMax : Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.06 || 1;
    if (opts.yMin === undefined) lo = opts.zeroBase && lo >= 0 ? 0 : lo - pad;
    if (opts.yMax === undefined) hi += pad;
    var ticks = niceTicks(lo, hi, 5);
    lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    var X = function (i) { return m.l + (span <= 0 ? iw / 2 : ((i - from) / span) * iw); };
    var Y = function (v) { return m.t + ih - ((v - lo) / (hi - lo)) * ih; };

    // Gridlines + y labels
    ticks.forEach(function (tv) {
      svg.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: Y(tv), y2: Y(tv), class: 'grid' }));
      var tx = el('text', { x: m.l - 8, y: Y(tv) + 4, 'text-anchor': 'end', class: 'axis-label' });
      tx.textContent = opts.yFmt ? opts.yFmt(tv) : tv;
      svg.appendChild(tx);
    });

    // Comparison window shading
    if (opts.window) {
      var wx = X(opts.window.startIdx);
      svg.appendChild(el('rect', { x: wx, y: m.t, width: Math.max(2, X(opts.window.endIdx) - wx), height: ih, class: 'win' }));
    }

    // X labels: days for a short range, month starts for a long one
    var ticksX = [], labelFor = function (i) { var p = opts.days[i].split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]); };
    if (span <= 100) {
      var step = Math.max(1, Math.ceil(span / Math.max(1, Math.floor(iw / 72))));
      for (var di = from; di <= to; di += step) ticksX.push(di);
    } else {
      var firstOfMonth = [];
      for (var mi = from; mi <= to; mi++) if (opts.days[mi].slice(8) === '01') firstOfMonth.push(mi);
      var every = Math.max(1, Math.ceil(firstOfMonth.length / Math.max(1, Math.floor(iw / 64))));
      firstOfMonth.forEach(function (i, k) { if (k % every === 0) ticksX.push(i); });
      labelFor = function (i) { var p = opts.days[i].split('-'); return MONTHS[+p[1] - 1] + (p[1] === '01' ? ' ' + p[0] : ''); };
    }
    ticksX.forEach(function (i) {
      var tx = el('text', { x: X(i), y: H - 8, 'text-anchor': i === from && span > 0 ? 'start' : 'middle', class: 'axis-label' });
      tx.textContent = labelFor(i);
      svg.appendChild(tx);
      svg.appendChild(el('line', { x1: X(i), x2: X(i), y1: m.t + ih, y2: m.t + ih + 4, class: 'tick' }));
    });

    // Everything drawn from data is clipped to the plot area so lines that
    // continue outside the range are cut at its edges.
    var defs = el('defs', {});
    var clip = el('clipPath', { id: clipId });
    clip.appendChild(el('rect', { x: m.l, y: m.t - 4, width: iw, height: ih + 8 }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    var plot = el('g', { 'clip-path': 'url(#' + clipId + ')' });
    svg.appendChild(plot);

    // Min-max band, joined across gap days with straight edges
    if (opts.band) {
      var idx = [];
      for (var bi = 0; bi < n; bi++) if (opts.band.hi[bi] !== null) idx.push(bi);
      if (idx.length > 1) {
        var up = idx.map(function (i) { return X(i) + ',' + Y(opts.band.hi[i]); });
        var dn = idx.slice().reverse().map(function (i) { return X(i) + ',' + Y(opts.band.lo[i]); });
        plot.appendChild(el('polygon', { points: up.concat(dn).join(' '), fill: opts.band.color, opacity: '0.22' }));
      }
    }

    // Lines: straight segments across gap days (a linear estimate); a lone
    // reading is drawn as a dot.
    opts.series.forEach(function (s) {
      var d = '', count = 0, lastX, lastY;
      for (var i = 0; i < n; i++) {
        var v = s.values[i];
        if (v === null) continue;
        d += (count === 0 ? 'M' : 'L') + X(i).toFixed(1) + ',' + Y(v).toFixed(1);
        count++; lastX = X(i); lastY = Y(v);
      }
      if (count === 1) plot.appendChild(el('circle', { cx: lastX, cy: lastY, r: 3, fill: s.color }));
      var attrs = { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' };
      if (s.dash) attrs['stroke-dasharray'] = s.dash;
      plot.appendChild(el('path', attrs));
    });

    // Cursor
    var cursor = el('g', { class: 'cursor', visibility: 'hidden' });
    var cline = el('line', { y1: m.t, y2: m.t + ih, class: 'cursor-line' });
    cursor.appendChild(cline);
    var dots = opts.series.map(function (s) {
      var c = el('circle', { r: 4, fill: s.color, stroke: 'var(--bg)', 'stroke-width': 1.5 });
      cursor.appendChild(c); return c;
    });
    svg.appendChild(cursor);

    var tip = document.createElement('div');
    tip.className = 'tooltip'; tip.hidden = true;
    box.appendChild(tip);
    var live = document.createElement('div');
    live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');
    box.appendChild(live);

    var cur = -1;
    function show(i, announce) {
      cur = Math.max(from, Math.min(to, i));
      var x = X(cur);
      cline.setAttribute('x1', x); cline.setAttribute('x2', x);
      var lines = [], any = false, est = false;
      opts.series.forEach(function (s, k) {
        var raw = s.values[cur], v = interp(s.values, cur);
        if (v === null) { dots[k].setAttribute('visibility', 'hidden'); return; }
        any = true;
        if (raw === null) est = true;
        dots[k].setAttribute('visibility', 'visible');
        dots[k].setAttribute('cx', x); dots[k].setAttribute('cy', Y(v));
        lines.push(s.name + ': ' + (raw === null ? '~' : '') + (s.fmt ? s.fmt(v) : v));
      });
      cursor.setAttribute('visibility', 'visible');
      var head = dayLabel(opts.days[cur]);
      var body = any ? lines : ['No readings this day'];
      if (est) body.push('No reading this day; estimated between neighbouring readings');
      if (opts.note) { var nt = opts.note(cur); if (nt) body.push(nt); }
      tip.innerHTML = '<strong>' + esc(head) + '</strong>' + body.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('');
      tip.hidden = false;
      var tw = tip.offsetWidth, left = x + 12;
      if (left + tw > W) left = x - tw - 12;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = (legend.offsetHeight + 8) + 'px';
      if (announce) live.textContent = head + '. ' + body.join('. ');
    }
    function hide() { cursor.setAttribute('visibility', 'hidden'); tip.hidden = true; }

    var overlay = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' });
    svg.appendChild(overlay);
    overlay.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
      show(span <= 0 ? from : Math.round(from + ((px - m.l) / iw) * span), false);
    });
    overlay.addEventListener('pointerleave', hide);
    svg.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 7 : 1;
      if (e.key === 'ArrowLeft') { show((cur < 0 ? to : cur) - step, true); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { show((cur < 0 ? to : cur) + step, true); e.preventDefault(); }
      else if (e.key === 'Home') { show(from, true); e.preventDefault(); }
      else if (e.key === 'End') { show(to, true); e.preventDefault(); }
      else if (e.key === 'Escape') { hide(); }
    });
    svg.addEventListener('blur', hide);

    return { destroy: function () {} };
  }

  // Inline sparkline; values may contain nulls. Decorative (data is in the table cells).
  function sparkline(values, color) {
    var w = 90, h = 24, pts = values.filter(function (v) { return v !== null; });
    if (pts.length < 2) return '<span class="muted">–</span>';
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts);
    if (lo === hi) { lo -= 1; hi += 1; }
    var n = values.length, d = '', run = 0;
    values.forEach(function (v, i) {
      if (v === null) { run = 0; return; }
      var x = (i / (n - 1)) * (w - 4) + 2, y = h - 3 - ((v - lo) / (hi - lo)) * (h - 6);
      d += (run++ === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
      '" aria-hidden="true" focusable="false"><path d="' + d + '" fill="none" stroke="' + (color || 'currentColor') +
      '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }

  // Data-table fallback inside <details>; built when first opened.
  // columns: [{label, values[], fmt}]
  function dataTable(container, title, days, columns) {
    container.innerHTML = '';
    var det = document.createElement('details');
    det.className = 'data-table';
    var sum = document.createElement('summary');
    sum.textContent = 'View ' + title.toLowerCase() + ' as a table';
    det.appendChild(sum);
    var built = false;
    det.addEventListener('toggle', function () {
      if (!det.open || built) return;
      built = true;
      var wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      var html = '<table><caption class="sr-only">' + esc(title) + ' by day, newest first</caption><thead><tr><th scope="col">Day</th>' +
        columns.map(function (c) { return '<th scope="col" class="num">' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>';
      for (var i = days.length - 1; i >= 0; i--) {
        var any = columns.some(function (c) { return c.values[i] !== null; });
        if (!any) continue;
        html += '<tr><th scope="row">' + days[i] + '</th>' + columns.map(function (c) {
          var v = c.values[i];
          return '<td class="num">' + (v === null ? '–' : c.fmt(v)) + '</td>';
        }).join('') + '</tr>';
      }
      wrap.innerHTML = html + '</tbody></table>';
      det.appendChild(wrap);
    });
    container.appendChild(det);
  }

  root.esc = esc;
  root.lineChart = lineChart;
  root.sparkline = sparkline;
  root.dataTable = dataTable;
  root.dayLabel = dayLabel;
})(window.DB = window.DB || {});

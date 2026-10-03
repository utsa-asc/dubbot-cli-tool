// UI helpers: formatting, scope resolution, URL-hash state, and HTML renderers.
(function (root) {
  'use strict';
  var esc = root.esc;
  var MINUS = '−';
  // Last line of defence for href values: https only, otherwise a dead link.
  function safeHref(u) { return /^https:\/\//i.test(u) ? u : '#'; }
  var SCOPES = ['all', 'vpaa', 'dls', 'unlisted', 'site', 'custom'];

  function fmtInt(v) { return Math.round(v).toLocaleString('en-US'); }
  function fmtScore(v) { return (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, ''); }
  function sign(v) { return v > 0 ? '+' : v < 0 ? MINUS : ''; }
  function fmtDeltaInt(v) { return sign(v) + fmtInt(Math.abs(v)); }
  function fmtDeltaScore(v) { return sign(v) + (Math.round(Math.abs(v) * 100) / 100).toFixed(2); }

  // better: 'down' (fewer is better) | 'up' | null (neutral). Arrow + sign + word, never colour alone.
  function deltaHtml(v, fmt, better, zero) {
    if (v === null || v === undefined) return '<span class="muted">–</span>';
    var eps = fmt === fmtDeltaScore ? 0.005 : 0.5;
    if (Math.abs(v) < eps) return '<span class="neutral">' + (zero || 'no change') + '</span>';
    var up = v > 0, cls = 'neutral', word = '';
    if (better) {
      var good = (better === 'up') === up;
      cls = good ? 'good' : 'bad'; word = good ? 'improved' : 'worse';
    }
    return '<span class="' + cls + '">' + (up ? '▲' : '▼') + ' ' + fmt(v) +
      (word ? '<span class="sr-only"> (' + word + ')</span>' : '') + '</span>';
  }

  function scoreHtml(v) {
    return fmtScore(v) + (v > 100
      ? ' <span class="flag" title="DubBot reported a score above 100">⚑<span class="sr-only"> score above 100</span></span>' : '');
  }

  // ---- scope ----
  function scopeIds(model, scope) {
    var sites = model.sites, pick;
    switch (scope.type) {
      case 'vpaa': pick = function (s) { return s.lists.indexOf('VPAA') >= 0; }; break;
      case 'dls': pick = function (s) { return s.lists.indexOf('DLS') >= 0; }; break;
      case 'unlisted': pick = function (s) { return !s.listed; }; break;
      case 'site': pick = function (s) { return s.id === scope.site; }; break;
      case 'custom': pick = function (s) { return scope.custom.indexOf(s.id) >= 0; }; break;
      default: pick = function () { return true; };
    }
    return sites.filter(pick).map(function (s) { return s.id; });
  }

  function scopeLabel(model, scope, count) {
    var base = {
      all: 'All sites', vpaa: 'VPAA list', dls: 'DLS list', unlisted: 'Sites not in the directory',
      custom: 'Custom selection'
    }[scope.type];
    if (scope.type === 'site') {
      var s = model.sitesById.get(scope.site);
      return s ? s.name : 'Single site';
    }
    return base + ' (' + count + ' site' + (count === 1 ? '' : 's') + ')';
  }

  // ---- URL hash ----
  function readHash() {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var type = p.get('scope') || 'all';
    if (SCOPES.indexOf(type) < 0) type = 'all'; // also covers retired links such as scope=owner
    return {
      scope: {
        type: type, site: p.get('site') || '',
        custom: (p.get('sites') || '').split(',').filter(Boolean)
      },
      win: p.get('window') || '30',
      band: p.get('band') === '1',
      metric: p.get('rank') === 'score' ? 'score' : 'issues'
    };
  }
  function writeHash(st) {
    var p = new URLSearchParams();
    if (st.scope.type !== 'all') p.set('scope', st.scope.type);
    if (st.scope.type === 'site') p.set('site', st.scope.site);
    if (st.scope.type === 'custom') p.set('sites', st.scope.custom.join(','));
    if (st.win !== '30') p.set('window', st.win);
    if (st.band) p.set('band', '1');
    if (st.metric !== 'issues') p.set('rank', st.metric);
    var h = p.toString();
    history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : ''));
  }

  // ---- renderers ----
  function windowPhrase(w, win) {
    if (win === 'prev') return 'previous reading (' + w.startDay + ')';
    if (win === 'all') return 'baseline (' + w.startDay + ')';
    return w.startDay + ' (' + win + ' days earlier)';
  }

  function renderKpis(el, notesEl, res, win) {
    var k = res.kpi, d = k.delta;
    var tile = function (label, value, delta, fmt, better) {
      return '<div class="kpi"><div class="label">' + label + '</div><div class="value">' + value +
        '</div><div class="delta">' + (d ? deltaHtml(delta, fmt, better) : '<span class="muted">–</span>') + '</div></div>';
    };
    el.innerHTML =
      tile('Average score (%)', fmtScore(k.score), d && d.score, fmtDeltaScore, 'up') +
      tile('Accessibility issues', fmtInt(k.issues), d && d.issues, fmtDeltaInt, 'down') +
      tile('Pages with issues', fmtInt(k.pages), d && d.pages, fmtDeltaInt, 'down') +
      tile('PDFs', fmtInt(k.pdf), d && d.pdf, fmtDeltaInt, null) +
      tile('Sites at 100', fmtInt(k.at100) + '<span class="muted small"> of ' + k.sites + '</span>', d && d.at100, fmtDeltaInt, 'up') +
      tile('Sites below 90', fmtInt(k.below90), d && d.below90, fmtDeltaInt, 'down');
    var notes = ['<span>Change vs. ' + esc(windowPhrase(res.window, win)) + ', across the ' + k.compared + ' site' + (k.compared === 1 ? '' : 's') + ' read at both dates.</span>'];
    if (res.newSites.length) {
      notes.push('<span><strong>' + res.newSites.length + ' new site' + (res.newSites.length === 1 ? '' : 's') + '</strong> since then (' +
        fmtInt(k.newIssues) + ' issues) not counted in changes.</span>');
    }
    if (res.staleSites.length) {
      notes.push('<span><strong>' + res.staleSites.length + ' stale site' + (res.staleSites.length === 1 ? '' : 's') +
        '</strong> (no reading in over ' + root.STALE_DAYS + ' days), shown with last known values.</span>');
    }
    notesEl.innerHTML = notes.join('');
  }

  function moversTable(rows, key, metric) {
    if (!rows.length) return '<p class="empty">No changes in this window.</p>';
    var fmt = metric === 'score' ? fmtDeltaScore : fmtDeltaInt;
    var better = metric === 'score' ? 'up' : 'down';
    return '<table><thead><tr><th scope="col">Site</th><th scope="col" class="num">Now</th><th scope="col" class="num">Change</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var now = metric === 'score' ? scoreHtml(r.end.score) : fmtInt(r.end.issues);
        return '<tr><th scope="row"><button type="button" class="link" data-site="' + esc(r.site.id) + '">' + esc(r.site.name) + '</button></th>' +
          '<td class="num">' + now + '</td><td class="num">' + deltaHtml(r[key], fmt, better) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  var COLS = [
    { k: 'name', label: 'Site', get: function (r) { return r.site.name.toLowerCase(); } },
    { k: 'score', label: 'Score', num: 1, get: function (r) { return r.end.score; } },
    { k: 'issues', label: 'Issues', num: 1, get: function (r) { return r.end.issues; } },
    { k: 'pages', label: 'Pages with issues', num: 1, get: function (r) { return r.end.pages; } },
    { k: 'pdf', label: 'PDFs', num: 1, get: function (r) { return r.end.pdf; } },
    { k: 'dIssues', label: 'Issues change', num: 1, get: function (r) { return r.dIssues === null ? -Infinity : r.dIssues; } },
    { k: 'dScore', label: 'Score change', num: 1, get: function (r) { return r.dScore === null ? -Infinity : r.dScore; } },
    { k: 'trend', label: 'Issues trend' },
    { k: 'last', label: 'Last reading', get: function (r) { return r.end.day; } }
  ];

  function renderSitesTable(el, res, model, sort, filter, trendRange) {
    var rows = res.rows.slice();
    var f = (filter || '').trim().toLowerCase();
    if (f) rows = rows.filter(function (r) { return r.site.name.toLowerCase().indexOf(f) >= 0; });
    var col = COLS.filter(function (c) { return c.k === sort.key; })[0] || COLS[2];
    if (col.get) rows.sort(function (a, b) {
      var x = col.get(a), y = col.get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1);
    });
    var head = COLS.map(function (c) {
      var th = '<th scope="col"' + (c.num ? ' class="num"' : '');
      if (!c.get) return th + '>' + c.label + '</th>';
      var active = sort.key === c.k;
      return th + (active ? ' aria-sort="' + (sort.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') +
        '><button type="button" data-sort="' + c.k + '">' + c.label + '</button></th>';
    }).join('');
    var from = trendRange.from, to = trendRange.to;
    var body = rows.map(function (r) {
      var s = r.site, spark = [];
      for (var i = from; i <= to; i++) spark.push(s.filled[i] ? s.filled[i].issues : null);
      return '<tr><th scope="row"><button type="button" class="link" data-site="' + esc(s.id) + '">' + esc(s.name) + '</button>' +
        ' <a href="' + esc(safeHref(s.dubbotUrl)) + '" target="_blank" rel="noopener" class="small">DubBot<span class="sr-only"> (opens in new tab) for ' + esc(s.name) + '</span></a>' +
        (r.isNew ? '<span class="badge">new</span>' : '') + (s.listed ? '' : '<span class="badge">not in directory</span>') + '</th>' +
        '<td class="num">' + scoreHtml(r.end.score) + '</td>' +
        '<td class="num">' + fmtInt(r.end.issues) + '</td>' +
        '<td class="num">' + fmtInt(r.end.pages) + '</td>' +
        '<td class="num">' + fmtInt(r.end.pdf) + '</td>' +
        '<td class="num">' + deltaHtml(r.dIssues, fmtDeltaInt, 'down') + '</td>' +
        '<td class="num">' + deltaHtml(r.dScore, fmtDeltaScore, 'up') + '</td>' +
        '<td>' + root.sparkline(spark, 'var(--s1)') + '</td>' +
        '<td>' + r.end.day + (r.stale ? '<span class="badge stale">stale: ' + r.age + ' days</span>' : '') + '</td></tr>';
    }).join('');
    el.innerHTML = '<table><caption class="sr-only">Sites in the current scope</caption><thead><tr>' + head + '</tr></thead><tbody>' +
      (body || '<tr><td colspan="' + COLS.length + '" class="empty">No sites match.</td></tr>') + '</tbody></table>';
  }

  function renderSiteCard(el, site) {
    if (!site) { el.innerHTML = ''; return; }
    var lists = site.lists.join(', ');
    el.innerHTML = '<div class="card"><h2 class="site-card-heading">' + esc(site.name) + '</h2><dl>' +
      '<dt>List</dt><dd>' + esc(lists) + '</dd>' +
      '<dt>DubBot</dt><dd><a href="' + esc(safeHref(site.dubbotUrl)) + '" target="_blank" rel="noopener">Open in DubBot<span class="sr-only"> (opens in new tab)</span></a></dd>' +
      '<dt>Readings</dt><dd>' + site.readings.length + ' days, first ' + site.readings[0].day + ', last ' + site.latest.day + '</dd></dl></div>';
  }

  function renderHealth(el, model, source) {
    if (source !== 'server') {
      el.innerHTML = '<span class="banner">Showing dropped files. Data health checks run on the hosted page.</span>';
      return;
    }
    var now = Date.now(), parts = [], warn = false;
    ['main', 'dls'].forEach(function (l) {
      var ts = model.listLatest[l];
      if (!ts) return;
      var hrs = (now - new Date(ts).getTime()) / 3600000;
      if (hrs > 36) warn = true;
      parts.push((l === 'main' ? 'Main' : 'DLS') + ' export: ' + root.dayOf(ts) + ' (' + (hrs < 48 ? Math.round(hrs) + ' h' : Math.round(hrs / 24) + ' days') + ' ago)');
    });
    el.innerHTML = '<span class="banner' + (warn ? ' warn' : '') + '"' + (warn ? ' role="alert"' : '') + '>' +
      (warn ? 'Data may be out of date. ' : '') + esc(parts.join(' · ')) + '</span>';
  }

  root.fmtInt = fmtInt; root.fmtScore = fmtScore; root.fmtDeltaInt = fmtDeltaInt; root.fmtDeltaScore = fmtDeltaScore;
  root.deltaHtml = deltaHtml; root.scoreHtml = scoreHtml;
  root.scopeIds = scopeIds; root.scopeLabel = scopeLabel;
  root.readHash = readHash; root.writeHash = writeHash;
  root.renderKpis = renderKpis; root.moversTable = moversTable; root.renderSitesTable = renderSitesTable;
  root.renderSiteCard = renderSiteCard; root.renderHealth = renderHealth; root.windowPhrase = windowPhrase;
})(window.DB = window.DB || {});

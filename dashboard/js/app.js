// Wiring: load data, own the state, and re-render on every change.
(function () {
  'use strict';
  var DB = window.DB, $ = function (id) { return document.getElementById(id); };
  var model = null, source = 'server', pickerBuilt = false;
  var state = DB.readHash();
  state.sort = { key: 'issues', dir: 'desc' };
  state.filter = '';

  // ---- loading ----
  function showLoader(msg) {
    $('app').hidden = true; $('loader').hidden = false;
    $('loader-msg').textContent = msg;
    $('asof').textContent = 'No data loaded';
  }
  function start(data) {
    var m = DB.buildModel(data.rows, data.directory);
    if (!m) { showLoader('No snapshot rows found in those files. Expected CSVs with the “Collected At / Site URL / DubBot Site ID …” header.'); return; }
    model = m; source = data.source;
    $('loader').hidden = true; $('app').hidden = false;
    $('asof').textContent = 'Data as of ' + m.days[m.n - 1] + ' · ' + m.sites.length + ' sites · ' + data.fileCount + ' files · ' + DB.fmtInt(m.rowCount) + ' readings';
    DB.renderHealth($('health'), m, source);
    $('foot-note').textContent = m.unlisted.length
      ? m.unlisted.length + ' site' + (m.unlisted.length === 1 ? ' is' : 's are') + ' not in sites-directory.csv: ' + m.unlisted.map(function (s) { return s.name; }).join(', ') + '.'
      : '';
    if (!m.hasDirectory) $('foot-note').textContent = 'sites-directory.csv was not loaded, so VPAA and DLS lists are unavailable.';
    buildControls();
    render(true);
  }

  function boot() {
    if (location.protocol === 'file:') {
      showLoader('This page was opened from disk, so it can’t fetch the data folder. Drop the CSV files below, or serve the folder over HTTP.');
      return;
    }
    $('asof').textContent = 'Loading data…';
    DB.loadFromServer('data/', function (done, total) {
      $('asof').textContent = 'Loading data… ' + done + ' of ' + total + ' files';
    }).then(start).catch(function (err) {
      showLoader('Couldn’t load data/manifest.json (' + err.message + '). You can drop CSV files below instead.');
    });
  }

  function handleFiles(files) {
    if (!files || !files.length) return;
    DB.loadFromFiles(files).then(start);
  }
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files); });
  $('file').addEventListener('change', function (e) { handleFiles(e.target.files); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { $('file').click(); e.preventDefault(); } });

  // ---- controls ----
  function buildControls() {
    $('site-list').innerHTML = model.sites.map(function (s) { return '<option value="' + DB.esc(s.name) + '">'; }).join('');
    // Normalise restored state against the data.
    var t = state.scope.type;
    if ((t === 'vpaa' || t === 'dls') && !model.hasDirectory) state.scope.type = 'all';
if (t === 'site' && !model.sitesById.has(state.scope.site)) { state.scope.type = 'all'; state.scope.site = ''; }
    if (t === 'unlisted' && !model.unlisted.length) state.scope.type = 'all';
    state.scope.custom = state.scope.custom.filter(function (id) { return model.sitesById.has(id); });
    if (!['prev', '7', '30', '90', 'all'].some(function (w) { return w === state.win; })) state.win = '30';
    pickerBuilt = false;
    buildPicker();
  }

  function buildPicker() {
    var f = $('custom-filter').value.trim().toLowerCase();
    var list = $('custom-list'), legend = list.firstElementChild;
    list.innerHTML = '';
    list.appendChild(legend);
    model.sites.forEach(function (s) {
      if (f && s.name.toLowerCase().indexOf(f) < 0) return;
      var lab = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = s.id; cb.checked = state.scope.custom.indexOf(s.id) >= 0;
      lab.appendChild(cb); lab.appendChild(document.createTextNode(s.name));
      list.appendChild(lab);
    });
  }

  function syncControls() {
    var t = state.scope.type;
    $('scope').value = t;
    $('site-field').hidden = t !== 'site';
    $('custom-field').hidden = t !== 'custom';
    if (t === 'site') { var s = model.sitesById.get(state.scope.site); if (s && document.activeElement !== $('site')) $('site').value = s.name; }
    $('custom-count').textContent = state.scope.custom.length + ' site' + (state.scope.custom.length === 1 ? '' : 's') + ' selected';
    $('window').value = state.win;
    $('band').checked = state.band;
    $('mv-metric').value = state.metric;
    // Only offer list scopes that have data.
    Array.prototype.forEach.call($('scope').options, function (o) {
      if (o.value === 'unlisted') o.hidden = !model.unlisted.length;
      if (o.value === 'vpaa' || o.value === 'dls') o.hidden = !model.hasDirectory;
    });
  }

  $('scope').addEventListener('change', function (e) {
    state.scope.type = e.target.value;
    if (state.scope.type === 'site' && !state.scope.site) state.scope.site = model.sites[0].id;
    render();
    if (state.scope.type === 'site') $('site').focus(); // already holds current site; typing replaces it
  });
  $('site').addEventListener('focus', function (e) { e.target.select(); });
  $('site').addEventListener('change', function (e) {
    var name = e.target.value.trim().toLowerCase();
    var s = model.sites.filter(function (x) { return x.name.toLowerCase() === name; })[0];
    if (s) { state.scope.site = s.id; render(); }
  });
  $('window').addEventListener('change', function (e) { state.win = e.target.value; render(); });
  $('band').addEventListener('change', function (e) { state.band = e.target.checked; render(); });
  $('mv-metric').addEventListener('change', function (e) { state.metric = e.target.value; render(); });
  $('tbl-filter').addEventListener('input', function (e) { state.filter = e.target.value; renderTable(); });

  $('custom-filter').addEventListener('input', buildPicker);
  $('custom-list').addEventListener('change', function (e) {
    var id = e.target.value, i = state.scope.custom.indexOf(id);
    if (e.target.checked && i < 0) state.scope.custom.push(id);
    if (!e.target.checked && i >= 0) state.scope.custom.splice(i, 1);
    render();
  });
  $('custom-all').addEventListener('click', function () {
    Array.prototype.forEach.call($('custom-list').querySelectorAll('input'), function (cb) {
      if (cb.value && state.scope.custom.indexOf(cb.value) < 0) state.scope.custom.push(cb.value);
      cb.checked = true;
    });
    render();
  });
  $('custom-none').addEventListener('click', function () { state.scope.custom = []; buildPicker(); render(); });

  $('copy-link').addEventListener('click', function () {
    var msg = $('copy-msg');
    var done = function (t) { msg.textContent = t; setTimeout(function () { msg.textContent = ''; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(location.href).then(function () { done('Link copied'); }, function () { done('Copy the address bar'); });
    } else done('Copy the address bar');
  });

  // Row/button clicks that scope to one site; sortable headers.
  document.addEventListener('click', function (e) {
    var siteBtn = e.target.closest && e.target.closest('[data-site]');
    if (siteBtn) {
      state.scope.type = 'site'; state.scope.site = siteBtn.getAttribute('data-site');
      render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
    }
    var sortBtn = e.target.closest && e.target.closest('[data-sort]');
    if (sortBtn) {
      var k = sortBtn.getAttribute('data-sort');
      state.sort = state.sort.key === k ? { key: k, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'name' ? 'asc' : 'desc' };
      renderTable();
      var again = document.querySelector('[data-sort="' + k + '"]'); if (again) again.focus();
    }
  });
  window.addEventListener('hashchange', function () {
    if (!model) return;
    var keep = { sort: state.sort, filter: state.filter };
    state = DB.readHash(); state.sort = keep.sort; state.filter = keep.filter;
    buildControls(); render(true);
  });

  // ---- rendering ----
  var res, ids, agg, lastWidth = 0;

  function render() {
    syncControls();
    ids = DB.scopeIds(model, state.scope);
    DB.writeHash(state);
    if (!ids.length) {
      $('scope-summary').textContent = DB.scopeLabel(model, state.scope, 0) + ' · no sites selected';
      $('kpis').innerHTML = ''; $('kpi-notes').innerHTML = '';
      ['chart-score', 'chart-issues', 'chart-pdf', 'table-score', 'table-issues', 'table-pdf', 'mv-good', 'mv-bad', 'sites-table', 'site-card']
        .forEach(function (id) { $(id).innerHTML = ''; });
      return;
    }
    res = DB.compute(model, ids, state.win);
    agg = DB.aggregate(model, ids);
    $('scope-summary').textContent = DB.scopeLabel(model, state.scope, ids.length) + ' · compared with ' + DB.windowPhrase(res.window, state.win);
    DB.renderSiteCard($('site-card'), state.scope.type === 'site' ? model.sitesById.get(state.scope.site) : null);
    DB.renderKpis($('kpis'), $('kpi-notes'), res, state.win);
    renderCharts();
    renderMovers();
    renderTable();
  }

  function renderCharts() {
    var w = { startIdx: res.window.startIdx, endIdx: res.window.endIdx };
    var perSite = state.scope.type === 'site' || ids.length === 1;
    var note = function (i) {
      var bits = [];
      if (agg.count[i]) bits.push(agg.count[i] + ' site' + (agg.count[i] === 1 ? '' : 's'));
      if (agg.stale[i]) bits.push(agg.stale[i] + ' stale');
      return bits.join(' · ');
    };
    var scoreName = perSite ? 'Score' : 'Average score';
    var band = state.band && !perSite ? { name: 'Lowest to highest site score', color: 'var(--s1)', lo: agg.scoreMin, hi: agg.scoreMax } : null;

    DB.lineChart({
      container: $('chart-score'), title: scoreName, days: model.days, window: w, note: perSite ? null : note,
      series: [{ name: scoreName + ' (%)', color: 'var(--s1)', values: agg.score, fmt: function (v) { return DB.fmtScore(v) + '%'; } }],
      band: band, yFmt: function (v) { return DB.fmtScore(v); }
    });
    DB.lineChart({
      container: $('chart-issues'), title: 'Accessibility issues', days: model.days, window: w, zeroBase: true, note: perSite ? null : note,
      series: [
        { name: 'Issues', color: 'var(--s1)', values: agg.issues, fmt: DB.fmtInt },
        { name: 'Pages with issues', color: 'var(--s2)', dash: '6 4', values: agg.pages, fmt: DB.fmtInt }
      ], yFmt: DB.fmtInt
    });
    DB.lineChart({
      container: $('chart-pdf'), title: 'PDF count', days: model.days, window: w, zeroBase: true, note: perSite ? null : note,
      series: [{ name: 'PDFs', color: 'var(--s3)', values: agg.pdf, fmt: DB.fmtInt }], yFmt: DB.fmtInt
    });

    var sc = function (v) { return DB.scoreHtml(v); };
    DB.dataTable($('table-score'), scoreName, model.days, [
      { label: scoreName + ' (%)', values: agg.score, fmt: sc },
      { label: 'Lowest', values: agg.scoreMin, fmt: sc },
      { label: 'Highest', values: agg.scoreMax, fmt: sc },
      { label: 'Sites', values: agg.count.map(function (c, i) { return agg.score[i] === null ? null : c; }), fmt: DB.fmtInt }
    ]);
    DB.dataTable($('table-issues'), 'Accessibility issues', model.days, [
      { label: 'Issues', values: agg.issues, fmt: DB.fmtInt },
      { label: 'Pages with issues', values: agg.pages, fmt: DB.fmtInt },
      { label: 'Stale sites', values: agg.stale.map(function (c, i) { return agg.issues[i] === null ? null : c; }), fmt: DB.fmtInt }
    ]);
    DB.dataTable($('table-pdf'), 'PDF count', model.days, [{ label: 'PDFs', values: agg.pdf, fmt: DB.fmtInt }]);
  }

  function renderMovers() {
    var mv = DB.movers(res, state.metric, 10);
    $('mv-sub').textContent = 'Change from ' + DB.windowPhrase(res.window, state.win) + ' to ' + res.window.endDay +
      ', ranked by ' + (state.metric === 'score' ? 'score (higher is better)' : 'issues count (fewer is better)') + '. New sites are not ranked.';
    $('mv-good').innerHTML = DB.moversTable(mv.improved, mv.key, state.metric);
    $('mv-bad').innerHTML = DB.moversTable(mv.regressed, mv.key, state.metric);
  }

  function renderTable() {
    if (!res) return;
    var from = Math.max(0, Math.min(res.window.startIdx, res.window.endIdx - 30));
    DB.renderSitesTable($('sites-table'), res, model, state.sort, state.filter, { from: from, to: res.window.endIdx });
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var w = $('chart-score').clientWidth;
      if (res && w !== lastWidth) { lastWidth = w; renderCharts(); }
    }, 150);
  });

  boot();
})();

// Metrics: comparison window, KPI deltas, and biggest movers for a scope.
(function (root) {
  'use strict';

  var STALE_DAYS = 7;

  // win: 'prev' | 'all' | number of days (as number or numeric string)
  function resolveWindow(model, siteIds, win) {
    var endIdx = model.n - 1, startIdx;
    if (win === 'all') {
      startIdx = 0;
    } else if (win === 'prev') {
      var sites = siteIds.map(function (id) { return model.sitesById.get(id); }).filter(Boolean);
      startIdx = Math.max(0, endIdx - 1);
      for (var d = endIdx - 1; d >= 0; d--) {
        if (sites.some(function (s) { return s.actual[d]; })) { startIdx = d; break; }
      }
    } else {
      startIdx = Math.max(0, endIdx - parseInt(win, 10));
    }
    return { startIdx: startIdx, endIdx: endIdx, startDay: model.days[startIdx], endDay: model.days[endIdx] };
  }

  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  function compute(model, siteIds, win) {
    var w = resolveWindow(model, siteIds, win);
    var sites = siteIds.map(function (id) { return model.sitesById.get(id); }).filter(Boolean);
    var rows = [], newSites = [], staleSites = [];

    sites.forEach(function (s) {
      var end = s.filled[w.endIdx], start = s.filled[w.startIdx];
      if (!end) return;
      var row = {
        site: s, end: end, start: start || null, isNew: !start,
        age: s.age[w.endIdx], stale: s.age[w.endIdx] > STALE_DAYS,
        dIssues: start ? end.issues - start.issues : null,
        dScore: start ? end.score - start.score : null,
        dPages: start ? end.pages - start.pages : null,
        dPdf: start ? end.pdf - start.pdf : null
      };
      rows.push(row);
      if (row.isNew) newSites.push(row);
      if (row.stale) staleSites.push(row);
    });

    var common = rows.filter(function (r) { return !r.isNew; });
    var pick = function (list, k, side) { return list.map(function (r) { return r[side][k]; }); };
    var at = function (list, side, pred) { return list.filter(function (r) { return pred(r[side].score); }).length; };

    var kpi = {
      sites: rows.length,
      score: mean(pick(rows, 'score', 'end')),
      issues: sum(pick(rows, 'issues', 'end')),
      pages: sum(pick(rows, 'pages', 'end')),
      pdf: sum(pick(rows, 'pdf', 'end')),
      at100: at(rows, 'end', function (s) { return s >= 100; }),
      below90: at(rows, 'end', function (s) { return s < 90; }),
      // Like-for-like change over sites that existed at the window start.
      delta: common.length ? {
        score: mean(pick(common, 'score', 'end')) - mean(pick(common, 'score', 'start')),
        issues: sum(pick(common, 'issues', 'end')) - sum(pick(common, 'issues', 'start')),
        pages: sum(pick(common, 'pages', 'end')) - sum(pick(common, 'pages', 'start')),
        pdf: sum(pick(common, 'pdf', 'end')) - sum(pick(common, 'pdf', 'start')),
        at100: at(common, 'end', function (s) { return s >= 100; }) - at(common, 'start', function (s) { return s >= 100; }),
        below90: at(common, 'end', function (s) { return s < 90; }) - at(common, 'start', function (s) { return s < 90; })
      } : null,
      compared: common.length,
      newIssues: sum(newSites.map(function (r) { return r.end.issues; }))
    };

    return { window: w, rows: rows, kpi: kpi, newSites: newSites, staleSites: staleSites };
  }

  // metric: 'issues' (fewer is better) or 'score' (higher is better)
  function movers(result, metric, limit) {
    limit = limit || 10;
    var key = metric === 'score' ? 'dScore' : 'dIssues';
    var eps = metric === 'score' ? 0.005 : 0;
    var list = result.rows.filter(function (r) { return r[key] !== null && Math.abs(r[key]) > eps; });
    var better = function (r) { return metric === 'score' ? r[key] : -r[key]; }; // bigger = better
    var improved = list.filter(function (r) { return better(r) > 0; })
      .sort(function (a, b) { return better(b) - better(a); }).slice(0, limit);
    var worse = list.filter(function (r) { return better(r) < 0; })
      .sort(function (a, b) { return better(a) - better(b); }).slice(0, limit);
    return { improved: improved, regressed: worse, key: key };
  }

  root.resolveWindow = resolveWindow;
  root.compute = compute;
  root.movers = movers;
})(typeof module !== 'undefined' ? module.exports : (window.DB = window.DB || {}));

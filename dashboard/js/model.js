// Data model: normalize rows, dedupe to one reading per site per day,
// forward-fill each site across the calendar, and aggregate for a scope.
(function (root) {
  'use strict';

  var TZ = 'America/Chicago';
  var STALE_DAYS = 7;
  var dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

  function dayOf(iso) { return dayFmt.format(new Date(iso)); }
  function dayNum(day) {
    var p = day.split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function dayFromNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }

  // Links come from sites-directory.csv, which is editable data, so only an
  // https URL on dubbot.com (or a subdomain) is ever used as an href. Anything
  // else (javascript:, data:, http:, another host, embedded credentials) falls
  // back to the default DubBot link for the site.
  function parseDubbotUrl(value) {
    if (!value) return null;
    var u;
    try { u = new URL(String(value).trim()); } catch (e) { return null; }
    var host = u.hostname.toLowerCase();
    var ok = u.protocol === 'https:' && !u.username && !u.password &&
      (host === 'dubbot.com' || /\.dubbot\.com$/.test(host));
    return ok ? u : null;
  }
  function isSafeDubbotUrl(value) { return parseDubbotUrl(value) !== null; }
  function safeDubbotUrl(value, id) {
    var u = parseDubbotUrl(value);
    return u ? u.href : 'https://utsa.dubbot.com/sites/' + encodeURIComponent(id);
  }

  function stripUrl(u) { return u.replace(/^https?:\/\//, '').replace(/\/+$/, ''); }

  // rows: from load.js; directory: from load.js (may be empty)
  function buildModel(rows, directory) {
    // 1. Dedupe: latest reading per (site, Chicago day).
    var best = new Map();
    rows.forEach(function (r) {
      var day = dayOf(r.ts), key = r.id + '|' + day, cur = best.get(key);
      if (!cur || r.ts > cur.ts) best.set(key, Object.assign({ day: day, dayNum: dayNum(day) }, r));
    });
    var readings = Array.from(best.values());
    if (!readings.length) return null;

    var first = Infinity, last = -Infinity;
    readings.forEach(function (r) {
      if (r.dayNum < first) first = r.dayNum;
      if (r.dayNum > last) last = r.dayNum;
    });
    var n = last - first + 1;
    var days = [];
    for (var i = 0; i < n; i++) days.push(dayFromNum(first + i));

    // 2. Per-site readings and forward-filled arrays.
    var byId = new Map();
    readings.forEach(function (r) {
      var s = byId.get(r.id);
      if (!s) { s = { id: r.id, readings: [] }; byId.set(r.id, s); }
      s.readings.push(r);
    });

    var dirById = new Map();
    (directory || []).forEach(function (d) { dirById.set(d.id, d); });

    var hasReading = new Uint8Array(n); // any reading anywhere on this day
    var sites = [];
    byId.forEach(function (s) {
      s.readings.sort(function (a, b) { return a.dayNum - b.dayNum; });
      var filled = new Array(n).fill(null), age = new Int32Array(n).fill(-1);
      var actual = new Uint8Array(n);
      var ri = 0, cur = null, curIdx = -1;
      for (var d = 0; d < n; d++) {
        while (ri < s.readings.length && s.readings[ri].dayNum - first === d) {
          cur = s.readings[ri++]; curIdx = d; actual[d] = 1; hasReading[d] = 1;
        }
        if (cur) { filled[d] = cur; age[d] = d - curIdx; }
      }
      var latest = s.readings[s.readings.length - 1];
      var dir = dirById.get(s.id);
      s.filled = filled; s.age = age; s.actual = actual;
      s.firstIdx = s.readings[0].dayNum - first;
      s.latest = latest;
      s.listed = !!dir;
      // Display names never carry a scheme or trailing slash, whichever source they came from.
      s.name = stripUrl((dir && dir.displayUrl) || latest.url || '') || s.id;
      s.lists = dir && dir.lists.length ? dir.lists : ['Unlisted'];
      s.dubbotUrl = safeDubbotUrl(dir && dir.dubbotUrl, s.id);
      sites.push(s);
    });
    sites.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });

    // Disambiguate identical display names.
    var seen = {};
    sites.forEach(function (s) { seen[s.name] = (seen[s.name] || 0) + 1; });
    sites.forEach(function (s) { if (seen[s.name] > 1) s.name += ' (' + s.id.slice(-4) + ')'; });

    var sitesById = new Map();
    sites.forEach(function (s) { sitesById.set(s.id, s); });

    // Newest raw timestamp per export list, for the data-health banner.
    var listLatest = {};
    rows.forEach(function (r) {
      if (!listLatest[r.list] || r.ts > listLatest[r.list]) listLatest[r.list] = r.ts;
    });

    return {
      days: days, firstNum: first, n: n,
      sites: sites, sitesById: sitesById,
      hasReading: hasReading,
      listLatest: listLatest,
      unlisted: sites.filter(function (s) { return !s.listed; }),
      hasDirectory: dirById.size > 0,
      rowCount: rows.length, readingCount: readings.length
    };
  }

  // Aggregate series over every day for a set of sites.
  // A day is a gap (null) if none of the sites has a reading of its own that day.
  function aggregate(model, siteIds) {
    var n = model.n, out = {
      score: new Array(n).fill(null), scoreMin: new Array(n).fill(null), scoreMax: new Array(n).fill(null),
      issues: new Array(n).fill(null), pages: new Array(n).fill(null), pdf: new Array(n).fill(null),
      count: new Array(n).fill(0), stale: new Array(n).fill(0)
    };
    var sites = siteIds.map(function (id) { return model.sitesById.get(id); }).filter(Boolean);
    for (var d = 0; d < n; d++) {
      var cnt = 0, sum = 0, iss = 0, pg = 0, pdf = 0, lo = Infinity, hi = -Infinity, stale = 0, actual = false;
      for (var k = 0; k < sites.length; k++) {
        var s = sites[k], r = s.filled[d];
        if (!r) continue;
        cnt++; sum += r.score; iss += r.issues; pg += r.pages; pdf += r.pdf;
        if (r.score < lo) lo = r.score;
        if (r.score > hi) hi = r.score;
        if (s.age[d] > STALE_DAYS) stale++;
        if (s.actual[d]) actual = true;
      }
      out.count[d] = cnt; out.stale[d] = stale;
      if (!cnt || !actual) continue;
      out.score[d] = sum / cnt; out.scoreMin[d] = lo; out.scoreMax[d] = hi;
      out.issues[d] = iss; out.pages[d] = pg; out.pdf[d] = pdf;
    }
    return out;
  }

  root.STALE_DAYS = STALE_DAYS;
  root.TZ = TZ;
  root.dayOf = dayOf;
  root.dayNum = dayNum;
  root.dayFromNum = dayFromNum;
  root.buildModel = buildModel;
  root.safeDubbotUrl = safeDubbotUrl;
  root.isSafeDubbotUrl = isSafeDubbotUrl;
  root.aggregate = aggregate;
})(typeof module !== 'undefined' ? module.exports : (window.DB = window.DB || {}));

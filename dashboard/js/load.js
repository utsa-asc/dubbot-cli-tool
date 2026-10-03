// Loading: CSV parser, manifest + file fetching, and the drag-and-drop fallback.
// Plain script (no ES modules) so the page can also be opened from file://,
// where fetch() is unavailable and the drop zone is used instead.
(function (root) {
  'use strict';

  // RFC 4180-ish CSV parser: quoted fields, escaped quotes, CRLF, BOM.
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var rows = [], row = [], field = '', inQuotes = false, i = 0, c;
    while (i < text.length) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return !(r.length === 1 && r[0].trim() === ''); });
  }

  // Same rule as src/commands/manifest.ts, used for dropped files.
  function listForName(name) {
    if (/^snapshots-backfill/.test(name)) return 'backfill';
    if (/^snapshots-dls-/.test(name)) return 'dls';
    return 'main';
  }

  function indexHeader(header) {
    var idx = {};
    header.forEach(function (h, i) { idx[h.trim()] = i; });
    return idx;
  }

  // Snapshot CSV -> [{ts, url, id, score, pdf, issues, pages, list}]
  function snapshotRows(csvRows, list) {
    if (csvRows.length < 2) return [];
    var h = indexHeader(csvRows[0]);
    var need = ['Collected At', 'DubBot Site ID', 'Score (%)', 'Issues Count'];
    for (var n = 0; n < need.length; n++) if (!(need[n] in h)) return [];
    var out = [];
    for (var r = 1; r < csvRows.length; r++) {
      var x = csvRows[r];
      var score = parseFloat(x[h['Score (%)']]);
      var id = (x[h['DubBot Site ID']] || '').trim();
      var ts = (x[h['Collected At']] || '').trim();
      if (!id || !ts || isNaN(score)) continue;
      out.push({
        ts: ts,
        url: (x[h['Site URL']] || '').trim(),
        id: id,
        score: score,
        pdf: parseInt(x[h['PDF Count']], 10) || 0,
        issues: parseInt(x[h['Issues Count']], 10) || 0,
        pages: parseInt(x[h['Pages With Issues']], 10) || 0,
        list: list
      });
    }
    return out;
  }

  // sites-directory.csv -> [{id, displayUrl, lists[], dubbotUrl}]
  // Only these four columns are ever read. The dashboard deliberately holds no
  // personal data, so any other column in the file (names, emails) is ignored.
  function directoryRows(csvRows) {
    if (csvRows.length < 2) return [];
    var h = indexHeader(csvRows[0]);
    if (!('Site ID' in h)) return [];
    var get = function (x, k) { return k in h ? (x[h[k]] || '').trim() : ''; };
    var out = [];
    for (var r = 1; r < csvRows.length; r++) {
      var x = csvRows[r], id = get(x, 'Site ID');
      if (!id) continue;
      out.push({
        id: id,
        displayUrl: get(x, 'Display URL'),
        lists: get(x, 'List').split(/[;|]/).map(function (s) { return s.trim(); }).filter(Boolean),
        dubbotUrl: get(x, 'Dubbot URL')
      });
    }
    return out;
  }

  function fetchText(url, opts) {
    return fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error(url + ': HTTP ' + res.status);
      return res.text();
    });
  }

  // Fetch manifest.json, then every CSV it lists plus the directory.
  // onProgress(done, total) is optional.
  function loadFromServer(base, onProgress) {
    base = base || 'data/';
    return fetchText(base + 'manifest.json?t=' + Date.now(), { cache: 'no-store' }).then(function (txt) {
      var manifest = JSON.parse(txt);
      var files = manifest.files || [];
      var done = 0;
      var jobs = files.map(function (f) {
        return fetchText(base + encodeURIComponent(f.name)).then(function (t) {
          done++;
          if (onProgress) onProgress(done, files.length);
          return snapshotRows(parseCSV(t), f.list || listForName(f.name));
        });
      });
      var dir = fetchText(base + 'sites-directory.csv', { cache: 'no-cache' })
        .then(function (t) { return directoryRows(parseCSV(t)); })
        .catch(function () { return []; });
      return Promise.all([Promise.all(jobs), dir]).then(function (res) {
        return {
          rows: [].concat.apply([], res[0]),
          directory: res[1],
          fileCount: files.length,
          manifest: manifest,
          source: 'server'
        };
      });
    });
  }

  // Dropped / picked File objects: snapshot CSVs and optionally sites-directory.csv.
  function loadFromFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    return Promise.all(files.map(function (f) {
      return f.text().then(function (t) { return { name: f.name, csv: parseCSV(t) }; });
    })).then(function (parsed) {
      var rows = [], directory = [], used = 0;
      parsed.forEach(function (p) {
        var d = directoryRows(p.csv);
        if (d.length) { directory = d; used++; return; }
        var s = snapshotRows(p.csv, listForName(p.name));
        if (s.length) { rows = rows.concat(s); used++; }
      });
      return { rows: rows, directory: directory, fileCount: used, manifest: null, source: 'files' };
    });
  }

  root.parseCSV = parseCSV;
  root.listForName = listForName;
  root.snapshotRows = snapshotRows;
  root.directoryRows = directoryRows;
  root.loadFromServer = loadFromServer;
  root.loadFromFiles = loadFromFiles;
})(typeof module !== 'undefined' ? module.exports : (window.DB = window.DB || {}));

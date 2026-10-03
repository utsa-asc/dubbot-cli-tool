// Run: node dashboard/tests/model.test.js   (checks against dashboard/data/, or $DATA_DIR)
const fs = require('fs'), path = require('path'), assert = require('assert');
const load = require('../js/load.js'), model = require('../js/model.js'), metrics = require('../js/metrics.js');
// safeDubbotUrl: only https on dubbot.com is allowed as an href
(function () {
  const fb = id => 'https://utsa.dubbot.com/sites/' + id;
  const good = ['https://utsa.dubbot.com/a/aaaaaaaaaaaaaaaaaaaaaaaa/sites/bbbbbbbbbbbbbbbbbbbbbbbb/', 'https://dubbot.com/x', ' HTTPS://UTSA.DUBBOT.COM/sites/abc '];
  good.forEach(u => assert.notStrictEqual(model.safeDubbotUrl(u, 'id'), fb('id'), 'should allow ' + u));
  const bad = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>1</script>', 'http://utsa.dubbot.com/x',
    '//utsa.dubbot.com/x', 'https://evil.com/x', 'https://utsa.dubbot.com.evil.com/x', 'https://evildubbot.com/x',
    'https://user:pw@utsa.dubbot.com/x', 'https://utsa.dubbot.com@evil.com/x', 'vbscript:x', 'not a url', '', null, undefined];
  bad.forEach(u => assert.strictEqual(model.safeDubbotUrl(u, 'id'), fb('id'), 'should reject ' + JSON.stringify(u)));
  assert.strictEqual(model.safeDubbotUrl('', 'a"b<c'), fb('a%22b%3Cc'), 'fallback id must be URL-encoded');
  console.log('safeDubbotUrl: ' + good.length + ' allowed, ' + bad.length + ' rejected, OK');
})();

const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
let rows = [];
manifest.files.forEach(f => {
  rows = rows.concat(load.snapshotRows(load.parseCSV(fs.readFileSync(path.join(dir, f.name), 'utf8')), f.list));
});
const exportRows = rows.filter(r => r.list !== 'backfill').length;
const directory = load.directoryRows(load.parseCSV(fs.readFileSync(path.join(dir, 'sites-directory.csv'), 'utf8')));
const m = model.buildModel(rows, directory);

console.log('files', manifest.files.length, 'export rows', exportRows, 'all rows', rows.length);
// Counts only ever grow as daily exports are added.
assert.ok(manifest.files.length >= 243, 'expected at least 243 files');
assert.ok(exportRows >= 12099, 'expected at least 12,099 export rows');
assert.ok(rows.length >= 12310, 'expected at least 12,310 rows');
assert.ok(manifest.files.some(f => f.list === 'backfill'), 'backfill file missing');

const all = m.sites.map(s => s.id);
const agg = model.aggregate(m, all);
const at = d => m.days.indexOf(d);
const show = d => { const i = at(d); return { day: d, sites: agg.count[i], score: +agg.score[i].toFixed(2), issues: agg.issues[i], pdf: agg.pdf[i] }; };
console.log(show('2026-01-20'), show('2026-10-01'));
assert.strictEqual(agg.count[at('2026-01-20')], 61);
assert.strictEqual(agg.issues[at('2026-01-20')], 26023);
// 2026-10-01 is in the past now, so these totals are fixed.
assert.strictEqual(agg.count[at('2026-10-01')], 70);
assert.strictEqual(agg.issues[at('2026-10-01')], 3043);
assert.strictEqual(+agg.score[at('2026-10-01')].toFixed(2), 97.36);
// Freshness: newest day must be on/after the last known good day.
assert.ok(m.days[m.n - 1] >= '2026-10-01', 'data ends before 2026-10-01');

console.log('days', m.days.length, m.days[0], '->', m.days[m.n - 1], 'sites', m.sites.length, 'unlisted', m.unlisted.map(s => s.name + ' ' + s.id));
const gaps = []; let run = null;
agg.issues.forEach((v, i) => { if (v === null) { run = run || [m.days[i], m.days[i]]; run[1] = m.days[i]; } else if (run) { gaps.push(run.join('..')); run = null; } });
console.log('gap days (no reading from any site):', gaps.length ? gaps.join(', ') : 'none');

const r = metrics.compute(m, all, 30);
console.log('30d', r.window.startDay, '->', r.window.endDay, JSON.stringify({ ...r.kpi, score: +r.kpi.score.toFixed(2), delta: r.kpi.delta && { ...r.kpi.delta, score: +r.kpi.delta.score.toFixed(3) } }));
console.log('new', r.newSites.length, 'stale', r.staleSites.length);
const mv = metrics.movers(r, 'issues', 3);
console.log('improved', mv.improved.map(x => x.site.name + ' ' + x.dIssues), 'regressed', mv.regressed.map(x => x.site.name + ' +' + x.dIssues));
console.log('prev', JSON.stringify(metrics.resolveWindow(m, all, 'prev')));
console.log('listLatest', m.listLatest);
console.log('OK');

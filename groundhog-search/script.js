(function () {
    'use strict';

    var CSV_URL = 'https://the-art-of-data-journalism.github.io/tutorial-data/groundhogs/predictions.csv';
    var PAGE_SIZE = 24;

    var predictors = [];   // one entry per predictor
    var years = [];        // every year in the data, ascending
    var shown = PAGE_SIZE;

    var $ = function (id) { return document.getElementById(id); };
    var els = {
        q: $('gh-q'), region: $('gh-region'), type: $('gh-type'), sort: $('gh-sort'),
        count: $('gh-count'), results: $('gh-results'), more: $('gh-more'),
        reset: $('gh-reset'), total: $('gh-total-predictors')
    };

    /* ---------- CSV parsing (handles quoted fields with commas/newlines) ---------- */
    function parseCSV(text) {
        var rows = [], row = [], field = '', inQ = false, i, c;
        for (i = 0; i < text.length; i++) {
            c = text[i];
            if (inQ) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
                } else { field += c; }
            } else if (c === '"') { inQ = true; }
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.length > 1 || row[0] !== '') rows.push(row);
                row = [];
            } else { field += c; }
        }
        if (field !== '' || row.length) { row.push(field); rows.push(row); }
        var head = rows.shift();
        return rows.map(function (r) {
            var o = {};
            head.forEach(function (h, j) { o[h] = r[j] === undefined ? '' : r[j]; });
            return o;
        });
    }

    /* ---------- Build predictor records ---------- */
    function build(rows) {
        var yearSet = {}, byId = {}, order = [];

        rows.forEach(function (r) {
            var y = +r.year;
            yearSet[y] = true;
            if (!byId[r.id]) {
                byId[r.id] = {
                    id: r.id, name: r.name, city: r.city, region: r.region, country: r.country,
                    type: r.type, active: r.active === '1', calls: {}
                };
                order.push(r.id);
            }
            // 1 = saw shadow, 0 = no shadow, null = no call on record
            byId[r.id].calls[y] = r.shadow === '1' ? 1 : r.shadow === '0' ? 0 : null;
        });

        years = Object.keys(yearSet).map(Number).sort(function (a, b) { return a - b; });

        // Majority call per year, across everyone with a call that year. Ties = no consensus.
        var consensus = {};
        years.forEach(function (y) {
            var s = 0, n = 0;
            order.forEach(function (id) {
                var v = byId[id].calls[y];
                if (v === 1) s++; else if (v === 0) n++;
            });
            consensus[y] = s > n ? 1 : n > s ? 0 : null;
        });

        return order.map(function (id) {
            var p = byId[id], shadow = 0, no = 0, na = 0, match = 0, comparable = 0, latest = null;
            years.forEach(function (y) {
                if (!(y in p.calls)) return;
                var v = p.calls[y];
                if (v === 1) shadow++; else if (v === 0) no++; else na++;
                if (v !== null) {
                    latest = { year: y, shadow: v };
                    if (consensus[y] !== null) { comparable++; if (v === consensus[y]) match++; }
                }
            });
            p.shadow = shadow; p.noShadow = no; p.na = na;
            p.total = shadow + no + na;
            p.called = shadow + no;
            p.match = match; p.comparable = comparable;
            p.matchPct = comparable ? match / comparable : -1;
            p.latest = latest;
            p.first = years.filter(function (y) { return y in p.calls; })[0];
            p.last = years.filter(function (y) { return y in p.calls; }).pop();
            p.haystack = (p.name + ' ' + p.city + ' ' + p.region + ' ' + p.type).toLowerCase();
            return p;
        });
    }

    /* ---------- Filters & sorting ---------- */
    function fillSelect(sel, values) {
        var counts = {};
        values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
        Object.keys(counts).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (v) {
            var o = document.createElement('option');
            o.value = v; o.textContent = v + ' (' + counts[v] + ')';
            sel.appendChild(o);
        });
    }

    function filtered() {
        var q = els.q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        var list = predictors.filter(function (p) {
            if (els.region.value && p.region !== els.region.value) return false;
            if (els.type.value && p.type !== els.type.value) return false;
            return q.every(function (t) { return p.haystack.indexOf(t) !== -1; });
        });
        var s = els.sort.value;
        list.sort(function (a, b) {
            if (s === 'count') return b.total - a.total || a.name.localeCompare(b.name);
            if (s === 'shadow') return b.shadow - a.shadow || a.name.localeCompare(b.name);
            if (s === 'match') return b.matchPct - a.matchPct || b.comparable - a.comparable || a.name.localeCompare(b.name);
            return a.name.localeCompare(b.name);
        });
        return list;
    }

    /* ---------- Rendering ---------- */
    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

    function card(p) {
        var c = el('article', 'gh-card');

        var top = el('div', 'gh-card-top');
        var titles = el('div');
        titles.appendChild(el('h2', 'gh-name', p.name));
        titles.appendChild(el('p', 'gh-place', p.city + ', ' + p.region + (p.country === 'Canada' ? ', Canada' : '')));
        top.appendChild(titles);
        var tags = el('div', 'gh-tags');
        tags.appendChild(el('span', 'gh-tag', p.type));
        if (!p.active) tags.appendChild(el('span', 'gh-tag gh-tag-retired', 'Inactive'));
        top.appendChild(tags);
        c.appendChild(top);

        // Headline stats
        var stats = el('dl', 'gh-stats');
        function stat(label, value, sub) {
            var d = el('div', 'gh-stat');
            d.appendChild(el('dt', null, label));
            d.appendChild(el('dd', null, value));
            if (sub) d.appendChild(el('span', 'gh-stat-sub', sub));
            stats.appendChild(d);
        }
        stat('Predictions on record', String(p.called), p.first === p.last ? String(p.first) : p.first + '–' + p.last);
        stat('Saw shadow', p.called ? Math.round(p.shadow / p.called * 100) + '%' : '—', plural(p.shadow, 'year') + ' of winter');
        stat('No shadow', p.called ? Math.round(p.noShadow / p.called * 100) + '%' : '—', plural(p.noShadow, 'year') + ' of early spring');
        stat('In line with consensus', p.comparable ? Math.round(p.matchPct * 100) + '%' : '—',
            p.comparable ? p.match + ' of ' + p.comparable + ' years' : 'not enough data');
        c.appendChild(stats);

        // Year-by-year strip
        var strip = el('div', 'gh-strip');
        strip.setAttribute('role', 'img');
        strip.setAttribute('aria-label', p.name + ': ' + p.shadow + ' shadow years, ' + p.noShadow + ' no-shadow years, ' + p.na + ' years with no call on record, ' + p.first + ' to ' + p.last + '.');
        years.forEach(function (y) {
            var cell = el('span', 'gh-cell');
            if (!(y in p.calls)) {
                cell.classList.add('gh-empty'); cell.title = y + ': not active';
            } else if (p.calls[y] === 1) {
                cell.classList.add('gh-shadow'); cell.title = y + ': saw shadow';
            } else if (p.calls[y] === 0) {
                cell.classList.add('gh-noshadow'); cell.title = y + ': no shadow';
            } else {
                cell.classList.add('gh-na'); cell.title = y + ': no call on record';
            }
            strip.appendChild(cell);
        });
        c.appendChild(strip);

        var axis = el('div', 'gh-axis');
        axis.appendChild(el('span', null, String(years[0])));
        axis.appendChild(el('span', null, String(years[years.length - 1])));
        c.appendChild(axis);

        if (p.latest) {
            c.appendChild(el('p', 'gh-latest',
                'Latest call (' + p.latest.year + '): ' + (p.latest.shadow ? 'saw its shadow — six more weeks of winter.' : 'no shadow — early spring.')));
        }
        return c;
    }

    function render() {
        var list = filtered();
        var anyFilter = els.q.value || els.region.value || els.type.value;
        els.reset.hidden = !anyFilter;

        els.results.textContent = '';
        if (!list.length) {
            els.count.textContent = 'No matches.';
            els.results.appendChild(el('p', 'gh-empty-state', 'No predictors match those filters. Try a shorter name or clear a filter.'));
            els.more.hidden = true;
            return;
        }
        els.count.textContent = 'Showing ' + Math.min(shown, list.length) + ' of ' + plural(list.length, 'predictor');
        var frag = document.createDocumentFragment();
        list.slice(0, shown).forEach(function (p) { frag.appendChild(card(p)); });
        els.results.appendChild(frag);
        els.more.hidden = list.length <= shown;
        notifyHeight();
    }

    // When framed in a CMS, let the parent resize the iframe if it listens for this message.
    function notifyHeight() {
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'gh-search-height', height: document.documentElement.scrollHeight }, '*');
        }
    }

    function resetPaging() { shown = PAGE_SIZE; render(); }

    /* ---------- Init ---------- */
    [els.q, els.region, els.type, els.sort].forEach(function (e) {
        e.addEventListener(e === els.q ? 'input' : 'change', resetPaging);
    });
    els.more.addEventListener('click', function () { shown += PAGE_SIZE; render(); });
    els.reset.addEventListener('click', function () {
        els.q.value = ''; els.region.value = ''; els.type.value = '';
        resetPaging();
    });

    fetch(CSV_URL)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (text) {
            predictors = build(parseCSV(text));
            els.total.textContent = predictors.length;
            fillSelect(els.region, predictors.map(function (p) { return p.region; }));
            fillSelect(els.type, predictors.map(function (p) { return p.type; }));
            render();
        })
        .catch(function () {
            els.count.textContent = 'Sorry, the data could not be loaded. Please try again later.';
        });
})();

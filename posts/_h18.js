(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const base = 'https://raw.githubusercontent.com/dn0710sh-art/blog-images/main/posts/';
  const mo = (el, t, extra = {}) => {
    const r = el.getBoundingClientRect();
    const W = el.ownerDocument.defaultView;
    const o = Object.assign({ bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, view: W }, extra);
    el.dispatchEvent(t.startsWith('pointer') ? new W.PointerEvent(t, o) : new W.MouseEvent(t, o));
  };
  const fullClick = (el) => {
    el.focus && el.focus();
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'pointermove', 'pointerdown', 'mousedown']) mo(el, t);
    for (const t of ['pointerup', 'mouseup', 'click']) mo(el, t);
  };
  async function waitFor(fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { let v = null; try { v = fn(); } catch (e) {} if (v) return v; await sleep(200); } return null; }
  const hash = (t) => { let x = 5381; for (let i = 0; i < t.length; i++) x = (((x * 33) ^ t.charCodeAt(i)) >>> 0); return x.toString(16); };
  const jget = async (u) => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r; };

  // 建立 gid -> 痞客邦文章ID 對照（用現有標題 hash 對 _hm.json）
  window.__buildMap = async () => {
    const hm = await (await jget(base + '_hm.json?' + Date.now())).json();
    const map = {}; let n = 0, page = 1, total = 0;
    while (page < 200) {
      let j = null;
      for (let k = 0; k < 4 && !j; k++) {
        try { const r = await fetch('/api/posts/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ page }), credentials: 'include' }); if (r.ok) j = await r.json(); } catch (e) {}
        if (!j) await sleep(1500);
      }
      if (!j) return 'search failed at page ' + page;
      const rows = j._data || [];
      if (!rows.length) break;
      for (const p of rows) { total++; const g = hm[hash(p.title)]; if (g !== undefined) { if (map[g]) map[g + '_dup'] = p.id; else { map[g] = p.id; n++; } } }
      page++;
    }
    window.__map = map; window.__mapTotal = total;
    try { localStorage.setItem('upd_map', JSON.stringify(map)); } catch (e) {}
    return JSON.stringify({ posts: total, mapped: n, dup: Object.keys(map).filter(k => k.endsWith('_dup')).length });
  };

  async function updOne(id, gid) {
    const out = { gid: String(gid), id: String(id) };
    let f = null;
    try {
      const meta = await (await jget(base + 't_' + gid + '.json')).json();
      const html = await (await jget(base + 't_' + gid + '.html')).text();
      const cur = await (await fetch('/api/posts/' + id, { credentials: 'include' })).json();
      out.old = cur.title;
      const cs = (x) => (x && x.contents && typeof x.contents === 'object' ? x.contents.contents : x && x.contents) || '';
      if (cur.title === meta.title && cs(cur).includes('rel="nofollow sponsored noopener"') && cs(cur).includes('2027') && !cs(cur).includes('數據更新時間')) { out.same = true; out.done = true; return out; }
      f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:0;top:0;width:1400px;height:900px;opacity:0.01;pointer-events:none;border:0';
      f.src = '/posts/' + id; document.body.appendChild(f);
      const d = () => f.contentDocument;
      const ok = await waitFor(() => d() && d().readyState === 'complete' && d().querySelector('.jodit-wysiwyg') && d().querySelector('.ace_editor, .jodit-toolbar-button_source') && d().querySelector('textarea[placeholder="請輸入文章標題"]') && d().querySelectorAll('button[role=combobox]').length >= 4 && ![...d().querySelectorAll('button[role=combobox]')].slice(0, 4).some(b => /載入中/.test(b.innerText)), 60000);
      if (!ok) { out.err = 'editor not ready'; out.retry = true; return out; }
      await sleep(1500);
      const W = f.contentWindow;
      const srcBtn = () => d().querySelector('.jodit-toolbar-button_source button') || d().querySelector('.jodit-toolbar-button_source');
      srcBtn().click(); await sleep(600);
      const aceEl = d().querySelector('.ace_editor');
      if (!aceEl) { out.err = 'no ace'; return out; }
      const ace = W.ace.edit(aceEl);
      ace.setValue(html, -1); await sleep(400);
      srcBtn().click(); await sleep(1000);
      const imgs = d().querySelector('.jodit-wysiwyg').querySelectorAll('img').length;
      out.imgs = imgs;
      const t = d().querySelector('textarea[placeholder="請輸入文章標題"]');
      Object.getOwnPropertyDescriptor(W.HTMLTextAreaElement.prototype, 'value').set.call(t, meta.title);
      t.dispatchEvent(new W.Event('input', { bubbles: true }));
      await sleep(500);
      if (t.value !== meta.title) { out.err = 'title set failed'; return out; }
      if (imgs < 1 && html.indexOf('<img') >= 0) { out.err = 'imgs not parsed'; return out; }
      const pb = [...d().querySelectorAll('button[type=submit]')].find(b => b.innerText.trim() === '發佈');
      if (!pb) { out.err = 'no publish btn'; return out; }
      fullClick(pb);
      let c2 = null;
      for (let i = 0; i < 50; i++) {
        await sleep(500);
        try { c2 = await (await fetch('/api/posts/' + id, { credentials: 'include' })).json(); } catch (e) {}
        if (c2 && c2.title === meta.title && cs(c2) !== cs(cur)) break;
      }
      out.status = c2 && c2.status;
      out.done = !!(c2 && c2.title === meta.title && cs(c2) !== cs(cur) && c2.status === 'active');
      if (c2) { out.newImgs = (cs(c2).match(/<img/g) || []).length; out.newLen = cs(c2).length; }
    } catch (e) { out.err = String(e); }
    finally { if (f) f.remove(); }
    return out;
  }

  window.__uResults = JSON.parse(localStorage.getItem('upd_results') || '[]');
  window.__updLoop = async (gids, pause = 3500) => {
    if (window.__uRunning) return 'already running';
    window.__uRunning = true; window.__uStop = false; window.__uHalt = null; let bad = 0;
    for (const gid of gids) {
      if (window.__uStop) { window.__uHalt = 'stopped'; break; }
      if (document.visibilityState === 'hidden') { window.__uHalt = 'page hidden'; break; }
      if (window.__uResults.some(r => r.gid === String(gid) && r.done)) continue;
      const id = window.__map[gid];
      if (!id) { window.__uResults.push({ gid: String(gid), err: 'no post id', skip: true }); continue; }
      let r = await updOne(id, gid);
      if (r.retry) { await sleep(3000); r = await updOne(id, gid); }
      window.__uResults.push(r);
      try { localStorage.setItem('upd_results', JSON.stringify(window.__uResults.filter(x => x.done).map(x => ({ gid: x.gid, done: true })).concat(window.__uResults.filter(x => !x.done).slice(-50)))); } catch (e) {}
      if (r.done) bad = 0; else if (++bad >= 3) { window.__uHalt = '3 consecutive failures'; break; }
      await sleep(pause);
    }
    window.__uRunning = false;
    return 'update loop ended: ' + (window.__uHalt || 'finished');
  };
  window.__uStatus = () => {
    const rs = window.__uResults;
    return JSON.stringify({ running: !!window.__uRunning, halt: window.__uHalt, done: rs.filter(r => r.done).length, same: rs.filter(r => r.same).length, fail: rs.filter(r => !r.done && !r.skip).length, last: rs.slice(-2), fails: rs.filter(r => !r.done && !r.skip).map(r => r.gid + ':' + (r.err || r.status || '?')).slice(-8) });
  };
  return 'h18 loaded';
})()

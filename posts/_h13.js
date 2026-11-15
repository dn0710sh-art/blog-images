(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const base = 'https://raw.githubusercontent.com/dn0710sh-art/blog-images/main/posts/';
  const mo = (el, t, extra = {}) => {
    const r = el.getBoundingClientRect();
    const o = Object.assign({ bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, view: el.ownerDocument.defaultView }, extra);
    const W = el.ownerDocument.defaultView;
    el.dispatchEvent(t.startsWith('pointer') ? new W.PointerEvent(t, o) : new W.MouseEvent(t, o));
  };
  const fullClick = (el) => {
    el.focus && el.focus();
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'pointermove', 'pointerdown', 'mousedown']) mo(el, t);
    for (const t of ['pointerup', 'mouseup', 'click']) mo(el, t);
  };
  async function waitFor(fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { let v = null; try { v = fn(); } catch (e) {} if (v) return v; await sleep(200); } return null; }
  async function editOne(id, newTitle) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;width:1400px;height:900px;opacity:0.01;pointer-events:none;border:0';
    f.src = '/posts/' + id; document.body.appendChild(f);
    const out = { id };
    try {
      const d = () => f.contentDocument;
      const ok = await waitFor(() => d() && d().readyState === 'complete' && d().querySelector('.jodit-wysiwyg') && d().querySelector('textarea[placeholder="請輸入文章標題"]') && d().querySelectorAll('button[role=combobox]').length >= 4, 40000);
      if (!ok) { out.err = 'editor not ready'; out.retry = true; return out; }
      await sleep(1500);
      const t = d().querySelector('textarea[placeholder="請輸入文章標題"]');
      out.old = t.value;
      if (t.value === newTitle) { out.same = true; out.done = true; return out; }
      const W = f.contentWindow;
      Object.getOwnPropertyDescriptor(W.HTMLTextAreaElement.prototype, 'value').set.call(t, newTitle);
      t.dispatchEvent(new W.Event('input', { bubbles: true }));
      await sleep(500);
      if (t.value !== newTitle) { out.err = 'set failed'; return out; }
      const pb = [...d().querySelectorAll('button[type=submit]')].find(b => b.innerText.trim() === '發佈');
      if (!pb) { out.err = 'no publish btn'; return out; }
      fullClick(pb);
      let cur = null;
      for (let i = 0; i < 40 && cur !== newTitle; i++) {
        await sleep(500);
        try { const j = await (await fetch('/api/posts/' + id, { credentials: 'include' })).json(); cur = j.title; out.status = j.status; } catch (e) {}
      }
      out.done = cur === newTitle;
    } catch (e) { out.err = String(e); }
    finally { f.remove(); }
    return out;
  }
  window.__editLoop = async (items, pause = 4000) => {   // items: [[id, title], ...]
    if (window.__eRunning) return 'already running';
    window.__eRunning = true; window.__eStop = false; window.__eHalt = null; let bad = 0;
    window.__eResults = window.__eResults || [];
    for (const [id, title] of items) {
      if (window.__eStop) { window.__eHalt = 'stopped'; break; }
      if (window.__eResults.some(r => r.id === id && r.done)) continue;
      let r = await editOne(id, title);
      if (r.retry) { await sleep(3000); r = await editOne(id, title); }
      window.__eResults.push(r);
      if (r.done) bad = 0; else if (++bad >= 3) { window.__eHalt = '3 consecutive failures'; break; }
      await sleep(pause);
    }
    window.__eRunning = false; return 'edit loop ended: ' + (window.__eHalt || 'finished');
  };
  window.__eStatus = () => { const rs = window.__eResults || []; return JSON.stringify({ running: !!window.__eRunning, halt: window.__eHalt, done: rs.filter(r => r.done).length, fail: rs.filter(r => !r.done).length, last: rs.slice(-2), fails: rs.filter(r => !r.done).map(r => r.id + ':' + (r.err || '')).slice(-6) }); };
  return 'h13';
})()

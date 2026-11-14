(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const base = 'https://raw.githubusercontent.com/dn0710sh-art/blog-images/main/posts/';
  const mo = (el, t, extra = {}) => {
    const r = el.getBoundingClientRect();
    const o = Object.assign({ bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, view: window }, extra);
    el.dispatchEvent(t.startsWith('pointer') ? new PointerEvent(t, o) : new MouseEvent(t, o));
  };
  const fullClick = (el) => {
    el.focus && el.focus();
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'pointermove', 'pointerdown', 'mousedown']) mo(el, t);
    for (const t of ['pointerup', 'mouseup', 'click']) mo(el, t);
  };
  const setNative = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  async function waitFor(fn, ms = 15000) {
    const t = Date.now();
    while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(200); }
    return null;
  }
  async function pick(idx, text, search) {
    const cb = [...document.querySelectorAll('button[role=combobox]')][idx];
    if (!cb) return 'nocb' + idx;
    if (cb.innerText.trim() === text) return 'already';
    cb.scrollIntoView({ block: 'center' }); await sleep(200);
    for (let attempt = 0; attempt < 3 && cb.getAttribute('aria-expanded') !== 'true'; attempt++) {
      fullClick(cb); await sleep(600);
    }
    if (cb.getAttribute('aria-expanded') !== 'true') return 'noopen' + idx;
    if (search) {
      const si = await waitFor(() => [...document.querySelectorAll('input')].find(i => /搜尋/.test(i.placeholder || '') && i.offsetParent), 3000);
      if (si) { setNative(si, search); await sleep(500); }
    }
    const o = await waitFor(() => [...document.querySelectorAll('[role=option]')].find(o => o.innerText.trim() === text), 4000);
    if (!o) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'nooption:' + text; }
    fullClick(o); await sleep(500);
    return cb.innerText.trim();
  }
  // 步驟A：貼內容、標題、標籤
  window.__stepA = async (gid) => {
    const log = [];
    const meta = await (await fetch(base + gid + '.json', { cache: 'no-store' })).json();
    const html = await (await fetch(base + gid + '.html', { cache: 'no-store' })).text();
    const ed = await waitFor(() => document.querySelector('.jodit-wysiwyg'), 15000);
    if (!ed) return JSON.stringify({ err: 'no editor' });
    const srcBtn = () => document.querySelector('.jodit-toolbar-button_source button') || document.querySelector('.jodit-toolbar-button_source');
    srcBtn().click(); await sleep(500);
    const ace = window.ace.edit(document.querySelector('.ace_editor'));
    ace.setValue(html, -1); await sleep(300);
    srcBtn().click(); await sleep(900);
    log.push('imgs ' + ed.querySelectorAll('img').length + ' html ' + html.length);
    const t = document.querySelector('textarea[placeholder="請輸入文章標題"]');
    setNative(t, meta.title); await sleep(200);
    const ti = document.querySelector('input[placeholder="+ 新增標籤"]');
    for (const tag of meta.tags) {
      ti.focus(); setNative(ti, tag); await sleep(120);
      for (const ty of ['keydown', 'keypress', 'keyup'])
        ti.dispatchEvent(new KeyboardEvent(ty, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      await sleep(220);
    }
    setNative(ti, '');
    log.push('title ' + t.value.length + ' tags ' + meta.tags.length);
    return JSON.stringify({ log });
  };
  // 步驟B：四個下拉設定→檢查→發佈
  window.__stepB = async (gid, doPublish = true) => {
    const res = { gid };
    try {
      const log = [];
      log.push(await pick(0, '我最愛蝦皮好物', '蝦皮'));
      log.push(await pick(1, '生活綜合', '生活綜合'));
      log.push(await pick(2, '生活綜合', '生活綜合'));
      log.push(await pick(3, '公開'));
      const cb = [...document.querySelectorAll('button[role=combobox]')].map(b => b.innerText.trim());
      res.cb = cb.slice(0, 4).join('|');
      const t = document.querySelector('textarea[placeholder="請輸入文章標題"]').value;
      const imgs = document.querySelector('.jodit-wysiwyg').querySelectorAll('img').length;
      res.imgs = imgs; res.titleLen = t.length; res.id = location.pathname.split('/').pop();
      const good = cb[0] === '我最愛蝦皮好物' && cb[1] === '生活綜合' && cb[2] === '生活綜合' && cb[3] === '公開' && t.length > 5 && imgs > 0;
      if (!good) { res.err = 'check failed ' + log.join(','); return JSON.stringify(res); }
      if (!doPublish) return JSON.stringify(res);
      const pb = [...document.querySelectorAll('button[type=submit]')].find(b => b.innerText.trim() === '發佈');
      if (!pb) { res.err = 'no publish btn'; return JSON.stringify(res); }
      fullClick(pb);
      let st = null;
      for (let i = 0; i < 40 && st !== 'active'; i++) {
        await sleep(500);
        try { st = (await (await fetch('/api/posts/' + res.id, { credentials: 'include' })).json()).status; } catch (e) {}
      }
      res.published = st === 'active';
      if (res.published) res.url = 'https://ccclovegreentea.pixnet.net/blog/posts/' + res.id;
    } catch (e) { res.err = String(e); }
    return JSON.stringify(res);
  };
  window.__runAll = async (gid) => {
    const ok = await waitFor(() => /\/posts\/\d+$/.test(location.pathname) && document.querySelector('.jodit-wysiwyg') && document.querySelectorAll('button[role=combobox]').length >= 7, 20000);
    if (!ok) return JSON.stringify({ gid, err: 'editor not ready ' + location.pathname });
    await sleep(600);
    const a = JSON.parse(await window.__stepA(String(gid)));
    if (a.err) return JSON.stringify({ gid, err: a.err });
    return await window.__stepB(String(gid), true);
  };
  window.__start = async () => {
    const b = await waitFor(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '開始寫文章'), 15000);
    if (!b) return 'no start btn';
    await sleep(1800);
    fullClick(b);
    return 'start clicked';
  };
  return 'helper loaded';
})()

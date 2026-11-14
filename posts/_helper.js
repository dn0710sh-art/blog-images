(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const base = 'https://raw.githubusercontent.com/dn0710sh-art/blog-images/main/posts/';
  const ptr = (el, t) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }));
  const setNative = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  async function waitFor(fn, ms = 15000) {
    const t = Date.now();
    while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(250); }
    return null;
  }
  async function pick(idx, text, search) {
    const cb = [...document.querySelectorAll('button[role=combobox]')][idx];
    if (!cb) return 'nocb' + idx;
    if (cb.innerText.trim() === text) return 'already';
    cb.scrollIntoView({ block: 'center' }); await sleep(150);
    ptr(cb, 'pointerdown'); await sleep(450);
    if (search) {
      const si = await waitFor(() => [...document.querySelectorAll('input')].find(i => /搜尋/.test(i.placeholder || '') && i.offsetParent));
      if (si) { setNative(si, search); await sleep(450); }
    }
    const o = await waitFor(() => [...document.querySelectorAll('[role=option]')].find(o => o.innerText.trim() === text), 4000);
    if (!o) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'nooption:' + text; }
    for (const e of ['pointerdown', 'pointerup']) ptr(o, e);
    o.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    o.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(450);
    return cb.innerText.trim();
  }
  window.__fill = async (gid, o = {}) => {
    const log = [];
    const meta = await (await fetch(base + gid + '.json', { cache: 'no-store' })).json();
    const html = await (await fetch(base + gid + '.html', { cache: 'no-store' })).text();
    log.push('fetched ' + html.length);
    const ed = await waitFor(() => document.querySelector('.jodit-wysiwyg'));
    if (!ed) return JSON.stringify({ log: ['no editor'], cb: [] });
    const srcBtn = () => document.querySelector('.jodit-toolbar-button_source button') || document.querySelector('.jodit-toolbar-button_source');
    srcBtn().click(); await sleep(500);
    const ace = window.ace.edit(document.querySelector('.ace_editor'));
    ace.setValue(html, -1); await sleep(300);
    srcBtn().click(); await sleep(900);
    log.push('imgs ' + ed.querySelectorAll('img').length + ' len ' + ed.innerHTML.length);
    const t = document.querySelector('textarea[placeholder="請輸入文章標題"]');
    setNative(t, meta.title); await sleep(200);
    log.push('title ' + t.value.length);
    const ti = document.querySelector('input[placeholder="+ 新增標籤"]');
    for (const tag of meta.tags) {
      ti.focus(); setNative(ti, tag); await sleep(150);
      for (const ty of ['keydown', 'keypress', 'keyup'])
        ti.dispatchEvent(new KeyboardEvent(ty, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      await sleep(250);
    }
    log.push('tags ' + meta.tags.length);
    log.push(await pick(0, '我最愛蝦皮好物', '蝦皮'));
    log.push(await pick(1, '生活綜合', '生活綜合'));
    log.push(await pick(2, '生活綜合', '生活綜合'));
    log.push(await pick(3, '公開'));
    return JSON.stringify({ log, cb: [...document.querySelectorAll('button[role=combobox]')].map(b => b.innerText.trim()) });
  };
  window.__pub = async (gid) => {
    const res = { gid };
    try {
      const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === '/posts/create');
      if (!a) { res.err = 'no create link'; return JSON.stringify(res); }
      a.click();
      const sb = await waitFor(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '開始寫文章'), 10000);
      if (sb) sb.click();
      const ok = await waitFor(() => /\/posts\/\d+$/.test(location.pathname) && document.querySelector('.jodit-wysiwyg') && document.querySelectorAll('button[role=combobox]').length >= 7, 20000);
      if (!ok) { res.err = 'editor not ready ' + location.pathname; return JSON.stringify(res); }
      res.id = location.pathname.split('/').pop(); await sleep(800);
      const f = JSON.parse(await window.__fill(String(gid)));
      res.log = f.log.join(' / '); res.cb = f.cb.slice(0, 4).join('|');
      const t = document.querySelector('textarea[placeholder="請輸入文章標題"]').value;
      const imgs = document.querySelector('.jodit-wysiwyg').querySelectorAll('img').length;
      res.imgs = imgs; res.titleLen = t.length;
      const good = f.cb[0] === '我最愛蝦皮好物' && f.cb[1] === '生活綜合' && f.cb[2] === '生活綜合' && f.cb[3] === '公開' && t.length > 5 && imgs > 0;
      if (!good) { res.err = 'check failed'; return JSON.stringify(res); }
      const ti = document.querySelector('input[placeholder="+ 新增標籤"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(ti, '');
      ti.dispatchEvent(new Event('input', { bubbles: true })); await sleep(300);
      const pb = [...document.querySelectorAll('button[type=submit]')].find(b => b.innerText.trim() === '發佈');
      if (!pb) { res.err = 'no publish btn'; return JSON.stringify(res); }
      pb.click();
      const done = await waitFor(() => /文章已發布/.test(document.body.innerText), 20000);
      res.published = !!done;
      if (done) res.url = 'https://ccclovegreentea.pixnet.net/blog/posts/' + res.id;
      await sleep(1200);
    } catch (e) { res.err = String(e); }
    return JSON.stringify(res);
  };
  return 'helper loaded';
})()

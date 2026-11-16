// ==UserScript==
// @name         Backstabbr Player Names
// @namespace    backstabbr-player-names
// @version      1.0.1
// @description  Shows who is playing each country next to every country name on Backstabbr, with optional custom nicknames.
// @match        https://www.backstabbr.com/game/*
// @match        https://backstabbr.com/game/*
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/Timothy-Guyon/backstabbr-player-names
// @updateURL    https://raw.githubusercontent.com/Timothy-Guyon/backstabbr-player-names/main/backstabbr-player-names.user.js
// @downloadURL  https://raw.githubusercontent.com/Timothy-Guyon/backstabbr-player-names/main/backstabbr-player-names.user.js
// ==/UserScript==

(() => {
  'use strict';

  const match = location.pathname.match(/^\/game\/[^/]+\/(\d+)/);
  if (!match) return;
  const gameId = match[1];
  const basePath = location.pathname.split('/').slice(0, 4).join('/');

  // ---------- storage (per browser, on backstabbr.com) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('bsx:' + key); return v == null ? fallback : JSON.parse(v); }
      catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('bsx:' + key, JSON.stringify(value)); } catch (_) {}
    },
  };

  let players = store.get('players:' + gameId, {}); // country -> username, e.g. { Germany: "Player#1234" }
  let nicknames = store.get('nicknames', {});       // username -> nickname (follows a friend across games)
  let enabled = store.get('enabled', true);
  let regex = null;

  // ---------- styles ----------
  const style = document.createElement('style');
  style.textContent = `
    .bsx-country[data-bsx-label]::after {
      content: "(" attr(data-bsx-label) ")";
      margin-left: .3em; font-size: .85em; font-weight: normal; font-style: normal;
      opacity: .75; white-space: nowrap;
    }
    html.bsx-off .bsx-country::after { content: none !important; }

    .bsx-fab {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
      border: 0; border-radius: 999px; padding: 10px 14px;
      background: #1f2937; color: #fff; font: 600 13px/1 system-ui, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,.3); cursor: pointer;
    }
    .bsx-panel {
      position: fixed; right: 16px; bottom: 64px; z-index: 2147483001;
      width: min(320px, calc(100vw - 32px)); max-height: 70vh; overflow: auto;
      background: #fff; color: #222; border-radius: 10px; padding: 12px;
      box-shadow: 0 6px 24px rgba(0,0,0,.3); font: 13px/1.4 system-ui, sans-serif;
    }
    .bsx-panel[hidden] { display: none; }
    .bsx-panel h2 { font-size: 14px; margin: 0 0 8px; display: flex; justify-content: space-between; align-items: center; }
    .bsx-panel h2 button { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: #666; padding: 0 4px; }
    .bsx-panel label.bsx-toggle { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; }
    .bsx-panel .bsx-row { display: grid; grid-template-columns: 70px 1fr; gap: 2px 8px; align-items: center; margin-bottom: 8px; }
    .bsx-panel .bsx-c { font-weight: 600; }
    .bsx-panel .bsx-u { grid-column: 2; color: #777; font-size: 11px; }
    .bsx-panel input[type=text] {
      width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 16px; /* 16px stops iOS zoom */
      border: 1px solid #ccc; border-radius: 6px; background: #fff; color: #222;
    }
    .bsx-panel .bsx-hint { color: #777; font-size: 11px; margin-top: 4px; }
  `;
  document.head.append(style);

  // ---------- annotation ----------
  const SKIP = 'script,style,noscript,textarea,select,option,svg,[contenteditable=""],[contenteditable="true"],.bsx-country,.bsx-panel,.bsx-fab';
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shortName = (u) => u.replace(/\s*#\d+\s*$/, '').trim();
  const labelFor = (country) => {
    const u = players[country];
    return u ? (nicknames[u] || shortName(u)) : null;
  };

  function buildRegex() {
    const names = Object.keys(players).sort((a, b) => b.length - a.length).map(esc);
    regex = names.length ? new RegExp(`\\b(${names.join('|')})\\b`, 'g') : null;
  }

  // The Info tab's player list ("Player#1234 — Germany") already names the player.
  const inPlayerList = (el) => {
    const li = el.closest('li');
    return !!(li && li.querySelector('a[href^="/member/"]'));
  };

  function annotate(root) {
    if (!regex || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];
    let n;
    while ((n = walker.nextNode())) {
      regex.lastIndex = 0;
      if (!n.nodeValue || !regex.test(n.nodeValue)) continue;
      const p = n.parentElement;
      if (!p || p.closest(SKIP) || inPlayerList(p)) continue;
      targets.push(n);
    }
    for (const node of targets) {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      regex.lastIndex = 0;
      while ((m = regex.exec(text))) {
        if (m.index > last) frag.append(text.slice(last, m.index));
        const span = document.createElement('span');
        span.className = 'bsx-country';
        span.dataset.country = m[1];
        const label = labelFor(m[1]);
        if (label) span.dataset.bsxLabel = label;
        span.textContent = m[1];
        frag.append(span);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.append(text.slice(last));
      node.replaceWith(frag);
    }
  }

  function refreshLabels() {
    document.documentElement.classList.toggle('bsx-off', !enabled);
    document.querySelectorAll('.bsx-country').forEach((el) => {
      const label = labelFor(el.dataset.country);
      if (label) el.dataset.bsxLabel = label;
      else delete el.dataset.bsxLabel;
    });
  }

  // ---------- players ----------
  function parsePlayers(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = {};
    doc.querySelectorAll('li').forEach((li) => {
      const a = li.querySelector('a[href^="/member/"]');
      if (!a) return;
      const icon = li.querySelector('i');
      let country = icon && [...icon.classList].find((c) => !/^fa/.test(c));
      if (!country) country = (li.textContent.split('—')[1] || '').trim().split(/\s+/)[0];
      if (country) result[country] = a.textContent.trim();
    });
    return result;
  }

  function setPlayers(p) {
    if (!p || !Object.keys(p).length) return;
    players = p;
    buildRegex();
    annotate(document.body);
    refreshLabels();
    renderPanel();
  }

  async function loadPlayers() {
    try {
      const res = await fetch(`${basePath}/ajax/info`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const fresh = parsePlayers(await res.text());
      if (Object.keys(fresh).length) {
        store.set('players:' + gameId, fresh);
        setPlayers(fresh);
      }
    } catch (e) {
      console.warn('[Backstabbr Player Names] could not load players', e);
    }
  }

  // ---------- settings panel ----------
  const fab = document.createElement('button');
  fab.className = 'bsx-fab';
  fab.type = 'button';
  fab.textContent = 'Names';
  fab.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'bsx-panel';
  panel.hidden = true;

  fab.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  document.body.append(panel, fab);

  function renderPanel() {
    fab.hidden = !Object.keys(players).length;
    panel.textContent = '';

    const h = document.createElement('h2');
    h.textContent = 'Player names';
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => { panel.hidden = true; });
    h.append(close);

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'bsx-toggle';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = enabled;
    toggle.addEventListener('change', () => {
      enabled = toggle.checked;
      store.set('enabled', enabled);
      refreshLabels();
    });
    toggleLabel.append(toggle, 'Show player names');

    panel.append(h, toggleLabel);

    for (const [country, user] of Object.entries(players).sort()) {
      const row = document.createElement('div');
      row.className = 'bsx-row';
      const c = document.createElement('span');
      c.className = 'bsx-c';
      c.textContent = country;
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = shortName(user);
      input.value = nicknames[user] || '';
      input.addEventListener('input', () => {
        const v = input.value.trim();
        if (v) nicknames[user] = v; else delete nicknames[user];
        store.set('nicknames', nicknames);
        refreshLabels();
      });
      const u = document.createElement('span');
      u.className = 'bsx-u';
      u.textContent = user;
      row.append(c, input, u);
      panel.append(row);
    }

    const hint = document.createElement('div');
    hint.className = 'bsx-hint';
    hint.textContent = 'Leave blank to use their Backstabbr username. Nicknames apply in all your games on this browser.';
    panel.append(hint);
  }

  // ---------- keep up with page changes ----------
  let pending = null;
  new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => { pending = null; annotate(document.body); }, 100);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  // Pick up nickname edits made in another tab.
  window.addEventListener('storage', (e) => {
    if (e.key === 'bsx:nicknames' || e.key === 'bsx:enabled') {
      nicknames = store.get('nicknames', {});
      enabled = store.get('enabled', true);
      refreshLabels();
      renderPanel();
    }
  });

  buildRegex();
  annotate(document.body);
  refreshLabels();
  renderPanel();
  loadPlayers();
})();

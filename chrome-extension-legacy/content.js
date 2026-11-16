(() => {
  const match = location.pathname.match(/^\/game\/[^/]+\/(\d+)/);
  if (!match) return;
  const gameId = match[1];
  const basePath = location.pathname.split('/').slice(0, 4).join('/');

  let players = {};    // country -> backstabbr username, e.g. { Germany: "Player#1234" }
  let nicknames = {};  // username -> custom nickname (global, follows a friend across games)
  let enabled = true;
  let regex = null;

  const SKIP = 'script,style,noscript,textarea,select,option,svg,[contenteditable=""],[contenteditable="true"],.bsx-country';
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
  }

  async function loadPlayers() {
    const key = `players:${gameId}`;
    const cached = (await chrome.storage.local.get(key))[key];
    if (cached) setPlayers(cached);
    try {
      const res = await fetch(`${basePath}/ajax/info`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const fresh = parsePlayers(await res.text());
      if (Object.keys(fresh).length) {
        await chrome.storage.local.set({ [key]: fresh });
        setPlayers(fresh);
      }
    } catch (e) {
      console.warn('[Backstabbr Player Names] could not load players', e);
    }
  }

  let pending = null;
  new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => { pending = null; annotate(document.body); }, 100);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.nicknames) nicknames = changes.nicknames.newValue || {};
    if (changes.enabled) enabled = changes.enabled.newValue !== false;
    refreshLabels();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, send) => {
    if (msg && msg.type === 'bsx:getPlayers') send({ gameId, players });
  });

  chrome.storage.sync.get(['nicknames', 'enabled']).then((s) => {
    nicknames = s.nicknames || {};
    enabled = s.enabled !== false;
    refreshLabels();
    loadPlayers();
  });
})();

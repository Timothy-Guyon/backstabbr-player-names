const shortName = (u) => u.replace(/\s*#\d+\s*$/, '').trim();

(async () => {
  const { nicknames = {}, enabled } = await chrome.storage.sync.get(['nicknames', 'enabled']);
  const toggle = document.getElementById('enabled');
  toggle.checked = enabled !== false;
  toggle.addEventListener('change', () => chrome.storage.sync.set({ enabled: toggle.checked }));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let data;
  try { data = await chrome.tabs.sendMessage(tab.id, { type: 'bsx:getPlayers' }); } catch (_) {}
  const content = document.getElementById('content');
  if (!data || !Object.keys(data.players || {}).length) return;

  content.className = '';
  content.textContent = '';
  const table = document.createElement('table');
  let timer;
  for (const [country, user] of Object.entries(data.players).sort()) {
    const tr = table.insertRow();
    const c = tr.insertCell(); c.className = 'country'; c.textContent = country;
    const cell = tr.insertCell();
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = shortName(user);
    input.value = nicknames[user] || '';
    input.addEventListener('input', () => {
      const v = input.value.trim();
      if (v) nicknames[user] = v; else delete nicknames[user];
      clearTimeout(timer);
      timer = setTimeout(() => chrome.storage.sync.set({ nicknames }), 250);
    });
    cell.append(input);
    const u = tr.insertCell(); u.className = 'user'; u.textContent = user;
  }
  content.append(table);
})();

// Picona — content script (runs on every page)
// Sider-style floating selection toolbar

let toolbar = null;
let lastSelection = '';

function removeToolbar() {
  if (toolbar) { toolbar.remove(); toolbar = null; }
}

function buildToolbar(x, y, text) {
  removeToolbar();
  toolbar = document.createElement('div');
  toolbar.id = '__picona_toolbar';

  const actions = [
    { id: 'picona-explain',  label: 'Explicar',  icon: '💡' },
    { id: 'picona-translate',label: 'Traducir',  icon: '🌐' },
    { id: 'picona-summarize-sel', label: 'Resumir', icon: '📄' },
    { id: 'picona-memo',     label: 'Memo',      icon: '📌' },
    { id: 'picona-ask',      label: 'Preguntar', icon: '💬' }
  ];

  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = '__picona_btn';
    btn.type = 'button';
    btn.innerHTML = `<span>${a.icon}</span> ${a.label}`;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      // Port connections preserve the user-gesture context for
      // sidePanel.open() far more reliably than runtime.sendMessage
      // (see crbug.com/40929586).
      try {
        const port = chrome.runtime.connect({ name: 'picona-toolbar' });
        port.postMessage({
          type: a.id, text,
          sourceUrl: location.href, sourceTitle: document.title
        });
      } catch (err) {
        console.error('Picona: error al conectar con el background —', err);
      }
      removeToolbar();
    });
    toolbar.appendChild(btn);
  });

  document.body.appendChild(toolbar);

  // Position (clamp to viewport)
  const rect = toolbar.getBoundingClientRect();
  let left = x - rect.width / 2;
  let top = y - rect.height - 10;
  left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8));
  if (top < 8) top = y + 18;
  toolbar.style.left = `${left + window.scrollX}px`;
  toolbar.style.top = `${top + window.scrollY}px`;
}

document.addEventListener('mouseup', (e) => {
  // Ignore clicks on our own toolbar
  if (toolbar && toolbar.contains(e.target)) return;

  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() || '';
    if (text && text.length > 1) {
      lastSelection = text;
      chrome.storage.session.set({ selectedText: text }).catch(() => {});
      buildToolbar(e.clientX, e.clientY, text);
    } else {
      removeToolbar();
    }
  }, 5);
});

document.addEventListener('mousedown', (e) => {
  if (toolbar && !toolbar.contains(e.target)) removeToolbar();
});
window.addEventListener('scroll', removeToolbar, true);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') removeToolbar(); });

// Inject toolbar styles
const style = document.createElement('style');
style.textContent = `
#__picona_toolbar {
  position: absolute; z-index: 2147483647;
  display: flex; gap: 4px;
  background: rgba(29,29,31,.95);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  padding: 5px;
  box-shadow: 0 4px 16px rgba(0,0,0,.25);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  animation: __picona_in .12s ease;
}
@keyframes __picona_in {
  from { opacity: 0; transform: translateY(4px) scale(.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.__picona_btn {
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; border-radius: 6px;
  color: #fff; font-size: 12.5px; font-weight: 500;
  padding: 6px 10px; cursor: pointer; white-space: nowrap;
  transition: background .12s;
}
.__picona_btn:hover { background: rgba(255,255,255,.15); }
.__picona_btn span { font-size: 13px; }
`;
document.documentElement.appendChild(style);

// Respond to messages from sidepanel / background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SELECTION') {
    sendResponse({ text: window.getSelection()?.toString().trim() || lastSelection || '' });
    return true;
  }
  if (msg.type === 'GET_PAGE_TEXT') {
    sendResponse({
      title: document.title,
      url: location.href,
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50000)
    });
    return true;
  }
});

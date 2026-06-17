// ─── Picona · background.js (v1.1) ─────────────────────────────

// ── Open side panel on icon click ──────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  try { await chrome.sidePanel.open({ tabId: tab.id }); }
  catch (e) { console.error('Picona:', e); }
});

// ── Context menus ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    const items = [
      { id: 'picona-explain',   title: 'Explicar con Picona ✦',           contexts: ['selection'] },
      { id: 'picona-translate', title: 'Traducir con Picona ✦',           contexts: ['selection'] },
      { id: 'picona-research',  title: 'Investigar esto con Picona ✦',    contexts: ['selection'] },
      { id: 'picona-memo',      title: 'Guardar como memo ✦',             contexts: ['selection'] },
      { id: 'picona-summarize', title: 'Resumir esta página con Picona ✦', contexts: ['page'] }
    ];
    items.forEach(i => chrome.contextMenus.create(i));
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try { await chrome.sidePanel.open({ tabId: tab.id }); } catch {}
  await chrome.storage.session.set({
    pendingAction: { type: info.menuItemId, text: info.selectionText || '',
                     tabId: tab.id, sourceUrl: tab.url || '', sourceTitle: tab.title || '',
                     timestamp: Date.now() }
  });
});

// ── Injection function (self-contained, no closure deps) ────────
// (inyección de suscripción web eliminada en v2.6)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Page content extraction
  if (msg.type === 'GET_PAGE_CONTENT') {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      func: () => ({
        title: document.title, url: location.href,
        content: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50000),
        metaDesc: document.querySelector('meta[name="description"]')?.content || ''
      })
    }).then(res => sendResponse(res?.[0]?.result
        ? { success: true, data: res[0].result }
        : { success: false, error: 'Sin contenido' }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }


  // ── YouTube: extraer transcripción del video de la pestaña ──────
  if (msg.type === 'GET_YT_TRANSCRIPT') {
    (async () => {
      try {
        const tabId = msg.tabId;
        // Ejecutar en el mundo MAIN para acceder a ytInitialPlayerResponse
        const res = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: async () => {
            try {
              // 1) Obtener playerResponse (variable global o re-fetch del HTML)
              let pr = window.ytInitialPlayerResponse;
              const urlId = new URLSearchParams(location.search).get('v');
              if (!pr || pr?.videoDetails?.videoId !== urlId) {
                // SPA: la variable puede ser de un video anterior → re-obtener
                const html = await fetch(location.href, { credentials: 'same-origin' }).then(r => r.text());
                const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s|const\s|let\s|<\/script>)/s);
                if (m) { try { pr = JSON.parse(m[1]); } catch {} }
              }
              if (!pr) return { ok: false, error: 'No se encontró información del video.' };

              const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              if (!tracks || !tracks.length) {
                return { ok: false, error: 'Este video no tiene transcripción/subtítulos disponibles.' };
              }
              // Preferir es > en > primero; preferir manual sobre ASR si hay empate de idioma
              const score = t => {
                let s = 0;
                if (t.languageCode?.startsWith('es')) s += 20;
                else if (t.languageCode?.startsWith('en')) s += 10;
                if (t.kind !== 'asr') s += 5;
                return s;
              };
              const track = [...tracks].sort((a, b) => score(b) - score(a))[0];

              const url = track.baseUrl + '&fmt=json3';
              const data = await fetch(url, { credentials: 'same-origin' }).then(r => r.json());
              const segments = (data.events || [])
                .filter(e => e.segs)
                .map(e => ({
                  t: e.tStartMs || 0,
                  text: e.segs.map(x => x.utf8 || '').join('').replace(/\n/g, ' ').trim()
                }))
                .filter(x => x.text);

              return {
                ok: true,
                videoId: pr.videoDetails?.videoId || urlId || '',
                title: pr.videoDetails?.title || document.title,
                author: pr.videoDetails?.author || '',
                lengthSeconds: parseInt(pr.videoDetails?.lengthSeconds || '0', 10),
                lang: track.languageCode || '',
                isAuto: track.kind === 'asr',
                segments
              };
            } catch (e) {
              return { ok: false, error: 'Error al leer la transcripción: ' + e.message };
            }
          }
        });
        sendResponse(res?.[0]?.result || { ok: false, error: 'Sin respuesta del video.' });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  // ── Modo lectura: abrir una pestaña con el contenido limpio listo para "Guardar como PDF" ──
  if (msg.type === 'OPEN_READER_PDF') {
    (async () => {
      try {
        // Encontrar la pestaña web real activa (no el panel, no chrome://)
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || /^(chrome|chrome-extension|edge|about):/.test(tab.url)) {
          // Buscar la pestaña activa más reciente que sea web
          const all = await chrome.tabs.query({ currentWindow: true });
          tab = all.filter(t => t.url && /^https?:/.test(t.url)).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0];
        }
        if (!tab) { sendResponse({ ok:false, error:'Abre una página web (http/https) para guardarla como PDF.' }); return; }

        const res = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            function pickMain() {
              const art = document.querySelector('article');
              if (art && art.innerText.trim().length > 400) return art;
              const candidates = [...document.querySelectorAll('main, [role=main], .post, .article, .content, #content')];
              let best = null, bestLen = 0;
              for (const c of candidates) {
                const l = c.innerText.trim().length;
                if (l > bestLen) { best = c; bestLen = l; }
              }
              if (best && bestLen > 400) return best;
              return document.body;
            }
            const main = pickMain();
            const clone = main.cloneNode(true);
            clone.querySelectorAll('script,style,nav,aside,footer,header,form,iframe,noscript,button,svg,.ad,[class*=ad-],[id*=ad-]').forEach(n => n.remove());
            const blocks = [];
            clone.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre').forEach(el => {
              const t = el.innerText.trim();
              if (t) blocks.push({ tag: el.tagName.toLowerCase(), text: t });
            });
            return { title: document.title || 'Documento', url: location.href, blocks };
          }
        });
        const data = res?.[0]?.result;
        if (!data || !data.blocks?.length) { sendResponse({ ok:false, error:'No se pudo extraer el contenido de la página.' }); return; }

        const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const dias=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
        const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const d=new Date();
        const fecha=`${dias[d.getDay()]}, ${meses[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}, ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
        const body = data.blocks.map(b => {
          if (b.tag==='h1') return `<h1>${esc(b.text)}</h1>`;
          if (b.tag==='h2') return `<h2>${esc(b.text)}</h2>`;
          if (b.tag==='h3'||b.tag==='h4') return `<h3>${esc(b.text)}</h3>`;
          if (b.tag==='li') return `<li>${esc(b.text)}</li>`;
          if (b.tag==='blockquote') return `<blockquote>${esc(b.text)}</blockquote>`;
          if (b.tag==='pre') return `<pre>${esc(b.text)}</pre>`;
          return `<p>${esc(b.text)}</p>`;
        }).join('\n');
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(data.title)}</title>
<style>@page{margin:2cm;}body{font-family:Georgia,'Times New Roman',serif;line-height:1.6;color:#1a1a1a;max-width:42em;margin:0 auto;padding:24px;}
h1{font-size:24px;}h2{font-size:19px;margin-top:1.4em;}h3{font-size:16px;}
.src{color:#666;font-size:12px;border-bottom:1px solid #ddd;padding-bottom:12px;margin-bottom:24px;font-family:Arial,sans-serif;}
blockquote{border-left:3px solid #0071E3;padding-left:14px;color:#444;margin-left:0;}
pre{background:#f5f5f5;padding:10px;border-radius:6px;overflow-x:auto;font-size:13px;white-space:pre-wrap;}
.pie{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;color:#999;font-size:11px;font-family:Arial,sans-serif;}
.bar{position:fixed;top:0;left:0;right:0;background:#0071E3;color:#fff;padding:10px;text-align:center;font-family:Arial,sans-serif;font-size:13px;}
.bar button{background:#fff;color:#0071E3;border:none;border-radius:6px;padding:5px 14px;font-weight:600;cursor:pointer;margin-left:8px;}
@media print{.bar{display:none;}body{padding-top:24px;}}
.content{margin-top:48px;}</style></head><body>
<div class="bar">Para guardar como PDF: usa el botón <button onclick="window.print()">Guardar como PDF</button> y elige «Guardar como PDF» como destino.</div>
<div class="content"><h1>${esc(data.title)}</h1>
<div class="src">Fuente: ${esc(data.url)}<br>Guardado con Picona · ${fecha}</div>
${body}
<div class="pie">Documento en modo lectura generado por Picona. El formato visual original puede diferir.</div></div>
</body></html>`;

        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        await chrome.tabs.create({ url: dataUrl });
        sendResponse({ ok:true });
      } catch (e) {
        sendResponse({ ok:false, error: e.message });
      }
    })();
    return true;
  }

  // (Port-based handler for floating toolbar lives in onConnect, below)

  // All usable tabs
  if (msg.type === 'GET_ALL_TABS') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sendResponse({ tabs: tabs
        .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
        .map(t => ({ id: t.id, title: t.title || 'Sin título', url: t.url || '' })) });
    });
    return true;
  }

  // Active tab
  if (msg.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] ? { id: tabs[0].id, title: tabs[0].title, url: tabs[0].url } : null });
    });
    return true;
  }

  // Capture visible area of the active tab as a PNG data URL
  if (msg.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'No se pudo capturar la pantalla.' });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    });
    return true;
  }

});

// ── Floating-toolbar Port connection ─────────────────────────────
// Port connections preserve the user-gesture context for
// chrome.sidePanel.open() far more reliably than runtime.sendMessage
// when triggered from a content script (crbug.com/40929586).
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'picona-toolbar') return;

  port.onMessage.addListener((msg) => {
    const tab = port.sender?.tab;
    const tabId = tab?.id;
    const windowId = tab?.windowId;

    const pending = {
      type: msg.type,
      text: msg.text || '',
      sourceUrl: msg.sourceUrl || '',
      sourceTitle: msg.sourceTitle || '',
      timestamp: Date.now()
    };

    // Persist pending action first so the panel can read it once open
    chrome.storage.session.set({ pendingAction: pending }).catch(() => {});

    // Open the side panel — must be called synchronously within this
    // gesture-bound callback, before any other await.
    const openPromise = tabId
      ? chrome.sidePanel.open({ tabId })
      : (windowId ? chrome.sidePanel.open({ windowId }) : Promise.reject(new Error('Sin tabId/windowId')));

    openPromise.catch((err) => {
      console.error('Picona: no se pudo abrir el panel lateral —', err.message);
    });
  });
});

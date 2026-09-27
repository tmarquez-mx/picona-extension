// ─── Picona · background.js ─────────────────────────────────────

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


  // ── Capturar la conversación con un LLM de la página activa y guardarla como Markdown ──
  if (msg.type === 'CAPTURE_CONVERSATION') {
    (async () => {
      try {
        const tabId = msg.tabId;
        const res = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const host = location.hostname;

            // Detectar plataforma y devolver su configuración de selectores
            function detectPlatform() {
              if (/chatgpt\.com|chat\.openai\.com/.test(host)) return 'ChatGPT';
              if (/claude\.ai/.test(host)) return 'Claude';
              if (/perplexity\.ai/.test(host)) return 'Perplexity';
              if (/deepseek\.com/.test(host)) return 'DeepSeek';
              return 'LLM OpenSource'; // genérico / otros (incl. modelos open source)
            }

            const platform = detectPlatform();
            const turns = [];
            const allImages = []; // {url, marker} para descargar luego

            // Extrae texto + imágenes de un nodo
            function nodeToContent(el) {
              if (!el) return { text: '', images: [] };
              const clone = el.cloneNode(true);
              clone.querySelectorAll('button,svg,[role=button]').forEach(n => n.remove());
              // Tablas HTML → tablas Markdown (evita que salgan como texto corrido)
              clone.querySelectorAll('table').forEach(tbl => {
                const rows = [...tbl.querySelectorAll('tr')];
                if (!rows.length) return;
                const md = [];
                rows.forEach((tr, ri) => {
                  const cells = [...tr.querySelectorAll('th,td')].map(c =>
                    (c.innerText || '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()
                  );
                  if (!cells.length) return;
                  md.push('| ' + cells.join(' | ') + ' |');
                  if (ri === 0) md.push('| ' + cells.map(() => '---').join(' | ') + ' |');
                });
                tbl.replaceWith(document.createTextNode('\n\n' + md.join('\n') + '\n\n'));
              });
              // Bloques de código → cercas markdown
              clone.querySelectorAll('pre').forEach(pre => {
                const code = pre.innerText;
                pre.replaceWith(document.createTextNode('\n```\n' + code + '\n```\n'));
              });
              // Recolectar imágenes reales del contenido (no íconos de interfaz)
              const images = [];
              clone.querySelectorAll('img').forEach(img => {
                const src = img.currentSrc || img.src || '';
                // Filtrar avatares, íconos y data-uris diminutos
                const w = img.naturalWidth || img.width || 0;
                if (!src || src.startsWith('data:') && src.length < 200) return;
                if (/avatar|icon|favicon|logo|emoji/i.test(src)) return;
                if (w && w < 48) return;
                images.push(src);
              });
              const text = (clone.innerText || '').replace(/\u00a0/g, ' ').trim();
              return { text, images };
            }

            function pushTurn(role, el) {
              const { text, images } = nodeToContent(el);
              if (!text && !images.length) return;
              let body = text;
              images.forEach(src => {
                const idx = allImages.length;
                const marker = `__PICONA_IMG_${idx}__`;
                allImages.push({ url: src, marker });
                body += `\n\n${marker}`;
              });
              turns.push({ role, text: body });
            }

            // ── Extracción específica por plataforma ──
            if (platform === 'ChatGPT') {
              document.querySelectorAll('[data-message-author-role]').forEach(el => {
                const role = el.getAttribute('data-message-author-role') === 'user' ? 'Usuario' : 'Asistente';
                pushTurn(role, el);
              });
            } else if (platform === 'Claude') {
              // Estrategia robusta: recoger todos los nodos de mensaje (usuario y asistente)
              // en su orden de aparición en el documento, con varios selectores de respaldo.
              const sel = [
                '[data-testid="user-message"]',
                '.font-claude-message',
                '.font-claude-response',
                '[data-testid="assistant-message"]',
                '[data-is-streaming] .font-claude-message'
              ].join(',');
              let nodes = [...document.querySelectorAll(sel)];
              // Quitar nodos anidados dentro de otro nodo ya seleccionado (evita duplicados)
              nodes = nodes.filter(n => !nodes.some(o => o !== n && o.contains(n)));
              nodes.forEach(el => {
                const isUser = el.matches('[data-testid="user-message"]') ||
                               !!el.closest('[data-testid="user-message"]');
                pushTurn(isUser ? 'Usuario' : 'Asistente', el);
              });
              // Respaldo: si no se detectó ningún asistente, reintentar por bloques de respuesta
              if (!turns.some(t => t.role === 'Asistente')) {
                document.querySelectorAll('.font-claude-message, .font-claude-response, [class*="message"][class*="assistant"]').forEach(el => {
                  if (!nodes.includes(el)) pushTurn('Asistente', el);
                });
              }
            } else if (platform === 'Perplexity' || platform === 'DeepSeek') {
              const sel = platform === 'Perplexity'
                ? '.prose, [class*="answer"], [class*="query"]'
                : '[class*="_message"], [class*="message"]';
              // Quedarse solo con los nodos más externos (evita duplicar mensajes anidados)
              let nodes = [...document.querySelectorAll(sel)];
              nodes = nodes.filter(n => !nodes.some(o => o !== n && o.contains(n)));
              const seen = new Set();
              nodes.forEach(el => {
                const { text } = nodeToContent(el);
                if (text && text.length > 2 && !seen.has(text)) { seen.add(text); pushTurn('', el); }
              });
            }

            // ── Fallback genérico si no se obtuvo nada ──
            if (!turns.length) {
              let blocks = [...document.querySelectorAll('main p, main li, article p, [class*=message], [class*=msg], .prose')];
              blocks = blocks.filter(n => !blocks.some(o => o !== n && o.contains(n)));
              const seen = new Set();
              blocks.forEach(b => {
                const { text } = nodeToContent(b);
                if (text && text.length > 15 && !seen.has(text)) { seen.add(text); pushTurn('', b); }
              });
            }

            return {
              ok: turns.length > 0,
              platform,
              title: (document.title || 'Conversación').replace(/\s*[-|–]\s*(ChatGPT|Claude|Perplexity|DeepSeek).*$/i, '').trim() || 'Conversación',
              url: location.href,
              turns,
              images: allImages,
              error: turns.length ? '' : 'No se reconoció una conversación en esta página.'
            };
          }
        });

        const data = res?.[0]?.result;
        if (!data || !data.ok) { sendResponse({ ok: false, error: data?.error || 'No se pudo capturar la conversación.' }); return; }

        // ── Construir Markdown con frontmatter ──
        const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
        const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const d = new Date();
        const iso = d.toISOString();
        const fechaLegible = `${dias[d.getDay()]}, ${meses[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}, ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
        const stamp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        const safeTitle = (data.title || 'conversacion').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60);
        const fileName = `${safeTitle}-${stamp}.md`;

        const yq = v => JSON.stringify(String(v ?? ''));   // cadena YAML válida (entre comillas, escapada)
        const fm = [
          '---',
          `titulo: ${yq(data.title)}`,
          `plataforma: ${yq(data.platform)}`,
          `fecha: ${iso}`,
          `fecha_legible: ${yq(fechaLegible)}`,
          `mensajes: ${data.turns.length}`,
          `url: ${yq(data.url)}`,
          `etiquetas:`,
          `  - conversacion`,
          `  - ${data.platform.toLowerCase().replace(/\s+/g,'-')}`,
          '---',
          ''
        ].join('\n');

        const folder = 'Picona-conversaciones';
        const baseDir = `${folder}/${data.platform}`;

        // ── Descargar imágenes (segunda iteración) y mapear marcadores → enlaces Obsidian ──
        const imgReplace = {};
        const images = data.images || [];
        for (let i = 0; i < images.length; i++) {
          const { url, marker } = images[i];
          try {
            // Inferir extensión
            let ext = 'png';
            const mExt = /\.(png|jpe?g|gif|webp|svg)(?:[?#]|$)/i.exec(url);
            if (mExt) ext = mExt[1].toLowerCase().replace('jpeg', 'jpg');
            const imgName = `${safeTitle}-${stamp}-img${i + 1}.${ext}`;
            const imgPath = `${baseDir}/images/${imgName}`;

            // Descargar la imagen al subfolder images/ (puede fallar si la URL es temporal o requiere auth)
            const id = await chrome.downloads.download({ url, filename: imgPath, saveAs: false, conflictAction: 'uniquify' });
            // download() responde cuando la descarga EMPIEZA; esperar a que termine de verdad
            const done = await waitDownload(id, 20000);
            if (!done.ok) throw new Error(done.error || 'descarga incompleta');
            // Obsidian referencia imágenes locales por nombre con ![[ ]] (usar el nombre final, por si se renombró)
            const finalName = (done.filename || imgName).split(/[\\/]/).pop();
            imgReplace[marker] = `![[${finalName}]]`;
          } catch (e) {
            // Si falla la descarga, dejar el enlace remoto como respaldo
            imgReplace[marker] = `![imagen](${url})`;
          }
        }

        const applyImg = (txt) => txt.replace(/__PICONA_IMG_\d+__/g, m => imgReplace[m] || '');

        const body = data.turns.map(t => {
          const head = t.role ? `### ${t.role}\n\n` : '';
          return head + applyImg(t.text);
        }).join('\n\n---\n\n');

        const md = fm + `# ${data.title}\n\n> Fuente: ${data.url}\n> Capturado con Picona · ${fechaLegible}\n\n` + body + '\n';

        // El panel lateral descarga el .md con una URL blob (sin el límite de tamaño de las URL data:)
        const path = `${baseDir}/${fileName}`;
        const savedImages = Object.values(imgReplace).filter(v => v.startsWith('![[')).length;
        sendResponse({ ok: true, platform: data.platform, turns: data.turns.length, images: images.length, savedImages, path, md });
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
            // Anuncios: nombres de clase/id que EMPIEZAN con "ad-" o contienen "advert"/"sponsor"
            // (antes [class*=ad-] también borraba "thread-", "read-more", "head-"…)
            clone.querySelectorAll([
              'script','style','nav','aside','footer','header','form','iframe','noscript','button','svg',
              '.ad','.ads','[class^="ad-"]','[class*=" ad-"]','[id^="ad-"]',
              '[class*="advert"]','[id*="advert"]','[class*="sponsor"]','[aria-label="advertisement" i]'
            ].join(',')).forEach(n => n.remove());
            const BLOCK = 'h1,h2,h3,h4,p,li,blockquote,pre';
            const blocks = [];
            clone.querySelectorAll(BLOCK).forEach(el => {
              // Si ya está dentro de otro bloque capturado (p dentro de li o de blockquote), no repetirlo
              if (el.parentElement && el.parentElement.closest(BLOCK)) return;
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

// ── Esperar a que una descarga termine (o falle) ─────────────────
function waitDownload(id, timeoutMs) {
  return new Promise(resolve => {
    let finished = false;
    const end = (r) => { if (finished) return; finished = true; chrome.downloads.onChanged.removeListener(onCh); clearTimeout(t); resolve(r); };
    const check = () => chrome.downloads.search({ id }).then(([it]) => {
      if (!it) return end({ ok: false, error: 'no encontrada' });
      if (it.state === 'complete') end({ ok: true, filename: it.filename });
      else if (it.state === 'interrupted') end({ ok: false, error: it.error });
    }).catch(() => {});
    const onCh = (d) => { if (d.id === id && d.state) check(); };
    chrome.downloads.onChanged.addListener(onCh);
    const t = setTimeout(() => end({ ok: false, error: 'tiempo agotado' }), timeoutMs);
    check();
  });
}

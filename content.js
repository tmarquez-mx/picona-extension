// Picona — content script (se ejecuta en cada página)
// Barra flotante de selección + lectura en voz alta con resaltado de palabras y frases.
// La barra y el reproductor viven en Shadow DOM: el CSS de la página no los deforma.

(() => {
if (window.__piconaContentLoaded) return;
window.__piconaContentLoaded = true;

let toolbarHost = null;
let lastSelection = '';
let lastRange = null;

// ════════════════════════════════════════════════════════════════
//  Utilidades
// ════════════════════════════════════════════════════════════════
function isOwnNode(n) {
  return !!n && ((toolbarHost && (n === toolbarHost || toolbarHost.contains(n))) ||
                 (TTS.playerHost && (n === TTS.playerHost || TTS.playerHost.contains(n))));
}

function sendAction(type, text) {
  // Las conexiones por Port conservan el gesto del usuario para sidePanel.open()
  // mejor que runtime.sendMessage (crbug.com/40929586).
  try {
    const port = chrome.runtime.connect({ name: 'picona-toolbar' });
    port.postMessage({ type, text, sourceUrl: location.href, sourceTitle: document.title });
  } catch (err) {
    console.warn('Picona: recarga la página para volver a conectar con la extensión.', err);
  }
}

// ════════════════════════════════════════════════════════════════
//  Barra flotante
// ════════════════════════════════════════════════════════════════
const TOOLBAR_CSS = `
:host { all: initial; }
.bar {
  position: fixed; z-index: 2147483647;
  display: flex; gap: 2px; align-items: center;
  background: rgba(29,29,31,.96);
  border-radius: 10px; padding: 4px;
  box-shadow: 0 4px 16px rgba(0,0,0,.28);
  font: 500 12.5px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  animation: pin .12s ease;
}
@keyframes pin { from { opacity: 0; transform: translateY(4px) scale(.96); } to { opacity: 1; transform: none; } }
button {
  all: unset; box-sizing: border-box;
  display: inline-flex; align-items: center; gap: 5px;
  color: #fff; padding: 6px 9px; border-radius: 6px;
  cursor: pointer; white-space: nowrap;
}
button:hover { background: rgba(255,255,255,.16); }
button:focus-visible { outline: 2px solid #FFC83D; outline-offset: 1px; }
.ic { font-size: 13px; }
.sep { width: 1px; align-self: stretch; margin: 3px 2px; background: rgba(255,255,255,.18); }
`;

const ACTIONS = [
  { id: 'picona-explain',       label: 'Explicar',  icon: '💡', aria: 'Explicar la selección con IA' },
  { id: 'picona-translate',     label: 'Traducir',  icon: '🌐', aria: 'Traducir la selección' },
  { id: 'picona-summarize-sel', label: 'Resumir',   icon: '📄', aria: 'Resumir la selección' },
  { id: 'picona-memo',          label: 'Memo',      icon: '📌', aria: 'Guardar la selección como memo' },
  { id: 'picona-ask',           label: 'Preguntar', icon: '💬', aria: 'Preguntar sobre la selección' }
];

function removeToolbar() {
  if (toolbarHost) { toolbarHost.remove(); toolbarHost = null; }
}

function buildToolbar(x, y, text, range, viaKeyboard) {
  removeToolbar();
  toolbarHost = document.createElement('picona-toolbar');
  const root = toolbarHost.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${TOOLBAR_CSS}</style><div class="bar" role="toolbar" aria-label="Picona"></div>`;
  const bar = root.querySelector('.bar');

  const mk = (label, icon, aria, onAct) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.title = aria;
    b.innerHTML = `<span class="ic" aria-hidden="true">${icon}</span>${label}`;
    // mousedown: impedir que el clic borre la selección de la página
    b.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    // click: funciona con ratón y con teclado (Enter / Espacio)
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onAct(); });
    bar.appendChild(b);
    return b;
  };

  ACTIONS.forEach(a => mk(a.label, a.icon, a.aria, () => { sendAction(a.id, text); removeToolbar(); }));
  const sep = document.createElement('span'); sep.className = 'sep'; bar.appendChild(sep);
  mk('Leer', '🔊', 'Leer en voz alta (Esc para detener)', () => {
    removeToolbar();
    ttsStart(text, range);
  });

  // Flechas izquierda/derecha para moverse dentro de la barra
  bar.addEventListener('keydown', (e) => {
    const btns = [...bar.querySelectorAll('button')];
    const i = btns.indexOf(root.activeElement);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
      btns[n].focus();
    } else if (e.key === 'Escape') {
      removeToolbar();
    }
  });

  document.documentElement.appendChild(toolbarHost);

  // Posición (fija al viewport, dentro de los bordes)
  const rect = bar.getBoundingClientRect();
  let left = x - rect.width / 2;
  let top = y - rect.height - 10;
  left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8));
  if (top < 8) top = y + 18;
  top = Math.min(top, window.innerHeight - rect.height - 8);
  bar.style.left = `${left}px`;
  bar.style.top = `${top}px`;

  if (viaKeyboard) bar.querySelector('button')?.focus();
}

function currentSelection() {
  const sel = window.getSelection();
  const text = sel?.toString().trim() || '';
  const range = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
  return { text, range };
}

function showForSelection(x, y, viaKeyboard) {
  const { text, range } = currentSelection();
  if (text && text.length > 1) {
    lastSelection = text;
    lastRange = range;
    if (x == null && range) {
      const r = range.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top;
    }
    buildToolbar(x ?? window.innerWidth / 2, y ?? 80, text, range, viaKeyboard);
  } else {
    removeToolbar();
  }
}

document.addEventListener('mouseup', (e) => {
  if (isOwnNode(e.target)) return;
  setTimeout(() => showForSelection(e.clientX, e.clientY, false), 5);
});

// Selección con teclado (Mayús + flechas): al soltar Mayús aparece la barra con el foco en ella
document.addEventListener('keyup', (e) => {
  if (e.key !== 'Shift') return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  setTimeout(() => showForSelection(null, null, true), 5);
});

document.addEventListener('mousedown', (e) => {
  if (toolbarHost && !isOwnNode(e.target)) removeToolbar();
});
window.addEventListener('scroll', removeToolbar, true);
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  removeToolbar();
  if (TTS.active) ttsStop();
});

// ════════════════════════════════════════════════════════════════
//  Lectura en voz alta con resaltado
// ════════════════════════════════════════════════════════════════
const TTS = {
  active: false, paused: false, session: 0,
  full: '', segments: null, chunks: [], idx: 0,
  lang: 'es-MX', voice: null, rate: 1,
  utter: null, gotBoundary: false,
  est: null,            // temporizador de estimación (voces sin eventos de palabra)
  playerHost: null, ui: null
};
const HL_OK = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';

// Estilos de resaltado (Custom Highlight API: no modifica el DOM de la página)
if (HL_OK) {
  const st = document.createElement('style');
  st.textContent = `
    ::highlight(picona-tts-sentence) { background-color: rgba(255, 213, 74, .38); }
    ::highlight(picona-tts-word) { background-color: #FFC83D; color: #1d1d1f; }`;
  (document.head || document.documentElement).appendChild(st);
}

// ── Idioma: español o inglés según palabras frecuentes y caracteres propios ──
function detectLang(text) {
  const sample = text.slice(0, 3000).toLowerCase();
  const es = (sample.match(/\b(que|de|la|el|los|las|una?|para|con|por|son|es|en|y|se|del|al|como|pero|su|sus|esto|esta|está|más|también|porque|cuando|sobre|entre|muy|hay|fue|ser)\b/g) || []).length
           + 3 * (sample.match(/[ñ¿¡áéíóú]/g) || []).length;
  const en = (sample.match(/\b(the|and|of|to|in|is|are|was|were|that|this|with|for|on|as|by|it|be|from|at|which|have|has|not|or|but|an|they|their|these|would|can)\b/g) || []).length;
  return es >= en ? 'es-MX' : 'en-US';
}

function loadVoices() {
  return new Promise(res => {
    const v = speechSynthesis.getVoices();
    if (v.length) return res(v);
    const done = () => res(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 900);
  });
}

// ── Elección de voz ──
// macOS instala voces de efectos (Albert, Bad News, Zarvox…) que suenan muy mal; se excluyen.
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|deranged|hysterical|princess)\b/i;
// Voces de mejor calidad conocidas (macOS, Windows, Chrome)
const GOOD_EN = /\b(samantha|alex|ava|allison|evan|nathan|zoe|susan|tom|karen|daniel|moira|serena|aria|jenny|guy|libby|sonia|ryan|google us english|google uk english)\b/i;
const GOOD_ES = /\b(paulina|m[oó]nica|jorge|juan|marisol|diego|dalia|jorge|elvira|alvaro|helena|laura|sabina|raul|google español)\b/i;
const OLDER_MAC = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

function voiceScore(v, lang) {
  const base = lang.split('-')[0];
  const pref = base === 'es' ? ['es-MX', 'es-US', 'es-419', 'es-ES'] : ['en-US', 'en-GB', 'en-AU', 'en-CA'];
  const l = (v.lang || '').replace('_', '-').toLowerCase();
  const name = v.name || '';
  if (NOVELTY.test(name)) return -100;
  let s = 0;
  const p = pref.findIndex(x => x.toLowerCase() === l);
  if (p !== -1) s += 8 - p;
  if (/(premium|enhanced|mejorada|natural|neural|siri)/i.test(name)) s += 20;
  if ((base === 'en' ? GOOD_EN : GOOD_ES).test(name)) s += 12;
  if (OLDER_MAC.test(name)) s -= 6;
  if (v.localService) s += 5;          // las locales resaltan palabra por palabra
  if (v.default) s += 1;
  return s;
}
function voicesFor(voices, lang) {
  const base = lang.split('-')[0];
  return voices
    .filter(v => (v.lang || '').replace('_', '-').toLowerCase().startsWith(base))
    .filter(v => !NOVELTY.test(v.name || ''))
    .sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang));
}
async function pickVoice(voices, lang) {
  const cands = voicesFor(voices, lang);
  if (!cands.length) return null;
  // Voz elegida antes por la persona para este idioma
  try {
    const key = 'picona_tts_voice_' + lang.split('-')[0];
    const saved = (await chrome.storage.local.get(key))[key];
    const hit = saved && cands.find(v => v.voiceURI === saved);
    if (hit) return hit;
  } catch {}
  return cands[0];
}
async function saveVoiceChoice(lang, voice) {
  try { await chrome.storage.local.set({ ['picona_tts_voice_' + lang.split('-')[0]]: voice.voiceURI }); } catch {}
}

// ── Mapa texto ↔ DOM de la selección, para poder resaltar lo que se lee ──
const blockCache = new WeakMap();
function blockOf(node) {
  let e = node.parentElement;
  while (e && e !== document.body) {
    if (blockCache.has(e)) return blockCache.get(e);
    const d = getComputedStyle(e).display;
    if (d && !d.startsWith('inline') && d !== 'contents') { blockCache.set(e, e); return e; }
    e = e.parentElement;
  }
  return document.body;
}

function buildTextMap(range) {
  if (!range) return null;
  let root = range.commonAncestorContainer;
  if (root.nodeType !== 1) root = root.parentNode;
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!range.intersectsNode(n) || !n.data) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p || p.closest('script,style,noscript,textarea,select,[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let full = '';
  const segments = [];
  let prevBlock = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const start = n === range.startContainer ? range.startOffset : 0;
    const end = n === range.endContainer ? range.endOffset : n.data.length;
    if (end <= start) continue;
    const blk = blockOf(n);
    if (prevBlock && blk !== prevBlock && !/\s$/.test(full)) full += '\n';   // separador entre bloques (no mapeado)
    prevBlock = blk;
    const piece = n.data.slice(start, end);
    segments.push({ node: n, nodeStart: start, strStart: full.length, strEnd: full.length + piece.length });
    full += piece;
  }
  if (!full.trim()) return null;
  return { full, segments };
}

function rangeFor(a, b) {
  const segs = TTS.segments;
  if (!segs || !segs.length || b <= a) return null;
  let iA = segs.findIndex(g => a < g.strEnd);
  let iB = -1;
  for (let i = segs.length - 1; i >= 0; i--) if (b > segs[i].strStart) { iB = i; break; }
  if (iA === -1 || iB === -1 || iB < iA) return null;
  const A = segs[iA], B = segs[iB];
  const offA = A.nodeStart + Math.max(0, a - A.strStart);
  const offB = B.nodeStart + Math.min(b, B.strEnd) - B.strStart;
  try {
    const r = document.createRange();
    r.setStart(A.node, Math.min(offA, A.node.data.length));
    r.setEnd(B.node, Math.min(offB, B.node.data.length));
    return r.collapsed ? null : r;
  } catch { return null; }
}

// ── Fragmentar en frases (evita el corte de Chrome en textos largos) ──
function splitChunks(full) {
  const chunks = [];
  const re = /[^.!?…\n]*(?:[.!?…]+["»”’')\]]*|\n+|$)/g;
  let m;
  while ((m = re.exec(full)) !== null) {
    if (m[0] === '') { re.lastIndex++; if (re.lastIndex > full.length) break; continue; }
    let s = m.index, e = m.index + m[0].length;
    const lead = m[0].match(/^\s*/)[0].length;
    s += lead;
    while (e > s && /\s/.test(full[e - 1])) e--;
    if (e <= s) continue;
    // Frases muy largas → cortar en comas / punto y coma / espacios
    while (e - s > 220) {
      const win = full.slice(s, s + 220);
      let cut = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '), win.lastIndexOf(': '));
      if (cut < 80) cut = win.lastIndexOf(' ');
      if (cut < 40) cut = 220;
      else cut += 1;
      chunks.push({ start: s, end: s + cut });
      s += cut;
      while (s < e && /\s/.test(full[s])) s++;
    }
    if (e > s) chunks.push({ start: s, end: e });
  }
  return chunks.map(c => ({ ...c, text: full.slice(c.start, c.end) }));
}

// ── Resaltado ──
function setHighlight(name, range) {
  if (!HL_OK) return;
  if (range) CSS.highlights.set(name, new Highlight(range));
  else CSS.highlights.delete(name);
}
function clearHighlights() {
  if (!HL_OK) return;
  CSS.highlights.delete('picona-tts-sentence');
  CSS.highlights.delete('picona-tts-word');
}
function highlightWord(chunk, rel, len) {
  let L = len;
  if (!L || L <= 0) {
    const m = chunk.text.slice(rel).match(/^[\p{L}\p{N}'’\-]+|^\S+/u);
    L = m ? m[0].length : 0;
  }
  if (!L) return;
  const a = chunk.start + rel;
  setHighlight('picona-tts-word', rangeFor(a, a + L));
}
function scrollIfNeeded(range) {
  if (!range) return;
  const r = range.getBoundingClientRect();
  if (!r || (r.top === 0 && r.bottom === 0)) return;
  if (r.top < 70 || r.bottom > window.innerHeight - 90) {
    const el = range.startContainer.parentElement;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

// Voces sin eventos de palabra (p. ej. voces en línea de Google): avance estimado por tiempo
function startEstimator(chunk, session, startedAt) {
  stopEstimator();
  const words = [];
  const re = /\S+/g; let m;
  while ((m = re.exec(chunk.text)) !== null) words.push({ i: m.index, len: m[0].length, w: m[0] });
  if (!words.length) return;
  const cps = 14.5 * TTS.rate;              // caracteres por segundo aproximados
  let t = 0;
  const times = words.map(w => {
    const at = t;
    t += (w.len + 1) / cps + (/[,;:]$/.test(w.w) ? 0.18 : 0) + (/[.!?…]$/.test(w.w) ? 0.32 : 0);
    return at;
  });
  // Contar desde que empezó a sonar la frase, no desde que arrancó el estimador
  let elapsed = (performance.now() - (startedAt || performance.now())) / 1000, last = performance.now(), k = -1;
  TTS.est = setInterval(() => {
    if (session !== TTS.session || TTS.gotBoundary) { stopEstimator(); return; }
    const now = performance.now();
    if (!TTS.paused) elapsed += (now - last) / 1000;
    last = now;
    while (k + 1 < words.length && times[k + 1] <= elapsed) {
      k++;
      highlightWord(chunk, words[k].i, words[k].len);
    }
  }, 60);
}
function stopEstimator() { if (TTS.est) { clearInterval(TTS.est); TTS.est = null; } }

// ── Reproductor flotante (permanece aunque se cierre la barra) ──
const PLAYER_CSS = `
:host { all: initial; }
.p {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
  display: flex; align-items: center; gap: 4px;
  background: rgba(29,29,31,.96); color: #fff;
  border-radius: 12px; padding: 6px 6px 6px 12px;
  box-shadow: 0 6px 22px rgba(0,0,0,.3);
  font: 500 12.5px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.st { margin-right: 6px; white-space: nowrap; }
.st small { display: block; color: rgba(255,255,255,.6); font-size: 11px; margin-top: 2px; }
button {
  all: unset; box-sizing: border-box; cursor: pointer;
  padding: 6px 9px; border-radius: 7px; color: #fff; white-space: nowrap;
}
button:hover { background: rgba(255,255,255,.16); }
button:focus-visible { outline: 2px solid #FFC83D; outline-offset: 1px; }
select.voice {
  all: unset; box-sizing: border-box; cursor: pointer; max-width: 118px;
  padding: 6px 8px; border-radius: 7px; color: #fff; background: rgba(255,255,255,.1);
  font: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
select.voice:focus-visible { outline: 2px solid #FFC83D; }
select.voice option { color: #1d1d1f; background: #fff; }
.stop { background: rgba(255,59,48,.85); }
.stop:hover { background: rgba(255,59,48,1); }
`;
function showPlayer() {
  if (TTS.playerHost) return;
  TTS.playerHost = document.createElement('picona-reader');
  const root = TTS.playerHost.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${PLAYER_CSS}</style>
    <div class="p" role="region" aria-label="Lectura en voz alta de Picona">
      <div class="st" aria-live="polite"><span class="s1">🔊 Leyendo</span><small class="s2"></small></div>
      <button class="pause" aria-label="Pausar lectura">⏸ Pausa</button>
      <select class="voice" aria-label="Voz de lectura" title="Voz de lectura"></select>
      <button class="rate" aria-label="Cambiar velocidad de lectura">1×</button>
      <button class="stop" aria-label="Detener lectura (Esc)">⏹ Detener</button>
    </div>`;
  const q = s => root.querySelector(s);
  TTS.ui = { s1: q('.s1'), s2: q('.s2'), pause: q('.pause'), rate: q('.rate'), voice: q('.voice') };
  q('.voice').addEventListener('change', (e) => {
    const v = (TTS.voiceList || []).find(x => x.voiceURI === e.target.value);
    if (!v) return;
    TTS.voice = v;
    saveVoiceChoice(TTS.lang, v);
    // Aplicar de inmediato: repetir la frase actual con la voz nueva
    if (TTS.active) { const sess = TTS.session; TTS.utter = null; speechSynthesis.cancel(); TTS.paused = false; speakChunk(sess); }
  });
  q('.stop').addEventListener('click', ttsStop);
  q('.pause').addEventListener('click', ttsTogglePause);
  q('.rate').addEventListener('click', () => {
    const steps = [1, 1.2, 1.4, 0.8];
    TTS.rate = steps[(steps.indexOf(TTS.rate) + 1) % steps.length];
    TTS.ui.rate.textContent = `${TTS.rate}×`;
  });
  root.addEventListener('mousedown', e => e.stopPropagation());
  document.documentElement.appendChild(TTS.playerHost);
}
function fillVoiceMenu(voices) {
  if (!TTS.ui) return;
  TTS.voiceList = voicesFor(voices, TTS.lang);
  const sel = TTS.ui.voice;
  sel.innerHTML = '';
  TTS.voiceList.forEach(v => {
    const o = document.createElement('option');
    o.value = v.voiceURI;
    o.textContent = v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*\(.*\)$/, '') + (v.localService ? '' : ' ☁');
    sel.appendChild(o);
  });
  if (TTS.voice) sel.value = TTS.voice.voiceURI;
  sel.style.display = TTS.voiceList.length > 1 ? '' : 'none';
}
function updatePlayer() {
  if (!TTS.ui) return;
  const idioma = TTS.lang.startsWith('es') ? 'Español' : 'Inglés';
  TTS.ui.s1.textContent = TTS.paused ? '⏸ En pausa' : '🔊 Leyendo';
  TTS.ui.s2.textContent = `${idioma} · frase ${Math.min(TTS.idx + 1, TTS.chunks.length)} de ${TTS.chunks.length}`;
  TTS.ui.pause.textContent = TTS.paused ? '▶ Seguir' : '⏸ Pausa';
  TTS.ui.pause.setAttribute('aria-label', TTS.paused ? 'Reanudar lectura' : 'Pausar lectura');
}
function hidePlayer() {
  if (TTS.playerHost) { TTS.playerHost.remove(); TTS.playerHost = null; TTS.ui = null; }
}

// ── Control de la lectura ──
async function ttsStart(text, range) {
  if (!('speechSynthesis' in window)) return;
  ttsStop();
  const session = ++TTS.session;

  const map = buildTextMap(range);
  TTS.full = map ? map.full : text;
  TTS.segments = map ? map.segments : null;
  TTS.chunks = splitChunks(TTS.full);
  if (!TTS.chunks.length) return;
  TTS.idx = 0;
  TTS.lang = detectLang(TTS.full);
  TTS.gotBoundary = false;
  TTS.paused = false;
  TTS.active = true;

  // Quitar la selección azul para que se vea el resaltado de lectura
  if (TTS.segments) window.getSelection()?.removeAllRanges();

  showPlayer(); updatePlayer();
  const voices = await loadVoices();
  if (session !== TTS.session) return;
  TTS.voice = await pickVoice(voices, TTS.lang);
  if (session !== TTS.session) return;
  fillVoiceMenu(voices);
  speakChunk(session);
}

function speakChunk(session) {
  if (session !== TTS.session || !TTS.active) return;
  if (TTS.idx >= TTS.chunks.length) { ttsStop(); return; }
  const chunk = TTS.chunks[TTS.idx];
  const u = new SpeechSynthesisUtterance(chunk.text);
  u.lang = TTS.voice?.lang || TTS.lang;
  if (TTS.voice) u.voice = TTS.voice;
  u.rate = TTS.rate;
  TTS.utter = u;

  u.onstart = () => {
    if (session !== TTS.session) return;
    const startedAt = performance.now();
    const sr = rangeFor(chunk.start, chunk.end);
    setHighlight('picona-tts-sentence', sr);
    setHighlight('picona-tts-word', null);
    scrollIfNeeded(sr);
    updatePlayer();
    if (!TTS.gotBoundary && TTS.segments) {
      // Si en 350 ms no llegan eventos de palabra, estimar el avance
      setTimeout(() => {
        if (session === TTS.session && TTS.utter === u && !TTS.gotBoundary) startEstimator(chunk, session, startedAt);
      }, 350);
    }
  };
  u.onboundary = (e) => {
    if (session !== TTS.session || e.name !== 'word') return;
    TTS.gotBoundary = true;
    stopEstimator();
    highlightWord(chunk, e.charIndex, e.charLength);
  };
  u.onend = () => {
    if (session !== TTS.session || TTS.utter !== u) return;
    stopEstimator();
    TTS.idx++;
    speakChunk(session);
  };
  u.onerror = (e) => {
    if (session !== TTS.session || TTS.utter !== u) return;
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    console.warn('Picona: error de síntesis de voz —', e.error);
    stopEstimator();
    TTS.idx++;
    speakChunk(session);
  };
  // Pequeña pausa: Chrome a veces ignora speak() justo después de cancel()
  setTimeout(() => { if (session === TTS.session) speechSynthesis.speak(u); }, 40);
}

function ttsTogglePause() {
  if (!TTS.active) return;
  if (TTS.paused) { speechSynthesis.resume(); TTS.paused = false; }
  else { speechSynthesis.pause(); TTS.paused = true; }
  updatePlayer();
}

function ttsStop() {
  TTS.session++;
  TTS.active = false;
  TTS.paused = false;
  TTS.utter = null;
  stopEstimator();
  try { speechSynthesis.cancel(); } catch {}
  clearHighlights();
  hidePlayer();
}

window.addEventListener('pagehide', () => { if (TTS.active) ttsStop(); });

// ════════════════════════════════════════════════════════════════
//  Mensajes desde el panel / background
// ════════════════════════════════════════════════════════════════
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
})();

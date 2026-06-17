/* ─── Picona · sidepanel/app.js v1.1 ──────────────────────────── */

// ── Multimodal helpers (image support for vision-capable models) ──
function stripDataUrl(dataUrl){
  const m=/^data:(.+?);base64,(.+)$/.exec(dataUrl||'');
  return m?{mime:m[1],data:m[2]}:{mime:'image/png',data:dataUrl||''};
}
function toCompatContent(x){
  if(!x.image) return x.content;
  return [
    { type:'text', text:x.content||'' },
    { type:'image_url', image_url:{ url:x.image } }
  ];
}
function toAnthropicContent(x){
  if(!x.image) return x.content;
  const {mime,data}=stripDataUrl(x.image);
  return [
    { type:'image', source:{ type:'base64', media_type:mime, data } },
    { type:'text', text:x.content||'' }
  ];
}
function toGeminiParts(x){
  const parts=[];
  if(x.image){
    const {mime,data}=stripDataUrl(x.image);
    parts.push({ inline_data:{ mime_type:mime, data } });
  }
  parts.push({ text:x.content||'' });
  return parts;
}
function compatBuildBody(m,mod,s){
  return { model:mod, messages:m.map(x=>({role:x.role,content:toCompatContent(x)})), stream:s, max_tokens:4096 };
}

// ── API provider templates ──────────────────────────────────────
const API_TEMPLATES = {
  openai: {
    label:'OpenAI', icon:'⚡', keyRequired:true,
    apiUrl:'https://api.openai.com/v1/chat/completions',
    models:['gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'],
    keyHint:'https://platform.openai.com/api-keys', keyHintLabel:'platform.openai.com ↗',
    buildHeaders:c=>({'Content-Type':'application/json','Authorization':`Bearer ${c.apiKey}`}),
    buildBody:compatBuildBody,
    label:'Anthropic', icon:'🔮', keyRequired:true,
    apiUrl:'https://api.anthropic.com/v1/messages',
    models:['claude-opus-4-5-20251101','claude-sonnet-4-5-20251022','claude-haiku-4-5-20251001'],
    modelLabels:{'claude-opus-4-5-20251101':'Claude Opus 4.5','claude-sonnet-4-5-20251022':'Claude Sonnet 4.5','claude-haiku-4-5-20251001':'Claude Haiku 4.5'},
    keyHint:'https://console.anthropic.com/settings/keys', keyHintLabel:'console.anthropic.com ↗',
    buildHeaders:c=>({'Content-Type':'application/json','x-api-key':c.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}),
    buildBody(m,mod,s){const sys=m.find(x=>x.role==='system'),chat=m.filter(x=>x.role!=='system');return{model:mod,max_tokens:4096,stream:s,...(sys&&{system:sys.content}),messages:chat.map(x=>({role:x.role,content:toAnthropicContent(x)}))};},
    parseChunk:d=>d.delta?.text||'', type:'anthropic'
  },
  gemini: {
    label:'Google Gemini', icon:'✨', keyRequired:true,
    apiUrlTpl:'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={key}&alt=sse',
    models:['gemini-2.0-flash','gemini-1.5-pro','gemini-1.5-flash'],
    keyHint:'https://aistudio.google.com/app/apikey', keyHintLabel:'aistudio.google.com ↗',
    buildUrl:c=>API_TEMPLATES.gemini.apiUrlTpl.replace('{model}',c.model).replace('{key}',c.apiKey),
    buildHeaders:()=>({'Content-Type':'application/json'}),
    buildBody(m){const sys=m.find(x=>x.role==='system'),chat=m.filter(x=>x.role!=='system');return{contents:chat.map(x=>({role:x.role==='assistant'?'model':'user',parts:toGeminiParts(x)})),...(sys&&{system_instruction:{parts:[{text:sys.content}]}}),generationConfig:{maxOutputTokens:4096,temperature:0.7}};},
    parseChunk:d=>d.candidates?.[0]?.content?.parts?.[0]?.text||'', type:'gemini'
  },
  mistral: {
    label:'Mistral AI', icon:'🌊', keyRequired:true,
    apiUrl:'https://api.mistral.ai/v1/chat/completions',
    models:['mistral-large-latest','mistral-medium-latest','open-mistral-7b'],
    keyHint:'https://console.mistral.ai/api-keys/', keyHintLabel:'console.mistral.ai ↗',
    buildHeaders:c=>({'Content-Type':'application/json','Authorization':`Bearer ${c.apiKey}`}),
    buildBody:compatBuildBody,
    parseChunk:d=>d.choices?.[0]?.delta?.content||'', type:'compat'
  },
  groq: {
    label:'Groq', icon:'⚡', keyRequired:true,
    apiUrl:'https://api.groq.com/openai/v1/chat/completions',
    models:['llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768','gemma2-9b-it'],
    keyHint:'https://console.groq.com/keys', keyHintLabel:'console.groq.com ↗ (gratuito)',
    buildHeaders:c=>({'Content-Type':'application/json','Authorization':`Bearer ${c.apiKey}`}),
    buildBody:compatBuildBody,
    parseChunk:d=>d.choices?.[0]?.delta?.content||'', type:'compat'
  },
  openrouter: {
    label:'OpenRouter', icon:'🔀', keyRequired:true,
    apiUrl:'https://openrouter.ai/api/v1/chat/completions',
    models:['openai/gpt-4o','anthropic/claude-3.5-sonnet','meta-llama/llama-3.1-70b-instruct','mistralai/mistral-large','google/gemini-flash-1.5'],
    keyHint:'https://openrouter.ai/keys', keyHintLabel:'openrouter.ai ↗',
    buildHeaders:c=>({'Content-Type':'application/json','Authorization':`Bearer ${c.apiKey}`,'HTTP-Referer':'https://picona.app','X-Title':'Picona'}),
    buildBody:compatBuildBody,
    parseChunk:d=>d.choices?.[0]?.delta?.content||'', type:'compat'
  },
  ollama: {
    label:'Ollama', icon:'🦙', keyRequired:false,
    models:[],
    keyHint:'https://ollama.com', keyHintLabel:'ollama.com ↗',
    buildUrl:c=>`${(c.baseUrl||'http://localhost:11434').replace(/\/$/,'')}/api/chat`,
    buildHeaders:()=>({'Content-Type':'application/json'}),
    buildBody:(m,mod,s)=>({model:mod,messages:m.map(x=>({role:x.role,content:x.content})),stream:s}),
    parseChunk:d=>d.message?.content||'', type:'ollama'
  },
  custom: {
    label:'API personalizada', icon:'🛠', keyRequired:false, models:[],
    buildHeaders:c=>{const h={'Content-Type':'application/json'};if(c.apiKey)h['Authorization']=`Bearer ${c.apiKey}`;return h;},
    buildBody:compatBuildBody,
    parseChunk:d=>d.choices?.[0]?.delta?.content||'', type:'compat'
  }
};

// ── Subscription service templates ─────────────────────────────
// (Suscripción web eliminada en v2.6 — solo conexión por API key)


// ── App state ───────────────────────────────────────────────────
const state = {
  mode: 'chat',
  messages: [],
  providers: [],
  activeProviderId: null,
  isLoading: false,
  abortCtrl: null,           // AbortController for current stream
  dropdownOpen: false,
  formConnType: 'api',
  editingProviderId: null,
  selectedTabIds: new Set(),
  allTabs: [],
  memos: [],
  editingMemoId: null,
  memoSearchQuery: '',
  memoGroupBy: 'none',
  formMemoType: 'libre',
  formMemoTags: [],
  formMemoSource: null,
  formMemoAnchor: null,
  assistStep: 0,
  assistAnswers: {},
  graphVisible: false,
  diarioQs: null,
  ytCache: null,        // {videoId,title,segments,...}
  videoContext: false,  // chat con contexto del video activo
  pendingSource: null,  // fuente (url/title) a heredar por el próximo memo guardado
  bilingualView: true,
  history: [],
  historySearchQuery: '',
  currentHistoryId: null
};

// ── DOM refs ────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const el = {
  app:$('app'), modelPill:$('modelPill'), modelPillText:$('modelPillText'),
  modelPillDot:$('modelPillDot'), settingsBtn:$('settingsBtn'),
  modeTabs:document.querySelectorAll('.mode-tab'),
  translateBar:$('translateBar'), targetLang:$('targetLang'), bilingualToggle:$('bilingualToggle'),
  researchBar:$('researchBar'), tabsList:$('tabsList'), selectAllTabs:$('selectAllTabs'),
  memosPanel:$('memosPanel'), memoNewBtn:$('memoNewBtn'), memoSearch:$('memoSearch'),
  memoEditor:$('memoEditor'), memoTitleInput:$('memoTitleInput'), memoContentInput:$('memoContentInput'),
  memoEditorMeta:$('memoEditorMeta'), memoCancelBtn:$('memoCancelBtn'), memoSaveBtn:$('memoSaveBtn'),
  memosList:$('memosList'), memosEmpty:$('memosEmpty'),
  memoGroupBy:$('memoGroupBy'), memoExportBtn:$('memoExportBtn'), memoExportMenu:$('memoExportMenu'),
  storageBar:$('storageBar'),
  memoTypeRow:$('memoTypeRow'), memoDiario:$('memoDiario'),
  memoQsBtn:$('memoQsBtn'), memoQsEditor:$('memoQsEditor'), memoQsText:$('memoQsText'),
  memoQsSave:$('memoQsSave'), memoQsCancel:$('memoQsCancel'), memoQsReset:$('memoQsReset'),
  diarioReminder:$('diarioReminder'), diarioNowBtn:$('diarioNowBtn'), diarioDismissBtn:$('diarioDismissBtn'),
  memoImportBtn:$('memoImportBtn'), memoImportInput:$('memoImportInput'),
  memoProjectInput:$('memoProjectInput'), projectsDatalist:$('projectsDatalist'),
  memoTagsChips:$('memoTagsChips'), memoTagInput:$('memoTagInput'), tagsDatalist:$('tagsDatalist'),
  memoAnchorBox:$('memoAnchorBox'), memoAnchorQuote:$('memoAnchorQuote'), memoAnchorRemove:$('memoAnchorRemove'),
  memoRelated:$('memoRelated'), memoRelatedList:$('memoRelatedList'), memoAiSuggest:$('memoAiSuggest'),
  memoAssistBtn:$('memoAssistBtn'), memoAssist:$('memoAssist'), assistProgress:$('assistProgress'),
  assistQuestion:$('assistQuestion'), assistAnswer:$('assistAnswer'),
  assistSkip:$('assistSkip'), assistNext:$('assistNext'), assistClose:$('assistClose'),
  memoGraphBtn:$('memoGraphBtn'), memoGraph:$('memoGraph'),
  memoLinksBtn:$('memoLinksBtn'), memoLinksBox:$('memoLinksBox'), memoLinksList:$('memoLinksList'), linksClose:$('linksClose'),
  historyPanel:$('historyPanel'), historySearch:$('historySearch'),
  historyList:$('historyList'), historyEmpty:$('historyEmpty'),
  inputArea:document.getElementById('inputArea'),
  messagesArea:$('messagesArea'), welcomeScreen:$('welcomeScreen'), welcomeDesc:$('welcomeDesc'),
  welcomeBtns:$('welcomeBtns'), quickChips:$('quickChips'),
  messages:$('messages'), typingIndicator:$('typingIndicator'),
  userInput:$('userInput'), sendBtn:$('sendBtn'), actionBar:$('actionBar'),
  dropdownOverlay:$('dropdownOverlay'), modelDropdown:$('modelDropdown'),
  dropdownInner:$('dropdownInner'), manageModels:$('manageModels'),
  settingsPanel:$('settingsPanel'), closeSettings:$('closeSettings'),
  providersList:$('providersList'), addProviderBtn:$('addProviderBtn'),
  addProviderForm:$('addProviderForm'), formTitle:$('formTitle'),
  apiFields:$('apiFields'),
  providerType:$('providerType'), apiKeyRow:$('apiKeyRow'), apiKeyInput:$('apiKeyInput'),
  toggleApiKey:$('toggleApiKey'), keyHintLink:$('keyHintLink'),
  baseUrlRow:$('baseUrlRow'), baseUrlInput:$('baseUrlInput'),
  modelSelect:$('modelSelect'), customModelInput:$('customModelInput'),
  nicknameInput:$('nicknameInput'), cancelFormBtn:$('cancelFormBtn'), saveProviderBtn:$('saveProviderBtn'),
  setupBtn:$('setupBtn'), qSummarize:$('qSummarize'), qResearch:$('qResearch'), qTranslate:$('qTranslate')
};

// ── Storage ─────────────────────────────────────────────────────
async function loadStorage() {
  const d = await chrome.storage.local.get(['picona_providers','picona_active']);
  state.providers = d.picona_providers || [];
  state.activeProviderId = d.picona_active || null;

  // La conexión por "suscripción web" está desactivada: retirar esos
  // proveedores de la lista activa (respaldados, no destruidos).
  const subs = state.providers.filter(p => p.connType === 'subscription');
  if (subs.length) {
    state.providers = state.providers.filter(p => p.connType !== 'subscription');
    await chrome.storage.local.set({
      picona_providers: state.providers,
      picona_providers_sub_backup: subs
    });
    if (subs.some(s => s.id === state.activeProviderId)) {
      state.activeProviderId = state.providers[0]?.id || null;
      await chrome.storage.local.set({ picona_active: state.activeProviderId });
    }
  }

  if (!state.activeProviderId && state.providers.length) {
    state.activeProviderId = state.providers[0].id;
    await chrome.storage.local.set({ picona_active: state.activeProviderId });
  }
}
async function saveStorage() {
  await chrome.storage.local.set({ picona_providers: state.providers, picona_active: state.activeProviderId });
}
async function loadMemos() {
  const d = await chrome.storage.local.get(['picona_memos']);
  state.memos = d.picona_memos || [];
  // ── Migration to v2 schema (number, type, tags, project) ──
  let migrated=false;
  // Assign numbers by creation order to memos that lack one
  const numbered=state.memos.filter(m=>typeof m.number==='number');
  let nextNum=numbered.length?Math.max(...numbered.map(m=>m.number))+1:1;
  [...state.memos].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).forEach(m=>{
    if(typeof m.number!=='number'){ m.number=nextNum++; migrated=true; }
    if(!m.type){ m.type=m.sourceUrl?'pagina':'libre'; migrated=true; }
    if(!Array.isArray(m.tags)){ m.tags=[]; migrated=true; }
    if(m.project===undefined){ m.project=''; migrated=true; }
  });
  if(migrated) await saveMemos();
}
async function nextMemoNumber(){
  const d=await chrome.storage.local.get(['picona_memo_counter']);
  // Semilla inicial: continuar desde el número más alto jamás usado
  let counter=d.picona_memo_counter
    ?? (state.memos.length?Math.max(...state.memos.map(m=>m.number||0)):0);
  counter+=1;
  await chrome.storage.local.set({picona_memo_counter:counter});
  return counter;
}
function allTags(){
  return [...new Set(state.memos.flatMap(m=>m.tags||[]))].sort();
}
function allProjects(){
  return [...new Set(state.memos.map(m=>m.project).filter(Boolean))].sort();
}
async function saveMemos() {
  await chrome.storage.local.set({ picona_memos: state.memos });
}
async function loadHistory() {
  const d = await chrome.storage.local.get(['picona_history']);
  state.history = d.picona_history || [];
}
async function saveHistory() {
  // Cap history to avoid unbounded storage growth
  if(state.history.length>100) state.history=state.history.slice(0,100);
  await chrome.storage.local.set({ picona_history: state.history });
}
function getActive() { return state.providers.find(p => p.id === state.activeProviderId) || null; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// ── Markdown ─────────────────────────────────────────────────────
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function md(text){
  if(!text) return '';
  let h = text;
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g,(_,l,c)=>`<pre><code class="${l?'lang-'+l:''}">${esc(c.trim())}</code></pre>`);
  h = h.replace(/`([^`\n]+)`/g,(_,c)=>`<code>${esc(c)}</code>`);
  h = h.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h = h.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g,'<em>$1</em>');
  h = h.replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>');
  h = h.replace(/^---$/gm,'<hr>');
  h = h.replace(/^\- (.+)$/gm,'<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)/g,m=>`<ul>${m}</ul>`);
  h = h.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  const lines=h.split('\n'); const out=[]; let inP=false;
  for(const ln of lines){
    if(/^<(h[123]|ul|ol|pre|blockquote|hr)/.test(ln)||ln.trim()===''){ if(inP){out.push('</p>');inP=false;} if(ln.trim())out.push(ln); }
    else{ if(!inP){out.push('<p>');inP=true;} out.push(ln); }
  }
  if(inP)out.push('</p>');
  return out.join('\n');
}

// ── Messages ─────────────────────────────────────────────────────
function addMessage(role, content, extraClass=''){
  const id=uid();
  state.messages.push({id,role,content,ts:Date.now()});
  renderMsg({id,role,content,extraClass});
  scrollBottom();
  return id;
}
function renderMsg({id,role,content,extraClass=''}){
  const wrap=document.createElement('div');
  wrap.className=`msg ${role} ${extraClass}`.trim();
  wrap.dataset.id=id;

  const bubble=document.createElement('div');
  bubble.className='msg-bubble';

  if(role==='user') bubble.textContent=content;
  else if(role==='system') bubble.innerHTML=esc(content);
  else bubble.innerHTML=md(content);

  wrap.appendChild(bubble);

  if(role==='assistant'){
    const acts=document.createElement('div'); acts.className='msg-actions';
    const copyBtn=document.createElement('button');
    copyBtn.className='msg-action-btn';
    copyBtn.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar`;
    copyBtn.addEventListener('click',()=>copyMsg(id));
    acts.appendChild(copyBtn);

    const memoBtn=document.createElement('button');
    memoBtn.className='msg-action-btn memo-save';
    memoBtn.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 001 1h4"/><path d="M5 12V5a2 2 0 012-2h7l5 5v9a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/><path d="M3 17l3 3 3-3"/><path d="M6 20v-7"/></svg> Guardar como memo`;
    memoBtn.addEventListener('click',async ()=>{
      const m=state.messages.find(x=>x.id===id);
      if(!m) return;
      await quickSaveMemo({
        title: m.content.replace(/[#*`]/g,'').split('\n')[0].slice(0,60),
        content: m.content,
        sourceUrl: m.sourceUrl||null,
        sourceTitle: m.sourceTitle||null,
        type: m.sourceUrl?'pagina':'libre'
      });
      memoBtn.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg> Guardado`;
      setTimeout(()=>{
        memoBtn.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 001 1h4"/><path d="M5 12V5a2 2 0 012-2h7l5 5v9a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/><path d="M3 17l3 3 3-3"/><path d="M6 20v-7"/></svg> Guardar como memo`;
      },1800);
    });
    acts.appendChild(memoBtn);

    wrap.appendChild(acts);
  }
  el.messages.appendChild(wrap);
  if(state.messages.filter(m=>m.role!=='system').length>0) el.welcomeScreen.style.display='none';
}
function copyMsg(id){
  const m=state.messages.find(x=>x.id===id);
  if(m) navigator.clipboard.writeText(m.content).catch(()=>{});
};
function updateStream(id,delta){
  const m=state.messages.find(x=>x.id===id); if(!m) return;
  m.content+=delta;
  const b=el.messages.querySelector(`[data-id="${id}"] .msg-bubble`);
  if(b) b.innerHTML=md(m.content);
  scrollBottom();
}
function scrollBottom(){ el.messagesArea.scrollTop=el.messagesArea.scrollHeight; }
function clearMessages(){ state.messages=[]; el.messages.innerHTML=''; el.welcomeScreen.style.display=''; }

// ── Memos ─────────────────────────────────────────────────────────
function fmtDate(ts){
  const d=new Date(ts);
  const today=new Date();
  const sameDay=d.toDateString()===today.toDateString();
  const time=d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  if(sameDay) return `Hoy, ${time}`;
  return d.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})+`, ${time}`;
}

// Fecha larga en español para exportaciones: "viernes, junio 13 2026, 9:05"
function fmtDateLong(ts){
  const d=new Date(ts);
  const dias=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const h=d.getHours(), m=String(d.getMinutes()).padStart(2,'0');
  return `${dias[d.getDay()]}, ${meses[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}, ${h}:${m}`;
}

function openMemoEditor(memo){
  state.editingMemoId = memo?.id || null;
  state.formMemoType = memo?.type || 'libre';
  state.formMemoTags = [...(memo?.tags||[])];
  state.formMemoSource = memo?.sourceUrl ? {url:memo.sourceUrl,title:memo.sourceTitle} : null;
  state.formMemoAnchor = memo?.anchor || null;
  renderAnchorBox();

  el.memoTitleInput.value = memo?.title || '';
  el.memoContentInput.value = memo?.content || '';
  el.memoProjectInput.value = memo?.project || '';

  // Diario answers (campos dinámicos según preguntas personalizadas)
  renderDiarioFields(memo?.diarioAnswers||{});

  setMemoFormType(state.formMemoType);
  renderTagChips();
  refreshDatalists();

  if(memo?.sourceUrl){
    el.memoEditorMeta.innerHTML = `Fuente: <a href="${esc(memo.sourceUrl)}" target="_blank">${esc(memo.sourceTitle||memo.sourceUrl)}</a>`;
  } else {
    el.memoEditorMeta.textContent = '';
  }
  renderRelatedMemos(memo);
  el.memoEditor.style.display='flex';
  el.memosList.style.display='none';        // dar toda la altura al editor
  el.memoEditor.scrollTop=0;
  el.memoTitleInput.focus();
}

function renderAnchorBox(){
  if(state.formMemoAnchor){
    el.memoAnchorQuote.textContent=state.formMemoAnchor;
    el.memoAnchorBox.style.display='flex';
  } else {
    el.memoAnchorBox.style.display='none';
  }
}

function renderRelatedMemos(memo){
  const tags=memo?.tags?.length?memo.tags:state.formMemoTags;
  if(!tags?.length){ el.memoRelated.style.display='none'; return; }
  const related=state.memos.filter(m=>
    m.id!==(memo?.id) && (m.tags||[]).some(t=>tags.includes(t))
  ).slice(0,6);
  if(!related.length){ el.memoRelated.style.display='none'; return; }
  el.memoRelatedList.innerHTML=related.map(m=>{
    const shared=(m.tags||[]).filter(t=>tags.includes(t)).map(t=>'#'+esc(t)).join(' ');
    return `<button class="related-item" data-rel="${m.id}">
      <span class="memo-num">#${m.number}</span> ${esc(m.title||'Sin título')}
      <span class="related-tags">${shared}</span>
    </button>`;
  }).join('');
  el.memoRelatedList.querySelectorAll('[data-rel]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const m=state.memos.find(x=>x.id===btn.dataset.rel);
      if(m) openMemoEditor(m);
    });
  });
  el.memoRelated.style.display='flex';
}

function setMemoFormType(t){
  state.formMemoType=t;
  el.memoTypeRow.querySelectorAll('.memo-type-btn').forEach(b=>
    b.classList.toggle('active',b.dataset.mtype===t));
  el.memoDiario.style.display = t==='diario' ? 'flex' : 'none';
  el.memoContentInput.style.display = t==='diario' ? 'none' : '';
  if(t==='pagina' && !state.formMemoSource){
    // Capture current page as source + selection as anchor quote
    chrome.runtime.sendMessage({type:'GET_CURRENT_TAB'}).then(async r=>{
      if(r?.tab){
        state.formMemoSource={url:r.tab.url,title:r.tab.title};
        el.memoEditorMeta.innerHTML=`Fuente: <a href="${esc(r.tab.url)}" target="_blank">${esc(r.tab.title||r.tab.url)}</a>`;
        if(!state.formMemoAnchor){
          const sel=await getSelectedText().catch(()=>'');
          if(sel){ state.formMemoAnchor=sel.slice(0,600); renderAnchorBox(); }
        }
      }
    }).catch(()=>{});
  }
}

function renderTagChips(){
  el.memoTagsChips.innerHTML=state.formMemoTags.map((t,i)=>
    `<span class="tag-chip">${esc(t)}<button class="tag-x" data-i="${i}" title="Quitar">×</button></span>`).join('');
  el.memoTagsChips.querySelectorAll('.tag-x').forEach(btn=>{
    btn.addEventListener('click',()=>{
      state.formMemoTags.splice(parseInt(btn.dataset.i),1);
      renderTagChips();
    });
  });
}

function refreshDatalists(){
  el.tagsDatalist.innerHTML=allTags().map(t=>`<option value="${esc(t)}">`).join('');
  el.projectsDatalist.innerHTML=allProjects().map(p=>`<option value="${esc(p)}">`).join('');
}

function addTagFromInput(){
  const v=el.memoTagInput.value.trim().replace(/^#/,'');
  if(!v) return;
  if(!state.formMemoTags.includes(v)) state.formMemoTags.push(v);
  el.memoTagInput.value='';
  renderTagChips();
}

function closeMemoEditor(){
  state.editingMemoId=null;
  state.formMemoType='libre';
  state.formMemoTags=[];
  state.formMemoSource=null;
  state.formMemoAnchor=null;
  el.memoEditor.style.display='none';
  el.memosList.style.display='flex';
  el.memoTitleInput.value='';
  el.memoContentInput.value='';
  el.memoProjectInput.value='';
  el.memoTagInput.value='';
  renderDiarioFields({});
  el.memoEditorMeta.innerHTML='';
}

function diarioToContent(da){
  return diarioQs().map((q,i)=>[q,'a'+(i+1)])
    .filter(([,k])=>da[k]?.trim())
    .map(([q,k])=>`**${q}**\n${da[k].trim()}`).join('\n\n');
}

async function saveMemo(){
  addTagFromInput(); // capture any pending tag text
  const title=el.memoTitleInput.value.trim();
  const isDiario=state.formMemoType==='diario';
  const da=isDiario?getDiarioAnswers():null;
  const content=isDiario ? diarioToContent(da) : el.memoContentInput.value.trim();

  if(!title&&!content){ showError('Escribe al menos un título o contenido.'); return; }

  const project=el.memoProjectInput.value.trim();

  if(state.editingMemoId){
    const m=state.memos.find(x=>x.id===state.editingMemoId);
    if(m){
      m.title=title||content.slice(0,60);
      m.content=content;
      m.type=state.formMemoType;
      m.tags=[...state.formMemoTags];
      m.project=project;
      if(isDiario) m.diarioAnswers=da;
      if(state.formMemoSource){ m.sourceUrl=state.formMemoSource.url; m.sourceTitle=state.formMemoSource.title; }
      m.anchor=state.formMemoAnchor||null;
      m.updatedAt=Date.now();
    }
  } else {
    state.memos.unshift({
      id:uid(),
      number:await nextMemoNumber(),
      type:state.formMemoType,
      title: title || content.slice(0,60) || 'Sin título',
      content,
      tags:[...state.formMemoTags],
      project,
      ...(isDiario&&{diarioAnswers:da}),
      sourceUrl: state.formMemoSource?.url||null,
      sourceTitle: state.formMemoSource?.title||null,
      anchor: state.formMemoAnchor||null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  await saveMemos();
  closeMemoEditor();
  renderMemos();
  checkDiarioReminder();
}

function deleteMemo(id){
  const card=el.memosList.querySelector(`[data-memo-id="${id}"]`);
  if(!card) return;
  if(card.querySelector('.delete-confirm')) return;
  const conf=document.createElement('div'); conf.className='delete-confirm';
  conf.innerHTML=`¿Eliminar memo?
    <button class="confirm-yes" data-yes="${id}">Eliminar</button>
    <button class="confirm-no" data-no="${id}">Cancelar</button>`;
  card.appendChild(conf);
  conf.querySelector('.confirm-yes').addEventListener('click',async (e)=>{
    e.stopPropagation();
    state.memos=state.memos.filter(m=>m.id!==id);
    await saveMemos();
    renderMemos();
  });
  conf.querySelector('.confirm-no').addEventListener('click',(e)=>{
    e.stopPropagation();
    conf.remove();
  });
}

// ── Memo grouping & render ────────────────────────────────────────
const MEMO_TYPE_MARK={libre:'●',pagina:'◆',diario:'▣'};
const MEMO_TYPE_LABEL={libre:'Libre',pagina:'De página',diario:'Diario'};

function dateKey(ts){
  const d=new Date(ts);
  return d.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
}

function groupMemos(list){
  const g=state.memoGroupBy;
  if(g==='none') return [['',list]];
  const map=new Map();
  const push=(k,m)=>{ if(!map.has(k))map.set(k,[]); map.get(k).push(m); };
  list.forEach(m=>{
    if(g==='date') push(dateKey(m.createdAt),m);
    else if(g==='project') push(m.project||'(sin proyecto)',m);
    else if(g==='type') push(`${MEMO_TYPE_MARK[m.type]} ${MEMO_TYPE_LABEL[m.type]||m.type}`,m);
    else if(g==='source') push(m.sourceTitle||m.sourceUrl||'(sin fuente)',m);
    else if(g==='tag'){
      if(m.tags?.length) m.tags.forEach(t=>push('#'+t,m));
      else push('(sin etiquetas)',m);
    }
  });
  return [...map.entries()];
}

function memoCardHTML(m){
  const tagsHtml=(m.tags||[]).map(t=>`<span class="memo-card-tag">#${esc(t)}</span>`).join('');
  return `
    <div class="memo-card ${m.type==='diario'?'memo-diario-card':''}" data-memo-id="${m.id}">
      <div class="memo-card-head">
        <div class="memo-card-title"><span class="memo-num">#${m.number}</span> ${MEMO_TYPE_MARK[m.type]||'●'} ${esc(m.title||'Sin título')}</div>
        <div class="memo-card-acts">
          <button class="memo-card-btn" data-action="edit" data-id="${m.id}" title="Editar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="memo-card-btn" data-action="copy" data-id="${m.id}" title="Copiar como HTML (OneNote)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          <button class="memo-card-btn del" data-action="delete" data-id="${m.id}" title="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      ${m.anchor?`<div class="memo-card-anchor">"${esc(m.anchor.slice(0,120))}${m.anchor.length>120?'…':''}"</div>`:''}
      ${m.content&&m.content!==m.anchor?`<div class="memo-card-preview">${esc(m.content)}</div>`:''}
      ${tagsHtml?`<div class="memo-card-tags">${tagsHtml}</div>`:''}
      <div class="memo-card-foot">
        <span class="memo-card-date">${m.project?esc(m.project)+' · ':''}${fmtDate(m.createdAt)}</span>
        ${m.sourceUrl?`<a class="memo-card-source" href="${esc(m.sourceUrl)}" target="_blank" title="${esc(m.sourceUrl)}">${esc(m.sourceTitle||m.sourceUrl)}</a>`:''}
      </div>
    </div>`;
}

function renderMemos(){
  refreshDatalists();
  renderStorageBar();
  const q=state.memoSearchQuery.trim().toLowerCase();
  let list=q
    ? state.memos.filter(m=>(m.title+' '+m.content+' '+(m.tags||[]).join(' ')+' '+(m.project||'')).toLowerCase().includes(q))
    : [...state.memos];

  // Timeline: order by number desc (newest first)
  list.sort((a,b)=>(b.number||0)-(a.number||0));

  if(!list.length){
    el.memosList.innerHTML='';
    el.memosEmpty.style.display='flex';
    if(q){
      el.memosEmpty.querySelector('p').textContent='Sin resultados.';
      el.memosEmpty.querySelector('.memos-empty-sub').textContent=`No se encontraron memos para "${state.memoSearchQuery}".`;
    } else {
      el.memosEmpty.querySelector('p').textContent='Sin memos guardados.';
      el.memosEmpty.querySelector('.memos-empty-sub').textContent='Guarda fragmentos de páginas, respuestas de la IA o notas propias para consultarlas después.';
    }
    return;
  }
  el.memosEmpty.style.display='none';

  const groups=groupMemos(list);
  el.memosList.innerHTML=groups.map(([label,items])=>
    (label?`<div class="memo-group-header">${esc(label)} <span class="memo-group-count">${items.length}</span></div>`:'')+
    items.map(memoCardHTML).join('')
  ).join('');

  el.memosList.querySelectorAll('[data-action]').forEach(btn=>{
    const id=btn.dataset.id, action=btn.dataset.action;
    btn.addEventListener('click',(e)=>{
      e.stopPropagation();
      if(action==='edit') openMemoEditor(state.memos.find(m=>m.id===id));
      else if(action==='delete') deleteMemo(id);
      else if(action==='copy') copyMemoHTML(id);
    });
  });
  el.memosList.querySelectorAll('.memo-card').forEach(card=>{
    card.addEventListener('click',()=>{
      openMemoEditor(state.memos.find(m=>m.id===card.dataset.memoId));
    });
  });
}

// ── Export ────────────────────────────────────────────────────────
function memoToMarkdown(m){
  const fm=[
    '---',
    `numero: ${m.number}`,
    `tipo: ${m.type}`,
    `fecha: ${new Date(m.createdAt).toISOString()}`,
    `fecha_legible: "${fmtDateLong(m.createdAt)}"`,
    m.project?`proyecto: "${m.project}"`:null,
    m.tags?.length?`etiquetas: [${m.tags.join(', ')}]`:null,
    m.sourceUrl?`fuente: ${m.sourceUrl}`:null,
    m.sourceTitle?`fuente_titulo: "${m.sourceTitle.replace(/"/g,"'")}"`:null,
    '---'
  ].filter(Boolean).join('\n');
  const anchorBlock=m.anchor?`\n> ${m.anchor.replace(/\n/g,'\n> ')}\n`:'';
  return `${fm}\n\n# ${m.title||'Sin título'}\n${anchorBlock}\n${m.content||''}\n`;
}

function memoToHTML(m){
  const tagStr=(m.tags||[]).map(t=>'#'+t).join(' ');
  return `<div>
    <h2>#${m.number} ${esc(m.title||'Sin título')}</h2>
    <p><em>${MEMO_TYPE_LABEL[m.type]||m.type} · ${fmtDateLong(m.createdAt)}${m.project?' · '+esc(m.project):''}</em></p>
    ${tagStr?`<p><strong>${esc(tagStr)}</strong></p>`:''}
    ${m.sourceUrl?`<p>Fuente: <a href="${esc(m.sourceUrl)}">${esc(m.sourceTitle||m.sourceUrl)}</a></p>`:''}
    ${m.anchor?`<blockquote style="border-left:3px solid #0071E3;padding-left:8px;color:#555"><em>${esc(m.anchor)}</em></blockquote>`:''}
    <div>${esc(m.content||'').replace(/\n/g,'<br>')}</div>
  </div><hr>`;
}

function downloadFile(name,content,mime){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); },500);
}

function csvEscape(v){ return '"'+String(v??'').replace(/"/g,'""')+'"'; }

// ── PDF en modo lectura de la página activa ──────────────────────
async function exportPagePDF(){
  showToast('Preparando versión de lectura…');
  const r=await chrome.runtime.sendMessage({type:'OPEN_READER_PDF'});
  if(!r || r.ok===false){ showError(r?.error||'No se pudo generar el PDF.'); return; }
  showToast('✓ Se abrió la versión de lectura. Pulsa «Guardar como PDF».');
}

// ── Almacenamiento y respaldos ───────────────────────────────────
const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB (chrome.storage.local)
const BACKUP_MAX_AGE_DAYS = 30;

async function getStorageBytes(){
  try{
    if(chrome.storage.local.getBytesInUse){
      return await chrome.storage.local.getBytesInUse(null);
    }
  }catch{}
  // Fallback: estimar por tamaño del JSON
  try{
    const all=await chrome.storage.local.get(null);
    return new Blob([JSON.stringify(all)]).size;
  }catch{ return 0; }
}

async function registerBackup(){
  await chrome.storage.local.set({ picona_last_backup: Date.now() });
  state.lastBackup = Date.now();
  renderStorageBar();
}

function fmtBytes(b){
  if(b<1024) return b+' B';
  if(b<1024*1024) return (b/1024).toFixed(0)+' KB';
  return (b/1024/1024).toFixed(1)+' MB';
}

async function renderStorageBar(){
  const el2=$('storageBar');
  if(!el2) return;
  const used=await getStorageBytes();
  const pct=Math.min(100, Math.round(used/STORAGE_LIMIT_BYTES*100));
  const near = pct>=80;
  const d=await chrome.storage.local.get(['picona_last_backup']);
  const last=d.picona_last_backup||null;
  const ageDays = last ? Math.floor((Date.now()-last)/86400000) : null;
  const staleBackup = !last || ageDays>=BACKUP_MAX_AGE_DAYS;

  let warnMsg='';
  if(near) warnMsg=`Estás usando el ${pct}% del espacio. Conviene exportar un respaldo JSON y borrar memos antiguos.`;
  else if(staleBackup) warnMsg = last
    ? `Tu último respaldo fue hace ${ageDays} días. Te recomendamos exportar un respaldo JSON.`
    : `Aún no has hecho un respaldo. Te recomendamos exportar tus memos en JSON.`;

  el2.innerHTML=`
    <div class="storage-row">
      <span class="storage-label">Almacenamiento: ${fmtBytes(used)} de 10 MB (${pct}%)</span>
      ${last?`<span class="storage-backup">Último respaldo: hace ${ageDays===0?'menos de un día':ageDays+' día'+(ageDays===1?'':'s')}</span>`:`<span class="storage-backup">Sin respaldos</span>`}
    </div>
    <div class="storage-track"><div class="storage-fill ${near?'near':''}" style="width:${pct}%"></div></div>
    ${warnMsg?`<div class="storage-warn ${near?'crit':''}">${warnMsg} <button class="storage-backup-btn" id="storageBackupBtn">Exportar respaldo ahora</button></div>`:''}
  `;
  $('storageBackupBtn')?.addEventListener('click',()=>exportMemos('json'));
}

async function exportMemos(fmt){
  const list=[...state.memos].sort((a,b)=>(a.number||0)-(b.number||0));
  if(!list.length){ showError('No hay memos para exportar.'); return; }
  const stamp=new Date().toISOString().slice(0,10);

  if(fmt==='md'){
    const md=`# Memos Picona — exportado ${stamp}\n\n`+list.map(memoToMarkdown).join('\n---\n\n');
    downloadFile(`picona-memos-${stamp}.md`,md,'text/markdown');
  }
  else if(fmt==='csv'){
    const head=['numero','tipo','fecha','fecha_legible','titulo','contenido','cita_ancla','etiquetas','proyecto','fuente_url','fuente_titulo'].join(',');
    const rows=list.map(m=>[
      m.number,m.type,new Date(m.createdAt).toISOString(),fmtDateLong(m.createdAt),m.title,m.content,m.anchor||'',
      (m.tags||[]).join('; '),m.project||'',m.sourceUrl||'',m.sourceTitle||''
    ].map(csvEscape).join(','));
    downloadFile(`picona-memos-${stamp}.csv`,'\ufeff'+head+'\n'+rows.join('\n'),'text/csv');
  }
  else if(fmt==='json'){
    downloadFile(`picona-memos-${stamp}.json`,JSON.stringify(list,null,2),'application/json');
    await registerBackup();
  }
  else if(fmt==='obsidian'){ exportObsidian(); }
  else if(fmt==='zip-project'){ exportZipGrouped('project'); }
  else if(fmt==='zip-date'){ exportZipGrouped('date'); }
  else if(fmt==='html-clip'){
    const html=list.map(memoToHTML).join('\n');
    try{
      const blob=new Blob([html],{type:'text/html'});
      await navigator.clipboard.write([new ClipboardItem({'text/html':blob})]);
      showToast('✓ Copiado como HTML — pégalo en OneNote.');
    }catch(e){
      await navigator.clipboard.writeText(html).catch(()=>{});
      showToast('Copiado como texto (tu navegador no permite HTML enriquecido).');
    }
  }
  el.memoExportMenu.style.display='none';
}

async function copyMemoHTML(id){
  const m=state.memos.find(x=>x.id===id);
  if(!m) return;
  const html=memoToHTML(m);
  try{
    const blob=new Blob([html],{type:'text/html'});
    await navigator.clipboard.write([new ClipboardItem({'text/html':blob})]);
    showToast('✓ Memo copiado como HTML — pégalo en OneNote.');
  }catch(e){
    await navigator.clipboard.writeText(`#${m.number} ${m.title}\n\n${m.content}`).catch(()=>{});
    showToast('Memo copiado como texto.');
  }
}


// ── LLM one-shot helper (non-streaming accumulate) ───────────────
function llmOnce(prompt){
  return new Promise((resolve,reject)=>{
    let full='';
    state.abortCtrl=new AbortController();
    streamLLM([{role:'user',content:prompt}],
      c=>{full+=c;},
      ()=>resolve(full),
      err=>reject(new Error(err||'Error de IA')));
  });
}
function extractJSON(text){
  const m=text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if(!m) return null;
  try{ return JSON.parse(m[0]); }catch{ return null; }
}

// ── ✦ Sugerir título y etiquetas (IA, opcional) ──────────────────
async function aiSuggestTitleTags(){
  const prov=getActive();
  if(!prov){ showError('Configura un modelo de IA en Ajustes para usar esta función.'); return; }
  const isDiario=state.formMemoType==='diario';
  const content=isDiario
    ? Object.values(getDiarioAnswers()).filter(Boolean).join('\n')
    : el.memoContentInput.value.trim();
  if(!content){ showError('Escribe contenido primero.'); return; }

  el.memoAiSuggest.disabled=true;
  el.memoAiSuggest.textContent='✦ Consultando IA…';
  try{
    const existing=allTags();
    const res=await llmOnce(
`Analiza esta nota académica y responde SOLO con JSON: {"titulo":"...","etiquetas":["...","..."]}.
Título: máximo 8 palabras, en español. Etiquetas: 2-4, minúsculas, preferir de esta lista si aplican: [${existing.join(', ')}].

Nota:
${content.slice(0,2000)}`);
    const j=extractJSON(res);
    if(j?.titulo && !el.memoTitleInput.value.trim()) el.memoTitleInput.value=j.titulo.slice(0,120);
    if(Array.isArray(j?.etiquetas)){
      j.etiquetas.forEach(t=>{
        const tag=String(t).trim().toLowerCase().replace(/^#/,'');
        if(tag&&!state.formMemoTags.includes(tag)) state.formMemoTags.push(tag);
      });
      renderTagChips();
    }
    if(!j) showError('La IA no devolvió un formato válido. Intenta de nuevo.');
  }catch(e){
    showError('Error al consultar la IA: '+e.message);
  }finally{
    el.memoAiSuggest.disabled=false;
    el.memoAiSuggest.textContent='✦ Sugerir título y etiquetas (IA)';
  }
}

// ── ▣ Asistente diario guiado (local, sin IA) ────────────────────
const DIARIO_QS_DEFAULT=[
  '¿En qué trabajaste ayer o hace un rato que valga la pena recordar?',
  '¿Qué aprendiste, notaste, o sobre qué cambiaste tu pensamiento o lo estás dudando?',
  '¿Probaste, usaste o te peleaste con alguna herramienta de IA, flujo de trabajo, prompt, etc.?',
  '¿Hay alguna pequeña historia, lección u opinión de ayer que se pueda convertir en un ítem académico?'
];
function diarioQs(){ return state.diarioQs?.length ? state.diarioQs : DIARIO_QS_DEFAULT; }
async function loadDiarioQs(){
  const d=await chrome.storage.local.get(['picona_diario_qs']);
  state.diarioQs=Array.isArray(d.picona_diario_qs)&&d.picona_diario_qs.length?d.picona_diario_qs:null;
}
async function saveDiarioQs(qs){
  state.diarioQs=qs?.length?qs:null;
  if(state.diarioQs) await chrome.storage.local.set({picona_diario_qs:state.diarioQs});
  else await chrome.storage.local.remove('picona_diario_qs');
}
function renderDiarioFields(answers={}){
  el.memoDiario.innerHTML=diarioQs().map((q,i)=>
    `<label class="diario-q">${esc(q)}</label>
     <textarea class="memo-content-input diario-a" data-dq="${i+1}" rows="2">${esc(answers['a'+(i+1)]||'')}</textarea>`
  ).join('');
}
function getDiarioAnswers(){
  const out={};
  el.memoDiario.querySelectorAll('[data-dq]').forEach(t=>{ out['a'+t.dataset.dq]=t.value.trim(); });
  return out;
}

function startAssist(){
  state.assistStep=0;
  state.assistAnswers={};
  el.memoEditor.style.display='none';
  el.memoAssist.style.display='flex';
  el.memosList.style.display='none';
  renderAssistStep();
}
function renderAssistStep(){
  const total=diarioQs().length;
  el.assistProgress.textContent=`Pregunta ${state.assistStep+1} de ${total}`;
  el.assistQuestion.textContent=diarioQs()[state.assistStep];
  el.assistAnswer.value=state.assistAnswers['a'+(state.assistStep+1)]||'';
  el.assistNext.textContent=state.assistStep===total-1?'Terminar y revisar →':'Siguiente →';
  el.assistAnswer.focus();
}
function assistAdvance(skip){
  const total=diarioQs().length;
  if(!skip) state.assistAnswers['a'+(state.assistStep+1)]=el.assistAnswer.value.trim();
  if(state.assistStep<total-1){ state.assistStep++; renderAssistStep(); return; }
  // Finish: open editor as diario with answers pre-filled for review
  el.memoAssist.style.display='none';
  openMemoEditor(null);
  setMemoFormType('diario');
  renderDiarioFields(state.assistAnswers);
  el.memoTitleInput.value=`Diario ${new Date().toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}`;
  el.memoTitleInput.focus();
}

// ── Editor de preguntas del diario ───────────────────────────────
function openQsEditor(){
  el.memoQsText.value=diarioQs().join('\n');
  el.memoQsEditor.style.display='flex';
  el.memoAssist.style.display='none';
}
async function saveQsEditor(){
  const qs=el.memoQsText.value.split('\n').map(q=>q.trim()).filter(Boolean).slice(0,10);
  if(!qs.length){ showError('Escribe al menos una pregunta.'); return; }
  await saveDiarioQs(qs);
  el.memoQsEditor.style.display='none';
  showToast('✓ Preguntas del diario actualizadas.');
}

// ── Recordatorio de diario ───────────────────────────────────────
async function checkDiarioReminder(){
  const today=new Date().toDateString();
  const hasToday=state.memos.some(m=>m.type==='diario'&&new Date(m.createdAt).toDateString()===today);
  if(hasToday){ el.diarioReminder.style.display='none'; return; }
  const d=await chrome.storage.local.get(['picona_diario_dismiss']);
  if(d.picona_diario_dismiss===today){ el.diarioReminder.style.display='none'; return; }
  el.diarioReminder.style.display='flex';
}

// ── Importar respaldo JSON ───────────────────────────────────────
async function importMemosJSON(file){
  try{
    const text=await file.text();
    const data=JSON.parse(text);
    if(!Array.isArray(data)) throw new Error('El archivo no contiene una lista de memos.');
    const existing=new Set(state.memos.map(m=>m.id));
    let added=0, skipped=0;
    for(const m of data){
      if(!m||typeof m!=='object'||!m.id){ skipped++; continue; }
      if(existing.has(m.id)){ skipped++; continue; }
      state.memos.push({
        id:m.id,
        number:typeof m.number==='number'?m.number:0,
        type:['libre','pagina','diario'].includes(m.type)?m.type:(m.sourceUrl?'pagina':'libre'),
        title:String(m.title||'Sin título').slice(0,200),
        content:String(m.content||''),
        tags:Array.isArray(m.tags)?m.tags.map(String):[],
        project:String(m.project||''),
        diarioAnswers:m.diarioAnswers&&typeof m.diarioAnswers==='object'?m.diarioAnswers:undefined,
        sourceUrl:m.sourceUrl?String(m.sourceUrl):null,
        sourceTitle:m.sourceTitle?String(m.sourceTitle):null,
        anchor:m.anchor?String(m.anchor).slice(0,600):null,
        createdAt:typeof m.createdAt==='number'?m.createdAt:Date.now(),
        updatedAt:typeof m.updatedAt==='number'?m.updatedAt:Date.now()
      });
      existing.add(m.id); added++;
    }
    // Asignar números a los que llegaron sin número y subir el contador
    for(const m of state.memos){ if(!m.number) m.number=await nextMemoNumber(); }
    const maxNum=Math.max(0,...state.memos.map(m=>m.number||0));
    const c=await chrome.storage.local.get(['picona_memo_counter']);
    if((c.picona_memo_counter||0)<maxNum) await chrome.storage.local.set({picona_memo_counter:maxNum});
    await saveMemos();
    renderMemos();
    showToast(`✓ Importados ${added} memo${added===1?'':'s'}${skipped?` (${skipped} omitidos: duplicados o inválidos)`:''}.`);
  }catch(e){
    showError('No se pudo importar: '+e.message);
  }finally{
    el.memoImportInput.value='';
  }
}

// ── ✦ Vínculos sugeridos por IA (con aprobación) ─────────────────
async function suggestLinks(){
  const prov=getActive();
  if(!prov){ showError('Configura un modelo de IA en Ajustes para usar esta función.'); return; }
  if(state.memos.length<2){ showError('Necesitas al menos 2 memos.'); return; }

  el.memoLinksBox.style.display='flex';
  el.memoLinksList.innerHTML='<div class="links-loading">'+thinkingHTML('Analizando temas comunes entre tus memos…')+'</div>';

  const corpus=state.memos.slice(0,40).map(m=>
    `#${m.number}: "${m.title}" — ${(m.content||'').slice(0,150)} [tags: ${(m.tags||[]).join(',')||'ninguna'}]`
  ).join('\n');

  try{
    const res=await llmOnce(
`Estos son memos de investigación. Identifica hasta 5 pares con un tema común que NO compartan ya una etiqueta.
Responde SOLO con JSON: [{"a":numero,"b":numero,"tema":"breve descripción","etiqueta":"tag-sugerida-minusculas"}]

${corpus}`);
    const pairs=extractJSON(res);
    if(!Array.isArray(pairs)||!pairs.length){
      el.memoLinksList.innerHTML='<div class="links-loading">La IA no encontró vínculos nuevos (o el formato falló). Intenta de nuevo.</div>';
      return;
    }
    el.memoLinksList.innerHTML=pairs.map((p,i)=>{
      const ma=state.memos.find(m=>m.number===p.a), mb=state.memos.find(m=>m.number===p.b);
      if(!ma||!mb) return '';
      return `<div class="link-suggestion" data-li="${i}">
        <div class="link-pair">#${ma.number} ${esc(ma.title)} ↔ #${mb.number} ${esc(mb.title)}</div>
        <div class="link-theme">${esc(p.tema||'')} → <span class="memo-card-tag">#${esc(p.etiqueta||'vinculo')}</span></div>
        <div class="memo-editor-actions">
          <button class="btn-secondary link-discard">Descartar</button>
          <button class="btn-primary link-approve" data-a="${ma.id}" data-b="${mb.id}" data-tag="${esc(p.etiqueta||'vinculo')}">Aprobar vínculo</button>
        </div>
      </div>`;
    }).join('')||'<div class="links-loading">Sin pares válidos.</div>';

    el.memoLinksList.querySelectorAll('.link-discard').forEach(b=>
      b.addEventListener('click',()=>b.closest('.link-suggestion').remove()));
    el.memoLinksList.querySelectorAll('.link-approve').forEach(b=>
      b.addEventListener('click',async ()=>{
        const tag=b.dataset.tag.toLowerCase().replace(/^#/,'');
        [b.dataset.a,b.dataset.b].forEach(id=>{
          const m=state.memos.find(x=>x.id===id);
          if(m && !m.tags.includes(tag)) m.tags.push(tag);
        });
        await saveMemos();
        b.closest('.link-suggestion').remove();
        showToast(`✓ Vínculo aprobado: #${tag}`);
        renderMemos();
      }));
  }catch(e){
    el.memoLinksList.innerHTML=`<div class="links-loading">Error: ${esc(e.message)}</div>`;
  }
}

// ── Red de memos: grafo SVG (layout circular, local) ─────────────
function toggleGraph(){
  state.graphVisible=!state.graphVisible;
  el.memoGraph.style.display=state.graphVisible?'block':'none';
  el.memosList.style.display=state.graphVisible?'none':'flex';
  el.memoGraphBtn.classList.toggle('active-tool',state.graphVisible);
  if(state.graphVisible) renderGraph();
}

function renderGraph(){
  const memos=state.memos.slice(0,60);
  if(memos.length<2){
    el.memoGraph.innerHTML='<div class="links-loading">Necesitas al menos 2 memos para ver la red.</div>';
    return;
  }
  // Aristas: etiquetas compartidas
  const edges=[];
  for(let i=0;i<memos.length;i++)for(let j=i+1;j<memos.length;j++){
    const shared=(memos[i].tags||[]).filter(t=>(memos[j].tags||[]).includes(t));
    if(shared.length) edges.push([i,j,shared]);
  }
  const degree=memos.map((_,i)=>edges.reduce((a,[x,y])=>a+(x===i||y===i?1:0),0));

  // ── Layout de fuerzas (repulsión + resortes + gravedad al centro) ──
  const W=380,H=420,cx=W/2,cy=H/2;
  const nodes=memos.map((_,i)=>({
    x:cx+(Math.random()-0.5)*W*0.7,
    y:cy+(Math.random()-0.5)*H*0.7,
    vx:0,vy:0
  }));
  const K_REP=2600, K_SPRING=0.012, REST=85, K_CENTER=0.015, DAMP=0.82;
  for(let it=0;it<220;it++){
    for(let i=0;i<nodes.length;i++){
      let fx=0,fy=0;
      for(let j=0;j<nodes.length;j++){
        if(i===j)continue;
        let dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;
        let d2=dx*dx+dy*dy||1, d=Math.sqrt(d2);
        const rep=K_REP/d2;
        fx+=dx/d*rep; fy+=dy/d*rep;
      }
      fx+=(cx-nodes[i].x)*K_CENTER;
      fy+=(cy-nodes[i].y)*K_CENTER;
      nodes[i].vx=(nodes[i].vx+fx)*DAMP;
      nodes[i].vy=(nodes[i].vy+fy)*DAMP;
    }
    edges.forEach(([a,b])=>{
      const dx=nodes[b].x-nodes[a].x, dy=nodes[b].y-nodes[a].y;
      const d=Math.sqrt(dx*dx+dy*dy)||1;
      const f=K_SPRING*(d-REST);
      const fx=dx/d*f, fy=dy/d*f;
      nodes[a].vx+=fx; nodes[a].vy+=fy;
      nodes[b].vx-=fx; nodes[b].vy-=fy;
    });
    nodes.forEach(n=>{
      n.x=Math.max(26,Math.min(W-26,n.x+n.vx));
      n.y=Math.max(26,Math.min(H-26,n.y+n.vy));
    });
  }

  // Paleta multicolor estilo ejemplo; tamaño = nº de conexiones
  const PALETTE=['#1BA3C6','#4338CA','#0A9928','#F59E0B','#FF8200','#E91E8C',
                 '#7C3AED','#0891B2','#DC2626','#65A30D','#0EA5E9','#B45309',
                 '#7F1D1D','#86EFAC','#818CF8','#F472B6','#14B8A6','#A855F7'];
  const r=i=>8+Math.min(degree[i]*4,22);

  const edgeSvg=edges.map(([i,j,sh])=>
    `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}"
       stroke="#D2D2D7" stroke-width="${Math.min(1.2+sh.length*0.8,3.5)}" stroke-linecap="round">
       <title>${sh.map(t=>'#'+t).join(' ')}</title></line>`).join('');

  const TYPE_NAME={libre:'Libre',pagina:'De página',diario:'Diario'};
  const nodeSvg=memos.map((m,i)=>
    `<g class="graph-node" data-gid="${m.id}" transform="translate(${nodes[i].x.toFixed(1)},${nodes[i].y.toFixed(1)})">
      <circle r="${r(i)}" fill="${PALETTE[i%PALETTE.length]}"/>
      ${r(i)>=14?`<text class="graph-num" text-anchor="middle" dy="3.5">#${m.number}</text>`:''}
      <title>#${m.number} ${m.title}
${TYPE_NAME[m.type]||m.type} · ${degree[i]} conexión${degree[i]===1?'':'es'}
${(m.tags||[]).map(t=>'#'+t).join(' ')}</title>
    </g>`).join('');

  const isolated=degree.filter(d=>d===0).length;
  el.memoGraph.innerHTML=`
    <div class="graph-legend">
      <span class="graph-meta">Tamaño = nº de conexiones · ${edges.length} vínculo${edges.length===1?'':'s'} · ${isolated} sin conectar · pasa el cursor para detalles</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="graph-svg">${edgeSvg}${nodeSvg}</svg>`;
  el.memoGraph.querySelectorAll('.graph-node').forEach(n=>{
    n.addEventListener('click',()=>{
      const m=state.memos.find(x=>x.id===n.dataset.gid);
      if(m){ toggleGraph(); openMemoEditor(m); }
    });
  });
}

// ── ZIP (store, sin compresión — formato estándar) ───────────────
function crc32(buf){
  let t=crc32.t;
  if(!t){t=crc32.t=new Int32Array(256);
    for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c;}}
  let c=-1;
  for(let i=0;i<buf.length;i++)c=t[(c^buf[i])&0xFF]^(c>>>8);
  return (c^-1)>>>0;
}
function makeZip(files){ // files: [{name, text}]
  const enc=new TextEncoder();
  const chunks=[],central=[];let offset=0;
  files.forEach(f=>{
    const name=enc.encode(f.name), data=enc.encode(f.text), crc=crc32(data);
    const local=new Uint8Array(30+name.length);
    const dv=new DataView(local.buffer);
    dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0x0800,true);
    dv.setUint16(8,0,true);dv.setUint32(14,crc,true);
    dv.setUint32(18,data.length,true);dv.setUint32(22,data.length,true);
    dv.setUint16(26,name.length,true);
    local.set(name,30);
    chunks.push(local,data);
    const cd=new Uint8Array(46+name.length);
    const cv=new DataView(cd.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
    cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint32(16,crc,true);
    cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);
    cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);
    cd.set(name,46);
    central.push(cd);
    offset+=local.length+data.length;
  });
  const cdSize=central.reduce((a,c)=>a+c.length,0);
  const end=new Uint8Array(22);
  const ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true);ev.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}
function slug(t){return String(t||'sin-titulo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'memo';}

function exportZipGrouped(by){
  const list=[...state.memos].sort((a,b)=>(a.number||0)-(b.number||0));
  if(!list.length){ showError('No hay memos para exportar.'); return; }
  const files=list.map(m=>{
    const folder = by==='project'
      ? slug(m.project||'sin-proyecto')
      : new Date(m.createdAt).toISOString().slice(0,7); // YYYY-MM
    return { name:`${folder}/${String(m.number).padStart(3,'0')}-${slug(m.title)}.md`, text:memoToMarkdown(m) };
  });
  const stamp=new Date().toISOString().slice(0,10);
  const blob=makeZip(files);
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`picona-memos-${by==='project'?'proyectos':'fechas'}-${stamp}.zip`;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},500);
}


// ── Exportación optimizada para Obsidian ─────────────────────────
function obsidianFilename(m){
  return `${String(m.number).padStart(3,'0')}-${slug(m.title)}`;
}
function memoToObsidian(m,byNumber){
  const fecha=new Date(m.createdAt);
  const fm=[
    '---',
    `numero: ${m.number}`,
    `tipo: ${m.type}`,
    `fecha: ${fecha.toISOString()}`,
    `fecha_legible: "${fmtDateLong(m.createdAt)}"`,
    m.project?`proyecto: "${m.project}"`:null,
    (m.tags&&m.tags.length)?'etiquetas:\n'+m.tags.map(t=>`  - ${t}`).join('\n'):null,
    m.sourceUrl?`fuente: ${m.sourceUrl}`:null,
    m.sourceTitle?`fuente_titulo: "${(m.sourceTitle||'').replace(/"/g,"'")}"`:null,
    '---'
  ].filter(Boolean).join('\n');

  const tagsInline=(m.tags||[]).map(t=>'#'+t.replace(/\s+/g,'-')).join(' ');
  const anchorCallout=m.anchor
    ? `\n> [!quote] Cita ancla\n> ${m.anchor.replace(/\n/g,'\n> ')}\n`
    : '';
  const fuente=m.sourceUrl
    ? `\n**Fuente:** [${m.sourceTitle||m.sourceUrl}](${m.sourceUrl})\n`
    : '';

  // Wikilinks a memos relacionados (comparten ≥1 etiqueta)
  const related=state.memos.filter(x=>
    x.id!==m.id && (x.tags||[]).some(t=>(m.tags||[]).includes(t))
  ).slice(0,8);
  const relBlock=related.length
    ? `\n## Relacionados\n`+related.map(r=>{
        const shared=(r.tags||[]).filter(t=>(m.tags||[]).includes(t)).map(t=>'#'+t).join(' ');
        return `- [[${obsidianFilename(r)}|#${r.number} ${r.title}]] ${shared}`;
      }).join('\n')+'\n'
    : '';

  return `${fm}\n\n# ${m.title||'Sin título'}\n\n${tagsInline?tagsInline+'\n':''}${anchorCallout}${fuente}\n${m.content||''}\n${relBlock}`;
}

function exportObsidian(){
  const list=[...state.memos].sort((a,b)=>(a.number||0)-(b.number||0));
  if(!list.length){ showError('No hay memos para exportar.'); return; }
  const files=list.map(m=>({
    name:`${m.project?slug(m.project):'general'}/${obsidianFilename(m)}.md`,
    text:memoToObsidian(m)
  }));
  // Nota de bienvenida del mini-vault
  files.unshift({name:'_inicio.md',text:`# Memos Picona\n\nExportado: ${new Date().toLocaleString('es-MX')}\nMemos: ${list.length}\n\nAbre la vista de grafo de Obsidian para ver la red de memos (los wikilinks de "Relacionados" la generan automáticamente).\n`});
  const stamp=new Date().toISOString().slice(0,10);
  const blob=makeZip(files);
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`picona-obsidian-${stamp}.zip`;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},500);
}


// ── YouTube ───────────────────────────────────────────────────────
function ytTime(ms){
  const s=Math.floor(ms/1000), m=Math.floor(s/60), sec=s%60;
  const h=Math.floor(m/60);
  return h?`${h}:${String(m%60).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`;
}
async function activeYTTab(){
  const r=await chrome.runtime.sendMessage({type:'GET_CURRENT_TAB'}).catch(()=>null);
  const tab=r?.tab;
  if(tab?.url && /youtube\.com\/watch\?/.test(tab.url)) return tab;
  return null;
}
async function getYTTranscript(){
  const tab=await activeYTTab();
  if(!tab){ showError('Abre un video de YouTube en la pestaña activa.'); return null; }
  const vid=new URL(tab.url).searchParams.get('v');
  if(state.ytCache && state.ytCache.videoId===vid) return state.ytCache;
  const res=await chrome.runtime.sendMessage({type:'GET_YT_TRANSCRIPT',tabId:tab.id});
  if(!res?.ok){ showError(res?.error||'No se pudo obtener la transcripción.'); return null; }
  state.ytCache=res;
  state.ytCache.tabUrl=tab.url;
  return res;
}
function ytTranscriptText(yt,maxChars=14000){
  // Con marcas de tiempo cada ~30s para que la IA pueda citar momentos
  let out=[], lastMark=-30000;
  for(const seg of yt.segments){
    if(seg.t-lastMark>=30000){ out.push(`\n[${ytTime(seg.t)}]`); lastMark=seg.t; }
    out.push(seg.text);
  }
  let text=out.join(' ').trim();
  if(text.length>maxChars) text=text.slice(0,maxChars)+'\n[transcripción truncada]';
  return text;
}
async function ytAction(kind){
  const prov=getActive();
  if(!prov){ showError('Configura un modelo primero.'); return; }
  addMessage('system','🎬 Obteniendo transcripción del video…');
  const yt=await getYTTranscript();
  state.messages=state.messages.filter(m=>m.role!=='system');
  el.messages.innerHTML=''; state.messages.forEach(m=>renderMsg(m));
  if(!yt) return;

  const header=`Video: "${yt.title}"${yt.author?' — '+yt.author:''} (duración ${ytTime((yt.lengthSeconds||0)*1000)}${yt.isAuto?', subtítulos automáticos':''})`;
  const transcript=ytTranscriptText(yt);

  const prompts={
    summary:{
      label:`🎬 Resumir video: "${yt.title.slice(0,60)}"`,
      think:'Resumiendo el video…',
      p:`${header}\n\nGenera un resumen claro y estructurado de los puntos principales del video a partir de su transcripción:\n\n${transcript}`
    },
    keys:{
      label:`🔑 Ideas clave y momentos: "${yt.title.slice(0,60)}"`,
      think:'Extrayendo ideas clave y momentos…',
      p:`${header}\n\nExtrae las ideas clave del video y los momentos importantes. Para cada momento importante indica su marca de tiempo en formato [mm:ss] usando las marcas presentes en la transcripción:\n\n${transcript}`
    },
    outline:{
      label:`🗂 Esquema de temas: "${yt.title.slice(0,60)}"`,
      think:'Construyendo el esquema de temas…',
      p:`${header}\n\nCrea un esquema jerárquico (temas y subtemas) de los temas tratados en el video, en orden de aparición, con marcas de tiempo [mm:ss] al inicio de cada tema principal:\n\n${transcript}`
    }
  };
  const cfg=prompts[kind];
  addMessage('user',cfg.label);
  state.pendingSource={url: yt.tabUrl||`https://youtube.com/watch?v=${yt.videoId}`, title: yt.title};
  await callWithMessages([{role:'user',content:cfg.p}],cfg.think);
}

async function ytShowTranscript(){
  addMessage('system','🎬 Obteniendo transcripción…');
  const yt=await getYTTranscript();
  state.messages=state.messages.filter(m=>m.role!=='system');
  el.messages.innerHTML=''; state.messages.forEach(m=>renderMsg(m));
  if(!yt) return;
  // Mensaje local (sin IA) con timestamps enlazados al video
  const aid=uid();
  const lines=[];
  let lastMark=-30000, buf=[];
  for(const seg of yt.segments){
    if(seg.t-lastMark>=30000){
      if(buf.length) lines.push(buf.join(' '));
      const url=`${yt.tabUrl.split('&t=')[0]}&t=${Math.floor(seg.t/1000)}s`;
      lines.push(`__TS__${ytTime(seg.t)}__${url}__`);
      lastMark=seg.t; buf=[];
    }
    buf.push(seg.text);
  }
  if(buf.length) lines.push(buf.join(' '));
  state.messages.push({id:aid,role:'assistant',content:`Transcripción de "${yt.title}"`,ts:Date.now()});
  renderMsg({id:aid,role:'assistant',content:''});
  const bubble=el.messages.querySelector(`[data-id="${aid}"] .msg-bubble`);
  if(bubble){
    bubble.innerHTML=`<div class="yt-transcript">
      <div class="yt-transcript-title">📜 ${esc(yt.title)} <span class="yt-lang">${esc(yt.lang)}${yt.isAuto?' · auto':''}</span></div>
      ${lines.map(l=>{
        const m=l.match(/^__TS__(.+?)__(.+)__$/);
        if(m) return `<a class="yt-ts" href="${esc(m[2])}" target="_blank">▶ ${esc(m[1])}</a>`;
        return `<p>${esc(l)}</p>`;
      }).join('')}
    </div>`;
  }
  // Guardar texto plano en el historial
  const m=state.messages.find(x=>x.id===aid);
  if(m) m.content=`Transcripción de "${yt.title}":\n\n`+ytTranscriptText(yt,30000);
  scrollBottom();
}

async function ytToggleChatContext(){
  if(state.videoContext){
    state.videoContext=false;
    refreshYTChips();
    showToast('Contexto de video desactivado.');
    return;
  }
  const yt=await getYTTranscript();
  if(!yt) return;
  state.videoContext=true;
  refreshYTChips();
  showToast(`✓ Chat con contexto del video activado. Pregunta lo que quieras sobre "${yt.title.slice(0,50)}".`);
  el.userInput.focus();
}

async function refreshYTChips(){
  const bar=$('ytChips');
  if(!bar) return;
  const tab=await activeYTTab();
  if(!tab || state.mode!=='chat'){ bar.style.display='none'; return; }
  // Si cambió de video, limpiar caché y contexto
  const vid=new URL(tab.url).searchParams.get('v');
  if(state.ytCache && state.ytCache.videoId!==vid){ state.ytCache=null; state.videoContext=false; }
  bar.style.display='flex';
  bar.innerHTML=`
    <button class="chip yt-chip" id="ytSummary">🎬 Resumir video</button>
    <button class="chip yt-chip" id="ytKeys">🔑 Ideas clave y momentos</button>
    <button class="chip yt-chip" id="ytOutline">🗂 Esquema de temas</button>
    <button class="chip yt-chip" id="ytTrans">📜 Transcripción</button>
    <button class="chip yt-chip ${state.videoContext?'yt-active':''}" id="ytChat">${state.videoContext?'💬 Contexto de video: ON':'💬 Preguntar sobre el video'}</button>`;
  $('ytSummary')?.addEventListener('click',()=>ytAction('summary'));
  $('ytKeys')?.addEventListener('click',()=>ytAction('keys'));
  $('ytOutline')?.addEventListener('click',()=>ytAction('outline'));
  $('ytTrans')?.addEventListener('click',ytShowTranscript);
  $('ytChat')?.addEventListener('click',ytToggleChatContext);
}

// Quick-save helper used by chat / selection / context menu
async function quickSaveMemo({title, content, sourceUrl, sourceTitle, type, tags, project, anchor}){
  await loadMemos();
  state.memos.unshift({
    id:uid(),
    number:await nextMemoNumber(),
    type: type || (sourceUrl?'pagina':'libre'),
    title: title || content?.slice(0,60) || 'Sin título',
    content: content||'',
    tags: tags||[],
    project: project||'',
    sourceUrl: sourceUrl||null,
    sourceTitle: sourceTitle||null,
    anchor: anchor||null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  await saveMemos();
}

// ── Conversation history ────────────────────────────────────────
const MODE_ICON={chat:'💬',summarize:'📄',research:'🔎',translate:'🌐'};
const MODE_LABEL={chat:'Chat',summarize:'Resumen',research:'Investigación',translate:'Traducción'};

function conversationTitle(){
  const first=state.messages.find(m=>m.role==='user');
  if(!first) return 'Conversación sin título';
  // Strip leading emoji/marker prefixes like "📝 Resumir: " or "🌐 ..."
  let t=first.content.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\s]+/u,'').trim();
  t=t.replace(/^["“]|["”]$/g,'');
  return (t || first.content).slice(0,80) || 'Conversación sin título';
}

// Save current conversation (if it has any content) into history
async function saveCurrentConversation(){
  const meaningful=state.messages.filter(m=>m.role!=='system');
  if(meaningful.length===0) return;

  await loadHistory();

  // If we're continuing a previously-loaded conversation, update it in place
  if(state.currentHistoryId){
    const idx=state.history.findIndex(h=>h.id===state.currentHistoryId);
    if(idx>=0){
      state.history[idx]={
        ...state.history[idx],
        mode:['chat','summarize','research','translate'].includes(state.mode)?state.mode:'chat',
        messages:JSON.parse(JSON.stringify(state.messages)),
        updatedAt:Date.now()
      };
      await saveHistory();
      return;
    }
  }

  state.history.unshift({
    id:uid(),
    title:conversationTitle(),
    mode:['chat','summarize','research','translate'].includes(state.mode)?state.mode:'chat',
    messages:JSON.parse(JSON.stringify(state.messages)),
    createdAt:Date.now(),
    updatedAt:Date.now()
  });
  await saveHistory();
}

function openHistoryItem(id){
  const item=state.history.find(h=>h.id===id);
  if(!item) return;
  state.messages=JSON.parse(JSON.stringify(item.messages));
  state.currentHistoryId=item.id;
  setMode(item.mode||'chat');
  el.messages.innerHTML='';
  if(state.messages.length){
    el.welcomeScreen.style.display='none';
    state.messages.forEach(m=>{
      if(m.role==='system') return;
      renderMsg(m);
      if(m.bilingual){
        const bubble=el.messages.querySelector(`[data-id="${m.id}"] .msg-bubble`);
        renderBilingualBlock(bubble,m.bilingual.paragraphs,m.bilingual.translations,m.bilingual.lang);
      } else if(m.role==='assistant'){
        const bubble=el.messages.querySelector(`[data-id="${m.id}"] .msg-bubble`);
        if(bubble) bubble.innerHTML=md(m.content);
      }
    });
  } else {
    el.welcomeScreen.style.display='';
  }
  scrollBottom();
}

function deleteHistoryItem(id){
  const card=el.historyList.querySelector(`[data-history-id="${id}"]`);
  if(!card) return;
  if(card.querySelector('.delete-confirm')) return;
  const conf=document.createElement('div'); conf.className='delete-confirm';
  conf.innerHTML=`¿Eliminar conversación?
    <button class="confirm-yes" data-yes="${id}">Eliminar</button>
    <button class="confirm-no" data-no="${id}">Cancelar</button>`;
  card.appendChild(conf);
  conf.querySelector('.confirm-yes').addEventListener('click',async (e)=>{
    e.stopPropagation();
    state.history=state.history.filter(h=>h.id!==id);
    if(state.currentHistoryId===id) state.currentHistoryId=null;
    await saveHistory();
    renderHistory();
  });
  conf.querySelector('.confirm-no').addEventListener('click',(e)=>{
    e.stopPropagation();
    conf.remove();
  });
}

function renderHistory(){
  const q=state.historySearchQuery.trim().toLowerCase();
  const list=q
    ? state.history.filter(h=>(h.title+' '+(h.messages||[]).map(m=>m.content).join(' ')).toLowerCase().includes(q))
    : state.history;

  if(!list.length){
    el.historyList.innerHTML='';
    el.historyEmpty.style.display='flex';
    if(q){
      el.historyEmpty.querySelector('p').textContent='Sin resultados.';
      el.historyEmpty.querySelector('.memos-empty-sub').textContent=`No se encontraron conversaciones para "${state.historySearchQuery}".`;
    } else {
      el.historyEmpty.querySelector('p').textContent='Sin conversaciones guardadas.';
      el.historyEmpty.querySelector('.memos-empty-sub').textContent='Cuando inicies "Nueva conversación" desde el chat, la conversación actual se guardará aquí automáticamente.';
    }
    return;
  }
  el.historyEmpty.style.display='none';

  el.historyList.innerHTML=list.map(h=>{
    const lastMsg=[...(h.messages||[])].reverse().find(m=>m.role!=='system');
    const preview=(lastMsg?.content||'').replace(/[#*`]/g,'').slice(0,140);
    const count=(h.messages||[]).filter(m=>m.role!=='system').length;
    return `
    <div class="memo-card" data-history-id="${h.id}">
      <div class="memo-card-head">
        <div class="memo-card-title">${MODE_ICON[h.mode]||'💬'} ${esc(h.title)}</div>
        <div class="memo-card-acts">
          <button class="memo-card-btn del" data-action="delete" data-id="${h.id}" title="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      ${preview?`<div class="memo-card-preview">${esc(preview)}</div>`:''}
      <div class="memo-card-foot">
        <span class="memo-card-date">${MODE_LABEL[h.mode]||'Chat'} · ${count} mensaje${count===1?'':'s'} · ${fmtDate(h.updatedAt||h.createdAt)}</span>
      </div>
    </div>`;
  }).join('');

  el.historyList.querySelectorAll('[data-action="delete"]').forEach(btn=>{
    btn.addEventListener('click',(e)=>{ e.stopPropagation(); deleteHistoryItem(btn.dataset.id); });
  });
  el.historyList.querySelectorAll('.memo-card').forEach(card=>{
    card.addEventListener('click',()=>openHistoryItem(card.dataset.historyId));
  });
}



// ── Mode UI ──────────────────────────────────────────────────────
function setMode(mode){
  state.mode=mode;
  el.modeTabs.forEach(t=>t.classList.toggle('active',t.dataset.mode===mode));
  el.translateBar.style.display=mode==='translate'?'flex':'none';
  if(mode==='research'){ el.researchBar.style.display='flex'; loadTabs(); }
  else el.researchBar.style.display='none';

  if(mode==='memos'){
    el.messagesArea.style.display='none';
    el.inputArea.style.display='none';
    el.memosPanel.style.display='flex';
    el.historyPanel.style.display='none';
    closeMemoEditor();
    renderMemos();
    return;
  }
  if(mode==='history'){
    el.messagesArea.style.display='none';
    el.inputArea.style.display='none';
    el.memosPanel.style.display='none';
    el.historyPanel.style.display='flex';
    renderHistory();
    return;
  }
  el.messagesArea.style.display='';
  el.inputArea.style.display='';
  el.memosPanel.style.display='none';
  el.historyPanel.style.display='none';

  updateActionBar();
  refreshYTChips();
  const descs={
    chat:'Chatea con tu modelo de IA sobre cualquier tema o sobre la página actual.',
    summarize:'Obtén un resumen estructurado de la página que estás visitando.',
    research:'Sintetiza información de varias pestañas en un informe de investigación.',
    translate:'Selecciona un texto en la página y tradúcelo. Con "Vista bilingüe" verás el original y la traducción intercalados por párrafo.'
  };
  el.welcomeDesc.textContent=descs[mode];
  const ph={chat:'Escribe un mensaje…',summarize:'Instrucciones adicionales…',
             research:'Pregunta de investigación…',translate:'Texto a traducir…'};
  el.userInput.placeholder=ph[mode];
}

function updateActionBar(){
  const base=`
    <button class="chip chip-ghost" id="btnNewChat" title="Nueva conversación (Alt+N)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Nueva
    </button>`;
  if(state.mode==='summarize'){
    el.actionBar.innerHTML=`
      <button class="chip" id="btnSumPage">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="10" x2="3" y2="10"/><line x1="14" y1="14" x2="3" y2="14"/></svg>
        Resumir página
      </button>
      <button class="chip" id="btnSumSel">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
        Resumir selección
      </button>${base}`;
    $('btnSumPage')?.addEventListener('click',summarizePage);
    $('btnSumSel')?.addEventListener('click',summarizeSelection);
  } else if(state.mode==='research'){
    el.actionBar.innerHTML=`
      <button class="chip" id="btnResearch">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Iniciar investigación
      </button>${base}`;
    $('btnResearch')?.addEventListener('click',()=>startResearch());
  } else {
    el.actionBar.innerHTML=`
      <button class="chip" id="btnAskPage">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Sobre esta página
      </button>
      <button class="chip" id="btnExplainSel">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Explicar selección
      </button>
      <button class="chip" id="btnCaptureImg">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        Extraer texto de imagen
      </button>
      <button class="chip" id="btnPagePDF">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        Guardar página en PDF
      </button>${base}`;
    $('btnAskPage')?.addEventListener('click',askAboutPage);
    $('btnExplainSel')?.addEventListener('click',explainSelection);
    $('btnCaptureImg')?.addEventListener('click',captureAndExtract);
    $('btnPagePDF')?.addEventListener('click',exportPagePDF);
  }
  $('btnNewChat')?.addEventListener('click',clearConversation);
}

// ── Tabs list (research) ─────────────────────────────────────────
async function loadTabs(){
  const r=await chrome.runtime.sendMessage({type:'GET_ALL_TABS'});
  // Depurar selecciones de pestañas que ya no existen
  const liveIds=new Set((r?.tabs||[]).map(t=>t.id));
  [...state.selectedTabIds].forEach(id=>{ if(!liveIds.has(id)) state.selectedTabIds.delete(id); });
  state.allTabs=r?.tabs||[];
  el.tabsList.innerHTML=state.allTabs.length
    ? state.allTabs.map(t=>`
        <label class="tab-item">
          <input type="checkbox" value="${t.id}" ${state.selectedTabIds.has(t.id)?'checked':''}>
          <span class="tab-item-title">${esc(t.title)}</span>
          <span class="tab-item-url">${esc(new URL(t.url||'about:blank').hostname)}</span>
        </label>`).join('')
    : '<div style="font-size:12px;color:var(--txt3)">No hay pestañas disponibles</div>';
  el.tabsList.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const id=parseInt(cb.value);
      cb.checked?state.selectedTabIds.add(id):state.selectedTabIds.delete(id);
    });
  });
}

// ── LLM streaming ─────────────────────────────────────────────────
async function streamLLM(messages,onChunk,onDone,onError){
  const prov=getActive();
  if(!prov){onError('No hay modelo activo.');return;}
  const tmpl=API_TEMPLATES[prov.type];
  if(!tmpl){onError('Tipo de proveedor desconocido.');return;}
  try{
    if(tmpl.type==='anthropic')  await streamAnthropic(prov,tmpl,messages,onChunk,onDone,onError);
    else if(tmpl.type==='gemini') await streamGemini(prov,tmpl,messages,onChunk,onDone,onError);
    else if(tmpl.type==='ollama') await streamOllama(prov,tmpl,messages,onChunk,onDone,onError);
    else                          await streamCompat(prov,tmpl,messages,onChunk,onDone,onError);
  }catch(e){onError(e.message||'Error desconocido');}
}

async function streamCompat(prov,tmpl,msgs,onChunk,onDone,onError){
  const url=prov.baseUrl?`${prov.baseUrl.replace(/\/$/,'')}/chat/completions`:tmpl.apiUrl;
  const r=await fetch(url,{method:'POST',headers:tmpl.buildHeaders(prov),
    body:JSON.stringify(tmpl.buildBody(msgs,prov.model,true)),
    signal:state.abortCtrl?.signal});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${r.status}`);}
  await readSSE(r,data=>{
    if(data==='[DONE]'){onDone();return true;}
    try{const c=tmpl.parseChunk(JSON.parse(data));if(c)onChunk(c);}catch{}
  },onDone);
}

async function streamAnthropic(prov,tmpl,msgs,onChunk,onDone,onError){
  const r=await fetch(tmpl.apiUrl,{method:'POST',headers:tmpl.buildHeaders(prov),
    body:JSON.stringify(tmpl.buildBody(msgs,prov.model,true)),
    signal:state.abortCtrl?.signal});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${r.status}`);}
  await readSSE(r,data=>{
    try{const p=JSON.parse(data);
      if(p.type==='message_stop'){onDone();return true;}
      if(p.type==='content_block_delta'){const c=p.delta?.text||'';if(c)onChunk(c);}
    }catch{}
  },onDone);
}

async function streamGemini(prov,tmpl,msgs,onChunk,onDone,onError){
  const r=await fetch(tmpl.buildUrl(prov),{method:'POST',headers:tmpl.buildHeaders(prov),
    body:JSON.stringify(tmpl.buildBody(msgs)),
    signal:state.abortCtrl?.signal});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${r.status}`);}
  await readSSE(r,data=>{try{const c=tmpl.parseChunk(JSON.parse(data));if(c)onChunk(c);}catch{}},onDone);
}

async function streamOllama(prov,tmpl,msgs,onChunk,onDone,onError){
  const r=await fetch(tmpl.buildUrl(prov),{method:'POST',headers:tmpl.buildHeaders(prov),
    body:JSON.stringify(tmpl.buildBody(msgs,prov.model,true)),
    signal:state.abortCtrl?.signal});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const reader=r.body.getReader(),decoder=new TextDecoder();
  while(true){
    let rd,value;
    try{({done:rd,value}=await reader.read());}catch(e){onDone();return;}
    if(rd){onDone();break;}
    for(const line of decoder.decode(value).split('\n').filter(l=>l.trim())){
      try{const p=JSON.parse(line);const c=p.message?.content||'';if(c)onChunk(c);if(p.done){onDone();return;}}catch{}
    }
  }
}

async function readSSE(resp,onData,onDone){
  const reader=resp.body.getReader(),decoder=new TextDecoder();let buf='';
  let finished=false;
  const finish=()=>{ if(!finished){finished=true;onDone();} };
  while(true){
    let rd,value;
    try{ ({done:rd,value}=await reader.read()); }
    catch(e){ finish();return; }          // aborted fetch
    if(rd){finish();break;}
    buf+=decoder.decode(value,{stream:true});
    const lines=buf.split('\n');buf=lines.pop()||'';
    for(const line of lines){
      if(!line.trim()||line.startsWith(':'))continue;
      if(line.startsWith('data: ')){const stop=onData(line.slice(6));if(stop){finish();return;}}
    }
  }
}

// ── "Pensando" indicator ─────────────────────────────────────────
function providerDisplayName(prov){
  if(!prov) return 'tu modelo';
  const tmpl=API_TEMPLATES[prov.type]||{};
  return prov.nickname || `${tmpl.label||prov.type} (${prov.model})`;
}

function thinkingLabel(prov){
  const name=providerDisplayName(prov);
  switch(state.mode){
    case 'summarize': return `Leyendo y resumiendo la página…`;
    case 'research':  return `Sintetizando ${state.selectedTabIds.size||''} pestaña${state.selectedTabIds.size===1?'':'s'}…`;
    case 'translate': return `Traduciendo con ${name}…`;
    default:          return `Consultando a ${name}…`;
  }
}

function thinkingHTML(label){
  return `<span class="thinking-indicator"><span class="typing-dots"><span></span><span></span><span></span></span><span class="thinking-label">${esc(label)}</span></span>`;
}

// ── callWithMessages (API path) ──────────────────────────────────
async function callWithMessages(extra,customLabel){
  if(state.isLoading)return;
  const prov=getActive();
  if(!prov){showError('Configura un modelo en Ajustes.');return;}
  state.isLoading=true;
  state.abortCtrl=new AbortController();
  setUILoading(true);

  const history=state.messages.filter(m=>m.role!=='system').slice(-20).map(m=>({role:m.role,content:m.content}));
  let messages=extra?[...history.slice(0,-extra.length),...extra]:history;
  // Contexto de video de YouTube activo → inyectar transcripción como system
  if(state.videoContext && state.ytCache){
    messages=[{role:'system',content:`El usuario está viendo este video de YouTube. Responde sus preguntas basándote en la transcripción.\nVideo: "${state.ytCache.title}"\n\nTranscripción:\n${ytTranscriptText(state.ytCache,12000)}`},...messages];
  }

  const aid=uid();
  const msgObj={id:aid,role:'assistant',content:'',ts:Date.now()};
  if(state.pendingSource){
    msgObj.sourceUrl=state.pendingSource.url;
    msgObj.sourceTitle=state.pendingSource.title;
    state.pendingSource=null;
  }
  state.messages.push(msgObj);
  renderMsg({id:aid,role:'assistant',content:''});
  const bubble=el.messages.querySelector(`[data-id="${aid}"] .msg-bubble`);
  if(bubble) bubble.innerHTML=thinkingHTML(customLabel||thinkingLabel(prov));

  const finish=()=>{
    state.isLoading=false; state.abortCtrl=null; setUILoading(false);
    const m=state.messages.find(x=>x.id===aid);
    if(m && !m.content.trim() && bubble) bubble.innerHTML='<em>(sin respuesta)</em>';
  };
  try{
    await streamLLM(messages,(chunk)=>updateStream(aid,chunk),finish,
      (err)=>{
        // Don't show abort errors as visible errors
        if(err&&!err.includes('abort')&&!err.includes('AbortError')){
          updateStream(aid,`\n\n⚠️ **Error:** ${err}`);
        }
        finish();
      });
  }catch(e){
    if(e.name!=='AbortError') updateStream(aid,`\n\n⚠️ **Error inesperado:** ${e.message}`);
    finish();
  }
}

function stopGeneration(){
  if(state.abortCtrl){ state.abortCtrl.abort(); }
}

function setUILoading(v){
  el.typingIndicator.style.display=v?'flex':'none';
  el.sendBtn.disabled=false;                 // always enabled — acts as stop when loading
  el.sendBtn.classList.toggle('is-stop',v);
  el.sendBtn.title=v?'Detener generación':'Enviar';
  // Swap icon
  el.sendBtn.innerHTML=v
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  if(!v) el.sendBtn.disabled=!el.userInput.value.trim();
}

// ── Subscription launch path ─────────────────────────────────────
async function sendMessage(){
  // When loading, the button acts as "stop"
  if(state.isLoading){ stopGeneration(); return; }
  const prov=getActive();
  if(!prov){ showError('Primero conecta un modelo de IA.'); openSettings(); return; }

  if(state.mode==='summarize'){summarizePage();return;}
  if(state.mode==='research'){startResearch();return;}
  if(state.mode==='translate'){translateContent(el.userInput.value.trim());return;}

  const text=el.userInput.value.trim();
  if(!text)return;
  el.userInput.value=''; autoResize();

  addMessage('user',text);
await callWithMessages([{role:'user',content:text}]);
}

// ── Summarize ────────────────────────────────────────────────────
async function summarizePage(){
  const prov=getActive(); if(!prov){showError('Configura un modelo primero.');return;}
  addMessage('system','⏳ Obteniendo contenido de la página…');
  const tab=await chrome.runtime.sendMessage({type:'GET_CURRENT_TAB'});
  if(!tab?.tab){showError('No se pudo acceder a la pestaña.');return;}
  const res=await chrome.runtime.sendMessage({type:'GET_PAGE_CONTENT',tabId:tab.tab.id});
  if(!res?.success){showError('No se pudo leer la página.');return;}
  const{title,url,content}=res.data;
  const extra=el.userInput.value.trim(); el.userInput.value='';
  const instr=extra?`Resume el siguiente contenido web. ${extra}`
    :'Proporciona un resumen claro y estructurado. Incluye los puntos principales, ideas clave y conclusiones.';
  const prompt=`${instr}\n\nTítulo: ${title}\nURL: ${url}\n\n---\n${content}`;
  state.messages=state.messages.filter(m=>m.role!=='system');
  el.messages.innerHTML=''; state.messages.forEach(m=>renderMsg(m));
  const display=`📄 Resumir: "${title}"`;
  addMessage('user',display);
  state.pendingSource={url, title};  // para que el resumen guardado herede la fuente
await callWithMessages([{role:'user',content:prompt}]);
}

async function summarizeSelection(){
  const prov=getActive(); if(!prov){showError('Configura un modelo primero.');return;}
  const{selectedText}=await chrome.storage.session.get('selectedText');
  if(!selectedText){showError('No hay texto seleccionado.');return;}
  const extra=el.userInput.value.trim(); el.userInput.value='';
  const prompt=extra?`${extra}\n\nTexto: "${selectedText}"`:`Resume de forma concisa:\n\n"${selectedText}"`;
  const display=`📝 Resumir: "${selectedText.slice(0,60)}…"`;
  addMessage('user',display);
await callWithMessages([{role:'user',content:prompt}],'Resumiendo la selección…');
}

// ── Get freshest selected text (content script → storage fallback) ──
async function getSelectedText(){
  try{
    const tab=await chrome.runtime.sendMessage({type:'GET_CURRENT_TAB'});
    if(tab?.tab?.id){
      const r=await chrome.tabs.sendMessage(tab.tab.id,{type:'GET_SELECTION'}).catch(()=>null);
      if(r?.text) return r.text;
    }
  }catch{}
  const{selectedText}=await chrome.storage.session.get('selectedText');
  return selectedText||'';
}

// ── Explain highlighted text ───────────────────────────────────────
async function explainSelection(){
  const prov=getActive(); if(!prov){showError('Configura un modelo primero.');return;}
  const text=await getSelectedText();
  if(!text){showError('No hay texto seleccionado en la página.');return;}
  const extra=el.userInput.value.trim(); el.userInput.value=''; autoResize();
  const prompt=extra
    ? `${extra}\n\nTexto seleccionado: "${text}"`
    : `Explica el siguiente texto de forma clara, sencilla y bien estructurada. Define términos clave si es necesario:\n\n"${text}"`;
  const display=`💡 Explicar: "${text.slice(0,60)}${text.length>60?'…':''}"`;
  addMessage('user',display);
await callWithMessages([{role:'user',content:prompt}],'Pensando una explicación clara…');
}

// ── Extract text from screenshot (OCR via vision model) ──────────────
async function captureAndExtract(){
  const prov=getActive(); if(!prov){showError('Configura un modelo primero.');return;}

  addMessage('system','📸 Capturando la pantalla visible…');

  const cap=await chrome.runtime.sendMessage({type:'CAPTURE_SCREENSHOT'});
  state.messages=state.messages.filter(m=>m.role!=='system');
  el.messages.innerHTML=''; state.messages.forEach(m=>renderMsg(m));

  if(!cap?.success){
    showError(cap?.error||'No se pudo capturar la pantalla.');
    return;
  }

  const extra=el.userInput.value.trim(); el.userInput.value=''; autoResize();
  const instruction = extra
    ? extra
    : 'Extrae todo el texto visible en esta imagen, conservando su estructura (títulos, párrafos, listas, tablas). Si no hay texto, describe brevemente el contenido visual.';

  // Show the captured image as the user message
  const aid=uid();
  const userId=uid();
  state.messages.push({id:userId,role:'user',content:`🖼️ ${instruction}`,ts:Date.now()});
  const wrap=document.createElement('div');
  wrap.className='msg user'; wrap.dataset.id=userId;
  wrap.innerHTML=`<div class="msg-bubble">
    <img src="${cap.dataUrl}" style="max-width:100%;border-radius:8px;display:block;margin-bottom:6px">
    ${esc(instruction)}
  </div>`;
  el.messages.appendChild(wrap);
  el.welcomeScreen.style.display='none';
  scrollBottom();

  await callWithMessages([{role:'user',content:instruction,image:cap.dataUrl}],'Analizando la imagen…');
}

// ── Research ──────────────────────────────────────────────────────
async function startResearch(){
  const prov=getActive(); if(!prov){showError('Configura un modelo primero.');return;}
  const q=el.userInput.value.trim(); if(!q){showError('Escribe una pregunta de investigación.');return;}
  const ids=state.selectedTabIds.size>0?[...state.selectedTabIds]:state.allTabs.map(t=>t.id);
  if(!ids.length){showError('No hay pestañas seleccionadas.');return;}
  el.userInput.value=''; setMode('chat');
  addMessage('system',`🔍 Analizando ${ids.length} pestaña(s)…`);
  const contents=[];
  for(const id of ids.slice(0,8)){
    try{const r=await chrome.runtime.sendMessage({type:'GET_PAGE_CONTENT',tabId:id});
      if(r?.success)contents.push(`### [${r.data.title}](${r.data.url})\n${r.data.content.slice(0,6000)}`);}
    catch{}
  }
  if(!contents.length){showError('No se pudo leer las pestañas.');return;}
  const prompt=`Pregunta de investigación: **${q}**\n\nFuentes:\n\n${contents.join('\n\n---\n\n')}\n\n---\nResponde de forma completa y estructurada, citando fuentes relevantes.`;
  state.messages=state.messages.filter(m=>m.role!=='system');
  el.messages.innerHTML=''; state.messages.forEach(m=>renderMsg(m));
  const display=`🔍 Investigación: "${q}" (${contents.length} fuentes)`;
  addMessage('user',display);
await callWithMessages([{role:'user',content:prompt}]);
}

// ── Translate ─────────────────────────────────────────────────────
const LANG_NAMES={es:'español',en:'inglés',fr:'francés',de:'alemán',pt:'portugués',it:'italiano',zh:'chino',ja:'japonés',ko:'coreano',ar:'árabe',ru:'ruso'};

async function translateContent(inputText){
  const prov=getActive(); if(!prov){showError('Configura un modelo primero.');return;}

  // Si no hay texto, obtenerlo del content script
  let textToTranslate=inputText;
  if(!textToTranslate){
    const sel=await getSelectedText();
    if(!sel){showError('Selecciona un texto para traducir.');return;}
    textToTranslate=sel;
  }
  el.userInput.value='';

  if(state.bilingualView && prov.connType!=='subscription'){
    await translateBilingual(textToTranslate);
  } else {
    await translateSimple(textToTranslate,prov);
  }
}

async function translateSimple(textToTranslate,prov){
  const lang=el.targetLang.value;
  const prompt=`Traduce al ${LANG_NAMES[lang]}. Solo devuelve la traducción:\n\n${textToTranslate}`;
  const display=`🌐 Traducir al ${LANG_NAMES[lang]}: "${textToTranslate.slice(0,60)}${textToTranslate.length>60?'…':''}"`;

  addMessage('user',display);
await callWithMessages([{role:'user',content:prompt}]);
}

// ── Bilingual translation (original + translation interleaved by paragraph) ──
function splitParagraphs(text){
  // Split on blank lines first; if there's only one big block, split on line breaks
  let parts=text.split(/\n\s*\n+/).map(p=>p.trim()).filter(Boolean);
  if(parts.length<=1){
    parts=text.split(/\n+/).map(p=>p.trim()).filter(Boolean);
  }
  if(parts.length===0) parts=[text.trim()];
  return parts;
}

async function translateBilingual(textToTranslate){
  const lang=el.targetLang.value;
  const paragraphs=splitParagraphs(textToTranslate);

  const display=`🌐 Vista bilingüe (${LANG_NAMES[lang]}) — ${paragraphs.length} párrafo${paragraphs.length>1?'s':''}: "${textToTranslate.slice(0,60)}${textToTranslate.length>60?'…':''}"`;
  addMessage('user',display);

  const aid=uid();
  state.messages.push({id:aid,role:'assistant',content:'',ts:Date.now()});
  renderMsg({id:aid,role:'assistant',content:''});
  const bubble=el.messages.querySelector(`[data-id="${aid}"] .msg-bubble`);
  if(bubble) bubble.innerHTML=thinkingHTML(`Traduciendo ${paragraphs.length} párrafo${paragraphs.length>1?'s':''}…`);

  const prompt=`Traduce cada uno de los siguientes ${paragraphs.length} fragmentos al ${LANG_NAMES[lang]}.
Responde ÚNICAMENTE con un array JSON válido de ${paragraphs.length} strings (las traducciones, en el mismo orden, sin numerar, sin texto adicional, sin markdown ni bloques de código).

Fragmentos:
${paragraphs.map((p,i)=>`${i+1}) ${p}`).join('\n')}`;

  state.isLoading=true; state.abortCtrl=new AbortController(); setUILoading(true);
  let full='';
  const finish=()=>{ state.isLoading=false; state.abortCtrl=null; setUILoading(false); };

  await streamLLM([{role:'user',content:prompt}], (chunk)=>{ full+=chunk; }, ()=>{
    let translations=null;
    try{
      const m=full.match(/\[[\s\S]*\]/);
      if(m) translations=JSON.parse(m[0]);
    }catch{}

    if(!Array.isArray(translations) || translations.length!==paragraphs.length){
      // Fallback: render as plain text if parsing failed
      if(bubble){
        bubble.innerHTML='';
        bubble.appendChild(document.createTextNode(full.trim()||'(sin respuesta)'));
      }
      const m=state.messages.find(x=>x.id===aid);
      if(m) m.content=full;
      finish();
      return;
    }

    renderBilingualBlock(bubble,paragraphs,translations,lang);
    const m=state.messages.find(x=>x.id===aid);
    if(m){
      m.content=paragraphs.map((p,i)=>`**Original:**\n${p}\n\n**${LANG_NAMES[lang]}:**\n${translations[i]}`).join('\n\n---\n\n');
      m.bilingual={paragraphs,translations,lang};
    }
    finish();
  }, (err)=>{
    if(err && !err.includes('abort') && !err.includes('AbortError')){
      if(bubble) bubble.innerHTML=`⚠️ <strong>Error:</strong> ${esc(err)}`;
    }
    finish();
  });
}

function renderBilingualBlock(bubble,paragraphs,translations,lang){
  if(!bubble)return;
  bubble.innerHTML='';
  const wrap=document.createElement('div');
  wrap.className='bilingual-wrap';
  paragraphs.forEach((orig,i)=>{
    const pair=document.createElement('div');
    pair.className='bilingual-pair';
    pair.innerHTML=`
      <div class="bilingual-orig">${esc(orig)}</div>
      <div class="bilingual-trans"><span class="bilingual-lang-tag">${LANG_NAMES[lang]}</span>${esc(translations[i]||'')}</div>
    `;
    wrap.appendChild(pair);
  });
  bubble.appendChild(wrap);
}

async function askAboutPage(){
  el.userInput.value='Explica de qué trata esta página: ';
  el.userInput.focus(); autoResize(); el.sendBtn.disabled=false;
}

// ── Settings ──────────────────────────────────────────────────────
function openSettings(){ el.settingsPanel.style.display='flex'; hideForm(); renderProviders(); }
function closeSettingsPanel(){ el.settingsPanel.style.display='none'; }

function renderProviders(){
  if(!state.providers.length){
    el.providersList.innerHTML=`<div class="providers-empty">Sin modelos conectados.<br>Agrega uno para empezar.</div>`;
    return;
  }
  el.providersList.innerHTML=state.providers.map(p=>{
    const isActive=p.id===state.activeProviderId;
    const tmpl=API_TEMPLATES[p.type]||{};
    const icon=tmpl.icon||'🤖', label=p.nickname||p.model;
    const sub=`${tmpl.label||p.type} · ${p.model}`, badge='<span class="prov-badge api">API</span>';
    return `
      <div class="provider-item ${isActive?'active-item':''}" data-id="${p.id}">
        <div class="provider-icon">${icon}</div>
        <div class="provider-info">
          <div class="provider-name">${esc(label)}</div>
          <div class="provider-sub">${esc(sub)}</div>
        </div>
        ${badge}
        <div class="provider-actions">
          ${!isActive
            ? `<button class="prov-btn set-active" title="Activar" data-action="activate" data-id="${p.id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
               </button>`
            : `<span class="prov-active-badge">activo</span>`}
          <button class="prov-btn edit" title="Editar" data-action="edit" data-id="${p.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="prov-btn danger" title="Eliminar" data-action="delete" data-id="${p.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  // Wire all action buttons (event delegation via direct binding after render)
  el.providersList.querySelectorAll('[data-action]').forEach(btn=>{
    const id=btn.dataset.id;
    const action=btn.dataset.action;
    btn.addEventListener('click',()=>{
      if(action==='activate') activateProv(id);
      else if(action==='edit') editProv(id);
      else if(action==='delete') askDelete(id);
    });
  });
}

function activateProv(id){
  state.activeProviderId=id;
  saveStorage().then(()=>{ renderProviders(); updatePill(); });
}

function askDelete(id){
  const item=el.providersList.querySelector(`[data-id="${id}"]`);
  if(!item)return;
  if(item.querySelector('.delete-confirm'))return;
  const conf=document.createElement('div'); conf.className='delete-confirm';
  conf.innerHTML=`¿Eliminar?
    <button class="confirm-yes" data-confirm-id="${id}">Eliminar</button>
    <button class="confirm-no" data-cancel-id="${id}">Cancelar</button>`;
  item.appendChild(conf);
  conf.querySelector('.confirm-yes').addEventListener('click',()=>deleteProv(id));
  conf.querySelector('.confirm-no').addEventListener('click',()=>cancelDelete(id));
}

function cancelDelete(id){
  const item=el.providersList.querySelector(`[data-id="${id}"]`);
  item?.querySelector('.delete-confirm')?.remove();
}

function deleteProv(id){
  state.providers=state.providers.filter(p=>p.id!==id);
  if(state.activeProviderId===id) state.activeProviderId=state.providers[0]?.id||null;
  saveStorage().then(()=>{ renderProviders(); updatePill(); });
}

function editProv(id){
  showForm(id);
}

// ── Form logic ────────────────────────────────────────────────────
function showForm(editId){
  state.editingProviderId=editId||null;
  el.addProviderForm.style.display='flex';
  el.addProviderBtn.style.display='none';
  el.formTitle.textContent=editId?'Editar modelo':'Nuevo modelo';

  if(editId){
    const p=state.providers.find(x=>x.id===editId);
    if(p){
      // Solo soportamos API Key por ahora
      setFormConnType();
      el.providerType.value=p.type;
      onApiTypeChange();
      el.apiKeyInput.value=p.apiKey||'';
      el.baseUrlInput.value=p.baseUrl||'';
      // Restore model
      if(Array.from(el.modelSelect.options).some(o=>o.value===p.model)){
        el.modelSelect.value=p.model;
      } else {
        el.modelSelect.value='__custom';
        el.customModelInput.value=p.model||'';
        el.customModelInput.style.display='';
      }
      el.nicknameInput.value=p.nickname||'';
    }
  } else {
    resetForm();
  }
}

function hideForm(){
  el.addProviderForm.style.display='none';
  el.addProviderBtn.style.display='';
  state.editingProviderId=null;
}

function resetForm(){
  setFormConnType();
  el.providerType.value='';
  el.apiKeyInput.value='';
  el.baseUrlInput.value='';
  el.nicknameInput.value='';
  el.modelSelect.innerHTML='<option value="">Selecciona proveedor primero</option>';
  el.customModelInput.value=''; el.customModelInput.style.display='none';
  el.apiKeyRow.style.display='flex'; el.baseUrlRow.style.display='none';
  el.keyHintLink.style.display='none';
}

function setFormConnType(){ /* solo API en v2.6 */ if(el.apiFields) el.apiFields.style.display='flex'; }

function onApiTypeChange(){
  const type=el.providerType.value;
  const tmpl=API_TEMPLATES[type]; if(!tmpl)return;
  el.apiKeyRow.style.display=type==='ollama'?'none':'flex';
  el.baseUrlRow.style.display=(type==='ollama'||type==='custom')?'flex':'none';
  if(type==='ollama') el.baseUrlInput.placeholder='http://localhost:11434';
  if(type==='custom') el.baseUrlInput.placeholder='https://api.miservicio.com/v1';
  if(tmpl.keyHint){
    el.keyHintLink.href=tmpl.keyHint;
    el.keyHintLink.textContent=tmpl.keyHintLabel||'¿Dónde obtengo mi API key? ↗';
    el.keyHintLink.style.display='';
  } else { el.keyHintLink.style.display='none'; }
  if(tmpl.models?.length){
    el.modelSelect.innerHTML=tmpl.models.map(m=>{
      const lbl=tmpl.modelLabels?.[m]||m;
      return `<option value="${m}">${lbl}</option>`;
    }).join('')+'<option value="__custom">Modelo personalizado…</option>';
    el.customModelInput.style.display='none';
  } else {
    el.modelSelect.innerHTML='<option value="__custom">Escribe el nombre del modelo</option>';
    el.customModelInput.style.display='';
  }
}

// (funciones de suscripción web eliminadas)

async function saveProvider(){
  // Solo soportamos API Key por ahora - se elimina branch de suscripción web
  const type=el.providerType.value;
  if(!type){showError('Selecciona un proveedor.');return;}
  const tmpl=API_TEMPLATES[type];
  const apiKey=el.apiKeyInput.value.trim();
  if(tmpl.keyRequired&&!apiKey){showError('La API Key es obligatoria.');return;}
  const mVal=el.modelSelect.value;
  const model=mVal==='__custom'||!mVal?el.customModelInput.value.trim():mVal;
  if(!model){showError('Selecciona o escribe un modelo.');return;}
  const provider={
    id:state.editingProviderId||uid(),
    connType:'api', type, apiKey, model,
    nickname:el.nicknameInput.value.trim(),
    baseUrl:el.baseUrlInput.value.trim()
  };
  upsertProvider(provider);
}

function upsertProvider(provider){
  if(state.editingProviderId){
    const idx=state.providers.findIndex(p=>p.id===state.editingProviderId);
    if(idx>=0) state.providers[idx]=provider; else state.providers.push(provider);
  } else {
    state.providers.push(provider);
    if(!state.activeProviderId) state.activeProviderId=provider.id;
  }
  saveStorage().then(()=>{ updatePill(); hideForm(); renderProviders(); });
}

// ── Model pill / dropdown ─────────────────────────────────────────
function updatePill(){
  const prov=getActive();
  if(prov){
    let name,icon;
    {
      const tmpl=API_TEMPLATES[prov.type]||{};
      icon=tmpl.icon||''; name=prov.nickname||prov.model;
    }
    el.modelPillText.textContent=`${icon} ${name}`;
    el.modelPillDot.classList.add('active');
    el.welcomeDesc.textContent='Tu asistente está listo. ¿Cómo puedo ayudarte?';
    el.welcomeBtns.style.display='none'; el.quickChips.style.display='flex';
  } else {
    el.modelPillText.textContent='Sin modelo';
    el.modelPillDot.classList.remove('active');
    el.welcomeBtns.style.display=''; el.quickChips.style.display='none';
  }
}

function openDropdown(){
  if(!state.providers.length){openSettings();return;}
  el.dropdownInner.innerHTML=state.providers.length?state.providers.map(p=>{
    const isActive=p.id===state.activeProviderId;
    const tmpl=API_TEMPLATES[p.type]||{};
    const icon=tmpl.icon||'🤖', name=p.nickname||p.model, sub=tmpl.label||p.type;
    return `<div class="dropdown-item ${isActive?'selected':''}" data-id="${p.id}">
      <div class="dropdown-item-icon">${icon}</div>
      <div class="dropdown-item-info">
        <div class="dropdown-item-name">${esc(name)}</div>
        <div class="dropdown-item-sub">${esc(sub)}</div>
      </div>
      ${isActive?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>':''}
    </div>`;
  }).join(''):'<div class="dropdown-empty">Sin modelos configurados</div>';
  el.dropdownInner.querySelectorAll('.dropdown-item').forEach(item=>{
    item.addEventListener('click',()=>{activateProv(item.dataset.id);closeDropdown();});
  });
  state.dropdownOpen=true;
  el.modelDropdown.style.display=''; el.dropdownOverlay.style.display='';
}

function closeDropdown(){
  state.dropdownOpen=false;
  el.modelDropdown.style.display='none'; el.dropdownOverlay.style.display='none';
}

// ── Error toast ───────────────────────────────────────────────────
function showError(msg){
  // Remove any existing toast first
  document.querySelector('.error-toast')?.remove();
  const t=document.createElement('div'); t.className='error-toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),4000);
}

function showToast(msg){
  document.querySelector('.error-toast')?.remove();
  const t=document.createElement('div'); t.className='error-toast success'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2400);
}

// ── New conversation ──────────────────────────────────────────────
async function clearConversation(){
  if(state.isLoading){ stopGeneration(); }
  await saveCurrentConversation();
  state.currentHistoryId=null;
  state.messages=[];
  el.messages.innerHTML='';
  el.welcomeScreen.style.display='';
  el.userInput.value=''; autoResize();
}

// ── Textarea auto-resize ──────────────────────────────────────────
function autoResize(){
  const ta=el.userInput; ta.style.height='auto';
  ta.style.height=Math.min(ta.scrollHeight,120)+'px';
  el.sendBtn.disabled=!ta.value.trim()||state.isLoading;
}

// ── Pending action (context menu) ────────────────────────────────
async function checkPending(){
  const{pendingAction:a}=await chrome.storage.session.get('pendingAction');
  if(!a||Date.now()-a.timestamp>8000)return;
  await chrome.storage.session.remove('pendingAction');

  // Saving a memo doesn't require an AI model
  if(a.type==='picona-memo'){
    if(!a.text){ showError('No hay texto seleccionado para guardar.'); return; }
    await quickSaveMemo({
      title: a.text.slice(0,60),
      content: a.text,
      anchor: a.text.slice(0,600),
      sourceUrl: a.sourceUrl,
      sourceTitle: a.sourceTitle
    });
    setMode('memos');
    showToast('✓ Memo guardado.');
    return;
  }

  const prov=getActive();
  if(!prov){
    showError('Selecciona una acción rápida, pero primero configura un modelo en Ajustes.');
    if(a.text) await chrome.storage.session.set({selectedText:a.text});
    return;
  }
  switch(a.type){
    case 'picona-explain':
      if(a.text){ setMode('chat'); addMessage('user',`Explica: "${a.text}"`);
        await callWithMessages([{role:'user',content:`Explica de forma clara y concisa:\n\n"${a.text}"`}]); } break;
    case 'picona-translate': setMode('translate'); if(a.text)await translateContent(a.text); break;
    case 'picona-research':  setMode('research'); if(a.text){el.userInput.value=a.text;autoResize();} break;
    case 'picona-summarize': setMode('summarize'); await summarizePage(); break;
    case 'picona-summarize-sel':
      setMode('summarize');
      el.userInput.value='';
      await summarizeSelection();
      break;
    case 'picona-ask':
      setMode('chat');
      if(a.text){
        el.userInput.value=`Sobre el siguiente texto: "${a.text.slice(0,200)}${a.text.length>200?'…':''}"\n\n`;
        autoResize();
        el.userInput.focus();
      }
      break;
  }
}

// ── Init ──────────────────────────────────────────────────────────
async function init(){
  await loadStorage(); await loadMemos(); await loadHistory(); await loadDiarioQs();
  updatePill(); setMode('chat');
  checkDiarioReminder();
  await checkPending();

  // React to floating-toolbar / context-menu actions while panel is already open
  chrome.storage.session.onChanged.addListener((changes)=>{
    if(changes.pendingAction?.newValue) checkPending();
  });

  // YouTube: refrescar chips al cambiar de pestaña o navegar
  refreshYTChips();
  chrome.tabs.onActivated.addListener(()=>refreshYTChips());
  chrome.tabs.onUpdated.addListener((id,info)=>{ if(info.url||info.status==='complete') refreshYTChips(); });

  // Mode tabs
  el.modeTabs.forEach(t=>t.addEventListener('click',()=>setMode(t.dataset.mode)));

  // Input
  el.userInput.addEventListener('input',autoResize);
  el.userInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}
  });
  el.sendBtn.addEventListener('click',sendMessage);

  // Alt+N = new conversation
  document.addEventListener('keydown',e=>{
    if(e.altKey&&e.key==='n'){e.preventDefault();clearConversation();}
  });

  // Model pill / dropdown
  el.modelPill.addEventListener('click',()=>state.dropdownOpen?closeDropdown():openDropdown());
  el.dropdownOverlay.addEventListener('click',closeDropdown);
  el.manageModels.addEventListener('click',()=>{closeDropdown();openSettings();});

  // Settings
  el.settingsBtn.addEventListener('click',openSettings);
  el.closeSettings.addEventListener('click',closeSettingsPanel);
  el.addProviderBtn.addEventListener('click',()=>showForm());
  el.cancelFormBtn.addEventListener('click',hideForm);
  el.saveProviderBtn.addEventListener('click',saveProvider);
  el.setupBtn.addEventListener('click',openSettings);

  // Connection type toggle

  // API type change
  el.providerType.addEventListener('change',onApiTypeChange);
  el.modelSelect.addEventListener('change',()=>{
    el.customModelInput.style.display=el.modelSelect.value==='__custom'?'':'none';
  });
  el.toggleApiKey.addEventListener('click',()=>{
    el.apiKeyInput.type=el.apiKeyInput.type==='password'?'text':'password';
  });

  // Translate
  el.selectAllTabs.addEventListener('click',()=>{
    state.allTabs.forEach(t=>state.selectedTabIds.add(t.id));
    el.tabsList.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=true);
  });

  // Quick chips
  el.qSummarize.addEventListener('click',()=>{setMode('summarize');summarizePage();});
  el.qResearch.addEventListener('click',()=>setMode('research'));
  el.qTranslate.addEventListener('click',()=>setMode('translate'));

  // Memos
  el.memoNewBtn.addEventListener('click',()=>openMemoEditor(null));
  el.memoCancelBtn.addEventListener('click',closeMemoEditor);
  el.memoSaveBtn.addEventListener('click',saveMemo);
  el.memoSearch.addEventListener('input',()=>{
    state.memoSearchQuery=el.memoSearch.value;
    renderMemos();
  });
  el.memoContentInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); saveMemo(); }
  });

  // Memo type selector
  el.memoTypeRow.querySelectorAll('.memo-type-btn').forEach(btn=>{
    btn.addEventListener('click',()=>setMemoFormType(btn.dataset.mtype));
  });

  // Tags input
  el.memoTagInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===','){ e.preventDefault(); addTagFromInput(); }
    if(e.key==='Backspace'&&!el.memoTagInput.value&&state.formMemoTags.length){
      state.formMemoTags.pop(); renderTagChips();
    }
  });
  el.memoTagInput.addEventListener('blur',addTagFromInput);

  // Group by
  el.memoGroupBy.addEventListener('change',()=>{
    state.memoGroupBy=el.memoGroupBy.value;
    renderMemos();
  });

  // Export menu
  el.memoExportBtn.addEventListener('click',(e)=>{
    e.stopPropagation();
    el.memoExportMenu.style.display=el.memoExportMenu.style.display==='none'?'flex':'none';
  });
  el.memoExportMenu.querySelectorAll('.export-opt').forEach(btn=>{
    btn.addEventListener('click',()=>exportMemos(btn.dataset.fmt));
  });
  document.addEventListener('click',(e)=>{
    if(!el.memoExportMenu.contains(e.target)&&e.target!==el.memoExportBtn){
      el.memoExportMenu.style.display='none';
    }
  });

  // Anchor remove
  el.memoAnchorRemove.addEventListener('click',()=>{
    state.formMemoAnchor=null; renderAnchorBox();
  });

  // ✦ AI suggest title/tags
  el.memoAiSuggest.addEventListener('click',aiSuggestTitleTags);

  // ▣ Guided diary assistant
  el.memoAssistBtn.addEventListener('click',startAssist);
  el.assistClose.addEventListener('click',()=>{ el.memoAssist.style.display='none'; el.memosList.style.display='flex'; });
  el.assistNext.addEventListener('click',()=>assistAdvance(false));
  el.assistSkip.addEventListener('click',()=>assistAdvance(true));
  el.assistAnswer.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); assistAdvance(false); }
  });

  // ✦ AI link suggestions
  el.memoLinksBtn.addEventListener('click',suggestLinks);
  el.linksClose.addEventListener('click',()=>{ el.memoLinksBox.style.display='none'; });

  // Graph view
  el.memoGraphBtn.addEventListener('click',toggleGraph);

  // Editor de preguntas del diario
  el.memoQsBtn.addEventListener('click',openQsEditor);
  el.memoQsCancel.addEventListener('click',()=>{ el.memoQsEditor.style.display='none'; });
  el.memoQsSave.addEventListener('click',saveQsEditor);
  el.memoQsReset.addEventListener('click',async ()=>{
    await saveDiarioQs(null);
    el.memoQsText.value=DIARIO_QS_DEFAULT.join('\n');
    showToast('✓ Preguntas restauradas a las originales.');
  });

  // Recordatorio de diario
  el.diarioNowBtn.addEventListener('click',()=>{
    el.diarioReminder.style.display='none';
    startAssist();
  });
  el.diarioDismissBtn.addEventListener('click',async ()=>{
    await chrome.storage.local.set({picona_diario_dismiss:new Date().toDateString()});
    el.diarioReminder.style.display='none';
  });

  // Importar JSON
  el.memoImportBtn.addEventListener('click',()=>{
    el.memoExportMenu.style.display='none';
    el.memoImportInput.click();
  });
  el.memoImportInput.addEventListener('change',()=>{
    const file=el.memoImportInput.files?.[0];
    if(file) importMemosJSON(file);
  });

  // Translate: bilingual view toggle
  el.bilingualToggle.classList.toggle('active',state.bilingualView);
  el.bilingualToggle.addEventListener('click',()=>{
    state.bilingualView=!state.bilingualView;
    el.bilingualToggle.classList.toggle('active',state.bilingualView);
  });

  // History search
  el.historySearch.addEventListener('input',()=>{
    state.historySearchQuery=el.historySearch.value;
    renderHistory();
  });

  // Autosave current conversation when the panel is about to close/unload
  window.addEventListener('beforeunload',()=>{ saveCurrentConversation(); });
}

document.addEventListener('DOMContentLoaded',init);

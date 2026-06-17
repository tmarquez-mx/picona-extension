# Picona — Asistente de IA para Chrome

Extensión de Chrome (Manifest V3) tipo Sider AI: panel lateral con chat,
resumen, traducción, investigación multi-pestaña, memos y barra flotante
de selección. Soporta modelos por API (OpenAI, Anthropic, Gemini, Mistral,
Groq, OpenRouter, Ollama, custom) y por sesión de suscripción web
(ChatGPT, Claude, Gemini, Perplexity, Copilot, Le Chat, Grok, HuggingChat).

## Estructura

```
picona-extension/
├── manifest.json        # Manifest V3
├── background.js        # Service worker: side panel, context menus, inyección
├── content.js           # Barra flotante de selección (Sider-style)
├── icons/
└── sidepanel/
    ├── index.html
    ├── style.css
    └── app.js            # Lógica principal (~1400 líneas)
```

## Cómo probar localmente

1. `chrome://extensions` → activar "Modo de desarrollador"
2. "Cargar extensión sin empaquetar" → seleccionar esta carpeta
3. Para ver logs del panel lateral: clic derecho dentro del panel → Inspeccionar
4. Para ver logs del background/service worker: en `chrome://extensions`,
   clic en "service worker" bajo Picona
5. Tras editar código: botón ↻ en `chrome://extensions`. Si tocas
   `manifest.json` o permisos, **quita y vuelve a cargar** la extensión
   completa (↻ no siempre basta).

## Notas importantes para Claude Code

- **`chrome.sidePanel.open()`** desde content scripts requiere usar
  `chrome.runtime.connect` (Port), NO `chrome.runtime.sendMessage`
  — ver `background.js` → `onConnect` ("picona-toolbar"). Es un bug
  conocido de Chrome (crbug.com/40929586).
- **Patrones de URL para `chrome.tabs.query`** deben incluir `/*`
  (ej. `'https://claude.ai/*'`), nunca `'https://claude.ai*'` — Chrome
  lo rechaza como patrón inválido.
- **Sin handlers `onclick=""` inline** en HTML generado dinámicamente
  — viola la CSP de Manifest V3. Usar siempre `addEventListener` tras
  insertar el HTML (ver `renderProviders`, `renderServiceGrid`, etc.).
- Las API keys se guardan en `chrome.storage.local` bajo
  `picona_providers` / `picona_active`. Los memos en `picona_memos`.
  Nunca se envían a servidores propios.

## Pendientes / ideas (ver conversación previa)

- Vista bilingüe de traducción (lado a lado)
- Resumen de YouTube (transcripción)
- Soporte de PDFs (pdf.js)
- Historial de conversaciones (similar a memos)
- Política de privacidad pública (requerido para Chrome Web Store)
- Modo demo sin API key para onboarding

## Antes de publicar en Chrome Web Store

- Redactar política de privacidad pública (URL)
- Justificar permisos amplios (`<all_urls>`, hosts de IA) en la
  descripción del listing
- Explicar con claridad la función de "suscripción web" (inyección
  en sitios de terceros) — riesgo de rechazo bajo políticas de
  manipulación de UX si no se explica bien

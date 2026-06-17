# Picona — Extensión para Chrome

**Tu asistente de investigación con IA. Conecta tus propios modelos de lenguaje directamente en el navegador.**

---

## Instalación

### 1. Descargar y extraer
Extrae el contenido del ZIP en una carpeta permanente (por ejemplo: `~/Documentos/picona-extension`). **No borres ni muevas esta carpeta** después de instalar.

### 2. Activar modo desarrollador en Chrome
1. Abre Chrome y escribe en la barra de direcciones: `chrome://extensions`
2. Activa **"Modo desarrollador"** (Developer mode) en la esquina superior derecha.

### 3. Cargar la extensión
1. Haz clic en **"Cargar descomprimida"** (Load unpacked).
2. Selecciona la carpeta que extrajiste en el paso 1.
3. Picona aparecerá en tu lista de extensiones.

### 4. Anclar Picona a la barra de herramientas
1. Haz clic en el ícono del rompecabezas (🧩) junto a la barra de direcciones.
2. Haz clic en el pin 📌 junto a **Picona**.

---

## Configuración inicial

1. Haz clic en el ícono de Picona en la barra de herramientas.
2. Se abrirá el panel lateral. Haz clic en **"Conectar modelo"**.
3. Selecciona tu proveedor y pega tu API Key.
4. Haz clic en **Guardar**.

---

## Proveedores soportados

| Proveedor | Acceso | Modelos |
|-----------|--------|---------|
| **OpenAI** | API Key | GPT-4o, GPT-4o mini, GPT-3.5 |
| **Anthropic** | API Key | Claude Opus 4.5, Sonnet 4.5, Haiku 4.5 |
| **Google Gemini** | API Key (gratuita) | Gemini 1.5 Pro/Flash, 2.0 Flash |
| **Mistral AI** | API Key | Mistral Large, Medium, 7B |
| **Groq** | API Key **(gratuita)** | LLaMA 3.3 70B, Mixtral, Gemma2 |
| **OpenRouter** | API Key | +200 modelos |
| **Ollama** | Local (sin clave) | LLaMA, Mistral, etc. |
| **API personalizada** | Opcional | Compatible con formato OpenAI |

---

## Funcionalidades

### 💬 Chat
Conversa con el modelo sobre cualquier tema. Usa **"Sobre esta página"** para contextualizar automáticamente la conversación con el contenido de la pestaña activa.

### 📄 Resumir
- **Resumir página actual**: extrae y resume el texto completo de la página.
- **Resumir selección**: selecciona texto en la página y Picona lo resume.
- Puedes añadir instrucciones específicas en el campo de texto.

### 🔍 Investigar (Deep Research)
1. Abre las pestañas con las fuentes que quieras analizar.
2. En Picona, ve a **Investigar**, selecciona las pestañas relevantes.
3. Escribe tu pregunta de investigación y haz clic en **Iniciar investigación**.
4. Picona sintetiza el contenido de todas las fuentes seleccionadas (hasta 8 pestañas).

### 🌐 Traducir
- Traduce texto seleccionado o la página completa a cualquier idioma.
- Selecciona el idioma destino en el menú desplegable.

### Menú contextual (clic derecho)
Selecciona texto en cualquier página, haz clic derecho y elige:
- **Explicar con Picona ✦**
- **Traducir con Picona ✦**
- **Investigar esto con Picona ✦**
- **Resumir esta página ✦** (en área sin selección)

---

## Privacidad y seguridad

- Las API Keys se guardan **exclusivamente en tu navegador** (`chrome.storage.local`), nunca se envían a servidores de Picona ni terceros.
- Picona no recopila datos de uso ni telemetría.
- Cada llamada a la IA va directamente desde tu navegador al proveedor que configuraste.

---

## Solución de problemas

**"Sin modelo activo"**: Abre Configuración (⚙️) y verifica que tu proveedor esté guardado y activo.

**Error de CORS / red en Anthropic**: Asegúrate de estar usando Chrome actualizado (v120+). La cabecera `anthropic-dangerous-direct-browser-access: true` está incluida automáticamente.

**Ollama no conecta**: Verifica que Ollama esté corriendo (`ollama serve`) y que la URL base sea `http://localhost:11434`.

**La página no se puede leer**: Algunas páginas (PDFs del navegador, `chrome://`, extensiones) no permiten inyección de scripts. Funciona en la mayoría de sitios web convencionales.

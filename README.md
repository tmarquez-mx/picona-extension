<div align="center">

<img src="icon128.png" width="96" alt="Picona">

# Picona

### De horas de navegación a pensamiento documentado y conectado

*Extensión de navegador para investigación asistida por IA, con un sistema de notas de procedencia inspirado en el análisis cualitativo.*

· Versión 2.7.2 ·
[**▸ Instalar desde Chrome Web Store**](https://chromewebstore.google.com/search/picona?hl=es) ·
[**▸Guía de usuario**](https://github.com/tmarquez-mx/picona-extension/blob/main/Guia_de_usuario_Picona_2.6.pdf)

</div>

---

## Resumen

**Picona** es una extensión para navegadores basados en Chromium que acompaña al investigador mientras lee en la web. Se presenta como un panel lateral, junto a la página activa, y reúne en un mismo espacio la conversación con un modelo de lenguaje, el resumen y la traducción de contenidos, la generación de versiones de lectura en PDF, y -su componente distintivo- un **sistema de memos con procedencia**.

El proyecto parte de una premisa: el valor de la investigación no está solo en *leer* mucho, sino en *registrar y conectar* lo que se piensa mientras se lee. Picona busca convertir las horas de navegación en una base de conocimiento trazable, donde cada nota conserva de dónde salió, en qué contexto y cómo se relaciona con las demás.

## Fundamento conceptual

El sistema de memos se inspira en las prácticas de **análisis cualitativo** (por ejemplo, los *memos* analíticos y la codificación en herramientas como MAXQDA o Atlas.ti) y en los principios de los gestores de conocimiento en red como Obsidian. Cada memo (anotación o registro de ideas, reflexiones, curso de acciónm decisión, etc.) articula tres dimensiones:

- **Procedencia** - de qué fuente proviene (URL, título, fecha y la cita textual que lo originó).
- **Contexto** - a qué proyecto pertenece, con qué etiquetas se clasifica.
- **Conexión** - cómo se vincula con otros memos a través de etiquetas compartidas, formando una red navegable de ideas.

Esta orientación responde a una preocupación pedagógica más amplia: promover un uso de la inteligencia artificial que sea **reflexivo y crítico**, donde la herramienta apoye el pensamiento del investigador sin sustituirlo, y donde quede registro transparente de cómo se construyó el conocimiento.

## Funcionalidades

| Función | Descripción |
|---|---|
| **Chat contextual** | Conversación con un modelo de IA, con la opción de incorporar el contenido de la página activa. |
| **Resumen** | Resúmenes estructurados de artículos, *papers* y documentos web. |
| **Traducción bilingüe** | Original y traducción intercalados por párrafo, para lectura académica en otros idiomas. |
| **PDF en modo lectura** | Versión limpia (sin elementos accesorios) de la página, exportable a PDF. |
| **Investigación multi-pestaña** | Síntesis conjunta de varias pestañas abiertas. |
| **Análisis de videos** | Resumen, ideas clave con marcas de tiempo, esquema, transcripción y consulta sobre el contenido. |
| **Barra flotante** | Acciones rápidas (explicar, traducir, resumir, guardar memo) al seleccionar texto. |
| **Sistema de memos** | Notas con procedencia, etiquetas, proyectos, tipos (libre / de página / diario) y red de conexiones. |
| **Exportación** | Markdown, CSV, JSON, vault de Obsidian (con enlaces automáticos) y HTML enriquecido. |


## Contexto

Picona se desarrolla en el marco de la docencia e investigación sobre **alfabetización y uso crítico de la inteligencia artificial en contextos académicos**, en el Departamento de Ciencias Sociales y Políticas de la Universidad Iberoamericana Ciudad de México (IBERO).


## Picona para estudiantes

Cuando estudias en la web, el tiempo entre "encontré algo útil" y "lo perdí para siempre" puede ser de segundos. Picona cierra esa brecha.

**Lee más rápido y comprende mejor**

Abre Picona sobre cualquier artículo o página y pide un resumen estructurado en segundos. Si el texto está en otro idioma, tradúcelo en formato bilingüe: el original y la traducción intercalados párrafo a párrafo, para leer sin perder el matiz del original. También puedes seleccionar cualquier fragmento y pedir que te lo explique, lo traduzca o lo resuma directamente.

**Pregunta sobre lo que lees**

Al configurar Picona, conectas una clave de API de un proveedor de IA (como Groq o Mistral, ambos con opciones gratuitas). Esa clave es la que le da a Picona acceso a las capacidades del modelo: a partir de ese momento, Picona puede incorporar el contenido de la página activa a la conversación y responder con la inteligencia del modelo que elegiste. Puedes hacer preguntas específicas sobre el texto, pedir que lo relacione con otros conceptos, o que te ayude a entender argumentos complejos, todo sin salir de la página.

**Captura ideas sin perder el hilo**

El sistema de memos te permite guardar ideas, citas y reflexiones mientras lees, conservando automáticamente la fuente (URL, título, fecha) y la cita textual que las originó. Cada nota queda vinculada a la página donde nació. Puedes organizarlas por proyecto, etiquetarlas y exportarlas en formatos compatibles con tus herramientas de trabajo (Markdown, CSV, Obsidian).

**Funciona con los modelos que ya tienes**

Picona no impone un modelo de IA. Conecta la clave de API del proveedor que prefieras: OpenAI, Anthropic, Google Gemini, Groq (gratuito), Mistral (gratuito), Ollama (local) u otros compatibles. Si aún no tienes una, Groq y Mistral ofrecen acceso gratuito para comenzar sin costo.

## Picona para investigadores y académicos

El trabajo de investigación exige no solo leer, sino documentar cómo se construyó el conocimiento: qué se consultó, cuándo, por qué importó y cómo se relaciona con lo demás. Picona fue diseñada con esa exigencia en mente.

**Un sistema de memos con procedencia**

Inspirado en las prácticas del análisis cualitativo (los memos analíticos de herramientas como MAXQDA o Atlas.ti), el sistema de memos de Picona articula tres dimensiones para cada nota:

- **Procedencia** - fuente exacta de donde proviene: URL, título, fecha y cita textual de origen.
- **Contexto** - proyecto al que pertenece y etiquetas de clasificación.
- **Conexión** - vínculos automáticos con otros memos que comparten etiquetas, formando una red navegable de ideas.

El resultado es una base de conocimiento trazable: sabes exactamente de dónde viene cada idea y cómo se conecta con las demás.

**Investiga en múltiples fuentes a la vez**

La función de investigación multi-pestaña permite sintetizar el contenido de varias páginas abiertas en un análisis conjunto. Útil para comparar perspectivas, contrastar fuentes o construir un estado del arte mientras navegas.

**Exporta a tu entorno de trabajo**

Los memos se exportan en múltiples formatos: Markdown con frontmatter YAML, CSV, JSON (para respaldo y portabilidad), y vault de Obsidian con wikilinks automáticos entre notas relacionadas. El grafo de conexiones que genera Obsidian con ese vault es una visualización directa de tu red de ideas.

**Captura tus conversaciones con IA**

Si usas ChatGPT, Claude, Perplexity u otros modelos en el navegador, Picona puede capturar esas conversaciones como archivos Markdown organizados por plataforma, con frontmatter estructurado compatible con Obsidian y sistemas de archivo académico.

**Privacidad por diseño**

Picona no opera servidores propios ni almacena datos de usuarios. Todos los memos, el historial y la configuración residen en el navegador local. El modelo "trae tu propia clave de API" significa que las solicitudes de IA viajan directamente de tu navegador al proveedor que elegiste, sin intermediación. Tu información no sale de tu equipo salvo hacia el proveedor que tú configuraste.

---

## Funcionalidades

| Función | Descripción |
|---|---|
| **Chat contextual** | Conversación con IA usando el contenido de la página activa como contexto. |
| **Resumen** | Resúmenes estructurados de artículos, documentos y páginas web. |
| **Traducción bilingüe** | Original y traducción intercalados por párrafo. |
| **PDF en modo lectura** | Versión limpia de la página exportable como PDF. |
| **Investigación multi-pestaña** | Síntesis conjunta de varias fuentes abiertas. |

| **Barra flotante** | Acciones rápidas al seleccionar texto: explicar, traducir, resumir, guardar memo. |
| **Sistema de memos** | Notas con procedencia, etiquetas, proyectos, tipos (libre, de página, diario) y red de conexiones. |
| **Captura de diálogos** | Exportación de conversaciones con LLMs a Markdown organizado por plataforma. |
| **Exportación** | Markdown, CSV, JSON, vault de Obsidian y HTML enriquecido. |
| **Manual integrado** | Guía interactiva de 6 pasos y manual completo en PDF desde el propio panel. |

---

## Instalación

1. Instalar desde la [Chrome Web Store](#) (recomendado).
2. Abrir el panel de Picona y pulsar **Ajustes** para conectar un proveedor de IA.
3. Ingresar la clave de API del proveedor elegido.

> Algunos proveedores ofrecen acceso gratuito para comenzar. Groq y Mistral son buenas opciones sin costo inicial; también pueden utilizarse modelos locales mediante Ollama.



---

## Privacidad

Política de privacidad: https://tmarquez-mx.github.io/picona/

---

<div align="center">
<em>Lee, reflexiona, registra y conecta.</em>
</div>

<div align="center">

<img src="icon128.png" width="96" alt="Picona">

# Picona

### De horas de navegación a pensamiento documentado y conectado

*Extensión de navegador para investigación asistida por IA, con un sistema de notas de procedencia inspirado en el análisis cualitativo.*

· Versión 2.7.2 ·
[**▸ Instalar desde Chrome Web Store**](https://chromewebstore.google.com/search/picona?hl=es) ·
[**▸Guía de usuario**] (https://github.com/tmarquez-mx/picona-extension/blob/main/Guia_de_usuario_Picona_2.6.pdf)

</div>

---

## Resumen

**Picona** es una extensión para navegadores basados en Chromium que acompaña al investigador mientras lee en la web. Se presenta como un panel lateral, junto a la página activa, y reúne en un mismo espacio la conversación con un modelo de lenguaje, el resumen y la traducción de contenidos, la generación de versiones de lectura en PDF, y -su componente distintivo- un **sistema de memos con procedencia**.

El proyecto parte de una premisa: el valor de la investigación no está solo en *leer* mucho, sino en *registrar y conectar* lo que se piensa mientras se lee. Picona busca convertir las horas de navegación en una base de conocimiento trazable, donde cada nota conserva de dónde salió, en qué contexto y cómo se relaciona con las demás.

## Fundamento conceptual

El sistema de memos se inspira en las prácticas de **análisis cualitativo** (por ejemplo, los *memos* analíticos y la codificación en herramientas como MAXQDA o Atlas.ti) y en los principios de los gestores de conocimiento en red. Cada memo articula tres dimensiones:

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

## Arquitectura y privacidad

Picona está construida sobre **Manifest V3** y opera bajo un principio de **privacidad por diseño**:

- **Sin servidores propios.** El proyecto no opera infraestructura que reciba o almacene datos de los usuarios.
- **Almacenamiento local.** Todos los memos, el historial y la configuración residen en el navegador del usuario (`chrome.storage.local`).
- **Modelo "trae tu propia clave".** El usuario conecta su propio proveedor de IA mediante una clave de API; las solicitudes viajan directamente del navegador al proveedor elegido, sin intermediación. La clave nunca abandona el equipo del usuario salvo hacia ese proveedor.

```
picona-extension/
├── manifest.json        # Manifest V3
├── background.js        # Service worker: panel lateral, menús, extracción de contenido
├── content.js           # Barra flotante de selección
├── sidepanel/
│   ├── index.html       # Interfaz del panel
│   ├── app.js           # Lógica de la aplicación
│   └── style.css        # Estilos
└── icons/               # Iconografía (16 / 48 / 128 px)
```

## Instalación (modo desarrollador)

1. Descargar o clonar este repositorio.
2. Abrir `chrome://extensions` en un navegador basado en Chromium.
3. Activar el **Modo de desarrollador** (esquina superior derecha).
4. Pulsar **Cargar descomprimida** y seleccionar la carpeta del proyecto.
5. Abrir el panel de Picona y conectar un proveedor de IA con una clave de API propia.

> Para usar las funciones de IA se requiere una clave de API de un proveedor compatible. Algunos proveedores ofrecen acceso gratuito; también pueden utilizarse modelos locales.

## Estado del proyecto

Prueba de concepto funcional. La extensión se encuentra en proceso de revisión para su publicación en la tienda de extensiones, y en evaluación con usuarios.

## Contexto

Picona se desarrolla en el marco de la docencia e investigación sobre **alfabetización y uso crítico de la inteligencia artificial en contextos académicos**, en el Departamento de Ciencias Sociales y Políticas de la Universidad Iberoamericana Ciudad de México (IBERO).

## Privacidad

Política de privacidad: https://tmarquez-mx.github.io/picona/

---

<div align="center">
<em>Lee, reflexiona, registra y conecta.</em>
</div>

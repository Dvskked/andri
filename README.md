# Andri — Asistente personal por voz

**Andri** es un asistente de inteligencia artificial por voz construido 100 % en **JavaScript puro** (sin servidores, sin APIs externas). Es como un mini *Siri* local: pulsas un botón, hablas, y Andri entiende en español y agenda tus citas en un **calendario local** guardado en tu propio navegador.

## Cómo funciona

1. Pulsas el botón del micrófono → Andri empieza a **grabar tu voz** y te muestra la transcripción en vivo y el medidor de nivel de sonido.
2. Vuelves a pulsar el botón → se detiene la grabación (el audio **queda guardado en tu navegador** usando *IndexedDB*), se procesa lo que dijiste y Andri actúa.
3. Andri **responde hablando** (y por texto) y actualiza el calendario.

Flujo de ejemplo:

> **Tú:** *"Andri, tengo una cita para este sábado a las 4 de la tarde"*
>
> **Andri:** *"¡Listo! Agendé «Cita» para mañana, a las 4 de la tarde."*

Y la cita aparece inmediatamente en el calendario.

## Comandos que entiende

| Función | Ejemplo |
|---|---|
| Agendar una cita/evento | *"Andri tengo una cita con el doctor el martes a las 9 de la mañana"* |
| Agendar en varias fechas | *"Reunión el lunes y el miércoles a las 10"* |
| Agendar con fecha concreta | *"Andri agrega una reunión el 15 de diciembre a las 14:30"* |
| Evento todo el día | *"Recordatorio para el viernes"* |
| Preguntar qué tienes | *"Andri, ¿qué tengo mañana?"* · *"¿qué tengo esta semana?"* |
| Preguntar por un evento | *"Andri, ¿cuándo es mi cita con el doctor?"* · *"¿a qué hora es la reunión?"* |
| Eliminar eventos | *"Andri borra mis citas del sábado"* |
| Hora y fecha | *"¿qué hora es?"* · *"¿qué día es hoy?"* |
| Ayuda y saludo | *"Hola Andri"* · *"Andri, ¿qué puedes hacer?"* |

Fechas que entiende: *hoy, mañana, pasado mañana, esta semana, la próxima semana, en una semana, en un mes, el/este/próximo lunes…domingo, el 15 de marzo, el 15, 15/03/2026, fin de semana*.
Horas que entiende: *a las 4, a las 4 de la tarde, a las 9 de la mañana, a las 8 pm, 14:30, al mediodía, a la una, a las 4 y media, a las 9 menos cuarto*.

> Nota: si en tu comando se detecta una intención clara (agendar/listar/preguntar/borrar) **no hace falta** decir "Andri" primero. La palabra clave se necesita si Andri no sabe de qué le hablan.

También puedes **escribir** comandos en el campo de texto si el micrófono no está disponible.

## Grabaciones de voz

- Cada captura se guarda **persistentemente** (IndexedDB), se conserva la **última** duración y transcripción, y puedes **reproducirla o eliminarla** desde el panel.
- El panel tiene **scroll interno (máx. 24 vh)**: por muchas grabaciones que tengas, nunca desplazan el botón del micrófono ni rompen la interfaz.
- Solo se conservan las **últimas 30** (botón *Vaciar* para borrarlas todas).

## Cómo ejecutarlo

El micrófono y el reconocimiento de voz requieren un **contexto seguro** (HTTPS o `localhost`), así que lo más fácil es levantarlo con un mini servidor local:

### Opción A — Python

```bash
cd voz-js
python -m http.server 8000
```

Luego abre: `http://localhost:8000`

### Opción B — Node.js

```bash
cd voz-js
npx serve .
```

### Opción C — VS Code

Con la extensión **Live Server**: clic derecho en `index.html` → *Open with Live Server*.

> Abrir `index.html` con doble clic puede funcionar, pero el navegador quizá bloquee el micrófono. Para reporter/instalar como app también puedes usar **Chrome → Más herramientas → Crear acceso directo** (PWA ligera con `manifest.webmanifest`).

## Requisitos

- Navegador moderno: **Chrome / Edge** (recomendado) o **Firefox**.
- Micrófono conectado y **permisos concedidos**.
- `localhost` o HTTPS.

La transcripción usa la **Web Speech API** (Chrome/Edge/Firefox). La grabación de audio, el medidor de nivel y la síntesis de voz funcionan en la mayoría de navegadores modernos.

## Estructura del proyecto

```
voz-js/
├── index.html              # Interfaz (asistente + calendario) con SEO y accesibilidad
├── css/
│   └── style.css           # Estilos responsivos, tema oscuro, modo "menos movimiento"
├── js/
│   ├── parser.js           # "NLP" en español: intenciones, fechas, horas
│   ├── calendar.js         # Calendario local + persistencia en localStorage
│   ├── store.js            # IndexedDB: grabaciones de voz persistentes
│   ├── speech.js           # Grabación, transcripción en vivo, nivel de voz, TTS
│   ├── assistant.js        # Lógica de Andri (crear/consultar/borrar/respuestas)
│   └── app.js              # Conexión de la interfaz con todo lo anterior
├── icons/andri.svg         # Icono (favicon, PWA, Open Graph)
├── manifest.webmanifest    # Manifiesto PWA
└── README.md
```

## Dónde se guardan los datos

- **Eventos**: `localStorage` (clave `andri_events_v1`). Persisten al cerrar el navegador. Se eliminan con la **✕** de cada tarjeta del calendario.
- **Grabaciones de voz**: **IndexedDB** (base `andri`, store `recordings`). Persisten entre sesiones y se pueden borrar una a una o con *Vaciar*.

Nada de tus datos sale de tu equipo: no hay backend, cookies ni llamadas a APIs de terceros.

## La "inteligencia" de Andri

Andri usa un **parser de lenguaje natural hecho a mano en español** (`parser.js`), sin depender de servicios de IA:

1. Detecta la **intención**: agendar, listar, preguntar, borrar, hora, fecha o ayuda.
2. Extrae la **fecha** (relativa, concreta o **múltiples fechas**) y la **hora** ("de la tarde", "pm", 24 h, "y media", "menos cuarto"…).
3. Construye el **título** del evento descartando palabras de relleno.
4. Responde por voz y actualiza el calendario.

## Mejoras incorporadas (SEO, buenas prácticas, accesibilidad)

- **SEO**: meta descripción, palabras clave, Open Graph, Twitter Cards, datos estructurados JSON-LD, favicon SVG, `robots.txt` y manifest PWA.
- **Buenas prácticas**: HTML semántico, atributos ARIA, `noscript`, estados de carga, límites de almacenamiento y manejo de errores.
- **Responsive**: funciona en escritorio y móvil; el calendario y el chat se adaptan, botones táctiles de 44 px y modo `prefers-reduced-motion`.
- **Sistema de voz**: medidor de nivel de sonido en vivo, transcripción con resultados provisionales, reinicio automático de la escucha y síntesis de voz en español.

## Ideas para mejorarla

- Conectar a una IA real (p. ej. API de OpenAI) para respuestas más naturales.
- Agendar repeticiones ("todos los lunes", "cada semana").
- Integrar con Google Calendar/Outlook.
- Notificaciones y recordatorios.
- Más idiomas.

---

Hecho con JavaScript, HTML y CSS. ¡Que lo disfrutes con tu asistente Andri!
# Andri — Asistente personal por voz

**Andri** es un asistente de inteligencia artificial por voz construido 100 % en **JavaScript puro** (sin servidores, sin APIs externas). Es como un mini *Siri* local: pulsas un botón, hablas, y Andri entiende en español y agenda tus citas en un **calendario local** guardado en tu propio navegador.

## Cómo funciona

1. Pulsas el botón del micrófono → Andri empieza a **grabar tu voz** (el audio se guarda y se queda en tu navegador).
2. Vuelves a pulsar el botón → se detiene la grabación, se **transcribe lo que dijiste** y Andri interpreta tu petición.
3. Andri **responde hablando** (y por texto) y actúa sobre el calendario.

Flujo de ejemplo:

> **Tú:** *"Andri, tengo una cita para este sábado a las 4 de la tarde"*
>
> **Andri:** *"¡Listo! Agendé «Cita» para el sábado 12 de septiembre, a las 4 de la tarde."*

Y la cita aparece inmediatamente en el calendario.

## Funciones que entiende

| Función | Ejemplo por voz (empieza con "Andri") |
|---|---|
| Agendar una cita/evento | *"Andri tengo una cita con el doctor el martes a las 9 de la mañana"* |
| Agendar con fecha concreta | *"Andri agrega una reunión el 15 de diciembre a las 14:30"* |
| Evento todo el día | *"Andri recordatorio para el viernes"* |
| Preguntar qué tienes | *"Andri, ¿qué tengo mañana?"* |
| Preguntar por un evento | *"Andri, ¿cuándo es mi cita con el doctor?"* |
| Eliminar eventos | *"Andri borra mis citas del sábado"* |

Fechas que entiende: *hoy, mañana, pasado mañana, el/este/proximo lunes…domingo, el 15 de marzo, el 15, 15/03/2026, fin de semana*.
Horas que entiende: *a las 4, a las 4 de la tarde, a las 9 de la mañana, a las 8 pm, 14:30, al mediodía, a la una de la tarde*.

También puedes **escribir** comandos en el campo de texto (sin necesidad de decir "Andri") si el micrófono no está disponible.

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

Luego abre la URL que indica (normalmente `http://localhost:3000`).

### Opción C — VS Code

Con la extensión **Live Server**, haz clic derecho en `index.html` → *Open with Live Server*.

> También puedes abrir `index.html` directamente con doble clic, pero es posible que el navegador bloquee el micrófono.

## Requisitos

- Un navegador moderno: **Google Chrome / Edge** (recomendado) o **Firefox**.
- Micrófono conectado y permisos de micrófono concedidos.
- Conexión con `localhost` o HTTPS.

Nota: el reconocimiento (transcripción) usa la **Web Speech API** del navegador (solo en Chrome/Edge/Firefox). La grabación de audio y la síntesis de voz funcionan en muchos más navegadores.

## Estructura del proyecto

```
voz-js/
├── index.html          # Interfaz principal (asistente + calendario)
├── css/
│   └── style.css       # Estilos (tema oscuro, diseño responsivo)
├── js/
│   ├── parser.js       # "NLP" en español: interpreta fechas, horas e intención
│   ├── calendar.js     # Calendario local + persistencia en localStorage
│   ├── speech.js       # Grabación, transcripción y síntesis de voz
│   ├── assistant.js    # Lógica de Andri (crear/consultar/borrar eventos)
│   └── app.js          # Conexión de la interfaz con todo lo anterior
└── README.md
```

## Cómo se almacenan los datos

- Los **eventos** se guardan en `localStorage` (clave `andri_events_v1`), así que persisten incluso si cierras el navegador. Se pueden eliminar desde la **✕** de cada tarjeta en el calendario.
- Las **grabaciones de voz** se guardan solo en memoria durante la sesión (con su transcripción) y se pueden reproducir desde el panel *Grabaciones de voz*.

Nada de tus datos sale de tu equipo: no hay backend, no hay cookies, no hay llamadas a ninguna API de terceros.

## La "inteligencia" de Andri

Andri usa un **parser de lenguaje natural hecho a mano en español** (`parser.js`), sin depender de servicios de IA:

1. Detecta la **intención**: agendar, listar, preguntar o eliminar.
2. Extrae la **fecha** (relativa o concreta) y la **hora** (con expresiones como "de la tarde", "pm", formato 24 h…).
3. Construye el **título** del evento descartando palabras de relleno.
4. Responde hablando y actualiza el calendario.

## Ideas para mejorarla

- Conectar a una IA real (p. ej. la API de OpenAI) para respuestas más naturales.
- Agendar repeticiones ("todas las semanas", "cada lunes").
- Integrar con Google Calendar/Outlook.
- Notificaciones y recordatorios.
- Más idiomas.

---

Hecho con JavaScript, HTML y CSS. ¡Que lo disfrutes con tu asistente Andri!
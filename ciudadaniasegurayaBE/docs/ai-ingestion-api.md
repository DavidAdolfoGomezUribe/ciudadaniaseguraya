# API de ingesta de incidentes con IA

## Endpoint

```http
POST /api/v1/integrations/ai/incidents
Content-Type: application/json
X-AI-Ingest-Key: <AI_INGEST_API_KEY>
```

Configura en el entorno del backend una clave aleatoria de al menos 32
caracteres y reinicia el contenedor:

```env
AI_INGEST_API_KEY=una-clave-aleatoria-de-al-menos-32-caracteres
```

Si la variable queda vacia, el endpoint responde `503 AI_INGEST_DISABLED`.
Una clave ausente o incorrecta responde `401 AI_INGEST_UNAUTHENTICATED`.

## Cuerpo JSON

```json
{
  "cityId": "66a000000000000000000001",
  "incidentType": "hurto",
  "title": "Hurto reportado por un medio local",
  "description": "Un medio local reporto el hurto ocurrido en este sector.",
  "occurredAt": "2026-08-28T18:30:00-05:00",
  "latitude": 4.651,
  "longitude": -74.101,
  "address": "Carrera 10 con calle 20",
  "locationPrecision": "approximate",
  "neighborhood": "Centro",
  "sourceUrl": "https://example.com/noticia",
  "evidenceDescription": "Nota periodistica y registro fotografico.",
  "confirmLocation": true
}
```

`occurredAt` contiene fecha, hora y desplazamiento horario en formato ISO
8601. `locationPrecision` admite `exact`, `approximate` o `hexagon`. El
checkbox `confirmLocation` debe enviarse literalmente como `true`.

Los codigos validos se consultan en `GET /api/v1/incidents/types` y los
identificadores de ciudad en `GET /api/v1/geolocation/cities`.

## Ejemplo con curl

```bash
curl --request POST "https://api.example.com/api/v1/integrations/ai/incidents" \
  --header "Content-Type: application/json" \
  --header "X-AI-Ingest-Key: $AI_INGEST_API_KEY" \
  --data '{
    "cityId": "66a000000000000000000001",
    "incidentType": "hurto",
    "title": "Hurto reportado por un medio local",
    "description": "Un medio local reporto el hurto ocurrido en este sector.",
    "occurredAt": "2026-08-28T18:30:00-05:00",
    "latitude": 4.651,
    "longitude": -74.101,
    "address": "Carrera 10 con calle 20",
    "locationPrecision": "approximate",
    "neighborhood": "Centro",
    "sourceUrl": "https://example.com/noticia",
    "evidenceDescription": "Nota periodistica y registro fotografico.",
    "confirmLocation": true
  }'
```

Cada solicitud valida la fecha, calcula H3 y comprueba nuevamente que el punto
pertenezca al limite de la ciudad. Un envio correcto crea un incidente con
estado `pending` y `submissionSource: "ai_scraper"`; no suma confirmaciones
comunitarias. En el panel administrativo aparece con la etiqueta
`IA · SCRAPING` y puede aprobarse, rechazarse o fusionarse como duplicado.

El endpoint tiene un limite de 60 solicitudes por minuto. No envies la clave
al frontend ni la declares con un prefijo publico: debe permanecer solo en el
servicio de scraping y en el backend.

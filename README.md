# CRUD de series y episodios

API JSON con Node.js, Express, pnpm y MongoDB. Cada serie guarda sus episodios embebidos dentro del mismo documento (relación 1 a muchos).

## Modelo de datos

Las series se guardan en la colección `series` de MongoDB. Los episodios viven dentro de cada serie, no tienen colección propia.

```json
{
  "id": "507f1f77bcf86cd799439011",
  "title": "La casa de papel",
  "platform": "Netflix",
  "genre": "Acción",
  "seasons": 5,
  "episodes": [
    {
      "id": "ep-1",
      "title": "Efectuar lo acordado",
      "season": 1,
      "number": 1,
      "duration": 47
    }
  ]
}
```

- `id`: se genera a partir del `_id` de MongoDB. La API muestra `id`, no `_id`.
- `title`, `platform`, `genre`: texto obligatorio.
- `seasons`: número entero mayor que 0.
- `episodes`: lista de episodios. Si no se envía en el POST, se guarda como `[]`.
- Cada episodio lleva `id` y `title` (texto) y `season`, `number` y `duration` (enteros mayores que 0). `duration` va en minutos.

## Validaciones

1. `title`, `platform` y `genre` no pueden estar vacíos ni ser solo espacios.
2. `seasons` y los números de cada episodio deben ser enteros mayores que 0.
3. No se puede repetir el `id` de un episodio dentro de la misma serie.

A todos los textos se les hace `trim` (se quitan los espacios del inicio y del final). Se aceptan tildes y ñ.

Si algo no cumple, la API responde `400` con `{ "message": "..." }` explicando el error.

## Endpoints

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/series` | `200`: lista de series |
| GET | `/series/:id` | `200`: la serie; `404` si no existe |
| POST | `/series` | `201`: serie creada; `400` si los datos no son válidos |
| PUT | `/series/:id` | `200`: serie actualizada; `400` o `404` |
| DELETE | `/series/:id` | `204`: sin cuerpo; `404` si no existe |
| POST | `/series/:id/episodes` | `201`: agrega un episodio a la serie; `400` o `404` |

PUT reemplaza todos los datos de la serie (incluida la lista de episodios) y mantiene el mismo `id`. Para agregar un solo episodio sin mandar toda la lista, se usa `POST /series/:id/episodes`.

## Cómo correrlo

### 1. Requisitos

- Node.js 22.21 o superior
- pnpm 10 o superior
- Docker Desktop con el motor iniciado
- Puertos 27017 (MongoDB) y 3000 (API) libres

### 2. Clonar e instalar

```bash
git clone https://github.com/juanjosevelasquezparra8-sketch/series-api.git
cd series-api
pnpm install
```

### 3. Lanzar MongoDB en Docker

```bash
docker run --detach --name ucp-mongo --publish 127.0.0.1:27017:27017 --volume ucp-mongo-data:/data/db mongodb/mongodb-community-server:9.0.4-ubuntu2204
```

Si el contenedor ya existe, solo se prende con `docker start ucp-mongo`.

### 4. Configurar el `.env`

```bash
cp .env.example .env
```

Y dejarlo así:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=ucp_series
PORT=3000
```

### 5. Iniciar la API

```bash
pnpm dev
```

Queda disponible en `http://localhost:3000`.

## Probar con curl

Estos comandos son para Bash (en Windows, usar Git Bash).

El JSON se manda con `--data-binary @- <<'EOF'` en vez de `-d '...'`. Así las tildes y la ñ llegan bien a la API, porque en Windows `-d` las daña antes de que curl las envíe. Se copia y pega todo el bloque, incluida la línea `EOF` del final.

Crear una serie con un episodio:

```bash
curl -i -X POST http://localhost:3000/series \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'EOF'
{"title":"La casa de papel","platform":"Netflix","genre":"Acción","seasons":5,"episodes":[{"id":"ep-1","title":"Efectuar lo acordado","season":1,"number":1,"duration":47}]}
EOF
```

Crear otra serie sin episodios (con ñ en el nombre):

```bash
curl -i -X POST http://localhost:3000/series \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'EOF'
{"title":"El señor de los anillos: Los anillos de poder","platform":"Prime Video","genre":"Fantasía","seasons":2}
EOF
```

Listar todas las series:

```bash
curl -i http://localhost:3000/series
```

Copiar el `id` que devolvió el POST y guardarlo:

```bash
SERIE_ID='pega-aqui-el-id'
```

Consultar una serie:

```bash
curl -i "http://localhost:3000/series/$SERIE_ID"
```

Agregar un episodio:

```bash
curl -i -X POST "http://localhost:3000/series/$SERIE_ID/episodes" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'EOF'
{"id":"ep-2","title":"Imprudencias letales","season":1,"number":2,"duration":41}
EOF
```

Actualizar la serie:

```bash
curl -i -X PUT "http://localhost:3000/series/$SERIE_ID" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'EOF'
{"title":"La casa de papel (actualizada)","platform":"Netflix","genre":"Acción","seasons":5,"episodes":[]}
EOF
```

Eliminar la serie:

```bash
curl -i -X DELETE "http://localhost:3000/series/$SERIE_ID"
```

### Probar las validaciones

Título vacío (responde `400`):

```bash
curl -i -X POST http://localhost:3000/series \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'EOF'
{"title":"   ","platform":"Netflix","genre":"Drama","seasons":1}
EOF
```

Temporadas en 0 (responde `400`):

```bash
curl -i -X POST http://localhost:3000/series \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'EOF'
{"title":"Dark","platform":"Netflix","genre":"Misterio","seasons":0}
EOF
```

Episodio con `id` repetido (responde `400`):

```bash
curl -i -X POST http://localhost:3000/series \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'EOF'
{"title":"Dark","platform":"Netflix","genre":"Misterio","seasons":3,"episodes":[{"id":"ep-1","title":"Secretos","season":1,"number":1,"duration":51},{"id":"ep-1","title":"Mentiras","season":1,"number":2,"duration":44}]}
EOF
```

Ver los datos directamente en MongoDB:

```bash
docker exec ucp-mongo mongosh ucp_series --quiet --eval 'db.series.find().toArray()'
```


const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

async function conectar() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const collection = client.db(process.env.MONGODB_DB).collection('series');
  return { client, collection };
}
function formatearSerie({ _id, ...serie }) {
  return { id: _id.toString(), ...serie };
}
function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : valor;
}


function textoValido(valor) {
  return typeof valor === 'string' && valor.length > 0;
}

function numeroValido(valor) {
  return Number.isInteger(valor) && valor > 0;
}


function limpiarEpisodio(episodio = {}) {
  return {
    id: limpiar(episodio.id),
    title: limpiar(episodio.title),
    season: episodio.season,
    number: episodio.number,
    duration: episodio.duration,
  };
}

// Revisa un episodio. Devuelve el mensaje de error o null si está bien.
function validarEpisodio(episodio) {
  if (!textoValido(episodio.id)) return 'Cada episodio necesita un "id" que no esté vacío';
  if (!textoValido(episodio.title)) return 'Cada episodio necesita un "title" que no esté vacío';
  if (!numeroValido(episodio.season)) return 'La "season" del episodio debe ser un número entero mayor que 0';
  if (!numeroValido(episodio.number)) return 'El "number" del episodio debe ser un número entero mayor que 0';
  if (!numeroValido(episodio.duration)) return 'La "duration" del episodio debe ser un número entero mayor que 0';
  return null;
}

// Limpia y revisa los datos de una serie
// Devuelve { serie } si todo está bien, o { error } con el mensaje.
function prepararSerie(body = {}) {
  const serie = {
    title: limpiar(body.title),
    platform: limpiar(body.platform),
    genre: limpiar(body.genre),
    seasons: body.seasons,
    episodes: body.episodes === undefined ? [] : body.episodes,
  };

  // Validación 1, el título es obligatorio y no puede ser solo espacios.
  if (!textoValido(serie.title)) return { error: 'El "title" es obligatorio y no puede estar vacío' };
  if (!textoValido(serie.platform)) return { error: 'La "platform" es obligatoria y no puede estar vacía' };
  if (!textoValido(serie.genre)) return { error: 'El "genre" es obligatorio y no puede estar vacío' };

  // Validación 2, las temporadas deben ser un número entero mayor que 0.
  if (!numeroValido(serie.seasons)) return { error: 'Las "seasons" deben ser un número entero mayor que 0' };

  if (!Array.isArray(serie.episodes)) return { error: 'Los "episodes" deben ser una lista' };

  serie.episodes = serie.episodes.map(limpiarEpisodio);

  for (const episodio of serie.episodes) {
    const error = validarEpisodio(episodio);
    if (error) return { error };
  }

  // Validación 3, no se puede repetir el id de un episodio dentro de la misma serie.
  const ids = serie.episodes.map((episodio) => episodio.id);
  if (new Set(ids).size !== ids.length) return { error: 'Hay episodios con el "id" repetido' };

  return { serie };
}

// Listar.
app.get('/series', async (req, res) => {
  let client;
  try {
    const conexion = await conectar();
    client = conexion.client;

    const documentos = await conexion.collection.find({}).toArray();
    res.status(200).json(documentos.map(formatearSerie));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudieron listar las series' });
  } finally {
    await client?.close();
  }
});

// Consultar una serie por su id.
app.get('/series/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'El id no tiene un formato válido' });
  }

  let client;
  try {
    const conexion = await conectar();
    client = conexion.client;

    const documento = await conexion.collection.findOne({ _id: new ObjectId(req.params.id) });
    if (!documento) {
      return res.status(404).json({ message: 'No existe una serie con ese id' });
    }
    res.status(200).json(formatearSerie(documento));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo consultar la serie' });
  } finally {
    await client?.close();
  }
});

// Crear una serie (con sus episodios, si los mandan).
app.post('/series', async (req, res) => {
  const { serie, error } = prepararSerie(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }

  let client;
  try {
    const conexion = await conectar();
    client = conexion.client;

    const resultado = await conexion.collection.insertOne(serie);
    res.status(201).json(formatearSerie({ _id: resultado.insertedId, ...serie }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'No se pudo crear la serie' });
  } finally {
    await client?.close();
  }
});

// Actualizar una serie completa.
app.put('/series/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'El id no tiene un formato válido' });
  }

  const { serie, error } = prepararSerie(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }

  let client;
  try {
    const conexion = await conectar();
    client = conexion.client;

    const filtro = { _id: new ObjectId(req.params.id) };
    const resultado = await conexion.collection.updateOne(filtro, { $set: serie });
    if (resultado.matchedCount === 0) {
      return res.status(404).json({ message: 'No existe una serie con ese id' });
    }

    const actualizada = await conexion.collection.findOne(filtro);
    res.status(200).json(formatearSerie(actualizada));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'No se pudo actualizar la serie' });
  } finally {
    await client?.close();
  }
});

// Eliminarla.
app.delete('/series/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'El id no tiene un formato válido' });
  }

  let client;
  try {
    const conexion = await conectar();
    client = conexion.client;

    const resultado = await conexion.collection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (resultado.deletedCount === 0) {
      return res.status(404).json({ message: 'No existe una serie con ese id' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo eliminar la serie' });
  } finally {
    await client?.close();
  }
});

// Agregar UN episodio a una serie sin que mande toda la lista.
app.post('/series/:id/episodes', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'El id no tiene un formato válido' });
  }

  const episodio = limpiarEpisodio(req.body);
  const error = validarEpisodio(episodio);
  if (error) {
    return res.status(400).json({ message: error });
  }

  let client;
  try {
    const conexion = await conectar();
    client = conexion.client;

    const filtro = { _id: new ObjectId(req.params.id) };
    const serie = await conexion.collection.findOne(filtro);
    if (!serie) {
      return res.status(404).json({ message: 'No existe una serie con ese id' });
    }

    // Validación 3 también aqui, el id del episodio no se puede repetir.
    if (serie.episodes.some((e) => e.id === episodio.id)) {
      return res.status(400).json({ message: 'Ya existe un episodio con ese "id" en esta serie' });
    }

    // push mete el episodio al final de la lista episdes.
    await conexion.collection.updateOne(filtro, { $push: { episodes: episodio } });
    res.status(201).json(episodio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'No se pudo agregar el episodio' });
  } finally {
    await client?.close();
  }
});

// Al importar la app en las pruebas, no iniciar el servidor principal.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor disponible en http://localhost:${PORT}`);
  });
}

module.exports = app;

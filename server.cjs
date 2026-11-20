// Instalar dependencias: pnpm add express
// Iniciar el servidor: pnpm exec node --watch server.cjs

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Listar cursos.
app.get('/courses', async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('courses');

    const documents = await collection.find({}).toArray();
    const courses = documents.map(({ _id, ...course }) => ({
      id: _id.toString(),
      ...course,
    }));
    res.status(200).json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudieron listar los cursos' });
  } finally {
    await client.close();
  }
});

// Consultar un curso por ID.
app.get('/courses/:id', (req, res) => {
  console.log(req.params.id);
  // TODO: buscar req.params.id y retornar el curso (200) o no encontrado (404).
  // Pista: req.params.id es un string, pero MongoDB guarda _id como ObjectId.
  // Usa { _id: new ObjectId(req.params.id) } como filtro de búsqueda.
  res.status(501).json({ message: 'Consultar curso: pendiente de implementar' });
});

// Crear un curso.
app.post('/courses', async (req, res) => {
  const { name, description, students = [] } = req.body || {};
  const course = { name, description, students };

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('courses');

    const result = await collection.insertOne(course);
    res.status(201).json({
      id: result.insertedId.toString(),
      name: course.name,
      description: course.description,
      students: course.students,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo crear el curso' });
  } finally {
    await client.close();
  }
});

// Actualizar un curso.
app.put('/courses/:id', (req, res) => {
  console.log(req.params.id);
  // TODO: validar req.body y actualizar el curso con req.params.id (200 o 404).
  res.status(501).json({ message: 'Actualizar curso: pendiente de implementar' });
});

// Eliminar un curso.
app.delete('/courses/:id', (req, res) => {
  console.log(req.params.id);
  // TODO: eliminar el curso con req.params.id (204 sin cuerpo o 404).
  res.status(501).json({ message: 'Eliminar curso: pendiente de implementar' });
});

// Al importar la app en las pruebas, no iniciar el servidor principal.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor disponible en http://localhost:${PORT}`);
  });
}

module.exports = app;

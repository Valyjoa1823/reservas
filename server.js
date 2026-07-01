const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/reservas.html');
});

// Database setup
const dataDir = path.join(__dirname, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
const db = new sqlite3.Database(path.join(dataDir, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time_range TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      org TEXT,
      password TEXT DEFAULT '1234'
    )`, (err) => {
      // Migrate old DBs
      db.run("ALTER TABLE teachers ADD COLUMN password TEXT DEFAULT '1234'", () => {});
    });

    db.run(`CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT,
      date TEXT,
      slot TEXT,
      teacher_name TEXT,
      teacher_org TEXT,
      note TEXT,
      UNIQUE(room, date, slot)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS fixed_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT,
      day_of_week INTEGER,
      slot TEXT,
      teacher_name TEXT,
      teacher_org TEXT,
      note TEXT,
      UNIQUE(room, day_of_week, slot)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      action TEXT,
      details TEXT
    )`);

    // Pre-populate some slots if empty
    db.get('SELECT count(*) as count FROM slots', (err, row) => {
      if (row.count === 0) {
        const defaultSlots = [
          '07:40 – 08:20', '08:55 – 09:30', '09:40 – 10:20',
          '10:20 – 11:00', '11:10 – 11:50', '11:50 – 12:25',
          '12:40 – 13:20', '13:20 – 13:55'
        ];
        const stmt = db.prepare('INSERT INTO slots (time_range) VALUES (?)');
        defaultSlots.forEach(s => stmt.run(s));
        stmt.finalize();
      }
    });

    // Pre-populate fixed reservations based on previous hardcoded data
    db.get('SELECT count(*) as count FROM fixed_reservations', (err, row) => {
      if (row.count === 0) {
        // Lunes: Teatro Prof. German, Informatica Jimena y Marcela
        // Martes: Informatica Jimena y Marcela (11:10 a 13:55)
        // Viernes: Informatica Jimena y Marcela (todos menos 10:20-11:00)
        
        const stmt = db.prepare('INSERT OR IGNORE INTO fixed_reservations (room, day_of_week, slot, teacher_name, teacher_org, note) VALUES (?, ?, ?, ?, ?, ?)');
        const defaultSlots = [
          '07:40 – 08:20', '08:55 – 09:30', '09:40 – 10:20',
          '10:20 – 11:00', '11:10 – 11:50', '11:50 – 12:25',
          '12:40 – 13:20', '13:20 – 13:55'
        ];

        defaultSlots.forEach(slot => {
          // Lunes (day 1)
          stmt.run('teatro', 1, slot, 'Prof. German', 'Docente', 'Clase de Teatro');
          stmt.run('informatica', 1, slot, 'Jimena y Marcela', 'Docentes', 'Clase de Informática');
        });

        const tuesdaySlots = ['11:10 – 11:50', '11:50 – 12:25', '12:40 – 13:20', '13:20 – 13:55'];
        tuesdaySlots.forEach(slot => {
          // Martes (day 2)
          stmt.run('informatica', 2, slot, 'Jimena y Marcela', 'Docentes', 'Clase de Informática');
        });

        defaultSlots.forEach(slot => {
          if (slot !== '10:20 – 11:00') {
            // Viernes (day 5)
            stmt.run('informatica', 5, slot, 'Jimena y Marcela', 'Docentes', 'Clase de Informática');
          }
        });
        stmt.finalize();
      }
    });
  });
}

function logAction(action, details) {
  db.run('INSERT INTO logs (action, details) VALUES (?, ?)', [action, details]);
}

// -- API Endpoints --

// SLOTS
app.get('/api/slots', (req, res) => {
  db.all('SELECT * FROM slots ORDER BY id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/slots', (req, res) => {
  const { time_range } = req.body;
  db.run('INSERT INTO slots (time_range) VALUES (?)', [time_range], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction('Add Slot', `Added slot ${time_range}`);
    res.json({ id: this.lastID, time_range });
  });
});

app.delete('/api/slots/:id', (req, res) => {
  db.run('DELETE FROM slots WHERE id = ?', req.params.id, function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction('Delete Slot', `Deleted slot ID ${req.params.id}`);
    res.json({ deleted: this.changes });
  });
});

// TEACHERS
app.get('/api/teachers', (req, res) => {
  db.all('SELECT * FROM teachers ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/teachers', (req, res) => {
  const { name, org, password } = req.body;
  const pwd = password || '1234';
  db.run('INSERT INTO teachers (name, org, password) VALUES (?, ?, ?)', [name, org, pwd], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction('Add Teacher', `Added teacher ${name} (${org})`);
    res.json({ id: this.lastID, name, org, password: pwd });
  });
});

app.put('/api/teachers/:id/password', (req, res) => {
  const { password } = req.body;
  db.run('UPDATE teachers SET password = ? WHERE id = ?', [password, req.params.id], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction('Update Teacher', `Updated password for teacher ID ${req.params.id}`);
    res.json({ updated: this.changes });
  });
});

app.delete('/api/teachers/:id', (req, res) => {
  db.run('DELETE FROM teachers WHERE id = ?', req.params.id, function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction('Delete Teacher', `Deleted teacher ID ${req.params.id}`);
    res.json({ deleted: this.changes });
  });
});

// LOGIN / VALIDATE TEACHER
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  if (name.toLowerCase() === 'admin' && password === 'admin') {
     return res.json({ id: 0, name: 'Administrador', org: 'Administración', role: 'admin' });
  }
  db.get('SELECT * FROM teachers WHERE name = ? COLLATE NOCASE', [name], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Docente no encontrado. Consulte al preceptor.' });
    if (row.password !== password) return res.status(401).json({ error: 'Contraseña incorrecta.' });
    res.json({ ...row, role: 'teacher' });
  });
});

// RESERVATIONS
app.get('/api/reservations', (req, res) => {
  db.all('SELECT * FROM reservations', [], (err, resRows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all('SELECT * FROM fixed_reservations', [], (err, fixedRows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ reservations: resRows, fixed_reservations: fixedRows });
    });
  });
});

app.post('/api/reservations', (req, res) => {
  const { room, date, slot, teacher_name, teacher_org, note } = req.body;
  db.run('INSERT INTO reservations (room, date, slot, teacher_name, teacher_org, note) VALUES (?, ?, ?, ?, ?, ?)',
    [room, date, slot, teacher_name, teacher_org, note],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      logAction('Add Reservation', `${teacher_name} booked ${room} on ${date} at ${slot}`);
      res.json({ id: this.lastID });
    });
});

app.delete('/api/reservations', (req, res) => {
  const { room, date, slot } = req.query;
  db.run('DELETE FROM reservations WHERE room = ? AND date = ? AND slot = ?', [room, date, slot], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction('Cancel Reservation', `Cancelled ${room} on ${date} at ${slot}`);
    res.json({ deleted: this.changes });
  });
});

// FIXED RESERVATIONS
app.post('/api/fixed_reservations', (req, res) => {
  const { room, day_of_week, slot, teacher_name, teacher_org, note } = req.body;
  db.run('INSERT INTO fixed_reservations (room, day_of_week, slot, teacher_name, teacher_org, note) VALUES (?, ?, ?, ?, ?, ?)',
    [room, day_of_week, slot, teacher_name, teacher_org, note],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      logAction('Add Fixed Reservation', `${teacher_name} fixed booking in ${room} on day ${day_of_week} at ${slot}`);
      res.json({ id: this.lastID });
    });
});

app.delete('/api/fixed_reservations/:id', (req, res) => {
  db.run('DELETE FROM fixed_reservations WHERE id = ?', req.params.id, function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction('Delete Fixed Reservation', `Deleted fixed reservation ID ${req.params.id}`);
    res.json({ deleted: this.changes });
  });
});

// LOGS
app.get('/api/logs', (req, res) => {
  db.all('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

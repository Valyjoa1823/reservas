const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '.data');
const dbPath = fs.existsSync(path.join(dataDir, 'database.sqlite')) 
  ? path.join(dataDir, 'database.sqlite')
  : path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
    return;
  }
  
  db.serialize(() => {
    // 1. Delete ALL old fixed reservations for teatro
    db.run('DELETE FROM fixed_reservations WHERE room = ?', ['teatro']);

    // 2. Ensure all definitive slots exist
    const definitiveSlots = [
      '07:40 – 08:20', '08:55 – 09:30', '09:40 – 10:20',
      '10:20 – 11:00', '11:10 – 11:50', '11:50 – 12:25',
      '12:40 – 13:20', '13:20 – 13:55', '13:55 – 15:00',
      '15:00 – 16:00'
    ];
    
    // We will delete all slots and recreate to be sure, or just insert ignore
    db.run('DELETE FROM slots');
    const insertSlot = db.prepare('INSERT INTO slots (time_range) VALUES (?)');
    definitiveSlots.forEach(s => insertSlot.run(s));
    insertSlot.finalize();

    // 3. Insert definitive Teatro
    const insertResStmt = db.prepare('INSERT OR IGNORE INTO fixed_reservations (room, day_of_week, slot, teacher_name, teacher_org, note) VALUES (?, ?, ?, ?, ?, ?)');
    const insertTeatro = (day, slots) => {
      slots.forEach(slot => {
        insertResStmt.run('teatro', day, slot, 'Prof. German', 'Docente', 'Clase de Teatro');
      });
    };

    insertTeatro(1, ['09:40 – 10:20', '10:20 – 11:00', '11:10 – 11:50', '11:50 – 12:25', '12:40 – 13:20', '13:20 – 13:55']);
    insertTeatro(2, ['12:40 – 13:20', '13:20 – 13:55']);
    insertTeatro(3, ['07:40 – 08:20', '08:55 – 09:30', '11:50 – 12:25', '12:40 – 13:20', '13:20 – 13:55', '13:55 – 15:00', '15:00 – 16:00']);
    insertTeatro(4, ['11:50 – 12:25', '12:40 – 13:20', '13:20 – 13:55']);
    insertTeatro(5, ['13:55 – 15:00']);

    insertResStmt.finalize();
    console.log('Definitive schedule applied to existing database.');
  });
});

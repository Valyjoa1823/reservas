const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening database', err.message);
    return;
  }
  
  db.serialize(() => {
    // 1. Delete the bad slots
    const badSlots = ['14:00 – 14:40', '14:40 – 15:20', '15:20 – 16:00'];
    const deleteSlot = db.prepare('DELETE FROM slots WHERE time_range = ?');
    badSlots.forEach(s => deleteSlot.run(s));
    deleteSlot.finalize();

    // 2. Insert the new slots
    const newSlots = ['13:55 – 15:00', '15:00 – 16:00'];
    const insertSlot = db.prepare('INSERT OR IGNORE INTO slots (time_range) VALUES (?)');
    newSlots.forEach(s => insertSlot.run(s));
    insertSlot.finalize();

    // 3. Delete fixed reservations that used the old slots
    const deleteRes = db.prepare('DELETE FROM fixed_reservations WHERE slot = ?');
    badSlots.forEach(s => deleteRes.run(s));
    deleteRes.finalize();

    // 4. Insert new fixed reservations for Teatro with the new slots
    const insertResStmt = db.prepare('INSERT OR IGNORE INTO fixed_reservations (room, day_of_week, slot, teacher_name, teacher_org, note) VALUES (?, ?, ?, ?, ?, ?)');
    const insertRes = (day, slots) => {
      slots.forEach(slot => {
        insertResStmt.run('teatro', day, slot, 'Prof. German', 'Docente', 'Clase de Teatro');
      });
    };

    // Miércoles: '13:55 – 15:00', '15:00 – 16:00'
    insertRes(3, ['13:55 – 15:00', '15:00 – 16:00']);

    // Viernes: '13:55 – 15:00'
    insertRes(5, ['13:55 – 15:00']);

    insertResStmt.finalize();
    console.log('Slots and reservations updated successfully');
  });
});

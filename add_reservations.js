const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening database', err.message);
    return;
  }
  
  db.serialize(() => {
    // 1. Add missing slots for afternoons
    const newSlots = [
      '14:00 – 14:40', 
      '14:40 – 15:20', 
      '15:20 – 16:00'
    ];
    const insertSlot = db.prepare('INSERT OR IGNORE INTO slots (time_range) VALUES (?)');
    newSlots.forEach(s => insertSlot.run(s));
    insertSlot.finalize();

    // 2. Clear old Teatro reservations for Prof. German to avoid duplicates, 
    // but the instruction is just to reserve. Let's delete old Teatro first, just in case?
    // Actually, let's just insert or ignore.

    const stmt = db.prepare('INSERT OR IGNORE INTO fixed_reservations (room, day_of_week, slot, teacher_name, teacher_org, note) VALUES (?, ?, ?, ?, ?, ?)');
    
    const insertRes = (day, slots) => {
      slots.forEach(slot => {
        stmt.run('teatro', day, slot, 'Prof. German', 'Docente', 'Clase de Teatro');
      });
    };

    // Lunes (1): 9:40 to 14:00
    insertRes(1, [
      '09:40 – 10:20', '10:20 – 11:00', '11:10 – 11:50', 
      '11:50 – 12:25', '12:40 – 13:20', '13:20 – 13:55'
    ]);

    // Martes (2): 12:40 to 14:00
    insertRes(2, [
      '12:40 – 13:20', '13:20 – 13:55'
    ]);

    // Miercoles (3): 7:40 to 9:30 and 11:50 to 16:00
    insertRes(3, [
      '07:40 – 08:20', '08:55 – 09:30', 
      '11:50 – 12:25', '12:40 – 13:20', '13:20 – 13:55',
      '14:00 – 14:40', '14:40 – 15:20', '15:20 – 16:00'
    ]);

    // Jueves (4): 11:40 to 14:00 -> starting from 11:50
    insertRes(4, [
      '11:50 – 12:25', '12:40 – 13:20', '13:20 – 13:55'
    ]);

    // Viernes (5): 14:00 to 15:00
    insertRes(5, [
      '14:00 – 14:40', '14:40 – 15:20'
    ]);

    stmt.finalize();
    console.log('Reservations added successfully');
  });
});

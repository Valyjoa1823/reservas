const fs = require('fs');
let content = fs.readFileSync('public/reservas.html', 'utf8');
content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('public/reservas.html', content);

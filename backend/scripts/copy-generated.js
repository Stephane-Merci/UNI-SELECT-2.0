const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '../src/generated');
const dest = path.join(__dirname, '../dist/generated');
if (fs.existsSync(src)) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

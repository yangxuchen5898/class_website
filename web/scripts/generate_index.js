const fs = require('fs');
const path = require('path');

// 运行位置： web/ 目录
const photosDir = path.join(__dirname, '..', 'class_photos');
const outFile = path.join(photosDir, 'index.json');

function isImage(name){
  return /\.jpe?g$|\.png$|\.gif$|\.webp$/i.test(name);
}

try{
  const files = fs.readdirSync(photosDir, { withFileTypes: true })
    .filter(d=>d.isFile())
    .map(d=>d.name)
    .filter(isImage)
    .sort();

  fs.writeFileSync(outFile, JSON.stringify(files, null, 2), { encoding: 'utf8' });
  console.log(`Wrote ${files.length} entries to ${outFile}`);
} catch(err){
  console.error('Failed to generate index.json:', err.message);
  process.exit(1);
}

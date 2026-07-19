const fs = require('fs');
const path = require('path');

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(source)) {
    console.error(`Source directory does not exist: ${source}`);
    process.exit(1);
  }

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  files.forEach((file) => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

const src = path.join(__dirname, 'frontend/dist');
const dest = path.join(__dirname, 'backend/frontend/dist');

console.log(`Copying build assets from ${src} to ${dest}...`);
try {
  copyFolderRecursiveSync(src, dest);
  console.log('Build assets copied successfully!');
} catch (err) {
  console.error('Failed to copy build assets:', err);
  process.exit(1);
}

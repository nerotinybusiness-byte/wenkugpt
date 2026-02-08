
const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'public', 'documents');
const files = fs.readdirSync(dir);

files.forEach(file => {
    if (file.includes('Manuál')) {
        const oldPath = path.join(dir, file);
        const newName = file
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_');
        const newPath = path.join(dir, newName);
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed: ${file} -> ${newName}`);
    }
});

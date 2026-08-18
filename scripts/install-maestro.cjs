const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const maestroDir = path.join(process.env.USERPROFILE || 'C:\\Users\\aaron', '.maestro');
const zipPath = path.join(maestroDir, 'maestro.zip');

if (!fs.existsSync(maestroDir)) {
  fs.mkdirSync(maestroDir, { recursive: true });
}

console.log('Downloading Maestro from GitHub releases...');
const file = fs.createWriteStream(zipPath);

https.get('https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip', (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    https.get(response.headers.location, (redirectResponse) => {
      redirectResponse.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log('Downloaded. Extracting with tar/powershell...');
          try {
            execSync(`tar -xf "${zipPath}" -C "${maestroDir}"`, { stdio: 'inherit' });
            console.log('Extracted successfully!');
            console.log('Maestro contents in', maestroDir, ':', fs.readdirSync(maestroDir));
          } catch (e) {
            console.error('Extract error:', e);
          }
        });
      });
    });
  } else {
    response.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        console.log('Extracting with tar...');
        execSync(`tar -xf "${zipPath}" -C "${maestroDir}"`, { stdio: 'inherit' });
      });
    });
  }
}).on('error', (err) => {
  console.error('Download error:', err);
});

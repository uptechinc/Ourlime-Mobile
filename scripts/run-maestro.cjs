const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const javaHome = 'C:\\Users\\aaron\\.gradle\\jdks\\eclipse_adoptium-17-amd64-windows.2';
const maestroBat = 'C:\\Users\\aaron\\.maestro\\maestro\\bin\\maestro.bat';

// Read env variables from e2e/config/env.yaml
const envYamlPath = path.resolve(__dirname, '..', 'e2e', 'config', 'env.yaml');
const envFlags = [];

if (fs.existsSync(envYamlPath)) {
  const content = fs.readFileSync(envYamlPath, 'utf8');
  const lines = content.split('\n');
  let inEnvBlock = false;
  for (const line of lines) {
    if (line.trim().startsWith('env:')) {
      inEnvBlock = true;
      continue;
    }
    if (inEnvBlock) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        const match = line.trim().match(/^([A-Za-z0-9_]+):\s*"?(.*?)"?$/);
        if (match) {
          const key = match[1];
          const val = match[2];
          envFlags.push('-e', `${key}=${val}`);
        }
      } else if (line.trim() !== '') {
        inEnvBlock = false;
      }
    }
  }
}

const rawArgs = process.argv.slice(2);
let command = 'test';
let targetFiles = [];

if (rawArgs.length === 0) {
  targetFiles = ['e2e/flows/'];
} else if (rawArgs[0] === 'studio') {
  command = 'studio';
} else if (rawArgs[0] === 'test') {
  targetFiles = rawArgs.slice(1);
  if (targetFiles.length === 0) targetFiles = ['e2e/flows/'];
} else {
  targetFiles = rawArgs;
}

const finalArgs = command === 'studio' ? ['studio'] : ['test', ...envFlags, ...targetFiles];

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')};${path.join('C:\\Users\\aaron\\.maestro\\maestro\\bin')};${process.env.PATH}`,
  MAESTRO_CLI_NO_ANALYTICS: 'true',
  MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
};

console.log(`[Maestro Runner] Running Maestro on physical device R5GL633RJYJ...`);
console.log(`[Maestro Runner] Loaded environment variables:`, envFlags.filter((_, i) => i % 2 === 1).map(f => f.split('=')[0]));
console.log(`[Maestro Runner] Command: maestro ${finalArgs.join(' ')}`);

const child = spawn(maestroBat, finalArgs, {
  env,
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

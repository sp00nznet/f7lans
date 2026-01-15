/**
 * Copy server files for unified build
 * This script copies the server directory into the Electron app resources
 * and installs dependencies automatically
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

const serverSource = path.join(__dirname, '..', '..', 'server');
const serverDest = path.join(__dirname, '..', 'server');

async function runNpmInstall(cwd) {
  return new Promise((resolve, reject) => {
    console.log('Installing server dependencies...');

    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const install = spawn(npm, ['install', '--production'], {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    install.on('close', (code) => {
      if (code === 0) {
        console.log('Server dependencies installed successfully!');
        resolve();
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });

    install.on('error', (err) => {
      reject(err);
    });
  });
}

async function copyServer() {
  console.log('Copying server files for unified build...');

  try {
    // Remove existing server copy if present
    if (await fs.pathExists(serverDest)) {
      await fs.remove(serverDest);
    }

    // Copy server directory
    await fs.copy(serverSource, serverDest, {
      filter: (src) => {
        // Exclude node_modules, .git, etc.
        const relativePath = path.relative(serverSource, src);
        if (relativePath.includes('node_modules')) return false;
        if (relativePath.includes('.git')) return false;
        if (relativePath.endsWith('.log')) return false;
        return true;
      }
    });

    // Copy package.json from root for dependencies
    const rootPackage = path.join(__dirname, '..', '..', 'package.json');
    const serverPackage = path.join(serverDest, 'package.json');

    const pkg = await fs.readJson(rootPackage);
    await fs.writeJson(serverPackage, {
      name: 'f7lans-server',
      version: pkg.version,
      main: 'index.js',
      dependencies: pkg.dependencies
    }, { spaces: 2 });

    console.log('Server files copied successfully!');
    console.log(`Source: ${serverSource}`);
    console.log(`Destination: ${serverDest}`);

    // Auto-install server dependencies
    await runNpmInstall(serverDest);

  } catch (error) {
    console.error('Failed to copy server:', error);
    process.exit(1);
  }
}

copyServer();

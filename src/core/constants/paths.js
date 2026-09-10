const path = require('path');
const fs = require('fs');
const { INSTANCE } = require('../../config/environments');


const ROOT = path.resolve(__dirname, '../../..');

const AUTH_DIR = path.join(ROOT, '.auth');


function authFile(projectKey, instance = INSTANCE) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  return path.join(AUTH_DIR, `${projectKey}-${instance}.json`);
}

module.exports = { ROOT, authFile };

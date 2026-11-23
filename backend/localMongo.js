const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');

const projectRoot = path.resolve(__dirname, '..');
const executable = path.join(projectRoot, '.local', 'mongodb-8.3.7', 'MongoDB', 'Server', '8.3', 'bin', 'mongod.exe');
const dataDirectory = path.join(projectRoot, '.local', 'mongodb', 'data');
const logFile = path.join(projectRoot, '.local', 'mongodb', 'mongod.log');

async function canConnect(uri) {
  const probe = new MongoClient(uri, { serverSelectionTimeoutMS: 700 });
  try {
    await probe.connect();
    await probe.db('admin').command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await probe.close();
  }
}

function portInUse() {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 27017 });
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(700);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function ensureLocalMongo(uri) {
  // Other installations and remote database connections remain independently managed.
  if (process.platform !== 'win32' || !/^mongodb:\/\/(?:localhost|127\.0\.0\.1):27017(?:[/?]|$)/.test(uri)) return;
  if (await canConnect(uri)) return;
  if (!fs.existsSync(executable)) return;
  if (await portInUse()) throw new Error('Port 27017 is occupied but MongoDB is not responding. Check the existing database process.');
  if (!fs.existsSync(path.join(dataDirectory, 'WiredTiger'))) {
    throw new Error('Recovered MongoDB data is missing. Restore it from .local/mongodb-backups before starting.');
  }
  const child = spawn(executable, [
    '--dbpath', dataDirectory,
    '--bind_ip', '127.0.0.1',
    '--port', '27017',
    '--logpath', logFile,
    '--logappend',
    '--wiredTigerCacheSizeGB', '0.25',
  ], { detached: true, windowsHide: true, stdio: 'ignore' });
  let launchError;
  child.once('error', error => { launchError = error; });
  child.unref();
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error(`MongoDB exited during startup. See ${logFile}`);
    if (await canConnect(uri)) {
      console.log('Recovered local MongoDB started on 127.0.0.1:27017.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`MongoDB did not become ready. See ${logFile}`);
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, 'env.txt') });
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  ensureLocalMongo(uri).then(async () => {
    if (!await canConnect(uri)) throw new Error('MongoDB is unavailable. Check its installation and MONGO_URI.');
    console.log('MongoDB is ready.');
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { ensureLocalMongo };

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const storageDir = process.env.STORAGE_DIR || './storage';
const nfsMountPoint = process.env.NFS_MOUNT_POINT || '/mnt/nfs';

class Storage {
  constructor(type = 'local') {
    this.type = type;
    if (type === 'local') {
      this.ensureStorageDir();
    } else if (type === 'nfs') {
      this.ensureNfsMount();
    }
  }

  ensureStorageDir() {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  ensureNfsMount() {
    if (!fs.existsSync(nfsMountPoint)) {
      fs.mkdirSync(nfsMountPoint, { recursive: true });
      // In a real application, you'd mount the NFS share here
      console.log('NFS mount point created. Please mount your NFS share to this location.');
    }
  }

  getStoragePath(filename) {
    return this.type === 'local' ? path.join(storageDir, filename) : path.join(nfsMountPoint, filename);
  }

  async saveFile(filename, content) {
    const filePath = this.getStoragePath(filename);
    await promisify(fs.writeFile)(filePath, content);
    return filePath;
  }

  async saveDirectory(directoryPath, content) {
    const fullPath = this.getStoragePath(directoryPath);
    await promisify(fs.mkdir)(fullPath, { recursive: true });
    for (const [name, fileContent] of Object.entries(content)) {
      const filePath = path.join(fullPath, name);
      await promisify(fs.writeFile)(filePath, fileContent);
    }
    return fullPath;
  }

  async getFile(filename) {
    const filePath = this.getStoragePath(filename);
    return await promisify(fs.readFile)(filePath);
  }

  async deleteFile(filename) {
    const filePath = this.getStoragePath(filename);
    await promisify(fs.unlink)(filePath);
  }

  async listFiles() {
    const dir = this.type === 'local' ? storageDir : nfsMountPoint;
    return await promisify(fs.readdir)(dir);
  }
}

module.exports = Storage;

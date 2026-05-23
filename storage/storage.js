'use strict';

const Storage = (() => {

  const STORAGE_KEY = 'csvNotes';

  async function getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const data = result[STORAGE_KEY];
        if (!data) {
          resolve({ files: {}, activeFile: null });
        } else {
          resolve(data);
        }
      });
    });
  }

  async function saveAll(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
    });
  }

  async function getFiles() {
    const data = await getAll();
    return data.files || {};
  }

  async function getActiveFile() {
    const data = await getAll();
    return data.activeFile || null;
  }

  async function setActiveFile(filename) {
    const data = await getAll();
    data.activeFile = filename;
    await saveAll(data);
  }

  async function getFile(filename) {
    const files = await getFiles();
    return files[filename] || null;
  }

  async function saveFile(filename, fileData) {
    const data = await getAll();
    if (!data.files) data.files = {};
    data.files[filename] = {
      headers: fileData.headers || [],
      rows: fileData.rows || [],
    };
    await saveAll(data);
  }

  async function createFile(filename) {
    const files = await getFiles();
    if (files[filename]) {
      throw new Error(`File "${filename}" already exists.`);
    }
    const data = await getAll();
    if (!data.files) data.files = {};
    data.files[filename] = { headers: ['Column A'], rows: [['']] };
    data.activeFile = filename;
    await saveAll(data);
    return data.files[filename];
  }

  async function deleteFile(filename) {
    const data = await getAll();
    if (!data.files || !data.files[filename]) return;
    delete data.files[filename];
    const remaining = Object.keys(data.files);
    data.activeFile = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    await saveAll(data);
    return data.activeFile;
  }

  async function renameFile(oldName, newName) {
    const data = await getAll();
    if (!data.files || !data.files[oldName]) throw new Error('File not found.');
    if (data.files[newName]) throw new Error(`File "${newName}" already exists.`);
    data.files[newName] = data.files[oldName];
    delete data.files[oldName];
    if (data.activeFile === oldName) data.activeFile = newName;
    await saveAll(data);
  }

  return {
    getAll,
    getFiles,
    getActiveFile,
    setActiveFile,
    getFile,
    saveFile,
    createFile,
    deleteFile,
    renameFile,
  };
})();

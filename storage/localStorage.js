'use strict';

/**
 * Local Storage Module
 * Wraps chrome.storage.local with a consistent async API
 * Used for offline-first caching and when user is not logged in
 */

const LocalStorage = (() => {
  const STORAGE_KEY = 'csvNotes';

  /**
   * Get all data from storage
   */
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

  /**
   * Save all data
   */
  async function saveAll(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
    });
  }

  /**
   * Get all CSV files
   */
  async function getFiles() {
    const data = await getAll();
    return data.files || {};
  }

  /**
   * Get a single file by name
   */
  async function getFile(filename) {
    const files = await getFiles();
    return files[filename] || null;
  }

  /**
   * Save a single file
   */
  async function saveFile(filename, fileData) {
    const data = await getAll();
    if (!data.files) data.files = {};
    data.files[filename] = {
      headers: fileData.headers || [],
      rows: fileData.rows || [],
    };
    await saveAll(data);
  }

  /**
   * Delete a file
   */
  async function deleteFile(filename) {
    const data = await getAll();
    if (!data.files || !data.files[filename]) return;
    delete data.files[filename];
    const remaining = Object.keys(data.files);
    data.activeFile = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    await saveAll(data);
    return data.activeFile;
  }

  /**
   * Create a new file with default structure
   */
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

  /**
   * Rename a file
   */
  async function renameFile(oldName, newName) {
    const data = await getAll();
    if (!data.files || !data.files[oldName]) {
      throw new Error('File not found.');
    }
    if (data.files[newName]) {
      throw new Error(`File "${newName}" already exists.`);
    }
    data.files[newName] = data.files[oldName];
    delete data.files[oldName];
    if (data.activeFile === oldName) data.activeFile = newName;
    await saveAll(data);
  }

  /**
   * Get the currently active file
   */
  async function getActiveFile() {
    const data = await getAll();
    return data.activeFile || null;
  }

  /**
   * Set the currently active file
   */
  async function setActiveFile(filename) {
    const data = await getAll();
    data.activeFile = filename;
    await saveAll(data);
  }

  /**
   * Clear all local storage
   */
  async function clear() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(STORAGE_KEY, resolve);
    });
  }

  return {
    getAll,
    saveAll,
    getFiles,
    getFile,
    saveFile,
    deleteFile,
    createFile,
    renameFile,
    getActiveFile,
    setActiveFile,
    clear,
  };
})();

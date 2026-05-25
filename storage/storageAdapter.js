'use strict';

/**
 * Storage Adapter
 * Unified storage interface that automatically chooses between local and cloud storage
 * 
 * Logic:
 * - If user is not logged in: use LocalStorage only
 * - If user is logged in: use CloudStorage but cache locally for offline support
 * - On logout: keep local cache but remove cloud metadata
 * - Debounced auto-save: 2 second delay after edits
 */

const StorageAdapter = (() => {
  let currentUser = null;
  let autoSaveTimer = null;
  const syncLocks = new Map();
  const MAX_RETRIES = 3;
  const AUTO_SAVE_DELAY = 2000; // 2 seconds
  
  // Dispatch simple events for UI to observe sync state
  function emitSyncEvent(detail) {
    try {
      window.dispatchEvent(new CustomEvent('storage-sync', { detail }));
    } catch (e) {
      // no-op
    }
  }

  /**
   * Set the current user after login
   */
  async function setCurrentUser(user) {
    currentUser = user;
    if (user) {
      console.log('User logged in:', user.email);
      // Fetch and sync cloud files on login
      emitSyncEvent({ status: 'syncing', reason: 'login' });
      await syncCloudFiles();
      emitSyncEvent({ status: 'synced', reason: 'login' });
    } else {
      console.log('User logged out');
    }
  }

  /**
   * Get the current user
   */
  function getCurrentUser() {
    return currentUser;
  }

  /**
   * Check if user is authenticated
   */
  function isAuthenticated() {
    return currentUser !== null;
  }

  /**
   * Get all files - from cloud if logged in, otherwise local
   */
  async function getFiles() {
    try {
      if (isAuthenticated()) {
        // If logged in, try cloud first
        const { files } = await CloudStorage.fetchCloudFiles(currentUser.id);
        return files;
      } else {
        // Fall back to local storage
        return await LocalStorage.getFiles();
      }
    } catch (err) {
      console.warn('Failed to fetch files, falling back to local storage:', err);
      return await LocalStorage.getFiles();
    }
  }

  /**
   * Get a single file
   */
  async function getFile(filename) {
    try {
      if (isAuthenticated()) {
        const files = await getFiles();
        return files[filename] || null;
      } else {
        return await LocalStorage.getFile(filename);
      }
    } catch (err) {
      console.warn('Failed to get file, falling back to local storage:', err);
      return await LocalStorage.getFile(filename);
    }
  }

  /**
   * Save file with debounced auto-sync
   * Immediately saves to local storage, schedules cloud sync if logged in
   */
  async function saveFile(filename, fileData) {
    try {
      // Always save to local storage first
      await LocalStorage.saveFile(filename, fileData);

      // If logged in, schedule cloud sync
      if (isAuthenticated()) {
        clearAutoSaveTimer();
        autoSaveTimer = setTimeout(() => {
          // fire and forget
          syncFileToCloud(filename, fileData).catch((err) => {
            console.warn('Background sync failed:', err);
          });
        }, AUTO_SAVE_DELAY);
      }

      return { error: null };
    } catch (err) {
      console.error('Save file failed:', err);
      return { error: err };
    }
  }

  /**
   * Create a new file
   */
  async function createFile(filename) {
    try {
      const file = await LocalStorage.createFile(filename);

      // If logged in, sync to cloud
      if (isAuthenticated()) {
        await syncFileToCloud(filename, file);
      }

      return file;
    } catch (err) {
      console.error('Create file failed:', err);
      throw err;
    }
  }

  /**
   * Delete a file
   */
  async function deleteFile(filename) {
    try {
      const files = await LocalStorage.getFiles();
      const file = files[filename];

      // Delete from local storage first
      await LocalStorage.deleteFile(filename);

      // If file had cloud ID, delete from cloud
      if (isAuthenticated() && file && file.cloudId) {
        await CloudStorage.deleteCloudFile(file.cloudId);
      }

      return { error: null };
    } catch (err) {
      console.error('Delete file failed:', err);
      return { error: err };
    }
  }

  /**
   * Rename a file
   */
  async function renameFile(oldName, newName) {
    try {
      const files = await LocalStorage.getFiles();
      const file = files[oldName];
      const cloudId = file ? file.cloudId : null;

      // Rename in local storage
      await LocalStorage.renameFile(oldName, newName);

      // If file had cloud ID, delete old and create new
      if (isAuthenticated() && cloudId) {
        await CloudStorage.deleteCloudFile(cloudId);
        const renamedFile = await LocalStorage.getFile(newName);
        await syncFileToCloud(newName, renamedFile);
      }

      return { error: null };
    } catch (err) {
      console.error('Rename file failed:', err);
      return { error: err };
    }
  }

  /**
   * Get currently active file
   */
  async function getActiveFile() {
    return await LocalStorage.getActiveFile();
  }

  /**
   * Set currently active file
   */
  async function setActiveFile(filename) {
    return await LocalStorage.setActiveFile(filename);
  }

  /**
   * INTERNAL: Sync a single file to cloud storage
   */
  async function syncFileToCloud(filename, fileData) {
    try {
      if (!isAuthenticated() || !CloudStorage.isAvailable()) {
        return;
      }

      // Prevent concurrent syncs for the same file
      if (syncLocks.get(filename)) return;
      syncLocks.set(filename, true);

      emitSyncEvent({ status: 'syncing', filename });

      let attempt = 0;
      let lastErr = null;

      while (attempt < MAX_RETRIES) {
        attempt += 1;
        try {
          const { id, error } = await CloudStorage.saveCloudFile(
            filename,
            fileData,
            currentUser.id
          );

          if (error) {
            lastErr = error;
            throw error;
          }

          // Update local storage with cloud ID and updatedAt if provided
          const updatedData = { ...fileData, cloudId: id, updatedAt: new Date().toISOString() };
          await LocalStorage.saveFile(filename, updatedData);

          emitSyncEvent({ status: 'synced', filename });

          console.log(`File "${filename}" synced to cloud`);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          console.warn(`Cloud sync attempt ${attempt} failed for ${filename}:`, err);
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }

      if (lastErr) {
        emitSyncEvent({ status: 'error', filename, error: String(lastErr) });
      }

      syncLocks.delete(filename);
    } catch (err) {
      console.warn('Cloud sync failed:', err);
      emitSyncEvent({ status: 'error', filename, error: String(err) });
      syncLocks.delete(filename);
    }
  }

  /**
   * INTERNAL: Fetch all cloud files and merge with local
   */
  async function syncCloudFiles() {
    try {
      if (!isAuthenticated() || !CloudStorage.isAvailable()) {
        return;
      }

      const { files: cloudFiles } = await CloudStorage.fetchCloudFiles(
        currentUser.id
      );

      const localFiles = await LocalStorage.getFiles();

      // Merge: cloud files with newer timestamps override local
      for (const filename in cloudFiles) {
        const cloudFile = cloudFiles[filename];
        const localFile = localFiles[filename];

        if (!localFile || 
            new Date(cloudFile.updatedAt) > new Date(localFile.updatedAt || 0)) {
          await LocalStorage.saveFile(filename, cloudFile);
        }
      }

      console.log('Cloud files synced to local storage');
      emitSyncEvent({ status: 'synced', reason: 'syncCloudFiles' });
    } catch (err) {
      console.warn('Cloud sync failed:', err);
      emitSyncEvent({ status: 'error', reason: 'syncCloudFiles', error: String(err) });
    }
  }

  /**
   * Manual sync API: attempt to push local files to cloud and pull remote.
   */
  async function manualSyncAll() {
    emitSyncEvent({ status: 'syncing', reason: 'manual' });
    try {
      // push all local files
      const localFiles = await LocalStorage.getFiles();
      for (const filename in localFiles) {
        await syncFileToCloud(filename, localFiles[filename]);
      }

      // then pull remote to merge
      await syncCloudFiles();

      emitSyncEvent({ status: 'synced', reason: 'manual' });
    } catch (err) {
      emitSyncEvent({ status: 'error', reason: 'manual', error: String(err) });
    }
  }

  /**
   * INTERNAL: Clear the auto-save timer
   */
  function clearAutoSaveTimer() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  return {
    setCurrentUser,
    getCurrentUser,
    isAuthenticated,
    getFiles,
    getFile,
    saveFile,
    createFile,
    deleteFile,
    renameFile,
    getActiveFile,
    setActiveFile,
    manualSyncAll,
  };
})();

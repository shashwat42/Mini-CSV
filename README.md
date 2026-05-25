# CSV Notes

A lightweight Chrome extension that provides a spreadsheet-like popup for creating, editing, importing, and exporting CSV files. Changes are saved locally via `chrome.storage.local`, with optional cloud sync via Supabase.

---

## Table of contents

- Features
- Quick install
- Cloud sync (optional)
- Usage
- Architecture
- Storage format
- Troubleshooting
- Contributing
- License

---

## Features

- Create and manage multiple CSV files from the popup
- Spreadsheet-style inline editing (cells & headers)
- Add / delete rows and columns
- Auto-save to `chrome.storage.local`
- **Cloud sync with Google login** (optional Supabase)
- **Cross-device sync** (when logged in)
- **Offline-first** - works without internet, syncs when available
- Import local `.csv` files (uses PapaParse)
- Export CSV from the active file
- Small, dependency-free UI (Vanilla JS + PapaParse)

---

## Quick Install

1. Download the project ZIP.

2. Extract / unzip the archive.

3. Ensure the following files exist:

```text
libs/papaparse.min.js
```

Download it from: https://www.papaparse.com/

(Cloud sync is optional - see section below)

4. Open Chrome and go to:

```text
chrome://extensions
```

5. Enable **Developer mode** (top-right).

6. Click:

```text
Load unpacked
```

7. Select the extracted project folder (the folder containing `manifest.json`).

8. The extension should now appear in Chrome.

9. Optionally pin the extension from the toolbar puzzle icon.

---

## Cloud Sync (Optional)

CSV Notes supports optional cloud sync via Supabase. All features work offline with local storage.

### To enable cloud sync:

1. Follow the setup guide in [`SETUP.md`](SETUP.md)
2. Create a Supabase project and get your credentials
3. Download `libs/supabase.min.js` from CDN
4. Update `services/supabase.js` with your Supabase URL and key
5. Enable Google OAuth in your Supabase project
6. Reload the extension in `chrome://extensions`

### Cloud sync features:

- **Google Login**: Sign in with your Google account
- **Auto-sync**: Files sync automatically to Supabase (2-second debounce)
- **Cross-device**: Access your CSV files from any device
- **Offline support**: Changes work offline, sync when online
- **Privacy**: Row Level Security (RLS) ensures users only access their own files

### How it works:

- **Not logged in**: Use local storage only (no sync)
- **Logged in**: Files sync to Supabase, cached locally for offline
- **Offline edits**: Changes save locally, sync when online
- **Logout**: Local cache preserved, cloud sync disabled

See [`SETUP.md`](SETUP.md) for detailed Supabase configuration.

---

## Usage

- Open the extension popup.
- Click the **+** button to create a new CSV file.
- Use **Add Column** and **Add Row** to expand the sheet.
- Click any header to rename it inline.
- Click a cell and type to edit; changes auto-save.
- Use **Import** to load a local `.csv` file; the app uses PapaParse to parse CSVs.
- Use **Export** to download the active CSV.
- **(Optional) Click Login** to enable cloud sync with Google

Keyboard notes:
- `Enter` and `Tab` move between cells (and create a new row at the end).

---

## Architecture

### Storage System

The extension uses a **unified storage adapter** that abstracts local and cloud storage:

```
StorageAdapter (unified API)
  ├── LocalStorage (chrome.storage.local)
  ├── CloudStorage (Supabase PostgreSQL)
  └── AuthService (Google OAuth)
```

**Files:**

- **`storage/localStorage.js`** - Chrome storage wrapper with async API
- **`storage/cloudStorage.js`** - Supabase database operations
- **`storage/storageAdapter.js`** - Unified interface, auto-chooses local or cloud
- **`services/supabase.js`** - Supabase client initialization
- **`services/auth.js`** - Google OAuth and auth state management

### Sync Behavior

1. **No auth**: Use local storage only
2. **Logged in**: Sync to cloud, cache locally
3. **Offline**: Changes work locally, sync when online
4. **Debounce**: 2-second delay before syncing (prevents frequent requests)
5. **Merge**: Newer cloud files override local on load

### UI Enhancements

- Added auth bar with login/logout buttons
- Sync status indicator (idle/syncing/error)
- User email display when logged in
- Automatic UI updates on auth state change

---

## Developer Notes

### File Structure

```
Mini-CSV/
├── services/
│   ├── supabase.js       (Supabase client initialization)
│   └── auth.js           (Google OAuth logic)
├── storage/
│   ├── localStorage.js   (Chrome storage wrapper)
│   ├── cloudStorage.js   (Supabase CRUD operations)
│   ├── storageAdapter.js (Unified interface)
│   └── storage.js        (Legacy - kept for reference)
├── popup/
│   ├── popup.html        (UI with auth buttons)
│   ├── popup.css         (Styles including auth bar)
│   └── popup.js          (Main app logic with cloud sync)
├── libs/
│   ├── papaparse.min.js  (CSV parsing library)
│   └── supabase.min.js   (Supabase JS client - optional)
├── assets/
│   └── icon128.png       (Extension icon)
├── manifest.json         (Extension configuration)
├── SETUP.md              (Cloud sync setup guide)
└── README.md             (This file)
```

### Key Implementation Details

**StorageAdapter Pattern:**
- Automatically chooses local or cloud based on auth state
- Implements debounced autosave (2 seconds)
- Provides fallback if cloud sync fails
- Merges cloud files with local cache on login

**Auth Flow:**
- Extension checks for existing session on load
- Auth state changes trigger UI and data updates
- Successful login triggers cloud file sync
- Logout preserves local cache for privacy

**Error Handling:**
- Cloud sync failures fall back to local storage
- Sync indicator shows status (idle/syncing/error)
- Failed syncs auto-retry on next edit
- Offline changes persist locally

### API Reference

**StorageAdapter:**
```javascript
await StorageAdapter.setCurrentUser(user)
await StorageAdapter.getFiles()
await StorageAdapter.getFile(filename)
await StorageAdapter.saveFile(name, data)         // Debounced
await StorageAdapter.createFile(name)
await StorageAdapter.deleteFile(name)
await StorageAdapter.renameFile(old, new)
await StorageAdapter.setActiveFile(name)
```

**AuthService:**
```javascript
await AuthService.signInWithGoogle()
await AuthService.signOut()
await AuthService.getCurrentUser()
await AuthService.getSession()
AuthService.onAuthStateChange(callback)
```

**CloudStorage:**
```javascript
await CloudStorage.fetchCloudFiles(userId)
await CloudStorage.saveCloudFile(name, data, userId)
await CloudStorage.deleteCloudFile(fileId)
CloudStorage.isAvailable()
```

---

## Storage Format

### Local Storage

Data is persisted under the `csvNotes` key in `chrome.storage.local`:

```js
{
  files: {
    "employees.csv": {
      headers: ["id", "name", "age"],
      rows: [
        ["1", "John", "22"]
      ]
    }
  },
  activeFile: "employees.csv"
}
```

### Cloud Storage (Supabase)

Files are stored in the `csv_files` table with:
- `id`: UUID file identifier
- `user_id`: User's Supabase ID
- `filename`: User-facing filename
- `headers`: JSON array of column names
- `rows`: JSON array of row data
- `updated_at`: Last modification timestamp

---

## Troubleshooting

- Extension won't load: verify `manifest.json` is valid and file paths match.
- Import errors: ensure files use `.csv` extension and are comma-separated.
- Changes not saving: open the extension popup via `chrome://extensions` → **Inspect views** and check the console for errors.

---

## Contributing

Feel free to open issues or submit PRs. Suggested improvements: search/filter, sorting, column resize, theme toggle, and sync storage.

---

## License

MIT License
MIT License

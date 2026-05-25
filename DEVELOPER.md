# Quick Start for Developers

## Project Structure

```
Mini-CSV/
├── services/
│   ├── supabase.js          ← Update your credentials here
│   └── auth.js              
├── storage/
│   ├── localStorage.js      ← Chrome storage wrapper
│   ├── cloudStorage.js      ← Supabase DB operations
│   ├── storageAdapter.js    ← Main API (use this!)
│   └── storage.js           ← DEPRECATED
├── popup/
│   ├── popup.html           ← Auth UI added
│   ├── popup.css            ← Auth bar styles
│   └── popup.js             ← Updated for cloud sync
├── libs/
│   ├── papaparse.min.js     ← CSV parsing
│   └── supabase.min.js      ← DOWNLOAD FROM CDN
├── manifest.json            ← Updated (v2.0.0)
├── README.md                ← Updated
├── SETUP.md                 ← Supabase setup guide
└── IMPLEMENTATION.md        ← This doc
```

## Configuration Steps

### 1. Minimal Setup (Local Only)
Works immediately without any Supabase setup:
- Create/edit/export CSV files
- Auto-saves locally
- No cloud sync

### 2. Full Setup (With Cloud Sync)
Follow `SETUP.md`:
1. Create Supabase project
2. Get API credentials
3. Create database table (SQL provided)
4. Enable Google OAuth
5. Download libs/supabase.min.js
6. Update services/supabase.js with your credentials
7. Reload extension

## Key API

### For UI Code (popup.js)

Use **StorageAdapter** - single unified API:

```javascript
// Auth
const user = StorageAdapter.getCurrentUser();
const isLoggedIn = StorageAdapter.isAuthenticated();

// Files
const files = await StorageAdapter.getFiles();
const file = await StorageAdapter.getFile(filename);
await StorageAdapter.saveFile(filename, { headers, rows });
await StorageAdapter.createFile(filename);
await StorageAdapter.deleteFile(filename);
```

### For Auth (login/logout)

Use **AuthService**:

```javascript
// Login
await AuthService.signInWithGoogle();

// Logout
await AuthService.signOut();

// Check auth
const user = await AuthService.getCurrentUser();

// Listen for changes
AuthService.onAuthStateChange((event, session) => {
  console.log(event); // 'SIGNED_IN' or 'SIGNED_OUT'
});
```

## Development Workflow

### Making Changes

1. **Storage logic changes** → Modify `storage/storageAdapter.js`
2. **Auth logic changes** → Modify `services/auth.js`
3. **UI/popup changes** → Modify `popup/popup.js` or `popup/html`
4. **Styles** → Modify `popup/popup.css`

### Testing Locally

1. Load unpacked extension in `chrome://extensions`
2. Click "Refresh" button after code changes
3. Open extension popup
4. View errors in console (F12 in popup)

### Testing Cloud Sync

1. Configure with real Supabase credentials
2. Click "Login" button
3. Should redirect to Google, then back
4. Email should appear in blue auth bar
5. Edit a file
6. Wait 2-3 seconds for sync
7. Files should appear in Supabase db

## Common Tasks

### Add a new storage method

In `storage/storageAdapter.js`:

```javascript
// Add to return object
async function myNewMethod(arg) {
  try {
    if (isAuthenticated()) {
      // Use CloudStorage
      return await CloudStorage.myOperation(arg);
    } else {
      // Use LocalStorage
      return await LocalStorage.myOperation(arg);
    }
  } catch (err) {
    console.warn('Operation failed:', err);
    return null;
  }
}

// Then export
return {
  // ... existing methods
  myNewMethod,
};
```

### Add a new auth provider

In `services/auth.js`:

```javascript
async function signInWithProvider(provider) {
  try {
    const client = SupabaseService.getClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: provider, // 'github', 'twitter', etc.
    });
    // ... handle response
  } catch (err) {
    console.error('Sign in failed:', err);
  }
}
```

### Debug Cloud Sync

1. In popup.js, look for `setSyncStatus()` calls
2. Check browser console (F12) for errors
3. Use sync indicator color as feedback:
   - 🔵 Blue = idle
   - 🟢 Green = syncing
   - 🔴 Red = error
4. Check Supabase dashboard for records in csv_files table

## Error Handling Pattern

```javascript
try {
  // Attempt cloud operation
  await CloudStorage.operation();
  setSyncStatus('idle');
} catch (err) {
  // Fall back to local
  console.warn('Cloud operation failed:', err);
  setSyncStatus('error');
  // Data already in local cache, continue working
  
  // Auto-retry on next operation
  setTimeout(() => setSyncStatus('idle'), 2000);
}
```

## Performance Tips

- Debounce saves: 2 second delay (already implemented)
- Don't sync on every keystroke
- Use batch operations where possible
- Check `isAuthenticated()` before cloud operations
- Cache frequently-accessed user object

## Security Checklist

- ✅ Don't log credentials
- ✅ Use HTTPS for all communication (Supabase handles)
- ✅ Don't hardcode secrets (use environment config)
- ✅ Use RLS policies for database (already set up)
- ✅ Validate user ID from auth, don't trust client
- ✅ Sanitize filenames (already done)

## Debugging Tips

### View Sync Status
```javascript
// In popup console
console.log(StorageAdapter.getCurrentUser());
console.log(StorageAdapter.isAuthenticated());
```

### Check Supabase
```sql
-- In Supabase SQL Editor
SELECT * FROM csv_files 
WHERE user_id = '00000000-0000-0000-0000-000000000000'
LIMIT 10;
```

### Monitor Auth
```javascript
// In popup console
AuthService.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session);
});
```

## Next Steps

1. **Start simple**: Run locally first (no Supabase needed)
2. **Then add cloud**: Follow SETUP.md when ready
3. **Test thoroughly**: Especially offline scenarios
4. **Deploy**: Push to Chrome Web Store

## File Reference

| File | Purpose | Modify When |
|------|---------|-------------|
| services/supabase.js | Supabase config | Adding credentials, changing provider |
| services/auth.js | Google OAuth | Adding new auth providers |
| storage/localStorage.js | Chrome storage | Changing local storage structure |
| storage/cloudStorage.js | Supabase DB | Adding new database operations |
| storage/storageAdapter.js | Main API | Adding new unified methods |
| popup/popup.js | UI logic | Adding UI features, changing sync behavior |
| popup/popup.html | UI markup | Adding UI elements |
| popup/popup.css | UI styles | Changing visual appearance |
| manifest.json | Extension config | Adding permissions, changing version |

## Questions?

- Setup issues: See SETUP.md
- Implementation details: See IMPLEMENTATION.md
- Architecture: See README.md
- Browser console: Check for JS errors (F12)
- Supabase: Check Project Settings > API in dashboard

# CSV Notes Cloud Sync - Supabase Setup Guide

This guide explains how to set up Supabase for cloud sync in CSV Notes.

## Overview

CSV Notes now supports optional cloud sync using Supabase. All features work offline with local storage, and cloud sync activates automatically when users log in with Google.

### Architecture

- **Local Storage**: Chrome `storage.local` always caches data for offline support
- **Cloud Storage**: Supabase PostgreSQL database syncs files for logged-in users
- **Auth**: Google OAuth via Supabase Auth
- **Sync**: Automatic with 2-second debounce on edits
- **Fallback**: If cloud sync fails, data remains in local cache

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up or log in
4. Create a new project:
   - **Name**: "csv-notes" (or your choice)
   - **Database Password**: Use a strong password
   - **Region**: Choose closest to you
5. Wait for the project to initialize (~2 minutes)

## Step 2: Get Your API Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - `Project URL` (supabase_url)
   - `anon public` key (supabase_anon_key)
3. Save these securely - you'll need them shortly

## Step 3: Create the Database Table

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste this SQL:

```sql
-- Create csv_files table
CREATE TABLE IF NOT EXISTS csv_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '[]',
  rows JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, filename)
);

-- Create indexes for faster queries
CREATE INDEX csv_files_user_id_idx ON csv_files(user_id);
CREATE INDEX csv_files_updated_at_idx ON csv_files(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE csv_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own files
CREATE POLICY "Users can read their own files"
ON csv_files FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own files
CREATE POLICY "Users can insert their own files"
ON csv_files FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own files"
ON csv_files FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON csv_files FOR DELETE
USING (auth.uid() = user_id);
```

4. Click **Run**
5. You should see "Success" messages

## Step 4: Enable Google OAuth

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click it
3. Click **Enable Google**
4. You'll need Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Go to **Credentials** → **Create OAuth 2.0 Client ID** → **Chrome App**
   - Enter your extension ID (from chrome://extensions when installed)
   - Copy the **Client ID** and **Client Secret**
5. Back in Supabase, paste Client ID and Client Secret
6. Click **Save**

## Step 5: Download Supabase JS Client

1. Download the Supabase JS client:
   ```
   https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
   ```

2. Save to your project:
   ```
   libs/supabase.min.js
   ```

3. Verify the file exists before testing

## Step 6: Configure the Extension

1. Open `services/supabase.js` in your editor
2. Find these lines at the top:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

3. Replace with your actual values from Step 2:
   ```javascript
   const SUPABASE_URL = 'https://xyzkwxyz.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGc...very-long-key...';
   ```

4. Save the file

## Step 7: Load the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select your `Mini-CSV` project folder
5. The extension should appear in your list

## Step 8: Test the Setup

1. Click the CSV Notes extension icon
2. You should see a **Login** button in the top blue bar
3. Click **Login** to test Google OAuth
4. If successful:
   - You'll see your email in the blue bar
   - A **Logout** button will appear
   - The sync indicator will show status
5. Create a new CSV file while logged in
6. The file should sync to Supabase (2-second debounce)

## Troubleshooting

### "Supabase not configured" error
- Check that `services/supabase.js` has your actual URL and key
- Verify `libs/supabase.min.js` exists
- Reload the extension (toggle in chrome://extensions)

### Login doesn't work
- Verify Google OAuth is enabled in Supabase
- Check that your extension ID matches Google Console settings
- Check browser console (F12) for detailed errors

### Files don't sync
- Check that auth is working (email shows in blue bar)
- Verify the `csv_files` table exists in Supabase
- Check Row Level Security policies are correct
- Wait 2-3 seconds after editing (debounce delay)
- Check browser console for sync errors

### "INSERT violates foreign key constraint"
- This happens if auth isn't working properly
- Verify you're logged in (email shows in blue bar)
- Check that Google OAuth is fully configured

### Files sync but disappear after logout
- This is normal! Local cache is separate from cloud
- Logged-out users use local-only storage for privacy
- Log back in to see cloud files again

## File Structure

After setup, your project should have:

```
Mini-CSV/
├── services/
│   ├── supabase.js       (Supabase client config)
│   └── auth.js           (Google auth logic)
├── storage/
│   ├── localStorage.js   (Chrome storage wrapper)
│   ├── cloudStorage.js   (Supabase DB operations)
│   └── storageAdapter.js (Unified storage interface)
├── popup/
│   ├── popup.html        (UI with auth buttons)
│   ├── popup.js          (Updated for cloud sync)
│   └── popup.css         (Includes auth bar styles)
├── libs/
│   ├── papaparse.min.js  (CSV parsing)
│   └── supabase.min.js   (Supabase JS client - must download)
└── manifest.json         (Updated for host permissions)
```

## How It Works

1. **On Load**: Extension checks for existing auth session
2. **Not Logged In**: Files use `chrome.storage.local` only
3. **Login**: Supabase auth redirects back to extension
4. **After Login**: Cloud files sync to local storage, new edits auto-sync
5. **Edit Files**: 2-second debounce before syncing to cloud
6. **Offline**: Changes saved locally, synced when online
7. **Logout**: Local cache preserved, cloud files won't sync

## Database Schema

The `csv_files` table has:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | File unique ID (primary key) |
| `user_id` | UUID | Owner's Supabase user ID |
| `filename` | TEXT | User-facing filename |
| `headers` | JSONB | Array of column names `["Name", "Email"]` |
| `rows` | JSONB | Array of row data `[["John", "john@example.com"]]` |
| `created_at` | TIMESTAMP | When file was created |
| `updated_at` | TIMESTAMP | When file was last modified |

## Security

- **Row Level Security (RLS)**: Users can only access their own files
- **OAuth**: Only authenticated Google users can sync
- **Keys**: Never commit your actual keys to version control
- **Offline**: Works fine without internet (local-only mode)

## Need Help?

- Check Supabase docs: https://supabase.com/docs
- Check extension console: Press F12 in popup
- Review error messages in browser console
- Verify your credentials are correct (copy-paste carefully!)

## Next Steps

After setup:
- Create CSV files that sync to cloud
- Log in from different devices to see cross-device sync
- Enjoy offline access with automatic sync!

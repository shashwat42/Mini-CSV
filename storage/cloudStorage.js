'use strict';

/**
 * Cloud Storage Module
 * Handles all Supabase database operations for syncing CSV files
 * 
 * Database schema:
 * Table: csv_files
 *   - id: UUID (primary key, auto-generated)
 *   - user_id: UUID (Supabase user ID)
 *   - filename: text (not null)
 *   - headers: jsonb (array of column names)
 *   - rows: jsonb (array of row data)
 *   - updated_at: timestamp (auto-updated)
 * 
 * RLS Policy: Users can only access their own files (WHERE user_id = auth.uid())
 */

const CloudStorage = (() => {
  const TABLE_NAME = 'csv_files';

  /**
   * Fetch all CSV files for the current user from Supabase
   */
  async function fetchCloudFiles(userId) {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        throw new Error('Supabase not configured');
      }

      const { data, error } = await client
        .from(TABLE_NAME)
        .select('id, filename, headers, rows, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Fetch cloud files error:', error);
        throw error;
      }

      // Transform to format expected by the app
      const files = {};
      if (data && Array.isArray(data)) {
        data.forEach((file) => {
          files[file.filename] = {
            id: file.id,
            headers: file.headers || [],
            rows: file.rows || [],
            updatedAt: file.updated_at,
            cloudId: file.id,
          };
        });
      }

      return { files, error: null };
    } catch (err) {
      console.error('Cloud fetch failed:', err);
      return { files: {}, error: err };
    }
  }

  /**
   * Save or update a single CSV file to Supabase
   * Uses upsert to handle both create and update
   */
  async function saveCloudFile(filename, fileData, userId) {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        throw new Error('Supabase not configured');
      }

      const cloudId = fileData.cloudId || null;

      // If we have a cloud ID, update it; otherwise insert
      let query = client
        .from(TABLE_NAME)
        .upsert({
          id: cloudId,
          user_id: userId,
          filename: filename,
          headers: fileData.headers || [],
          rows: fileData.rows || [],
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        });

      const { data, error } = await query.select('id').single();

      if (error) {
        console.error('Save cloud file error:', error);
        throw error;
      }

      // Return the cloud ID for future updates
      return { id: data.id, error: null };
    } catch (err) {
      console.error('Cloud save failed:', err);
      return { id: null, error: err };
    }
  }

  /**
   * Delete a CSV file from Supabase
   */
  async function deleteCloudFile(fileId) {
    try {
      const client = SupabaseService.getClient();
      if (!client) {
        throw new Error('Supabase not configured');
      }

      const { error } = await client
        .from(TABLE_NAME)
        .delete()
        .eq('id', fileId);

      if (error) {
        console.error('Delete cloud file error:', error);
        throw error;
      }

      return { error: null };
    } catch (err) {
      console.error('Cloud delete failed:', err);
      return { error: err };
    }
  }

  /**
   * Check if Supabase is available and configured
   */
  function isAvailable() {
    return SupabaseService && SupabaseService.isConfigured();
  }

  return {
    fetchCloudFiles,
    saveCloudFile,
    deleteCloudFile,
    isAvailable,
  };
})();

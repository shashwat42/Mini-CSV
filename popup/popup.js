'use strict';

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  files: {},
  activeFile: null,
  saveTimer: null,
};

// ─── DOM refs ────────────────────────────────────────────────────────────────

const fileList      = document.getElementById('file-list');
const emptyState    = document.getElementById('empty-state');
const spreadsheet   = document.getElementById('spreadsheet');
const activeFilename = document.getElementById('active-filename');
const tableHead     = document.getElementById('table-head');
const tableBody     = document.getElementById('table-body');
const btnNewFile    = document.getElementById('btn-new-file');
const btnEmptyNew   = document.getElementById('btn-empty-new');
const btnAddRow     = document.getElementById('btn-add-row');
const btnAddCol     = document.getElementById('btn-add-col');
const btnImport     = document.getElementById('btn-import');
const btnExport     = document.getElementById('btn-export');
const importInput   = document.getElementById('import-input');

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  const data = await Storage.getAll();
  state.files = data.files || {};
  state.activeFile = data.activeFile || null;

  renderFileList();

  if (state.activeFile && state.files[state.activeFile]) {
    renderSpreadsheet(state.activeFile);
  } else {
    showEmptyState();
  }

  attachGlobalListeners();
}

// ─── File list rendering ─────────────────────────────────────────────────────

function renderFileList() {
  fileList.innerHTML = '';
  const filenames = Object.keys(state.files);

  if (filenames.length === 0) {
    fileList.innerHTML = '<li style="padding:10px 8px;font-size:11px;color:var(--text-muted);text-align:center;">No files yet</li>';
    return;
  }

  filenames.forEach((filename) => {
    const li = document.createElement('li');
    li.className = 'file-item' + (filename === state.activeFile ? ' active' : '');
    li.dataset.file = filename;

    li.innerHTML = `
      <svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <span class="file-name" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
      <button class="file-delete" data-file="${escapeHtml(filename)}" title="Delete">×</button>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('file-delete')) return;
      selectFile(filename);
    });

    li.querySelector('.file-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDelete(filename);
    });

    fileList.appendChild(li);
  });
}

// ─── File selection ──────────────────────────────────────────────────────────

async function selectFile(filename) {
  if (state.activeFile === filename) return;
  state.activeFile = filename;
  await Storage.setActiveFile(filename);
  renderFileList();
  renderSpreadsheet(filename);
}

// ─── Spreadsheet rendering ───────────────────────────────────────────────────

function renderSpreadsheet(filename) {
  const file = state.files[filename];
  if (!file) { showEmptyState(); return; }

  emptyState.style.display = 'none';
  spreadsheet.style.display = 'flex';
  activeFilename.textContent = filename;

  renderTable(file.headers, file.rows);
}

function renderTable(headers, rows) {
  renderHead(headers);
  renderBody(headers, rows);
}

function renderHead(headers) {
  tableHead.innerHTML = '';
  const tr = document.createElement('tr');

  // Row number column header
  const thNum = document.createElement('th');
  thNum.className = 'row-num';
  thNum.style.background = 'var(--bg-elevated)';
  thNum.style.borderBottom = '2px solid var(--border-light)';
  tr.appendChild(thNum);

  headers.forEach((header, colIdx) => {
    const th = document.createElement('th');
    th.dataset.col = colIdx;

    const inner = document.createElement('div');
    inner.className = 'th-inner';

    const label = document.createElement('div');
    label.className = 'th-label';
    label.contentEditable = 'true';
    label.spellcheck = false;
    label.textContent = header;
    label.dataset.col = colIdx;

    label.addEventListener('blur', () => onHeaderEdit(colIdx, label.textContent.trim()));
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
      if (e.key === 'Escape') { label.textContent = getActiveHeaders()[colIdx]; label.blur(); }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'th-delete';
    delBtn.title = 'Delete column';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => deleteColumn(colIdx));

    inner.appendChild(label);
    inner.appendChild(delBtn);
    th.appendChild(inner);
    tr.appendChild(th);
  });

  tableHead.appendChild(tr);
}

function renderBody(headers, rows) {
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = headers.length + 1;
    td.style.cssText = 'padding:24px;text-align:center;color:var(--text-muted);font-size:12px;';
    td.textContent = 'No rows yet — click "+ Row" to add one';
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  rows.forEach((row, rowIdx) => {
    const tr = document.createElement('tr');

    // Row number cell
    const tdNum = document.createElement('td');
    tdNum.className = 'row-num';
    const numInner = document.createElement('div');
    numInner.className = 'row-num-inner';
    const rowLabel = document.createElement('span');
    rowLabel.className = 'row-label';
    rowLabel.textContent = rowIdx + 1;
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-row';
    delBtn.title = 'Delete row';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => deleteRow(rowIdx));
    numInner.appendChild(rowLabel);
    numInner.appendChild(delBtn);
    tdNum.appendChild(numInner);
    tr.appendChild(tdNum);

    headers.forEach((_, colIdx) => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cell-input';
      input.value = (row[colIdx] !== undefined && row[colIdx] !== null) ? row[colIdx] : '';
      input.dataset.row = rowIdx;
      input.dataset.col = colIdx;
      input.spellcheck = false;

      input.addEventListener('input', () => scheduleSave());
      input.addEventListener('change', () => onCellEdit(rowIdx, colIdx, input.value));
      input.addEventListener('keydown', (e) => handleCellKeydown(e, rowIdx, colIdx));
      input.addEventListener('focus', () => { input.select(); });

      td.appendChild(input);
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });
}

// ─── Cell keyboard navigation ─────────────────────────────────────────────────

function handleCellKeydown(e, rowIdx, colIdx) {
  const file = state.files[state.activeFile];
  if (!file) return;
  const maxRow = file.rows.length - 1;
  const maxCol = file.headers.length - 1;

  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      focusCell(rowIdx, colIdx - 1 >= 0 ? colIdx - 1 : colIdx);
    } else {
      if (colIdx < maxCol) {
        focusCell(rowIdx, colIdx + 1);
      } else if (rowIdx < maxRow) {
        focusCell(rowIdx + 1, 0);
      } else {
        addRow();
        setTimeout(() => focusCell(rowIdx + 1, 0), 50);
      }
    }
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    if (rowIdx < maxRow) {
      focusCell(rowIdx + 1, colIdx);
    } else {
      addRow();
      setTimeout(() => focusCell(rowIdx + 1, colIdx), 50);
    }
    return;
  }

  if (e.key === 'ArrowUp' && rowIdx > 0) {
    e.preventDefault();
    focusCell(rowIdx - 1, colIdx);
    return;
  }

  if (e.key === 'ArrowDown' && rowIdx < maxRow) {
    e.preventDefault();
    focusCell(rowIdx + 1, colIdx);
    return;
  }
}

function focusCell(rowIdx, colIdx) {
  const input = tableBody.querySelector(`input[data-row="${rowIdx}"][data-col="${colIdx}"]`);
  if (input) { input.focus(); input.select(); }
}

// ─── Edit handlers ────────────────────────────────────────────────────────────

function onCellEdit(rowIdx, colIdx, value) {
  const file = state.files[state.activeFile];
  if (!file) return;
  if (!file.rows[rowIdx]) file.rows[rowIdx] = [];
  file.rows[rowIdx][colIdx] = value;
  scheduleSave();
}

function onHeaderEdit(colIdx, value) {
  const file = state.files[state.activeFile];
  if (!file) return;
  const newName = value || `Column ${colIdx + 1}`;
  file.headers[colIdx] = newName;
  // Refresh header display if blank
  if (!value) renderHead(file.headers);
  scheduleSave();
}

// ─── Add/delete rows & columns ────────────────────────────────────────────────

function addRow() {
  const file = state.files[state.activeFile];
  if (!file) return;
  const emptyRow = new Array(file.headers.length).fill('');
  file.rows.push(emptyRow);
  renderBody(file.headers, file.rows);
  scheduleSave();
}

function deleteRow(rowIdx) {
  const file = state.files[state.activeFile];
  if (!file) return;
  file.rows.splice(rowIdx, 1);
  renderBody(file.headers, file.rows);
  scheduleSave();
}

function addColumn() {
  const file = state.files[state.activeFile];
  if (!file) return;
  const colName = `Column ${file.headers.length + 1}`;
  file.headers.push(colName);
  file.rows = file.rows.map((row) => [...row, '']);
  renderTable(file.headers, file.rows);
  scheduleSave();
}

function deleteColumn(colIdx) {
  const file = state.files[state.activeFile];
  if (!file || file.headers.length <= 1) return;
  file.headers.splice(colIdx, 1);
  file.rows = file.rows.map((row) => {
    const newRow = [...row];
    newRow.splice(colIdx, 1);
    return newRow;
  });
  renderTable(file.headers, file.rows);
  scheduleSave();
}

// ─── Auto-save ────────────────────────────────────────────────────────────────

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => persistActiveFile(), 400);
}

async function persistActiveFile() {
  if (!state.activeFile) return;
  const file = state.files[state.activeFile];
  if (!file) return;
  await Storage.saveFile(state.activeFile, file);
}

// ─── Create new file ──────────────────────────────────────────────────────────

function promptNewFile() {
  showNameModal('Create New CSV', '', async (name) => {
    const filename = sanitizeFilename(name);
    if (!filename) return;

    try {
      const fileData = await Storage.createFile(filename);
      state.files[filename] = fileData;
      state.activeFile = filename;
      renderFileList();
      renderSpreadsheet(filename);
    } catch (err) {
      alert(err.message);
    }
  });
}

// ─── Delete file ──────────────────────────────────────────────────────────────

function confirmDelete(filename) {
  showConfirmModal(
    'Delete CSV',
    `Are you sure you want to delete "${filename}"? This cannot be undone.`,
    async () => {
      const nextActive = await Storage.deleteFile(filename);
      delete state.files[filename];
      state.activeFile = nextActive;

      renderFileList();

      if (state.activeFile && state.files[state.activeFile]) {
        renderSpreadsheet(state.activeFile);
      } else {
        showEmptyState();
      }
    }
  );
}

// ─── Import CSV ───────────────────────────────────────────────────────────────

function handleImport(file) {
  if (!file) return;

  Papa.parse(file, {
    skipEmptyLines: true,
    complete: async (results) => {
      if (!results.data || results.data.length === 0) {
        alert('The CSV file is empty or could not be parsed.');
        return;
      }

      let filename = file.name;
      if (!filename.endsWith('.csv')) filename += '.csv';

      // If filename exists, ask for a new name
      if (state.files[filename]) {
        filename = generateUniqueName(filename);
      }

      const headers = results.data[0].map((h) => String(h).trim() || 'Column');
      const rows = results.data.slice(1).map((row) => {
        const padded = [...row];
        while (padded.length < headers.length) padded.push('');
        return padded.slice(0, headers.length).map((v) => String(v));
      });

      const fileData = { headers, rows };
      await Storage.saveFile(filename, fileData);
      state.files[filename] = fileData;

      // Set as active
      state.activeFile = filename;
      await Storage.setActiveFile(filename);

      renderFileList();
      renderSpreadsheet(filename);
      showToast(`Imported "${filename}" ✓`);

      // Reset input so same file can be re-imported
      importInput.value = '';
    },
    error: (err) => {
      alert('Failed to parse CSV: ' + err.message);
    },
  });
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportActiveFile() {
  const file = state.files[state.activeFile];
  if (!file) return;

  const allRows = [file.headers, ...file.rows];
  const csvString = Papa.unparse(allRows);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = state.activeFile || 'export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported "${state.activeFile}" ✓`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showEmptyState() {
  emptyState.style.display = 'flex';
  spreadsheet.style.display = 'none';
}

function getActiveHeaders() {
  const file = state.files[state.activeFile];
  return file ? file.headers : [];
}

function sanitizeFilename(name) {
  let cleaned = name.trim().replace(/[\/\\:*?"<>|]/g, '').trim();
  if (!cleaned) return null;
  if (!cleaned.toLowerCase().endsWith('.csv')) cleaned += '.csv';
  return cleaned;
}

function generateUniqueName(name) {
  const base = name.replace(/\.csv$/i, '');
  let idx = 1;
  let candidate = `${base} (${idx}).csv`;
  while (state.files[candidate]) {
    idx++;
    candidate = `${base} (${idx}).csv`;
  }
  return candidate;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function showConfirmModal(title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-danger">Delete</button>
      </div>
    </div>
  `;

  overlay.querySelector('.btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-danger').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
}

function showNameModal(title, defaultValue, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>${escapeHtml(title)}</h3>
      <input class="modal-input" type="text" placeholder="filename.csv" value="${escapeHtml(defaultValue)}" maxlength="120" />
      <div class="modal-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-primary">Create</button>
      </div>
    </div>
  `;

  const input = overlay.querySelector('.modal-input');

  overlay.querySelector('.btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-primary').addEventListener('click', () => {
    const val = input.value.trim();
    if (!val) { input.focus(); return; }
    overlay.remove();
    onConfirm(val);
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (!val) return;
      overlay.remove();
      onConfirm(val);
    }
    if (e.key === 'Escape') overlay.remove();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

// ─── Global listeners ─────────────────────────────────────────────────────────

function attachGlobalListeners() {
  btnNewFile.addEventListener('click', promptNewFile);
  btnEmptyNew.addEventListener('click', promptNewFile);
  btnAddRow.addEventListener('click', addRow);
  btnAddCol.addEventListener('click', addColumn);

  btnImport.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => handleImport(e.target.files[0]));

  btnExport.addEventListener('click', () => {
    if (!state.activeFile) {
      showToast('No file selected to export');
      return;
    }
    exportActiveFile();
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

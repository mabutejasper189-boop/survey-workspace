// storage.js - Resilient Local Database Wrapper & Log UI Logic

const DB_NAME = 'SurveyWorkspaceDB';
const STORE_NAME = 'projects';
const DB_VERSION = 1;
const FALLBACK_KEY = 'SW_Fallback_Logs';

const StorageManager = {
  _isFallback: false,

  init: function() {
    return new Promise((resolve, reject) => {
      try {
        const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        if (!indexedDB) {
          return reject(new Error("IndexedDB is not supported in this browser."));
        }
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        
        request.onsuccess = () => resolve(request.result);
        
        request.onerror = (e) => {
          e.preventDefault();
          reject(new Error("IndexedDB access denied by browser privacy settings."));
        };
      } catch (err) {
        reject(err);
      }
    });
  },

  getAll: async function() {
    try {
      if (this._isFallback) return this._getFallback();
      const db = await this.init();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
          const res = request.result || [];
          resolve(res.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
        };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
      });
    } catch (err) {
      console.warn("IndexedDB blocked. Seamlessly falling back to LocalStorage.", err);
      this._isFallback = true;
      return this._getFallback();
    }
  },

  save: async function(projectData) {
    const id = projectData.id || `proj_${Date.now()}`;
    const dataToSave = { ...projectData, id, timestamp: Date.now() };

    try {
      if (this._isFallback) throw new Error("Forced fallback");
      const db = await this.init();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(dataToSave);
        request.onsuccess = () => resolve(id);
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
      });
    } catch (err) {
      this._isFallback = true;
      return this._saveFallback(dataToSave);
    }
  },

  delete: async function(id) {
    try {
      if (this._isFallback) throw new Error("Forced fallback");
      const db = await this.init();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
      });
    } catch (err) {
      this._isFallback = true;
      return this._deleteFallback(id);
    }
  },

  // --- LocalStorage Fallback Methods for file:// protocols ---
  _getFallback: function() {
    try {
      const data = localStorage.getItem(FALLBACK_KEY);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) : [];
    } catch(e) {
      return [];
    }
  },
  
  _saveFallback: function(dataToSave) {
    try {
      let logs = this._getFallback();
      const idx = logs.findIndex(l => l.id === dataToSave.id);
      if (idx >= 0) {
          logs[idx] = dataToSave;
      } else {
          logs.push(dataToSave);
      }
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(logs));
      return dataToSave.id;
    } catch(e) {
      console.error("LocalStorage fallback failed.", e);
      throw new Error("Storage blocked entirely.");
    }
  },
  
  _deleteFallback: function(id) {
    try {
      let logs = this._getFallback();
      logs = logs.filter(l => l.id !== id);
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(logs));
      return Promise.resolve();
    } catch(e) {
      return Promise.resolve();
    }
  }
};

async function renderLogs() {
  const logList = document.getElementById('logList');
  if (!logList) return;

  try {
    const projects = await StorageManager.getAll();
    logList.innerHTML = '';

    if (!projects || projects.length === 0) {
      logList.innerHTML = `<span style="color:var(--text-muted); font-size:12px;">No saved projects.</span>`;
      return;
    }

    projects.forEach(proj => {
      const dateStr = new Date(proj.timestamp || Date.now()).toLocaleString();
      const lotCount = proj.lots ? proj.lots.length : 0;
      const safeName = typeof sanitize === 'function' ? sanitize(proj.number || 'Unnamed Project') : (proj.number || 'Unnamed Project');
      const safeOwner = typeof sanitize === 'function' ? sanitize(proj.owner || 'Unknown') : (proj.owner || 'Unknown');

      const item = document.createElement('div');
      item.className = 'log-item';
      item.dataset.id = proj.id;
      
      item.innerHTML = `
        <div class="log-content">
          <div class="log-title">${safeName}</div>
          <div class="log-details">${safeOwner} • ${lotCount} Lot(s)<br>${dateStr}</div>
        </div>
        <button type="button" class="log-delete-btn" aria-label="Delete Log" title="Delete Log">🗑️</button>
      `;
      logList.appendChild(item);
    });
  } catch (error) {
    console.error("Failed to render logs:", error);
    logList.innerHTML = `<div style="color:var(--danger); font-size:12px; line-height: 1.4; padding: 10px; background: #fee2e2; border-radius: 6px;">
      <strong>Storage Blocked</strong><br>
      Storage is blocked by your browser. Please use the "Save-as" (.sw) button above to prevent data loss.
    </div>`;
  }
}

function setupLogListeners() {
  const logPanel = document.getElementById('logPanel');
  if (!logPanel) return;

  logPanel.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.log-delete-btn');
    const logItem = e.target.closest('.log-item');

    if (deleteBtn && logItem) {
      e.stopPropagation(); 
      if (confirm("Are you sure you want to delete this saved project?")) {
        await StorageManager.delete(logItem.dataset.id);
        if (typeof WorkspaceState !== 'undefined' && WorkspaceState.currentProjectId === logItem.dataset.id) {
            WorkspaceState.currentProjectId = null;
        }
        await renderLogs();
        if (typeof showToast === 'function') showToast("Project deleted.");
      }
      return;
    }

    if (logItem && !deleteBtn) {
      await loadLogToWorkspace(logItem.dataset.id);
    }
  });
}

async function loadLogToWorkspace(id) {
  try {
    const projects = await StorageManager.getAll();
    const projectData = projects.find(p => p.id === id);
    if (!projectData) throw new Error("Project not found.");

    if (typeof window.populateWorkspaceFromData === 'function') {
        WorkspaceState.currentProjectId = projectData.id;
        window.populateWorkspaceFromData(projectData);
    }
    
    if (typeof showToast === 'function') showToast("Project loaded from logs!");
  } catch (error) {
    console.error("Error loading project:", error);
    if (typeof showToast === 'function') showToast("Failed to load project from logs.");
  }
}
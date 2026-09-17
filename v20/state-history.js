// state-history.js - Core State Management & Undo/Redo Engine

const WorkspaceState = {
  currentProjectId: null,
  transform: { x: 0, y: 0, k: 1 },
  baseScale: 15,
  isDraggingCanvas: false,
  isDraggingText: false,
  draggedTextRef: null,
  draggedTextType: null,
  draggedDataObject: null,
  lastMouse: { x: 0, y: 0 },
  dragStart: { x: 0, y: 0 },
  needsAutoFit: true,
  pdfUrl: null,
  textHitboxes: [],
  selectedTrRef: null,
  drawFrame: null,
  snapRadius: 15,
  activeSnap: null,
  pdfDebounceTimer: null,
  lotColors: ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#ea580c'],
  cachedLotsData: null,
  
  activeTool: 'select',
  customLines: [],
  customTexts: [],
  measurePoints: [],
  drawStartPoint: null,
  tempCurrentPoint: null,
  
  showTieLines: true,
  showText: true,
  showInteriorAngles: false,
  showAdjustedTraverse: true,
  gridSnap: false,
  orthoMode: false,

  // Undo / Redo History System
  history: [],
  historyIndex: -1,
  isUndoing: false,
  saveTimeout: null,
  renderDebounceTimer: null 
};

function pushHistoryState() {
    if (WorkspaceState.isUndoing) return;
    if (typeof serializeWorkspaceToJSON !== 'function') return; // Safety check
    
    const currentState = JSON.stringify(serializeWorkspaceToJSON());
    if (WorkspaceState.historyIndex >= 0 && WorkspaceState.history[WorkspaceState.historyIndex] === currentState) return;
    
    WorkspaceState.history = WorkspaceState.history.slice(0, WorkspaceState.historyIndex + 1);
    WorkspaceState.history.push(currentState);
    
    if (WorkspaceState.history.length > 30) {
        WorkspaceState.history.shift();
    } else {
        WorkspaceState.historyIndex++;
    }
}

window.undoState = function() {
    if (WorkspaceState.historyIndex > 0) {
        WorkspaceState.isUndoing = true;
        WorkspaceState.historyIndex--;
        const prevState = JSON.parse(WorkspaceState.history[WorkspaceState.historyIndex]);
        if (typeof window.populateWorkspaceFromData === 'function') {
            window.populateWorkspaceFromData(prevState);
        }
        WorkspaceState.isUndoing = false;
        if (typeof showToast === 'function') showToast("Undo Applied");
    }
}

window.redoState = function() {
    if (WorkspaceState.historyIndex < WorkspaceState.history.length - 1) {
        WorkspaceState.isUndoing = true;
        WorkspaceState.historyIndex++;
        const nextState = JSON.parse(WorkspaceState.history[WorkspaceState.historyIndex]);
        if (typeof window.populateWorkspaceFromData === 'function') {
            window.populateWorkspaceFromData(nextState);
        }
        WorkspaceState.isUndoing = false;
        if (typeof showToast === 'function') showToast("Redo Applied");
    }
}

// Global Keyboard Shortcuts for Undo/Redo
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); window.undoState(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); window.redoState(); }
});
// app.js - Main Initialization, App Event Listeners & Global Helpers

function handleInputChange() { 
  clearTimeout(WorkspaceState.saveTimeout);
  WorkspaceState.saveTimeout = setTimeout(() => { 
      if (typeof pushHistoryState === 'function') pushHistoryState(); 
  }, 500);

  if (typeof updateTableUI === 'function') updateTableUI(); 

  clearTimeout(WorkspaceState.renderDebounceTimer);
  WorkspaceState.renderDebounceTimer = setTimeout(() => {
      if (typeof buildGroupedPointsData === 'function') {
          WorkspaceState.cachedLotsData = buildGroupedPointsData();
      }
      if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch(); 
      
      if(document.getElementById('pdfFloating').style.display === 'flex' && typeof generatePDF === 'function') {
          clearTimeout(WorkspaceState.pdfDebounceTimer); 
          WorkspaceState.pdfDebounceTimer = setTimeout(() => { generatePDF('preview'); }, 600); 
      }
  }, 150);
}

function showToast(msg = "Success!") {
  const toast = document.getElementById("toast");
  toast.innerText = msg; 
  toast.className = "show";
  setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2000);
}

function togglePanel() { 
  document.querySelector('.app-container').classList.toggle('panel-collapsed');
}

function toggleWindow(windowId) {
  const win = document.getElementById(windowId);
  if (win.style.display === "none" || win.style.display === "") {
    win.style.display = "flex"; 
    document.querySelectorAll('.floating-window').forEach(w => w.classList.remove('is-active-window'));
    win.classList.add('is-active-window');
    
    if(windowId === 'sketchFloating') {
        WorkspaceState.needsAutoFit = true;
        if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
    }
    if(windowId === 'pdfFloating' && typeof generatePDF === 'function') {
        generatePDF('preview');
    }
  } else { 
    win.style.display = "none"; 
  }
}

function makeDraggable(elmnt, header) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  const dragStart = (e) => {
    if(['BUTTON', 'SELECT', 'INPUT'].includes(e.target.tagName)) return; 
    e.preventDefault(); 
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    pos3 = clientX; pos4 = clientY;
    document.querySelectorAll('.floating-window').forEach(w => w.classList.remove('is-active-window')); 
    elmnt.classList.add('is-active-window');
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
    document.addEventListener('mousemove', dragAction);
    document.addEventListener('touchmove', dragAction, { passive: false });
  };
  const dragAction = (e) => {
    e.preventDefault(); 
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    pos1 = pos3 - clientX; pos2 = pos4 - clientY; pos3 = clientX; pos4 = clientY;
    let newTop = Math.max(0, Math.min(elmnt.offsetTop - pos2, window.innerHeight - 60));
    let newLeft = Math.max(0, Math.min(elmnt.offsetLeft - pos1, window.innerWidth - 100));
    elmnt.style.top = newTop + "px"; elmnt.style.left = newLeft + "px";
  };
  const dragEnd = () => { 
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchend', dragEnd);
    document.removeEventListener('mousemove', dragAction);
    document.removeEventListener('touchmove', dragAction);
  };
  header.addEventListener('mousedown', dragStart);
  header.addEventListener('touchstart', dragStart, { passive: false });
}

async function saveFile() {
  try {
    WorkspaceState.currentProjectId = null; 
    if (typeof serializeWorkspaceToJSON !== 'function') return;
    
    const projectData = serializeWorkspaceToJSON();

    if (typeof StorageManager !== 'undefined') {
        const savedId = await StorageManager.save(projectData);
        WorkspaceState.currentProjectId = savedId;
        if (typeof renderLogs === 'function') await renderLogs();
        showToast("New project saved to local logs!");
    } else {
        showToast("System error: Storage manager is offline.");
    }
  } catch (error) {
    console.error("Save Error:", error);
    alert("System Error: Unable to save to Log. Please check if your browser is blocking Cookies/Local Storage, or use the 'Save-as (.sw)' feature to save your file.\n\nDetails: " + error.message);
    showToast("Error saving project data.");
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  if (typeof renderLogs === 'function') await renderLogs();
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast("Update available! Refreshing in 3 seconds...");
              setTimeout(() => window.location.reload(), 3000);
            }
          });
        });
      }).catch((err) => console.error('Service Worker Registration Failed:', err));
  }

  if (document.querySelectorAll('.lot-card').length === 0 && typeof addNewLot === 'function') {
    addNewLot();
  }
  
  makeDraggable(document.getElementById("pdfFloating"), document.getElementById("pdfDragHeader"));
  
  setupWorkspaceListeners();
  if (typeof setupLogListeners === 'function') setupLogListeners();
  
  document.querySelectorAll('.survey-table tbody tr').forEach(row => {
      if (typeof updateCommand === 'function') updateCommand(row);
  });
  if (typeof updateTableUI === 'function') updateTableUI();
  
  if (typeof buildGroupedPointsData === 'function') {
      WorkspaceState.cachedLotsData = buildGroupedPointsData();
  }
  if (typeof pushHistoryState === 'function') pushHistoryState(); 
  
  if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch(); 
  if (typeof setupCanvasInteractions === 'function') setupCanvasInteractions();

  // Load saved Drafter info from localStorage
  const savedDrawnBy = localStorage.getItem('pdfDrawnBy');
  const savedDrawnTitle = localStorage.getItem('pdfDrawnTitle');
  if (savedDrawnBy && document.getElementById('pdfDrawnBy')) document.getElementById('pdfDrawnBy').value = savedDrawnBy;
  if (savedDrawnTitle && document.getElementById('pdfDrawnTitle')) document.getElementById('pdfDrawnTitle').value = savedDrawnTitle;
  
  window.addEventListener('resize', () => {
    if(document.getElementById('sketchFloating').style.display === 'flex') {
        WorkspaceState.needsAutoFit = true;
        if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
    }
  });

  // Toggles and Tools Listeners
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (btn.id === 'btnUndo') { window.undoState(); return; }
      if (btn.id === 'btnRedo') { window.redoState(); return; }
      
      const toggleIDs = ['btnToggleTieLines', 'btnToggleText', 'btnExportPng', 'btnToggleAngles', 'btnToggleTraverse', 'btnGridSnap', 'btnOrthoMode'];
      if (toggleIDs.includes(btn.id)) return;

      document.querySelectorAll('.tool-btn').forEach(b => {
        if(!toggleIDs.includes(b.id)) b.classList.remove('active');
      });
      btn.classList.add('active');
      WorkspaceState.activeTool = btn.dataset.tool;
      WorkspaceState.measurePoints = [];
      WorkspaceState.drawStartPoint = null;
      WorkspaceState.tempCurrentPoint = null;
      document.getElementById('sketchTextInput').style.display = 'none';
      if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
    });
  });

  document.getElementById('btnToggleTieLines')?.addEventListener('click', function() {
      this.classList.toggle('active');
      WorkspaceState.showTieLines = !WorkspaceState.showTieLines;
      if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
  });

  document.getElementById('btnToggleText')?.addEventListener('click', function() {
      this.classList.toggle('active');
      WorkspaceState.showText = !WorkspaceState.showText;
      if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
  });
  
  document.getElementById('btnToggleAngles')?.addEventListener('click', function() {
      this.classList.toggle('active');
      WorkspaceState.showInteriorAngles = !WorkspaceState.showInteriorAngles;
      if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
      showToast(WorkspaceState.showInteriorAngles ? "Interior angles shown" : "Interior angles hidden");
  });

  document.getElementById('btnToggleTraverse')?.addEventListener('click', function() {
      this.classList.toggle('active');
      WorkspaceState.showAdjustedTraverse = !WorkspaceState.showAdjustedTraverse;
      if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
      showToast(WorkspaceState.showAdjustedTraverse ? "Adjusted Traverse View" : "Raw Traverse View (Shows Error)");
  });

  document.getElementById('btnExportPng')?.addEventListener('click', function() {
      const canvas = document.getElementById('sketchCanvas');
      const link = document.createElement('a');
      link.download = 'sketch-plan.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast("Image exported successfully!");
  });

  document.getElementById('btnThemeToggle')?.addEventListener('click', () => {
     document.body.classList.toggle('dark-mode');
     if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
  });

  document.getElementById('btnAddNewLot')?.addEventListener('click', () => { if (typeof addNewLot === 'function') addNewLot(); });
  document.getElementById('btnSaveFile')?.addEventListener('click', saveFile);
  document.getElementById('btnClearData')?.addEventListener('click', () => { if (typeof clearData === 'function') clearData(); });
  document.getElementById('btnExportDxf')?.addEventListener('click', () => { if (typeof exportDXF === 'function') exportDXF(); });
  
  document.getElementById('btnExportSW')?.addEventListener('click', () => { if (typeof exportWorkspaceSW === 'function') exportWorkspaceSW(); });
  document.getElementById('btnImportSW')?.addEventListener('click', () => { document.getElementById('fileImportSW').click(); });
  document.getElementById('fileImportSW')?.addEventListener('change', (e) => { if (typeof importWorkspaceSW === 'function') importWorkspaceSW(e); });

  document.getElementById('btnToggleSketch')?.addEventListener('click', function() {
    WorkspaceState.needsAutoFit = true; 
    toggleWindow('sketchFloating');
  });
  
  document.getElementById('btnTogglePdf')?.addEventListener('click', function() { toggleWindow('pdfFloating'); });
  document.getElementById('btnToggleLog')?.addEventListener('click', function() { togglePanel(); });

  document.getElementById('btnZoomIn')?.addEventListener('click', function() { if (typeof setZoom === 'function') setZoom(1.2); });
  document.getElementById('btnZoomFit')?.addEventListener('click', function() { if (typeof fitView === 'function') fitView(); });
  document.getElementById('btnZoomOut')?.addEventListener('click', function() { if (typeof setZoom === 'function') setZoom(1 / 1.2); });

  document.querySelectorAll('.window-closer').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.target.closest('.floating-window').style.display = 'none';
      if (e.target.closest('#pdfFloating') && WorkspaceState.pdfUrl) {
        URL.revokeObjectURL(WorkspaceState.pdfUrl);
        WorkspaceState.pdfUrl = null;
        document.getElementById('pdfPreviewFrame').src = '';
      }
    });
  });

  ['lotOwner', 'lotNumber', 'lotLocation'].forEach(id => { document.getElementById(id)?.addEventListener('input', handleInputChange); });
  ['pdfPaperSize', 'pdfOrientation', 'pdfScale', 'pdfIncludeTable'].forEach(id => { document.getElementById(id)?.addEventListener('change', function() { if (typeof generatePDF === 'function') generatePDF('preview'); }); });
  
  ['pdfDrawnBy', 'pdfDrawnTitle'].forEach(id => { 
    document.getElementById(id)?.addEventListener('input', function(e) { 
      localStorage.setItem(id, e.target.value);
      if (typeof generatePDF === 'function') generatePDF('preview'); 
    }); 
  });
  
  document.getElementById('btnDownloadPdf')?.addEventListener('click', function() { if (typeof generatePDF === 'function') generatePDF('download'); });
});

function setupWorkspaceListeners() {
  const workspace = document.getElementById('workspaceContainer');
  
  workspace.addEventListener('input', function(e) {
    if (e.target.tagName === 'TD' && e.target.contentEditable === 'true') {
      if (typeof updateCommand === 'function') updateCommand(e.target.parentElement); 
      handleInputChange();
    } else if (e.target.tagName === 'H3' || e.target.classList.contains('lot-color-picker')) {
      handleInputChange(); 
    }
  });

  workspace.addEventListener('change', function(e) {
    if (e.target.classList.contains('row-check') || 
        e.target.classList.contains('lot-color-picker') ||
        e.target.classList.contains('is-hidden-check') ||
        e.target.classList.contains('is-easement-check')) {
      handleInputChange();
    }
  });

  workspace.addEventListener('click', function(e) {
    const target = e.target;
    if (target.closest('.delete-lot-btn')) { if (typeof deleteLot === 'function') deleteLot(target.closest('.delete-lot-btn')); }
    else if (target.closest('.toggle-lot-btn')) { if (typeof toggleLot === 'function') toggleLot(target.closest('.toggle-lot-btn')); }
    else if (target.closest('.add-row-local')) { if (typeof addRowToLot === 'function') addRowToLot(target.closest('.add-row-local')); }
    else if (target.closest('.command-output')) { if (typeof copyCommand === 'function') copyCommand(target.closest('.command-output')); }
    else if (target.closest('.copy-tech-desc-btn')) { if (typeof copyTechnicalDescription === 'function') copyTechnicalDescription(target.closest('.copy-tech-desc-btn')); }
    else if (target.closest('.copy-single-desc')) {
      const row = target.closest('tr');
      if (row.dataset.techDesc) {
        navigator.clipboard.writeText(row.dataset.techDesc)
          .then(() => showToast("Text format copied!"))
          .catch(err => showToast("Failed to copy text. Check permissions."));
      }
    }
    else if (target.closest('.action-btn') && target.closest('.action-btn').innerText.includes('🗑️') && !target.closest('.delete-lot-btn')) {
      if (typeof deleteRow === 'function') deleteRow(target.closest('.action-btn'));
    }
    else if (target.closest('.save-btn') && target.closest('.lot-footer')) {
      if (typeof copyLotCommands === 'function') copyLotCommands(target.closest('.save-btn'));
    }
  });

  workspace.addEventListener('paste', function(e) {
    const cell = e.target;
    if (cell.tagName === 'TD' && cell.contentEditable === 'true') {
      e.preventDefault(); 
      let pasteText = (e.clipboardData || window.clipboardData).getData('text/plain').trim();
      
      if (typeof isGpsData === 'function' && isGpsData(pasteText)) {
        if (typeof parseGpsPointsList === 'function') parseGpsPointsList(cell.closest('.lot-card'), pasteText);
        return;
      }

      if (cell.cellIndex === 1) { 
        if (typeof parseTechnicalDescription === 'function') parseTechnicalDescription(cell.parentElement, pasteText);
      } else {
        const selection = window.getSelection();
        if (selection.rangeCount) {
            selection.deleteFromDocument();
            selection.getRangeAt(0).insertNode(document.createTextNode(pasteText));
        } else {
            cell.innerText = pasteText;
        }
        if (typeof updateCommand === 'function') updateCommand(cell.parentElement);
        handleInputChange();
      }
    }
  });

  workspace.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'TD' && e.target.contentEditable === 'true') {
      if (e.key === 'Enter') { 
        e.preventDefault(); 
        let currentCell = e.target;
        let nextCell = currentCell.nextElementSibling;
        
        while(nextCell && (nextCell.contentEditable !== 'true' || nextCell.classList.contains('command-output'))) {
          nextCell = nextCell.nextElementSibling;
        }

        if (nextCell && nextCell.contentEditable === 'true') {
          nextCell.focus();
        } else {
          let btn = currentCell.closest('.lot-card').querySelector('.add-row-local');
          if(btn) { btn.click(); }
        }
      }
    }
  });
  
  document.getElementById('applyTextEdit')?.addEventListener('click', () => {
    if (WorkspaceState.selectedTrRef) {
       WorkspaceState.selectedTrRef.dataset.trot = document.getElementById('editTRot').value;
       WorkspaceState.selectedTrRef.dataset.tsize = document.getElementById('editTSize').value;
       handleInputChange();
    }
    document.getElementById('textEditOverlay').style.display = 'none';
  });

  document.getElementById('resetTextPos')?.addEventListener('click', () => {
    if (WorkspaceState.selectedTrRef) {
       if(WorkspaceState.selectedTrRef.tagName === 'ARTICLE') {
           WorkspaceState.selectedTrRef.dataset.titleDx = "0";
           WorkspaceState.selectedTrRef.dataset.titleDy = "0";
       } else {
           WorkspaceState.selectedTrRef.dataset.dx = "0";
           WorkspaceState.selectedTrRef.dataset.dy = "0";
       }
       handleInputChange();
    }
    document.getElementById('textEditOverlay').style.display = 'none';
  });

  document.getElementById('cancelTextEdit')?.addEventListener('click', () => { 
    document.getElementById('textEditOverlay').style.display = 'none'; 
  });
}
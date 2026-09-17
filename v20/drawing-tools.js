// drawing-tools.js - User Interactions and Canvas Event Listeners

let canvasInteractionsInitialized = false;

function getPointerCoords(e, canvas) {
  let rect = canvas.getBoundingClientRect();
  let clientX = e.touches ? e.touches[0].clientX : e.clientX;
  let clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
     screenX: clientX - rect.left,
     screenY: clientY - rect.top,
     clientX, clientY
  };
}

function setupCanvasInteractions() {
  if (canvasInteractionsInitialized) return;
  const canvas = document.getElementById('sketchCanvas');
  const textInput = document.getElementById('sketchTextInput');
  if (!canvas) return;
  
  canvasInteractionsInitialized = true;
  let initialPinchDistance = null;
  
  textInput.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') {
       if (this.value.trim() !== '') {
           WorkspaceState.customTexts.push({
             text: this.value.trim(),
             mapX: parseFloat(this.dataset.mapX),
             mapY: parseFloat(this.dataset.mapY)
           });
           if (typeof window.pushHistoryState === 'function') window.pushHistoryState();
       }
       this.style.display = 'none';
       this.value = '';
       scheduleDrawSketch();
    }
  });

  // NEW: Toggle Logic for Snap and Ortho
  document.getElementById('btnGridSnap')?.addEventListener('click', function() {
      this.classList.toggle('active');
      WorkspaceState.gridSnap = this.classList.contains('active');
      if (typeof showToast === 'function') showToast(WorkspaceState.gridSnap ? "Grid Snap ON (0.5m)" : "Grid Snap OFF");
  });

  document.getElementById('btnOrthoMode')?.addEventListener('click', function() {
      this.classList.toggle('active');
      WorkspaceState.orthoMode = this.classList.contains('active');
      if (typeof showToast === 'function') showToast(WorkspaceState.orthoMode ? "Ortho Mode ON (90°)" : "Ortho Mode OFF");
  });
  
  // Touch events for mobile pinch-to-zoom
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      const pinchScale = currentDistance / initialPinchDistance;
      let newScale = WorkspaceState.transform.k * pinchScale;
      
      newScale = Math.max(0.01, Math.min(newScale, 100));
      WorkspaceState.transform.k = newScale;
      
      initialPinchDistance = currentDistance; 
      WorkspaceState.needsAutoFit = false;
      scheduleDrawSketch();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = null;
  });
  
  canvas.addEventListener('mousedown', (e) => {
    let ptr = getPointerCoords(e, canvas);
    let rawMapX = (ptr.screenX - WorkspaceState.transform.x) / (WorkspaceState.baseScale * WorkspaceState.transform.k);
    let rawMapY = (WorkspaceState.transform.y - ptr.screenY) / (WorkspaceState.baseScale * WorkspaceState.transform.k);
    
    // Grid Snapping Logic
    if (WorkspaceState.gridSnap) {
        const snapResolution = 0.5; // Snap to nearest 0.5 meters
        rawMapX = Math.round(rawMapX / snapResolution) * snapResolution;
        rawMapY = Math.round(rawMapY / snapResolution) * snapResolution;
    }
    
    let targetPoint = WorkspaceState.activeSnap?.isSnapped ? WorkspaceState.activeSnap.ref : {x: rawMapX, y: rawMapY};

    if (WorkspaceState.activeTool === 'select') {
        let hit = WorkspaceState.textHitboxes.find(h => {
           let distX = h.x - ptr.screenX; let distY = h.y - ptr.screenY;
           return (distX*distX + distY*distY) < (h.r * h.r);
        });

        if (hit) { 
          WorkspaceState.isDraggingText = true; 
          WorkspaceState.draggedTextRef = hit.ref; 
          WorkspaceState.draggedTextType = hit.type;
          WorkspaceState.draggedDataObject = hit.dataObject; 
          WorkspaceState.lastMouse = { x: ptr.clientX, y: ptr.clientY };
          return; 
        }

        WorkspaceState.isDraggingCanvas = true; 
        WorkspaceState.dragStart.x = ptr.clientX - WorkspaceState.transform.x; 
        WorkspaceState.dragStart.y = ptr.clientY - WorkspaceState.transform.y;
        canvas.dataset.dragStartX = ptr.clientX; 
        canvas.dataset.dragStartY = ptr.clientY;
    }
    else if (WorkspaceState.activeTool === 'measure') {
        if (WorkspaceState.measurePoints.length === 2) {
            WorkspaceState.measurePoints = [];
        }
        WorkspaceState.measurePoints.push(targetPoint);
        scheduleDrawSketch();
    }
    else if (WorkspaceState.activeTool === 'line') {
        WorkspaceState.drawStartPoint = targetPoint;
        WorkspaceState.tempCurrentPoint = targetPoint;
    }
    else if (WorkspaceState.activeTool === 'text') {
        textInput.style.display = 'block';
        textInput.style.left = (ptr.clientX + 10) + 'px';
        textInput.style.top = (ptr.clientY - 10) + 'px';
        textInput.dataset.mapX = targetPoint.x;
        textInput.dataset.mapY = targetPoint.y;
        setTimeout(() => textInput.focus(), 50);
    }
    else if (WorkspaceState.activeTool === 'id') {
        if (WorkspaceState.activeSnap?.isSnapped) {
            let p = WorkspaceState.activeSnap.ref;
            let idText = `N: ${p.y.toFixed(3)}, E: ${p.x.toFixed(3)}`;
            WorkspaceState.customTexts.push({ text: idText, mapX: p.x + 2, mapY: p.y + 2 });
            if (typeof window.pushHistoryState === 'function') window.pushHistoryState();
            scheduleDrawSketch();
            showToast("Coordinate Tag dropped!");
        }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (e.target !== canvas && !WorkspaceState.isDraggingCanvas && !WorkspaceState.isDraggingText) return;
    let ptr = getPointerCoords(e, canvas);

    if (!WorkspaceState.isDraggingCanvas && !WorkspaceState.isDraggingText) {
      const allPts = Object.values(getGroupedPointsData()).flatMap(l => l.points);
      
      if (WorkspaceState.customLines) {
         WorkspaceState.customLines.forEach(l => { allPts.push(l.p1, l.p2); });
      }

      WorkspaceState.activeSnap = getSnappedCoordinates(ptr.screenX, ptr.screenY, allPts);
      
      let rawMapX = (ptr.screenX - WorkspaceState.transform.x) / (WorkspaceState.baseScale * WorkspaceState.transform.k);
      let rawMapY = (WorkspaceState.transform.y - ptr.screenY) / (WorkspaceState.baseScale * WorkspaceState.transform.k);
      
      // Grid Snapping Logic for live preview
      if (WorkspaceState.gridSnap && !WorkspaceState.activeSnap?.isSnapped) {
          const snapResolution = 0.5;
          rawMapX = Math.round(rawMapX / snapResolution) * snapResolution;
          rawMapY = Math.round(rawMapY / snapResolution) * snapResolution;
      }
      
      let targetPoint = WorkspaceState.activeSnap?.isSnapped ? WorkspaceState.activeSnap.ref : {x: rawMapX, y: rawMapY};

      // Ortho Mode Logic (Force horizontal or vertical lines)
      if (WorkspaceState.orthoMode && WorkspaceState.drawStartPoint && WorkspaceState.activeTool === 'line') {
          let dx = Math.abs(targetPoint.x - WorkspaceState.drawStartPoint.x);
          let dy = Math.abs(targetPoint.y - WorkspaceState.drawStartPoint.y);
          if (dx > dy) {
              targetPoint.y = WorkspaceState.drawStartPoint.y; // Force Horizontal
          } else {
              targetPoint.x = WorkspaceState.drawStartPoint.x; // Force Vertical
          }
      }

      if (WorkspaceState.activeTool === 'line' && WorkspaceState.drawStartPoint) {
          WorkspaceState.tempCurrentPoint = targetPoint;
      }
      if (WorkspaceState.activeTool === 'measure' && WorkspaceState.measurePoints.length === 1) {
          WorkspaceState.tempCurrentPoint = targetPoint;
      }

      scheduleDrawSketch();
    }

    if (WorkspaceState.activeTool === 'select') {
        if (WorkspaceState.isDraggingText && WorkspaceState.draggedTextRef) {
          const scale = WorkspaceState.baseScale * WorkspaceState.transform.k;
          let moveX = ptr.clientX - WorkspaceState.lastMouse.x;
          let moveY = ptr.clientY - WorkspaceState.lastMouse.y;
          WorkspaceState.lastMouse = { x: ptr.clientX, y: ptr.clientY };

          let dxMap = moveX / scale;
          let dyMap = -moveY / scale; 

          if (WorkspaceState.draggedTextType === 'segment') {
              let currentDx = parseFloat(WorkspaceState.draggedTextRef.dataset.dx) || 0;
              let currentDy = parseFloat(WorkspaceState.draggedTextRef.dataset.dy) || 0;
              WorkspaceState.draggedTextRef.dataset.dx = currentDx + dxMap;
              WorkspaceState.draggedTextRef.dataset.dy = currentDy + dyMap;
              
              if (WorkspaceState.draggedDataObject) {
                  WorkspaceState.draggedDataObject.dxOffset += dxMap;
                  WorkspaceState.draggedDataObject.dyOffset += dyMap;
              }
          } else if (WorkspaceState.draggedTextType === 'title') {
              let currentDx = parseFloat(WorkspaceState.draggedTextRef.dataset.titleDx) || 0;
              let currentDy = parseFloat(WorkspaceState.draggedTextRef.dataset.titleDy) || 0;
              WorkspaceState.draggedTextRef.dataset.titleDx = currentDx + dxMap;
              WorkspaceState.draggedTextRef.dataset.titleDy = currentDy + dyMap;
              
              if (WorkspaceState.draggedDataObject) {
                  WorkspaceState.draggedDataObject.titleDx += dxMap;
                  WorkspaceState.draggedDataObject.titleDy += dyMap;
              }
          }

          WorkspaceState.needsAutoFit = false; 
          scheduleDrawSketch(); 
          return;
        }

        if (WorkspaceState.isDraggingCanvas) {
          WorkspaceState.transform.x = ptr.clientX - WorkspaceState.dragStart.x; 
          WorkspaceState.transform.y = ptr.clientY - WorkspaceState.dragStart.y;
          WorkspaceState.needsAutoFit = false; 
          scheduleDrawSketch();
        }
    }
  });

  window.addEventListener('mouseup', (e) => { 
    if (WorkspaceState.activeTool === 'line' && WorkspaceState.drawStartPoint) {
        if (WorkspaceState.tempCurrentPoint && 
            (WorkspaceState.drawStartPoint.x !== WorkspaceState.tempCurrentPoint.x || 
             WorkspaceState.drawStartPoint.y !== WorkspaceState.tempCurrentPoint.y)) {
             WorkspaceState.customLines.push({ p1: WorkspaceState.drawStartPoint, p2: WorkspaceState.tempCurrentPoint });
             if (typeof window.pushHistoryState === 'function') window.pushHistoryState();
        }
        WorkspaceState.drawStartPoint = null;
        WorkspaceState.tempCurrentPoint = null;
        scheduleDrawSketch();
    }

    if (WorkspaceState.activeTool === 'select') {
        if (WorkspaceState.isDraggingText) { 
          WorkspaceState.isDraggingText = false; 
          WorkspaceState.draggedTextRef = null;
          WorkspaceState.draggedTextType = null;
          WorkspaceState.draggedDataObject = null;
          
          if (typeof window.pushHistoryState === 'function') window.pushHistoryState(); 
          
          if(document.getElementById('pdfFloating').style.display === 'flex' && typeof generatePDF === 'function') {
              clearTimeout(WorkspaceState.pdfDebounceTimer); 
              WorkspaceState.pdfDebounceTimer = setTimeout(() => { generatePDF('preview'); }, 600); 
          }
          return; 
        }

        if(WorkspaceState.isDraggingCanvas && e.target === canvas) {
            let ptr = getPointerCoords(e, canvas);
            let dx = Math.abs(ptr.clientX - parseFloat(canvas.dataset.dragStartX));
            let dy = Math.abs(ptr.clientY - parseFloat(canvas.dataset.dragStartY));
            
            if (dx < 5 && dy < 5) {
                let hit = WorkspaceState.textHitboxes.find(h => {
                   let distX = h.x - ptr.screenX; let distY = h.y - ptr.screenY;
                   return (distX*distX + distY*distY) < (h.r * h.r);
                });
                if (hit) {
                   WorkspaceState.selectedTrRef = hit.ref;
                   document.getElementById('editTRot').value = WorkspaceState.selectedTrRef.dataset.trot || "";
                   document.getElementById('editTSize').value = WorkspaceState.selectedTrRef.dataset.tsize || "";
                   
                   let overlay = document.getElementById('textEditOverlay');
                   overlay.style.display = 'flex';
                   let oWidth = 250; let oHeight = 250; 
                   let left = ptr.clientX + 15; let top = ptr.clientY + 15;
                   if(left + oWidth > window.innerWidth) left = window.innerWidth - oWidth - 10;
                   if(top + oHeight > window.innerHeight) top = window.innerHeight - oHeight - 10;
                   overlay.style.left = left + 'px'; 
                   overlay.style.top = top + 'px';
                } else {
                   document.getElementById('textEditOverlay').style.display = 'none';
                }
            }
        }
        WorkspaceState.isDraggingCanvas = false; 
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    let ptr = getPointerCoords(e, canvas);
    
    const worldX = (ptr.screenX - WorkspaceState.transform.x) / (WorkspaceState.baseScale * WorkspaceState.transform.k);
    const worldY = (WorkspaceState.transform.y - ptr.screenY) / (WorkspaceState.baseScale * WorkspaceState.transform.k);

    let newScale = WorkspaceState.transform.k * factor;
    newScale = Math.max(0.01, Math.min(newScale, 100));
    WorkspaceState.transform.k = newScale;

    WorkspaceState.transform.x = ptr.screenX - (worldX * WorkspaceState.baseScale * WorkspaceState.transform.k);
    WorkspaceState.transform.y = ptr.screenY + (worldY * WorkspaceState.baseScale * WorkspaceState.transform.k);

    WorkspaceState.needsAutoFit = false;
    scheduleDrawSketch();
  }, { passive: false });
}
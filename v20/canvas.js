// canvas.js - Canvas Rendering Engine (Graphics & Display)

function scheduleDrawSketch() {
  if (WorkspaceState.drawFrame) cancelAnimationFrame(WorkspaceState.drawFrame);
  WorkspaceState.drawFrame = requestAnimationFrame(drawSketch);
}

function drawGrid(ctx, width, height) {
  const isDark = document.body.classList.contains('dark-mode');
  ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0'; 
  ctx.lineWidth = 1;
  ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
  ctx.font = '9px Arial';
  
  const gridSize = 20 * WorkspaceState.transform.k; 
  if(gridSize < 15) return; 
  
  const offsetX = WorkspaceState.transform.x % gridSize; 
  const offsetY = WorkspaceState.transform.y % gridSize;

  for (let x = offsetX; x <= width; x += gridSize) { 
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); 
    let realX = (x - WorkspaceState.transform.x) / (WorkspaceState.baseScale * WorkspaceState.transform.k);
    ctx.fillText(`E ${realX.toFixed(1)}`, x + 2, height - 5);
  }
  
  for (let y = offsetY; y <= height; y += gridSize) { 
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); 
    let realY = (WorkspaceState.transform.y - y) / (WorkspaceState.baseScale * WorkspaceState.transform.k);
    ctx.fillText(`N ${realY.toFixed(1)}`, 5, y - 2);
  }
}

function drawScaleBar(ctx, w, h) {
  const isDark = document.body.classList.contains('dark-mode');
  const txtColor = isDark ? '#f8fafc' : '#0f172a';

  let pixelsPerMeter = WorkspaceState.baseScale * WorkspaceState.transform.k;
  if(pixelsPerMeter < 0.1) return;
  let scaleMeters = 10;
  if (WorkspaceState.transform.k > 1.5) scaleMeters = 2; 
  else if (WorkspaceState.transform.k > 0.8) scaleMeters = 5; 
  else if (WorkspaceState.transform.k < 0.3) scaleMeters = 50; 
  else if (WorkspaceState.transform.k < 0.1) scaleMeters = 100;

  let scalePixels = scaleMeters * pixelsPerMeter; 
  let x = 15; 
  let y = h - 20;
  
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + scalePixels, y);
  ctx.lineWidth = 3; ctx.strokeStyle = txtColor; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.moveTo(x + scalePixels, y - 4); ctx.lineTo(x + scalePixels, y + 4); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = txtColor; ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'left'; ctx.fillText('0', x, y - 8);
  ctx.textAlign = 'right'; ctx.fillText(scaleMeters + 'm', x + scalePixels, y - 8);
}

const renderX = (rawX) => WorkspaceState.transform.x + (rawX * WorkspaceState.baseScale * WorkspaceState.transform.k);
const renderY = (rawY) => WorkspaceState.transform.y - (rawY * WorkspaceState.baseScale * WorkspaceState.transform.k);

function drawPolygons(ctx, lotsData) {
  const isDark = document.body.classList.contains('dark-mode');
  const lotKeys = Object.keys(lotsData);
  let drawnCanvasNodes = new Set();

  lotKeys.forEach(lotId => {
    let lot = lotsData[lotId]; 
    if (lot.isHidden) return;
    
    let renderPts = WorkspaceState.showAdjustedTraverse ? lot.points : (lot.rawPoints || lot.points);
    if (renderPts.length === 0) return;
    
    let tieLineDetected = renderPts.length > 0 && (renderPts[0].label.toUpperCase().includes("BLLM") || renderPts[0].label.toUpperCase().includes("BLMM") || renderPts[0].label.toUpperCase().includes("BBM"));
    
    if (WorkspaceState.showTieLines && tieLineDetected && renderPts.length > 1) {
      ctx.beginPath(); ctx.setLineDash([5, 5]); 
      ctx.moveTo(renderX(renderPts[0].x), renderY(renderPts[0].y)); 
      ctx.lineTo(renderX(renderPts[1].x), renderY(renderPts[1].y));
      ctx.strokeStyle = lot.color; ctx.lineWidth = Math.max(1, 1 * WorkspaceState.transform.k); 
      ctx.stroke(); ctx.setLineDash([]); 
    }
    
    if (renderPts.length > (tieLineDetected ? 2 : 1)) {
      ctx.beginPath(); let startIndex = tieLineDetected ? 1 : 0; 
      ctx.moveTo(renderX(renderPts[startIndex].x), renderY(renderPts[startIndex].y));
      for(let i = startIndex + 1; i < renderPts.length; i++) { 
        ctx.lineTo(renderX(renderPts[i].x), renderY(renderPts[i].y)); 
      }
      let endPt = renderPts[renderPts.length - 1]; 
      let startPt = renderPts[startIndex];
      let dxClose = Math.abs(endPt.x - startPt.x); 
      let dyClose = Math.abs(endPt.y - startPt.y);
      if (dxClose < 0.15 && dyClose < 0.15) { ctx.closePath(); }
      
      ctx.fillStyle = hexToRgba(lot.color, 0.15); ctx.fill(); 
      ctx.strokeStyle = lot.color; ctx.lineWidth = Math.max(1.5, 2 * WorkspaceState.transform.k); ctx.stroke();
      
      if (dxClose > 0.15 || dyClose > 0.15) {
          ctx.beginPath(); ctx.setLineDash([4, 4]); 
          ctx.moveTo(renderX(endPt.x), renderY(endPt.y)); 
          ctx.lineTo(renderX(startPt.x), renderY(startPt.y));
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(1.5, 2 * WorkspaceState.transform.k); 
          ctx.stroke(); ctx.setLineDash([]);
      }
    }
  });

  lotKeys.forEach(lotId => {
    let lot = lotsData[lotId];
    if (lot.isHidden) return;
    
    let renderPts = WorkspaceState.showAdjustedTraverse ? lot.points : (lot.rawPoints || lot.points);
    
    renderPts.forEach((p) => {
       let cx = renderX(p.x); let cy = renderY(p.y); 
       let nodeKey = `${Math.round(p.x*10)},${Math.round(p.y*10)}`;
       
       if (!drawnCanvasNodes.has(nodeKey)) {
           if (p.isOrigin) {
               ctx.beginPath(); ctx.arc(cx, cy, 5 * Math.max(0.8, WorkspaceState.transform.k), 0, 2 * Math.PI); 
               ctx.fillStyle = '#ef4444'; ctx.fill();
           } else {
               let tickSize = 4 * Math.max(0.7, WorkspaceState.transform.k); 
               ctx.beginPath(); ctx.moveTo(cx - tickSize, cy + tickSize); ctx.lineTo(cx + tickSize, cy - tickSize);
               ctx.strokeStyle = isDark ? '#f8fafc' : '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
           }
           
           if (WorkspaceState.transform.k >= 0.35) {
               ctx.font = `bold ${Math.max(11, 13 * WorkspaceState.transform.k)}px Arial`; 
               
               let rawVx = p.x - lot.centerX;
               let rawVy = p.y - lot.centerY;
               let rawVlen = Math.hypot(rawVx, rawVy) || 1;
               
               let offsetPx = 15 * Math.max(0.8, WorkspaceState.transform.k);
               let screenOffX = (rawVx / rawVlen) * offsetPx;
               let screenOffY = -(rawVy / rawVlen) * offsetPx; 
               
               ctx.textAlign = "center"; 
               ctx.textBaseline = "middle";
               ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff'; ctx.lineWidth = 3; 
               ctx.strokeText(p.label, cx + screenOffX, cy + screenOffY); 
               ctx.fillStyle = isDark ? '#f8fafc' : '#334155'; 
               ctx.fillText(p.label, cx + screenOffX, cy + screenOffY);
           }
           drawnCanvasNodes.add(nodeKey);
       }
    });
  });
}

function drawAnnotations(ctx, lotsData) {
  const isDark = document.body.classList.contains('dark-mode');
  const lotKeys = Object.keys(lotsData);
  let drawnCanvasSegments = new Set(); 

  if (WorkspaceState.transform.k >= 0.25) {
      lotKeys.forEach(lotId => {
        let lot = lotsData[lotId];
        if (lot.isHidden) return;

        lot.segments.forEach((seg) => {
            let sKey = `${Math.round(seg.midX * 10)},${Math.round(seg.midY * 10)}`;
            
            if (!drawnCanvasSegments.has(sKey)) {
                let cx = renderX(seg.midX + seg.dxOffset); 
                let cy = renderY(seg.midY + seg.dyOffset); 
                
                let screenAngle = -seg.angleRad;
                while (screenAngle <= -Math.PI) screenAngle += 2 * Math.PI;
                while (screenAngle > Math.PI) screenAngle -= 2 * Math.PI;
                if (screenAngle > Math.PI / 2) screenAngle -= Math.PI;
                if (screenAngle < -Math.PI / 2) screenAngle += Math.PI;

                let finalAngle = screenAngle + ((seg.tRot || 0) * (Math.PI / 180));

                WorkspaceState.textHitboxes.push({ ref: seg.trRef, type: 'segment', x: cx, y: cy, r: 25, dataObject: seg });

                if (WorkspaceState.transform.k >= 0.5) {
                    let baseSize = seg.tSize > 0 ? seg.tSize : 10; 
                    let fontSize = Math.max(8, baseSize * WorkspaceState.transform.k);
                    
                    ctx.save(); 
                    ctx.translate(cx, cy); 
                    ctx.rotate(finalAngle); 
                    ctx.textAlign = "center"; 
                    ctx.textBaseline = "middle"; 
                    
                    ctx.font = `${fontSize * 0.9}px Arial`;
                    let bearW = ctx.measureText(seg.bearing).width;
                    ctx.font = `bold ${fontSize}px Arial`;
                    let distW = ctx.measureText(`${seg.dist}m`).width;
                    
                    let boxW = Math.max(bearW, distW) + 6;
                    let boxH = (fontSize * 2.2) + 4;
                    
                    ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)'; 
                    ctx.fillRect(-boxW/2, -boxH/2, boxW, boxH); 
                    
                    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a'; 
                    ctx.font = `${fontSize * 0.9}px Arial`;
                    ctx.fillText(seg.bearing, 0, -(fontSize * 0.55)); 
                    
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.fillText(`${seg.dist}m`, 0, (fontSize * 0.6)); 
                    
                    ctx.restore();
                }
                drawnCanvasSegments.add(sKey);
            }
        });
      });
  }

  lotKeys.forEach(lotId => {
    let lot = lotsData[lotId];
    if (lot.isHidden) return;

    let renderPts = WorkspaceState.showAdjustedTraverse ? lot.points : (lot.rawPoints || lot.points);
    
    if (renderPts.length > 2 && WorkspaceState.transform.k >= 0.2) {
       let cx = renderX(lot.centerX + lot.titleDx); 
       let cy = renderY(lot.centerY + lot.titleDy); 
       
       WorkspaceState.textHitboxes.push({ ref: lot.cardRef, type: 'title', x: cx, y: cy, r: 35, dataObject: lot });

       ctx.textAlign = "center"; 
       ctx.textBaseline = "middle";
       let titleFont = `bold ${Math.max(11, 14 * WorkspaceState.transform.k)}px Arial`; 
       let areaFont = `${Math.max(9, 11 * WorkspaceState.transform.k)}px Arial`;
       let areaText = `A = ${lot.area.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} sq.m.`;
       
       ctx.font = titleFont; 
       let nameW = ctx.measureText(lot.displayName).width; 
       ctx.font = areaFont; 
       let areaW = ctx.measureText(areaText).width;
       let boxW = Math.max(nameW, areaW) + 12 * WorkspaceState.transform.k; 
       let boxH = 30 * WorkspaceState.transform.k;
       
       ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)'; 
       ctx.fillRect(cx - boxW/2, cy - boxH/2 - 2, boxW, boxH + 4);
       ctx.font = titleFont; 
       ctx.fillStyle = lot.color; 
       ctx.fillText(lot.displayName, cx, cy - 8 * WorkspaceState.transform.k);
       ctx.font = areaFont; 
       ctx.fillStyle = isDark ? '#f8fafc' : '#334155'; 
       ctx.fillText(areaText, cx, cy + 8 * WorkspaceState.transform.k);
    }
  });

  if (WorkspaceState.showInteriorAngles && WorkspaceState.transform.k >= 0.4) {
      lotKeys.forEach(lotId => {
          let lot = lotsData[lotId];
          if (lot.isHidden) return;

          let pts = WorkspaceState.showAdjustedTraverse ? lot.points : (lot.rawPoints || lot.points);
          if (pts.length === 0) return;
          
          let tieLineDetected = pts.length > 0 && /BLLM|BLMM|BBM/i.test(pts[0].label);
          let startIndex = tieLineDetected ? 1 : 0;
          
          if (pts.length > startIndex + 2) {
              for (let i = startIndex; i < pts.length; i++) {
                  let pPrev = i === startIndex ? pts[pts.length - 2] : pts[i - 1]; 
                  let pCurr = pts[i];
                  let pNext = i === pts.length - 1 ? pts[startIndex + 1] : pts[i + 1];
                  
                  if (i === startIndex || i === pts.length - 1) {
                      let dx = pts[pts.length - 1].x - pts[startIndex].x;
                      let dy = pts[pts.length - 1].y - pts[startIndex].y;
                      if (Math.hypot(dx, dy) > 0.5) continue; 
                  }
                  
                  if (typeof calculateInteriorAngle === 'function') {
                      let angleText = calculateInteriorAngle(pPrev, pCurr, pNext);
                      let cx = renderX(pCurr.x);
                      let cy = renderY(pCurr.y);
                      
                      let a1 = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
                      let a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
                      let bisectorRad = (a1 + a2) / 2;
                      
                      let distOff = 25 * Math.max(0.7, WorkspaceState.transform.k);
                      let textX = cx + Math.cos(bisectorRad) * distOff;
                      let textY = cy - Math.sin(bisectorRad) * distOff; 
                      
                      ctx.fillStyle = isDark ? '#fbbf24' : '#b45309'; 
                      ctx.font = `bold ${Math.max(9, 11 * WorkspaceState.transform.k)}px Arial`;
                      ctx.textAlign = "center";
                      ctx.textBaseline = "middle";
                      ctx.fillText(angleText, textX, textY);
                  }
              }
          }
      });
  }
}

function drawNorthArrow(ctx, x, y) {
  const isDark = document.body.classList.contains('dark-mode');
  const txtColor = isDark ? '#f8fafc' : '#334155';
  ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 6, y + 6); ctx.lineTo(x - 6, y + 6);
  ctx.closePath(); ctx.fillStyle = '#ef4444'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 18); ctx.strokeStyle = txtColor; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = txtColor; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', x, y - 20);
}

function drawSketch() {
  const canvas = document.getElementById('sketchCanvas');
  if (!canvas) return; 
  const ctx = canvas.getContext('2d');
  
  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  const logicalWidth = parent.clientWidth || 420;
  const logicalHeight = parent.clientHeight || 350;

  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.width = logicalWidth + 'px';
  canvas.style.height = logicalHeight + 'px';
  ctx.scale(dpr, dpr);

  const isDark = document.body.classList.contains('dark-mode');

  const lotsData = getGroupedPointsData(); 
  const lotKeys = Object.keys(lotsData);
  WorkspaceState.textHitboxes = []; 
  
  const areaContainer = document.getElementById('areaDisplayContainer'); 
  areaContainer.innerHTML = '';
  let allGlobalPoints = [];

  lotKeys.forEach(lotId => {
    let lot = lotsData[lotId]; 
    let renderPts = WorkspaceState.showAdjustedTraverse ? lot.points : (lot.rawPoints || lot.points);
    
    if (!lot.isHidden) {
        allGlobalPoints.push(...renderPts); 
    }
    
    let hiddenTag = lot.isHidden ? `<span style="color: #ef4444; font-size: 10px; font-weight: bold;">[HIDDEN]</span>` : '';
    let deductTag = lot.isEasement ? `<span style="color: #d97706; font-size: 10px; font-weight: bold;">[DEDUCT]</span>` : '';
    
    areaContainer.innerHTML += `
      <div class="area-display-item" style="${lot.isHidden ? 'opacity: 0.5;' : ''}">
        <span style="color: ${lot.color}; font-weight: 900;">■ ${lot.displayName} ${hiddenTag} ${deductTag}</span>
        <span>${lot.area.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} sq.m.</span>
        <span style="font-size: 10px; color: var(--text-muted);">Closure: ${lot.closureReport}</span>
      </div>`;
  });

  if (lotKeys.length === 0) areaContainer.innerHTML = `<span style="color:var(--text-muted); font-size:12px;">No active data.</span>`;

  // Draw Background
  ctx.fillStyle = isDark ? '#1e293b' : '#fcfcfc'; 
  ctx.fillRect(0, 0, logicalWidth, logicalHeight); 
  drawGrid(ctx, logicalWidth, logicalHeight);
  
  // Origin (0,0) X and Y Axes
  const originX = renderX(0);
  const originY = renderY(0);

  ctx.beginPath();
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, logicalHeight);
  ctx.strokeStyle = 'rgba(22, 163, 74, 0.6)'; 
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(logicalWidth, originY);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; 
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = isDark ? 'rgba(248, 250, 252, 0.8)' : 'rgba(51, 65, 85, 0.8)';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('ORIGIN (0,0)', originX + 5, originY - 5);
  
  if (WorkspaceState.customLines) {
      WorkspaceState.customLines.forEach(line => {
          allGlobalPoints.push(line.p1, line.p2);
      });
  }
  
  if (allGlobalPoints.length === 0) return;

  if (WorkspaceState.needsAutoFit) {
    let minX = Math.min(...allGlobalPoints.map(p => p.x)); 
    let maxX = Math.max(...allGlobalPoints.map(p => p.x));
    let minY = Math.min(...allGlobalPoints.map(p => p.y)); 
    let maxY = Math.max(...allGlobalPoints.map(p => p.y));
    let w = maxX - minX; 
    let h = maxY - minY; 
    
    const padding = 60;
    const availW = Math.max(20, logicalWidth - padding * 2);
    const availH = Math.max(20, logicalHeight - padding * 2);
    
    const scaleX = w === 0 ? 1 : availW / (w * WorkspaceState.baseScale || 1);
    const scaleY = h === 0 ? 1 : availH / (h * WorkspaceState.baseScale || 1);
    
    WorkspaceState.transform.k = Math.max(0.05, Math.min(scaleX, scaleY));
    
    const midX = (minX + maxX) / 2 * WorkspaceState.baseScale; 
    const midY = (minY + maxY) / 2 * WorkspaceState.baseScale;
    WorkspaceState.transform.x = logicalWidth / 2 - midX * WorkspaceState.transform.k; 
    WorkspaceState.transform.y = logicalHeight / 2 + midY * WorkspaceState.transform.k; 
    WorkspaceState.needsAutoFit = false;
  }

  ctx.save();
  drawPolygons(ctx, lotsData);
  if (WorkspaceState.showText) {
    drawAnnotations(ctx, lotsData);
  }
  
  if (WorkspaceState.customLines && WorkspaceState.customLines.length > 0) {
      ctx.strokeStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 2 * Math.max(0.5, WorkspaceState.transform.k);
      WorkspaceState.customLines.forEach(line => {
         ctx.beginPath();
         ctx.moveTo(renderX(line.p1.x), renderY(line.p1.y));
         ctx.lineTo(renderX(line.p2.x), renderY(line.p2.y));
         ctx.stroke();
      });
  }

  if (WorkspaceState.activeTool === 'line' && WorkspaceState.drawStartPoint && WorkspaceState.tempCurrentPoint) {
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.moveTo(renderX(WorkspaceState.drawStartPoint.x), renderY(WorkspaceState.drawStartPoint.y));
      ctx.lineTo(renderX(WorkspaceState.tempCurrentPoint.x), renderY(WorkspaceState.tempCurrentPoint.y));
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2 * Math.max(0.5, WorkspaceState.transform.k);
      ctx.stroke();
      ctx.setLineDash([]);
  }

  if (WorkspaceState.customTexts && WorkspaceState.customTexts.length > 0) {
      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.font = `bold ${Math.max(10, 12 * WorkspaceState.transform.k)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      WorkspaceState.customTexts.forEach(txt => {
         ctx.fillText(txt.text, renderX(txt.mapX), renderY(txt.mapY));
      });
  }

  if (WorkspaceState.activeTool === 'measure') {
      let mPts = WorkspaceState.measurePoints;
      if (mPts.length > 0) {
          ctx.fillStyle = '#d97706'; 
          ctx.beginPath(); ctx.arc(renderX(mPts[0].x), renderY(mPts[0].y), 6, 0, 2*Math.PI); ctx.fill();
          
          let target = WorkspaceState.tempCurrentPoint;
          if (mPts.length === 2) target = mPts[1];
          
          if (target) {
              ctx.beginPath(); ctx.arc(renderX(target.x), renderY(target.y), 6, 0, 2*Math.PI); ctx.fill();
              ctx.beginPath(); ctx.setLineDash([6, 6]);
              ctx.moveTo(renderX(mPts[0].x), renderY(mPts[0].y));
              ctx.lineTo(renderX(target.x), renderY(target.y));
              ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2; ctx.stroke();
              ctx.setLineDash([]);
              
              let dx = target.x - mPts[0].x; let dy = target.y - mPts[0].y;
              let dist = Math.hypot(dx, dy).toFixed(3);
              let polar = cartesianToPolarBearing(dx, dy);
              let bear = `${polar.ns} ${polar.deg}°${polar.min}'${polar.sec}" ${polar.ew}`;
              
              let midX = renderX(mPts[0].x + dx/2); let midY = renderY(mPts[0].y + dy/2);
              ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)';
              ctx.fillRect(midX - 60, midY - 15, 120, 30);
              ctx.fillStyle = '#d97706';
              ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(`${dist}m | ${bear}`, midX, midY);
          }
      }
  }

  if (WorkspaceState.activeTool === 'id' && WorkspaceState.activeSnap?.isSnapped) {
      let p = WorkspaceState.activeSnap.ref;
      let cx = renderX(p.x); let cy = renderY(p.y);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(cx + 10, cy - 25, 130, 24);
      ctx.fillStyle = '#ffffff'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`N:${p.y.toFixed(2)}, E:${p.x.toFixed(2)}`, cx + 15, cy - 13);
  }

  if (WorkspaceState.activeTool !== 'measure' && WorkspaceState.activeSnap && WorkspaceState.activeSnap.isSnapped) {
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.strokeRect(WorkspaceState.activeSnap.x - 6, WorkspaceState.activeSnap.y - 6, 12, 12);
  }

  ctx.restore(); 
  drawNorthArrow(ctx, logicalWidth - 30, 30); 
  drawScaleBar(ctx, logicalWidth, logicalHeight);
}

function setZoom(factor) {
  const canvas = document.getElementById('sketchCanvas');
  if (!canvas) return;
  
  const parent = canvas.parentElement;
  const logicalWidth = parent.clientWidth || 420;
  const logicalHeight = parent.clientHeight || 350;
  
  const cx = logicalWidth / 2;
  const cy = logicalHeight / 2;

  const worldX = (cx - WorkspaceState.transform.x) / (WorkspaceState.baseScale * WorkspaceState.transform.k);
  const worldY = (WorkspaceState.transform.y - cy) / (WorkspaceState.baseScale * WorkspaceState.transform.k);

  let newScale = WorkspaceState.transform.k * factor;
  
  newScale = Math.max(0.01, Math.min(newScale, 100));
  WorkspaceState.transform.k = newScale;

  WorkspaceState.transform.x = cx - (worldX * WorkspaceState.baseScale * WorkspaceState.transform.k);
  WorkspaceState.transform.y = cy + (worldY * WorkspaceState.baseScale * WorkspaceState.transform.k);

  WorkspaceState.needsAutoFit = false;
  if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
}

function fitView() {
  WorkspaceState.needsAutoFit = true;
  if (typeof scheduleDrawSketch === 'function') scheduleDrawSketch();
}
// data-parser.js - Text Parsing, Object Formatting & Data Compilation

const sanitize = (str) => {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
};

function isGpsData(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return false;
  const sampleParts = lines[0].split(/[,\t]/).map(s => s.trim());
  const numCoords = sampleParts.map(p => parseFloat(p)).filter(n => !isNaN(n));
  return numCoords.length >= 2;
}

function parseGpsPointsList(card, text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const parsedPoints = [];

  lines.forEach((line, idx) => {
    const parts = line.split(/[,\t]/).map(s => s.trim());
    if (parts.length >= 2) {
      let ptName = `P${idx + 1}`;
      let lat = NaN, lon = NaN;
      if (parts.length >= 3 && isNaN(parseFloat(parts[0]))) {
        ptName = parts[0];
        lat = parseFloat(parts[1]);
        lon = parseFloat(parts[2]);
      } else {
        lat = parseFloat(parts[0]);
        lon = parseFloat(parts[1]);
      }
      if (!isNaN(lat) && !isNaN(lon)) {
        parsedPoints.push({ name: ptName, lat, lon });
      }
    }
  });

  if (parsedPoints.length < 2) {
    if (typeof showToast === 'function') showToast("Invalid GPS format.");
    return;
  }

  const origin = parsedPoints[0];
  const cartesianPts = parsedPoints.map(p => {
    const local = latLonToCartesian(p.lat, p.lon, origin.lat, origin.lon);
    return { name: p.name, x: local.x, y: local.y };
  });

  const tbody = card.querySelector('tbody');
  tbody.innerHTML = "";
  const template = document.getElementById("rowTemplate");

  for (let i = 1; i < cartesianPts.length; i++) {
    const p1 = cartesianPts[i - 1];
    const p2 = cartesianPts[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const polar = cartesianToPolarBearing(dx, dy);

    if (template) {
      const clone = template.content.cloneNode(true);
      const tr = clone.querySelector('tr');
      const cells = tr.querySelectorAll('td');
      
      cells[1].innerText = `${p1.name}-${p2.name}`;
      cells[2].innerText = polar.ns;
      cells[3].innerText = polar.deg;
      cells[4].innerText = polar.min;
      cells[5].innerText = polar.sec;
      cells[6].innerText = polar.ew;
      cells[7].innerText = polar.dist;
      
      tbody.appendChild(tr);
      if (typeof updateCommand === 'function') updateCommand(tr);
    }
  }

  WorkspaceState.needsAutoFit = true;
  if (typeof handleInputChange === 'function') handleInputChange();
  if (typeof showToast === 'function') showToast(`Converted ${parsedPoints.length} GPS points!`);
}

function parseTechnicalDescription(row, text) {
  const cells = row.querySelectorAll('td'); 
  cells[1].classList.remove('cell-error');
  let lineMatch = text.match(/(?:Line|Pt\.?)\s*([A-Za-z0-9\-]+)\s*(?:to|-)\s*([A-Za-z0-9\-]+)/i); 
  let lineName = text; 
  if (lineMatch) { 
    lineName = `${lineMatch[1]}-${lineMatch[2]}`; 
  } else { 
    let simpleLine = text.match(/^([A-Za-z0-9\-]+)/); 
    if(simpleLine) lineName = simpleLine[1]; 
  }

  let bearingMatch = text.match(/([NS])\.?\s*(\d+)[^0-9]+(\d+)'?(?:[^0-9]*(\d+)(?:"|''|\s)?)?[^a-zA-Z]*([EW])\.?/i);
  let distMatch = null;

  if (bearingMatch) {
    const afterBearing = text.slice(bearingMatch.index + bearingMatch[0].length);
    distMatch = afterBearing.match(/([\d,]+\.?\d*)\s*(?:m|m\.|meters)?/i);
  }

  if (!distMatch) { 
    let parts = text.split(','); 
    if (parts.length > 1) { 
      let potentialDist = parts[parts.length-1].match(/([\d,\.]+)/); 
      if (potentialDist) distMatch = potentialDist; 
    } 
  }

  if (bearingMatch && distMatch) {
     cells[1].innerText = lineName; 
     cells[2].innerText = bearingMatch[1].toUpperCase(); 
     cells[3].innerText = bearingMatch[2]; 
     cells[4].innerText = bearingMatch[3]; 
     cells[5].innerText = bearingMatch[4] || "00"; 
     cells[6].innerText = bearingMatch[5].toUpperCase(); 
     cells[7].innerText = distMatch[1];                     
     if (typeof updateCommand === 'function') updateCommand(row); 
     if (typeof handleInputChange === 'function') handleInputChange(); 
     if (typeof showToast === 'function') showToast("Data Extracted!");
  } else { 
    cells[1].innerText = text;
    cells[1].classList.add('cell-error'); 
    if (typeof updateCommand === 'function') updateCommand(row); 
  }
}

function getGroupedPointsData() {
  if (!WorkspaceState.cachedLotsData) {
    WorkspaceState.cachedLotsData = buildGroupedPointsData();
  }
  return WorkspaceState.cachedLotsData;
}

function buildGroupedPointsData() {
  let lots = {}; 
  document.querySelectorAll('.lot-card').forEach((card, index) => {
    const lotName = card.querySelector('h3').innerText.trim() || 'Unassigned Lot';
    const lotId = `lot_${index}`;
    const colorInput = card.querySelector('.lot-color-picker');
    const lotColor = colorInput ? colorInput.value : '#2563eb';
    const titleDx = parseFloat(card.dataset.titleDx) || 0;
    const titleDy = parseFloat(card.dataset.titleDy) || 0;
    const isHidden = card.querySelector('.is-hidden-check')?.checked || false;
    const isEasement = card.querySelector('.is-easement-check')?.checked || false;

    if (!lots[lotId]) { 
      lots[lotId] = { 
        displayName: lotName, points: [], segments: [], 
        currentX: 0, currentY: 0, isFirst: true, color: lotColor, 
        rawData: [], titleDx, titleDy, cardRef: card,
        isHidden: isHidden, isEasement: isEasement
      }; 
    }

    const rows = card.querySelectorAll('tbody tr');
    rows.forEach(row => {
      if(!row.querySelector('.row-check').checked) return; 

      const cells = row.cells;
      if (cells.length >= 9) {
        const lineName = cells[1].innerText.trim(); 
        const ns = cells[2].innerText.trim().toUpperCase();
        const degStr = cells[3].innerText.trim(); 
        const minStr = cells[4].innerText.trim();
        const secStr = cells[5].innerText.trim() || "0"; 
        const ew = cells[6].innerText.trim().toUpperCase();
        const distStr = cells[7].innerText.trim().replace(/,/g, ''); 

        let deg = parseFloat(degStr); let min = parseFloat(minStr); 
        let sec = parseFloat(secStr); let dist = parseFloat(distStr);

        if ((ns === 'N' || ns === 'S') && (ew === 'E' || ew === 'W') && !isNaN(deg) && !isNaN(min) && !isNaN(dist) && dist > 0) {
          const bearingFormat = `${ns} ${deg}°${min}' ${ew}`;
          lots[lotId].rawData.push({line: lineName, bearing: bearingFormat, dist: distStr});

          let decimalDeg = deg + (min / 60) + (sec / 3600); 
          let angleRad = 0;
          if (ns === 'N' && ew === 'E') angleRad = (90 - decimalDeg) * Math.PI / 180;
          else if (ns === 'N' && ew === 'W') angleRad = (90 + decimalDeg) * Math.PI / 180;
          else if (ns === 'S' && ew === 'E') angleRad = (270 + decimalDeg) * Math.PI / 180;
          else if (ns === 'S' && ew === 'W') angleRad = (270 - decimalDeg) * Math.PI / 180;

          let dxOffset = parseFloat(row.dataset.dx) || 0;
          let dyOffset = parseFloat(row.dataset.dy) || 0;
          let tRot = parseFloat(row.dataset.trot) || 0; 
          let tSize = parseFloat(row.dataset.tsize) || 0;
          
          let nameParts = lineName.split('-'); 
          let pStartLabel = nameParts[0] || ""; 
          let pEndLabel = nameParts.length > 1 ? nameParts[1] : lineName;

          let dx = dist * Math.cos(angleRad); 
          let dy = dist * Math.sin(angleRad);

          if (lots[lotId].isFirst) {
            lots[lotId].points.push({x: 0, y: 0, label: pStartLabel, isOrigin: true}); 
            lots[lotId].currentX = dx; 
            lots[lotId].currentY = dy;
            lots[lotId].points.push({x: lots[lotId].currentX, y: lots[lotId].currentY, label: pEndLabel});
            lots[lotId].isFirst = false;
          } else {
            lots[lotId].currentX += dx; 
            lots[lotId].currentY += dy; 
            lots[lotId].points.push({x: lots[lotId].currentX, y: lots[lotId].currentY, label: pEndLabel});
          }
          
          lots[lotId].segments.push({
            dist: distStr, bearing: bearingFormat, 
            dxOffset, dyOffset, tRot, tSize, trRef: row,
            angleRad, midX: 0, midY: 0
          }); 
        }
      }
    });
  });

  Object.values(lots).forEach(lot => {
    let pts = lot.points;
    if (pts.length > 2) {
      let startIndex = 0;
      let lastPt = pts[pts.length - 1];
      let isTieLine = pts[0].label.toUpperCase().includes("BLLM") || pts[0].label.toUpperCase().includes("BLMM") || pts[0].label.toUpperCase().includes("BBM");
      
      if (pts.length > 3 && isTieLine) {
          startIndex = 1;
      }

      let startPt = pts[startIndex];
      let errX = lastPt.x - startPt.x;
      let errY = lastPt.y - startPt.y;
      let misclosure = Math.hypot(errX, errY);
      
      let perimeter = 0;
      let cumDistances = [0];

      for (let i = startIndex; i < pts.length - 1; i++) {
          let d = parseFloat(lot.segments[i].dist);
          perimeter += d;
          cumDistances.push(perimeter);
      }

      let precisionStr = "Perfect";
      if (misclosure > 0.001 && perimeter > 0) {
          let precisionRatio = Math.round(perimeter / misclosure);
          precisionStr = `1:${precisionRatio} (Err: ${misclosure.toFixed(3)}m)`;
      }
      lot.closureReport = precisionStr;

      lot.rawPoints = pts.map(p => ({...p})); 

      if (misclosure > 0.0001 && misclosure < 2.0 && startPt.label === lastPt.label && perimeter > 0) {
          for (let i = startIndex + 1; i < pts.length; i++) {
              let ratio = cumDistances[i - startIndex] / perimeter;
              pts[i].x -= errX * ratio;
              pts[i].y -= errY * ratio;
          }
      }

      for (let i = 1; i < pts.length; i++) {
          let seg = lot.segments[i-1];
          seg.midX = (pts[i-1].x + pts[i].x) / 2;
          seg.midY = (pts[i-1].y + pts[i].y) / 2;
      }
      
      let shapePoints = pts;
      if (pts.length > 1 && isTieLine) {
          shapePoints = pts.slice(1);
      }
      lot.area = calculatePolygonArea(shapePoints);
      
      if (shapePoints.length > 0) {
         let minX = Math.min(...shapePoints.map(p=>p.x)), maxX = Math.max(...shapePoints.map(p=>p.x));
         let minY = Math.min(...shapePoints.map(p=>p.y)), maxY = Math.max(...shapePoints.map(p=>p.y));
         lot.centerX = (minX + maxX) / 2;
         lot.centerY = (minY + maxY) / 2;
      } else {
         lot.centerX = 0; lot.centerY = 0;
      }
    } else {
      lot.area = 0; lot.centerX = 0; lot.centerY = 0; lot.closureReport = "N/A";
    }
  });

  return lots;
}

function serializeWorkspaceToJSON() {
  const owner = document.getElementById("lotOwner")?.value.trim() || "Unknown Owner";
  const number = document.getElementById("lotNumber")?.value.trim() || "Unnamed Project";
  const location = document.getElementById("lotLocation")?.value.trim() || "";
  
  const lots = [];
  
  document.querySelectorAll(".lot-card").forEach(card => {
    const lotName = card.querySelector('h3')?.innerText.trim() || "Unnamed Lot";
    const colorInput = card.querySelector('.lot-color-picker');
    const color = colorInput ? colorInput.value : '#2563eb';
    const titleDx = card.dataset.titleDx || "0";
    const titleDy = card.dataset.titleDy || "0";
    const isHidden = card.querySelector('.is-hidden-check')?.checked || false;
    const isEasement = card.querySelector('.is-easement-check')?.checked || false;
    const rows = [];
    
    card.querySelectorAll("tbody tr").forEach(tr => {
      const cells = tr.querySelectorAll("td");
      if (cells.length >= 8) { 
          rows.push({
            checked: cells[0].querySelector("input")?.checked ?? true, 
            line: cells[1].innerText.trim(), 
            ns: cells[2].innerText.trim(),
            deg: cells[3].innerText.trim(), 
            min: cells[4].innerText.trim(), 
            sec: cells[5].innerText.trim(),
            ew: cells[6].innerText.trim(), 
            dist: cells[7].innerText.trim(), 
            dx: tr.dataset.dx || "0", 
            dy: tr.dataset.dy || "0",
            tRot: tr.dataset.trot || "", 
            tSize: tr.dataset.tsize || "", 
            techDesc: tr.dataset.techDesc || ""
          });
      }
    });
    lots.push({ lotName, color, titleDx, titleDy, isHidden, isEasement, rows });
  });

  return { 
    id: WorkspaceState.currentProjectId, 
    owner, number, location, lots,
    customLines: WorkspaceState.customLines,
    customTexts: WorkspaceState.customTexts
  };
}

window.populateWorkspaceFromData = function(projectData) {
  document.getElementById("lotOwner").value = (projectData.owner === "Unknown Owner") ? "" : (projectData.owner || "");
  document.getElementById("lotNumber").value = projectData.number || "";
  document.getElementById("lotLocation").value = projectData.location || "";
  
  WorkspaceState.customLines = projectData.customLines || [];
  WorkspaceState.customTexts = projectData.customTexts || [];

  const container = document.getElementById("workspaceContainer"); 
  container.innerHTML = "";
  
  const lotTemplate = document.getElementById("lotTemplate");
  const rowTemplate = document.getElementById("rowTemplate");
  
  projectData.lots.forEach((lotData, i) => {
      const color = lotData.color || WorkspaceState.lotColors[i % WorkspaceState.lotColors.length];
      const clone = lotTemplate.content.cloneNode(true);
      const article = clone.querySelector('.lot-card');
      
      article.dataset.titleDx = lotData.titleDx || "0";
      article.dataset.titleDy = lotData.titleDy || "0";
      
      const h3 = article.querySelector('h3');
      if (h3) h3.innerText = lotData.lotName || "Unnamed Lot";
      
      const colorPicker = article.querySelector('.lot-color-picker');
      if (colorPicker) colorPicker.value = color;

      const hiddenCheck = article.querySelector('.is-hidden-check');
      if (hiddenCheck) hiddenCheck.checked = lotData.isHidden || false;
      
      const easementCheck = article.querySelector('.is-easement-check');
      if (easementCheck) easementCheck.checked = lotData.isEasement || false;

      const tbody = article.querySelector('tbody');
      if (tbody) tbody.innerHTML = "";

      if (Array.isArray(lotData.rows)) {
          lotData.rows.forEach(r => {
              const rowClone = rowTemplate.content.cloneNode(true);
              const tr = rowClone.querySelector('tr');
              
              tr.dataset.dx = r.dx || '0'; 
              tr.dataset.dy = r.dy || '0'; 
              tr.dataset.trot = r.tRot || ''; 
              tr.dataset.tsize = r.tSize || ''; 
              tr.dataset.techDesc = r.techDesc || '';

              const cells = tr.querySelectorAll('td');
              if (cells.length >= 8) {
                  const checkbox = cells[0].querySelector("input");
                  if (checkbox) checkbox.checked = r.checked ?? true;
                  
                  cells[1].innerText = r.line || "";
                  cells[2].innerText = r.ns || "";
                  cells[3].innerText = r.deg || "";
                  cells[4].innerText = r.min || "";
                  cells[5].innerText = r.sec || "00";
                  cells[6].innerText = r.ew || "";
                  cells[7].innerText = r.dist || "";
              }
              tbody.appendChild(tr); 
              if (typeof updateCommand === 'function') updateCommand(tr);
          });
      }
      container.appendChild(article);
  });
  
  WorkspaceState.needsAutoFit = true; 
  if (typeof handleInputChange === 'function') handleInputChange(); 
};
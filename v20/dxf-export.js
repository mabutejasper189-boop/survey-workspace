// dxf-export.js - Ultra-Stable "Entities-Only" Universal DXF Format

function getCadColor(hex) {
  const colorMap = {
    '#2563eb': 5,  '#16a34a': 3,  '#d97706': 42, '#9333ea': 200, 
    '#db2777': 1,  '#0891b2': 4,  '#ea580c': 30
  };
  return colorMap[(hex || '').toLowerCase()] || 7;
}

function makeDxfText(val, x, y, ht, layer, ang = 0, align = 'C', color = 256) {
  const cleanVal = String(val).replace(/[\r\n]+/g, ' ').trim();
  let t = `0\nTEXT\n8\n${layer}\n62\n${color}\n10\n${x.toFixed(6)}\n20\n${y.toFixed(6)}\n30\n0.0\n40\n${ht.toFixed(4)}\n1\n${cleanVal}\n50\n${ang.toFixed(6)}\n`;
  if (align === 'C') { 
    t += `72\n1\n73\n2\n11\n${x.toFixed(6)}\n21\n${y.toFixed(6)}\n31\n0.0\n`;
  } else if (align === 'L') { 
    t += `72\n0\n73\n0\n`;
  } else if (align === 'R') { 
    t += `72\n2\n73\n0\n11\n${x.toFixed(6)}\n21\n${y.toFixed(6)}\n31\n0.0\n`;
  }
  return t;
}

function makeDxfPolyline(points, layer, color = 256, isClosed = true) {
  if (!points || points.length < 2) return "";
  let p = "";
  for (let i = 0; i < points.length - 1; i++) {
    p += makeDxfLine(points[i], points[i+1], layer, color);
  }
  if (isClosed && points.length > 2) {
    let firstPt = points[0];
    let lastPt = points[points.length - 1];
    let dist = Math.hypot(lastPt.x - firstPt.x, lastPt.y - firstPt.y);
    if (dist > 0.001) {
        p += makeDxfLine(lastPt, firstPt, layer, color);
    }
  }
  return p;
}

function makeDxfLine(p1, p2, layer, color = 256) {
  return `0\nLINE\n8\n${layer}\n62\n${color}\n10\n${p1.x.toFixed(6)}\n20\n${p1.y.toFixed(6)}\n30\n0.0\n11\n${p2.x.toFixed(6)}\n21\n${p2.y.toFixed(6)}\n31\n0.0\n`;
}

function exportDXF() {
  const lotsData = getGroupedPointsData();
  const lotKeys = Object.keys(lotsData);
  let allPoints = [];
  
  lotKeys.forEach(id => { allPoints.push(...lotsData[id].points); });

  // NEW: I-apil ang custom lines sa DXF bounds
  if (WorkspaceState.customLines) {
      WorkspaceState.customLines.forEach(line => {
          allPoints.push(line.p1, line.p2);
      });
  }
  if (WorkspaceState.customTexts) {
      WorkspaceState.customTexts.forEach(txt => {
          allPoints.push({ x: txt.mapX, y: txt.mapY });
      });
  }

  if (allPoints.length === 0) { 
    showToast("No drawing data to export."); 
    return; 
  }

  let minX = Math.min(...allPoints.map(p => p.x)); 
  let maxX = Math.max(...allPoints.map(p => p.x));
  let minY = Math.min(...allPoints.map(p => p.y)); 
  let maxY = Math.max(...allPoints.map(p => p.y));
  
  let w = maxX - minX || 10; 
  let h = maxY - minY || 10; 
  let scale = Math.max(w, h) * 0.015; 

  let dxf = "0\nSECTION\n2\nENTITIES\n";

  let drawnPoints = new Set();
  let drawnSegments = new Set();

  lotKeys.forEach(lotId => {
    const lot = lotsData[lotId];
    if (lot.points.length < 2) return;

    let cadColor = getCadColor(lot.color);
    let isTieLine = lot.points.length > 0 && /BLLM|BLMM|BBM/i.test(lot.points[0].label);
    let startIndex = isTieLine ? 1 : 0;
    
    if (isTieLine && lot.points.length > 1) {
      dxf += makeDxfLine(lot.points[0], lot.points[1], 'TIE_LINE', 256); 
    }

    let lastIdx = lot.points.length;
    let firstPt = lot.points[startIndex];
    let endPt = lot.points[lot.points.length - 1];
    let closePolygon = Math.hypot(endPt.x - firstPt.x, endPt.y - firstPt.y) < 0.001;
    if (closePolygon) lastIdx = lot.points.length - 1; 

    let boundaryPoints = lot.points.slice(startIndex, lastIdx);
    if (boundaryPoints.length > 1) {
      dxf += makeDxfPolyline(boundaryPoints, 'PROPERTY_LINE', cadColor, closePolygon);
    }

    for (let i = startIndex; i < lastIdx; i++) {
      let p = lot.points[i];
      let pKey = `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`; 
      
      if (!drawnPoints.has(pKey)) {
          dxf += `0\nCIRCLE\n8\nBOUNDARY_POINTS\n62\n256\n10\n${p.x.toFixed(6)}\n20\n${p.y.toFixed(6)}\n30\n0.0\n40\n${(scale * 0.8).toFixed(4)}\n`;
          
          let vx = p.x - lot.centerX;
          let vy = p.y - lot.centerY;
          let vlen = Math.hypot(vx, vy) || 1;
          
          let offsetX = (vx / vlen) * (scale * 2.2);
          let offsetY = (vy / vlen) * (scale * 2.2);
          
          dxf += makeDxfText(p.label, p.x + offsetX, p.y + offsetY, scale * 1.5, 'BOUNDARY_POINTS', 0, 'C');
          drawnPoints.add(pKey);
      }
    }

    let cx = lot.centerX + lot.titleDx;
    let cy = lot.centerY + lot.titleDy;
    dxf += makeDxfText(lot.displayName, cx, cy, scale * 1.8, 'TEXT_TECH_DESC', 0, 'C', cadColor);
    if (lot.area) {
      dxf += makeDxfText(`A = ${lot.area.toFixed(2)} sq.m.`, cx, cy - (scale * 2.5), scale * 1.2, 'TEXT_TECH_DESC', 0, 'C');
    }

    for (let i = 1; i < lot.points.length; i++) {
      let seg = lot.segments[i - 1];
      let sKey = `${Math.round(seg.midX * 10)},${Math.round(seg.midY * 10)}`;
      
      if (!drawnSegments.has(sKey)) {
          let tX = seg.midX + seg.dxOffset;
          let tY = seg.midY + seg.dyOffset;

          let angleDeg = seg.angleRad * (180 / Math.PI);
          while (angleDeg <= -180) angleDeg += 360;
          while (angleDeg > 180) angleDeg -= 360;
          if (angleDeg > 90) angleDeg -= 180;
          if (angleDeg < -90) angleDeg += 180;
          
          angleDeg += (seg.tRot || 0);

          let radAngle = angleDeg * (Math.PI / 180);
          let perpX = -Math.sin(radAngle) * scale * 1.4; 
          let perpY = Math.cos(radAngle) * scale * 1.4;

          let safeBearing = seg.bearing.replace(/°/g, '%%d');

          dxf += makeDxfText(safeBearing, tX - perpX, tY + perpY, scale * 1.4, 'TEXT_TECH_DESC', angleDeg, 'C');
          dxf += makeDxfText(`${seg.dist}m`, tX + perpX, tY - perpY, scale * 1.4, 'TEXT_TECH_DESC', angleDeg, 'C');
          
          drawnSegments.add(sKey);
      }
    }
  });

  // NEW: EXPORT CUSTOM SKETCH ANNOTATIONS TO DXF
  if (WorkspaceState.customLines && WorkspaceState.customLines.length > 0) {
      WorkspaceState.customLines.forEach(line => {
         dxf += makeDxfLine(line.p1, line.p2, 'CUSTOM_SKETCH', 8); // 8 is light grey in CAD
      });
  }
  if (WorkspaceState.customTexts && WorkspaceState.customTexts.length > 0) {
      WorkspaceState.customTexts.forEach(txt => {
         dxf += makeDxfText(txt.text, txt.mapX, txt.mapY, scale * 1.2, 'CUSTOM_SKETCH', 0, 'C', 256);
      });
  }

  let col1 = scale * 12; 
  let col2 = scale * 22; 
  let col3 = scale * 16; 
  let tW = col1 + col2 + col3; 
  let rowH = scale * 3.0; 
  let tTxtH = scale * 1.2; 

  let tX = minX - tW - (scale * 15); 
  let cy = maxY; 

  const drawHLine = () => { dxf += makeDxfLine({x: tX, y: cy}, {x: tX + tW, y: cy}, 'TITLE_BLOCK', 256); };

  const drawFullRow = (txt1, txt2, height, color = 3) => {
    dxf += makeDxfLine({x: tX, y: cy}, {x: tX, y: cy - height}, 'TITLE_BLOCK', 256);
    dxf += makeDxfLine({x: tX + tW, y: cy}, {x: tX + tW, y: cy - height}, 'TITLE_BLOCK', 256);
    
    if (txt2) {
      dxf += makeDxfText(txt1, tX + (tW / 2), cy - (height * 0.35), tTxtH, 'TEXT_TECH_DESC', 0, 'C', color);
      dxf += makeDxfText(txt2, tX + (tW / 2), cy - (height * 0.75), tTxtH, 'TEXT_TECH_DESC', 0, 'C', color);
    } else {
      dxf += makeDxfText(txt1, tX + (tW / 2), cy - (height / 2), tTxtH * 1.3, 'TEXT_TECH_DESC', 0, 'C', color);
    }
    cy -= height;
  };

  const drawDataRow = (c1, c2, c3, color = 3) => {
    let mid = cy - (rowH / 2);
    dxf += makeDxfText(c1, tX + (col1 / 2), mid, tTxtH, 'TEXT_TECH_DESC', 0, 'C', color);
    dxf += makeDxfText(c2, tX + col1 + (col2 / 2), mid, tTxtH, 'TEXT_TECH_DESC', 0, 'C', color);
    dxf += makeDxfText(c3, tX + col1 + col2 + (col3 / 2), mid, tTxtH, 'TEXT_TECH_DESC', 0, 'C', color);
    
    dxf += makeDxfLine({x: tX, y: cy}, {x: tX, y: cy - rowH}, 'TITLE_BLOCK', 256);
    dxf += makeDxfLine({x: tX + col1, y: cy}, {x: tX + col1, y: cy - rowH}, 'TITLE_BLOCK', 256);
    dxf += makeDxfLine({x: tX + col1 + col2, y: cy}, {x: tX + col1 + col2, y: cy - rowH}, 'TITLE_BLOCK', 256);
    dxf += makeDxfLine({x: tX + tW, y: cy}, {x: tX + tW, y: cy - rowH}, 'TITLE_BLOCK', 256);
    cy -= rowH;
  };

  drawHLine();
  drawFullRow("TECHNICAL DESCRIPTIONS", null, rowH, 3); 
  drawHLine();

  lotKeys.forEach(lotId => {
    const lot = lotsData[lotId];
    if (lot.rawData.length === 0) return;

    let isTieLine = lot.points.length > 0 && /BLLM|BLMM|BBM/i.test(lot.points[0].label);
    let tieLineData = isTieLine ? lot.rawData[0] : null;
    let boundaryData = isTieLine ? lot.rawData.slice(1) : lot.rawData;

    let areaStr = lot.area.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    drawFullRow(lot.displayName.toUpperCase(), `AREA = ${areaStr} SQ.M.`, rowH * 1.8, 3);
    drawHLine();
    
    drawDataRow("LINE", "BEARING", "DISTANCE", 3);
    drawHLine();
    
    boundaryData.forEach(row => {
       drawDataRow(row.line, row.bearing.replace(/°/g, '%%d'), row.dist + " m.", 3);
    });
    drawHLine();
    
    if (tieLineData && lot.points.length > 1) {
       let bllmName = lot.points[0].label;
       let targetCorner = lot.points[1].label; 
       drawFullRow(`TIE LINE from ${bllmName}`, `to corner "${targetCorner}"`, rowH * 1.5, 3);
       drawHLine();
       drawDataRow("LINE", "BEARING", "DISTANCE", 3);
       drawHLine();
       drawDataRow("TIE", tieLineData.bearing.replace(/°/g, '%%d'), tieLineData.dist + " m.", 3);
       drawHLine();
    }
  });

  let tbX = maxX + (w * 0.15);
  let tbY = minY;
  let tbW = Math.max(w * 0.5, scale * 30);
  let tbH = Math.max(h * 0.8, scale * 50);

  dxf += makeDxfPolyline([
    {x: tbX, y: tbY}, {x: tbX + tbW, y: tbY}, 
    {x: tbX + tbW, y: tbY + tbH}, {x: tbX, y: tbY + tbH}
  ], 'TITLE_BLOCK', 256, true);

  const owner = document.getElementById("lotOwner")?.value || "N/A";
  const projectNum = document.getElementById("lotNumber")?.value || "Export";
  const location = document.getElementById("lotLocation")?.value || "N/A";
  const drawnBy = document.getElementById("pdfDrawnBy")?.value || "Jasper Mabute";
  
  let txtH = tbH * 0.025;
  let cursorY = tbY + tbH - (txtH * 3);

  const drawTBText = (label, value) => {
    dxf += makeDxfText(label, tbX + (tbW * 0.05), cursorY, txtH * 0.8, 'TITLE_BLOCK', 0, 'L', 8); 
    cursorY -= (txtH * 1.5);
    dxf += makeDxfText(value, tbX + (tbW * 0.05), cursorY, txtH * 1.2, 'TITLE_BLOCK', 0, 'L', 256);
    cursorY -= (txtH * 3);
  };

  drawTBText("PROJECT:", projectNum);
  drawTBText("LOCATION:", location);
  drawTBText("OWNER:", owner);
  drawTBText("DRAWN BY:", drawnBy);
  drawTBText("DATE:", new Date().toLocaleDateString('en-US'));

  let naX = tbX + (tbW * 0.85);
  let naY = tbY + tbH - (tbH * 0.1);
  let naSize = tbW * 0.08;

  dxf += makeDxfLine({x: naX, y: naY - naSize}, {x: naX, y: naY + naSize}, 'NORTH_ARROW'); 
  dxf += makeDxfLine({x: naX, y: naY + naSize}, {x: naX - (naSize * 0.4), y: naY + (naSize * 0.2)}, 'NORTH_ARROW'); 
  dxf += makeDxfLine({x: naX, y: naY + naSize}, {x: naX + (naSize * 0.4), y: naY + (naSize * 0.2)}, 'NORTH_ARROW'); 
  dxf += makeDxfText("N", naX, naY + naSize * 1.4, txtH * 1.5, 'NORTH_ARROW', 0, 'C');

  dxf += "0\nENDSEC\n";
  dxf += "0\nEOF\n";

  const blob = new Blob([dxf], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  
  const safeProjectNum = typeof sanitize === 'function' ? sanitize(projectNum) : (projectNum || "");
  a.download = `Lot_Plan_${safeProjectNum.replace(/[^a-z0-9]/gi, '_')}.dxf`;
  
  document.body.appendChild(a); 
  a.click(); 
  document.body.removeChild(a);
  
  setTimeout(() => { URL.revokeObjectURL(url); }, 1500);
  
  showToast("CAD Format Exported Successfully!");
}
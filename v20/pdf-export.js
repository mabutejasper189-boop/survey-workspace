// pdf-export.js - Professional PDF Generation using jsPDF

function generatePDF(action = 'download') {
  if (WorkspaceState.pdfUrl) {
    URL.revokeObjectURL(WorkspaceState.pdfUrl);
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
      if (action !== 'preview') showToast("PDF engine unavailable. Check network.");
      return;
  }

  const { jsPDF } = window.jspdf;
  const paperSize = document.getElementById("pdfPaperSize")?.value || 'a4'; 
  const orientation = document.getElementById("pdfOrientation")?.value || 'portrait';
  const scaleMethod = document.getElementById("pdfScale")?.value || 'auto'; 
  const includeTable = document.getElementById("pdfIncludeTable")?.value || 'yes';
  
  const doc = new jsPDF({ orientation: orientation, unit: 'mm', format: paperSize });
  const pw = doc.internal.pageSize.getWidth(); 
  const ph = doc.internal.pageSize.getHeight();
  const m = 10; 
  const titleBlockW = 45; 
  
  doc.setDrawColor(0); doc.setLineWidth(0.6); doc.rect(m, m, pw - (m*2), ph - (m*2));
  const mapW = pw - (m*2) - titleBlockW; 
  const mapH = ph - (m*2); 
  doc.setLineWidth(0.3); doc.line(pw - m - titleBlockW, m, pw - m - titleBlockW, ph - m);

  const lotsData = getGroupedPointsData(); 
  const lotKeys = Object.keys(lotsData);
  let allPoints = [];
  
  lotKeys.forEach(id => {
     allPoints.push(...lotsData[id].points);
  });

  // NEW: I-apil ang custom lines ug texts sa bounding box para dili ma-crop sa PDF
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

  if (allPoints.length === 0 || lotKeys.length === 0) { 
    if (action === 'preview') document.getElementById('pdfPreviewFrame').src = ''; 
    else showToast("No active data to export."); 
    return; 
  }

  let minX = Math.min(...allPoints.map(p => p.x)); 
  let maxX = Math.max(...allPoints.map(p => p.x));
  let minY = Math.min(...allPoints.map(p => p.y)); 
  let maxY = Math.max(...allPoints.map(p => p.y));
  let realW = maxX - minX; 
  let realH = maxY - minY; 
  let drawMapW = mapW; 
  let mapOffsetX = m; 
  let tableW = 0;

  if (includeTable === 'yes') { 
    tableW = 75; 
    drawMapW = mapW - tableW; 
    mapOffsetX = m + tableW; 
    doc.setLineWidth(0.3); 
    doc.line(mapOffsetX, m, mapOffsetX, ph - m); 
  }

  let scaleFactor = 1; 
  if (scaleMethod === "auto") { 
    const sx = (drawMapW - 20) / (realW || 1); 
    const sy = (mapH - 20) / (realH || 1); 
    scaleFactor = Math.min(sx, sy); 
  } else { 
    scaleFactor = 1000 / parseInt(scaleMethod); 
  }

  const midX = (minX + maxX) / 2; 
  const midY = (minY + maxY) / 2;
  const pdfX = (x) => mapOffsetX + (drawMapW / 2) + ((x - midX) * scaleFactor); 
  const pdfY = (y) => m + (mapH / 2) - ((y - midY) * scaleFactor);

  let drawnNodes = new Set(); 
  let drawnSegments = new Set(); 

  // Draw Lines & Polygons
  lotKeys.forEach(lotId => {
    let lot = lotsData[lotId]; 
    let tieLineDetected = lot.points.length > 0 && /BLLM|BLMM|BBM/i.test(lot.points[0].label);
    
    if (tieLineDetected && lot.points.length > 1) { 
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.13); doc.setLineDash([2, 2], 0); 
      doc.line(pdfX(lot.points[0].x), pdfY(lot.points[0].y), pdfX(lot.points[1].x), pdfY(lot.points[1].y)); 
      doc.setLineDash([], 0); 
    }
    if(lot.points.length > (tieLineDetected ? 2 : 1)) {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.6); 
      let startIndex = tieLineDetected ? 1 : 0;
      for(let i = startIndex + 1; i < lot.points.length; i++) { 
        doc.line(pdfX(lot.points[i-1].x), pdfY(lot.points[i-1].y), pdfX(lot.points[i].x), pdfY(lot.points[i].y)); 
      }
      let endPt = lot.points[lot.points.length - 1]; 
      let startPt = lot.points[startIndex];
      let dxClose = Math.abs(endPt.x - startPt.x); 
      let dyClose = Math.abs(endPt.y - startPt.y);
      if (dxClose > 0.15 || dyClose > 0.15) { 
        doc.setDrawColor(239, 68, 68); doc.setLineWidth(0.4); doc.setLineDash([1.5, 1.5], 0); 
        doc.line(pdfX(endPt.x), pdfY(endPt.y), pdfX(startPt.x), pdfY(startPt.y)); 
        doc.setLineDash([], 0); 
      }
    }
  });

  // Draw Points & Labels
  lotKeys.forEach(lotId => {
    let lot = lotsData[lotId];
    lot.points.forEach((p, index) => {
       let x = pdfX(p.x); let y = pdfY(p.y); 
       let nodeKey = `${Math.round(x*10)},${Math.round(y*10)}`; 
       if (!drawnNodes.has(nodeKey)) {
           doc.setFillColor(index === 0 ? 200 : 0, 0, 0); 
           doc.circle(x, y, index === 0 ? 1.0 : 0.6, 'F'); 
           doc.setFont("helvetica", "bold"); 
           doc.setFontSize(8);
           let cxLot = pdfX(lot.centerX); 
           let cyLot = pdfY(lot.centerY);
           let vx = x - cxLot; let vy = y - cyLot; 
           let vlen = Math.sqrt(vx*vx + vy*vy) || 1; 
           let radOff = 2.0; 
           doc.text(p.label, x + (vx/vlen)*radOff, y + (vy/vlen)*radOff, { align: 'center', baseline: 'middle' }); 
           drawnNodes.add(nodeKey);
       }
    });
  });

  // Draw Text Annotations
  lotKeys.forEach(lotId => {
    let lot = lotsData[lotId]; 
    doc.setTextColor(0, 0, 0);

    lot.segments.forEach((seg) => {
       let sKey = `${Math.round(seg.midX * 10)},${Math.round(seg.midY * 10)}`;
       
       if (!drawnSegments.has(sKey)) {
           let px = pdfX(seg.midX + seg.dxOffset); 
           let py = pdfY(seg.midY + seg.dyOffset); 
           
           let screenAngle = -seg.angleRad;
           while (screenAngle <= -Math.PI) screenAngle += 2 * Math.PI;
           while (screenAngle > Math.PI) screenAngle -= 2 * Math.PI;
           if (screenAngle > Math.PI / 2) screenAngle -= Math.PI;
           if (screenAngle < -Math.PI / 2) screenAngle += Math.PI;
           
           let angleDeg = screenAngle * (180 / Math.PI);
           angleDeg += (seg.tRot || 0);

           let fontSize = seg.tSize > 0 ? seg.tSize : 8;

           let rad = angleDeg * (Math.PI / 180);
           let s = Math.sin(rad); 
           let c = Math.cos(rad);
           let offset = 2.0;

           let perpX = s * offset;
           let perpY = -c * offset;

           doc.setFont("helvetica", "normal");
           doc.setFontSize(fontSize * 0.85);
           doc.text(seg.bearing, px + perpX, py + perpY, { angle: -angleDeg, align: 'center', baseline: 'middle' });
           
           doc.setFont("helvetica", "bold"); 
           doc.setFontSize(fontSize);
           doc.text(seg.dist + 'm', px - perpX, py - perpY, { angle: -angleDeg, align: 'center', baseline: 'middle' });
           
           drawnSegments.add(sKey);
       }
    });

    let cxLot = pdfX(lot.centerX + lot.titleDx); 
    let cyLot = pdfY(lot.centerY + lot.titleDy);
    
    let areaStr = `A = ${lot.area.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} sq.m.`;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); 
    let nameW = doc.getTextWidth(lot.displayName); 
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); 
    let areaW = doc.getTextWidth(areaStr);
    let boxW = Math.max(nameW, areaW) + 4; 
    
    doc.setFillColor(255, 255, 255); 
    doc.rect(cxLot - boxW/2, cyLot - 5, boxW, 10, 'F'); 
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0, 0, 0); 
    doc.text(lot.displayName, cxLot, cyLot - 1.5, { align: 'center', baseline: 'middle' });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); 
    doc.text(areaStr, cxLot, cyLot + 2.5, { align: 'center', baseline: 'middle' });
  });

  // NEW: Draw Custom Lines on PDF
  if (WorkspaceState.customLines && WorkspaceState.customLines.length > 0) {
      doc.setDrawColor(148, 163, 184); // Slate grey color
      doc.setLineWidth(0.3);
      WorkspaceState.customLines.forEach(line => {
         doc.line(pdfX(line.p1.x), pdfY(line.p1.y), pdfX(line.p2.x), pdfY(line.p2.y));
      });
  }

  // NEW: Draw Custom Texts on PDF
  if (WorkspaceState.customTexts && WorkspaceState.customTexts.length > 0) {
      doc.setTextColor(15, 23, 42); // Dark slate
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      WorkspaceState.customTexts.forEach(txt => {
         doc.text(txt.text, pdfX(txt.mapX), pdfY(txt.mapY), { align: 'center', baseline: 'middle' });
      });
  }

  // North Arrow Map
  doc.setDrawColor(0); doc.setFillColor(0); 
  const nx = mapOffsetX + drawMapW - 15; 
  const ny = m + 15; 
  doc.triangle(nx, ny-4, nx+2, ny+1, nx-2, ny+1, 'F'); 
  doc.line(nx, ny+1, nx, ny+6); 
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); 
  doc.text('N', nx-1.5, ny-5);

  // Technical Description Table
  if (includeTable === 'yes') {
    let tableData = [];
    lotKeys.forEach(id => { 
      const lot = lotsData[id];
      tableData.push([{content: lot.displayName, colSpan: 3, styles: {halign: 'center', fillColor: [220,220,220], fontStyle: 'bold'}}]); 
      
      let isTieLine = lot.points.length > 0 && /BLLM|BLMM|BBM/i.test(lot.points[0].label);
      
      if (isTieLine && lot.rawData.length > 0) {
          let tieData = lot.rawData[0];
          tableData.push([{content: `TIE LINE from ${lot.points[0].label}`, colSpan: 3, styles: {halign: 'center', fillColor: [245,245,245], fontStyle: 'italic', fontSize: 6}}]);
          tableData.push([tieData.line, tieData.bearing, tieData.dist]);
          
          if (lot.rawData.length > 1) {
              tableData.push([{content: "BOUNDARY", colSpan: 3, styles: {halign: 'center', fillColor: [245,245,245], fontStyle: 'italic', fontSize: 6}}]);
              lot.rawData.slice(1).forEach(r => { tableData.push([r.line, r.bearing, r.dist]); });
          }
      } else {
          lot.rawData.forEach(r => { tableData.push([r.line, r.bearing, r.dist]); }); 
      }
    });

    if (tableData.length > 0) { 
      if (typeof doc.autoTable === 'function') {
        doc.autoTable({ 
          startY: m + 2, 
          margin: { left: m + 2, right: pw - mapOffsetX + 2, bottom: m + 5 },
          tableWidth: tableW - 4, 
          head: [['Line', 'Bearing', 'Dist (m)']], 
          body: tableData, 
          theme: 'plain', 
          styles: { fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1 }, 
          headStyles: { fillColor: [240,240,240], textColor: 0, fontStyle: 'bold', halign: 'center' }, 
          columnStyles: { 0: {halign: 'center'}, 1: {halign: 'center'}, 2: {halign: 'right'} },
          didDrawPage: function (data) {
            if (data.pageNumber > 1) {
              doc.setDrawColor(0);
              doc.setLineWidth(0.6);
              doc.rect(m, m, pw - (m*2), ph - (m*2));
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.text("Technical Description Continued...", m + 2, m - 2);
            }
          }
        }); 
      } else {
        console.warn("AutoTable plugin offline. Skipping PDF table generation.");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.text("Table generation unavailable (plugin offline).", mapOffsetX + 5, m + 15);
      }
    }
  }

  const tbX = pw - m - titleBlockW; 
  let currentY = m;
  const drawCell = (height, title, content, isBold = false) => {
      doc.setPage(1); 
      doc.setDrawColor(0); doc.setLineWidth(0.2); 
      doc.line(tbX, currentY + height, pw - m, currentY + height); 
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100); 
      doc.text(title, tbX + 2, currentY + 4);
      doc.setFont("helvetica", isBold ? "bold" : "normal"); doc.setFontSize(10); doc.setTextColor(0); 
      const safeContent = typeof sanitize === 'function' && typeof content === 'string' 
                          ? sanitize(content) : (content || "N/A");
      const splitContent = doc.splitTextToSize(safeContent, titleBlockW - 4); 
      doc.text(splitContent, tbX + 2, currentY + 9); 
      currentY += height;
  };

  const lotOwner = document.getElementById("lotOwner")?.value || "N/A"; 
  const lotNumber = document.getElementById("lotNumber")?.value || "N/A"; 
  const lotLocation = document.getElementById("lotLocation")?.value || "N/A";
  let scaleStr = scaleMethod === "auto" ? "As Shown" : `1:${scaleMethod}`; 
  const dateStr = new Date().toLocaleDateString('en-US');
  const drawnBy = document.getElementById("pdfDrawnBy")?.value || "Jasper Mabute"; 
  const drawnTitle = document.getElementById("pdfDrawnTitle")?.value || "Technical Designer";

  drawCell(25, "PROJECT TITLE:", lotNumber, true); 
  drawCell(25, "PROJECT LOCATION:", lotLocation, false); 
  drawCell(20, "OWNER:", lotOwner, true);

  const MAX_LOTS_DISPLAY = 8;
  const displayedLots = lotKeys.slice(0, MAX_LOTS_DISPLAY);
  const hiddenLotsCount = lotKeys.length - MAX_LOTS_DISPLAY;

  const areaHeight = 12 + (displayedLots.length * 6) + (hiddenLotsCount > 0 ? 6 : 0);
  doc.setLineWidth(0.2); doc.line(tbX, currentY + areaHeight, pw - m, currentY + areaHeight); 
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100); 
  doc.text("AREA SUMMARY:", tbX + 2, currentY + 5);
  doc.setFont("helvetica", "normal"); doc.setTextColor(0); 
  let aY = currentY + 10;
  
  displayedLots.forEach(id => {
      let areaStr = `${lotsData[id].area.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} sq.m.`;
      let displayName = lotsData[id].displayName;
      if (displayName.length > 20) displayName = displayName.substring(0, 18) + "...";
      
      doc.text(`${displayName}:`, tbX + 2, aY); 
      doc.text(areaStr, pw - m - 2, aY, { align: 'right' }); 
      aY += 6;
  }); 

  if (hiddenLotsCount > 0) {
      doc.setFont("helvetica", "italic"); doc.setTextColor(100);
      doc.text(`... and ${hiddenLotsCount} more lot(s)`, tbX + 2, aY);
  }
  
  currentY += areaHeight;

  drawCell(15, "SCALE:", scaleStr, false); 
  drawCell(15, "DATE:", dateStr, false);
  drawCell(20, "DRAWN BY:", `${drawnBy}\n${drawnTitle}`, true); 
  
  const sheetCellH = (ph - m) - currentY; 
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100); 
  doc.text("SHEET NUMBER:", tbX + 2, currentY + 5); 
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(0); 
  doc.text("A-1", tbX + (titleBlockW/2), currentY + (sheetCellH/2) + 5, { align: "center", baseline: "middle" });

  if (action === 'preview') {
      try { 
        const pdfBlob = doc.output('blob'); 
        WorkspaceState.pdfUrl = URL.createObjectURL(pdfBlob); 
        document.getElementById('pdfPreviewFrame').src = WorkspaceState.pdfUrl; 
      } catch (e) { 
        document.getElementById('pdfPreviewFrame').src = doc.output('datauristring'); 
      }
  } else { 
    const safeNum = typeof sanitize === 'function' ? sanitize(lotNumber) : lotNumber;
    doc.save(`Lot_Plan_${safeNum !== "N/A" ? safeNum.replace(/[^a-z0-9]/gi, '_') : "Export"}.pdf`); 
    showToast("PDF Exported Successfully!"); 
  }
}
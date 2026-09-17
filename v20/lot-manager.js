// lot-manager.js - Table & UI Controls for Lots and Rows

function getLotLabel(index) {
  let label = ""; let temp = index;
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label;
    temp = Math.floor(temp / 26) - 1;
  }
  return "Lot " + label;
}

function addNewLot() {
  const container = document.getElementById("workspaceContainer");
  const lotCount = document.querySelectorAll('.lot-card').length;
  const newLotName = getLotLabel(lotCount); 
  const defaultColor = WorkspaceState.lotColors[lotCount % WorkspaceState.lotColors.length];
  
  const template = document.getElementById("lotTemplate");
  if (!template) return;
  const clone = template.content.cloneNode(true);
  const article = clone.querySelector('.lot-card');
  
  article.dataset.titleDx = "0"; article.dataset.titleDy = "0";
  article.querySelector('h3').innerText = newLotName;
  article.querySelector('.lot-color-picker').value = defaultColor;

  const tbody = article.querySelector('tbody');
  const rowTemplate = document.getElementById("rowTemplate");
  if (rowTemplate) {
     const rowClone = rowTemplate.content.cloneNode(true);
     const tr = rowClone.querySelector('tr');
     const cells = tr.querySelectorAll('td');
     cells[1].innerText = "BLLM-1"; cells[2].innerText = "N"; cells[5].innerText = "00";
     tbody.appendChild(tr);
     updateCommand(tr);
  }

  container.appendChild(article); 
  if (typeof handleInputChange === 'function') handleInputChange();
}

function addRowToLot(btn) {
  const tbody = btn.closest('.lot-card').querySelector('tbody'); 
  const template = document.getElementById("rowTemplate");
  if (template) {
    const clone = template.content.cloneNode(true);
    const tr = clone.querySelector('tr');
    tbody.appendChild(tr);
    if (typeof handleInputChange === 'function') handleInputChange();
    const inputs = tr.querySelectorAll('td[contenteditable="true"]');
    if(inputs.length > 0) inputs[0].focus();
  }
}

function deleteRow(btn) {
  const tbody = btn.closest('tbody'); 
  const row = btn.closest('tr');
  if (tbody.querySelectorAll('tr').length > 1) { 
    row.remove(); 
    if (typeof handleInputChange === 'function') handleInputChange(); 
  } else { 
    row.querySelectorAll('td[contenteditable="true"]').forEach((cell, idx) => { cell.innerText = idx === 4 ? "00" : ""; });
    row.dataset.techDesc = "";
    updateCommand(row);
    if (typeof handleInputChange === 'function') handleInputChange(); 
    if (typeof showToast === 'function') showToast("Lot reset to a single blank line."); 
  }
}

function deleteLot(btn) {
  if (confirm("Are you sure you want to delete this lot?")) { 
    btn.closest('.lot-card').remove(); 
    if (typeof handleInputChange === 'function') handleInputChange(); 
  }
}

function toggleLot(btn) {
  const card = btn.closest('.lot-card'); 
  const table = card.querySelector('.table-container'); 
  const footer = card.querySelector('.lot-footer');
  if (table.style.display === 'none') { 
    table.style.display = 'block'; footer.style.display = 'flex'; btn.innerText = '▼'; btn.title = "Collapse Lot"; 
  } else { 
    table.style.display = 'none'; footer.style.display = 'none'; btn.innerText = '▶'; btn.title = "Expand Lot"; 
  }
}

function updateCommand(row) {
  const cells = row.cells;
  if (cells.length >= 9) { 
    for(let i=1; i<=7; i++) { if(cells[i]) cells[i].classList.remove('cell-error'); }
    
    const nsStr = cells[2].innerText.trim().toUpperCase(); 
    const degStr = cells[3].innerText.trim();
    const minStr = cells[4].innerText.trim(); 
    const secStr = cells[5].innerText.trim() || "00";
    const ewStr = cells[6].innerText.trim().toUpperCase(); 
    let distRaw = cells[7].innerText.trim().replace(/,/g, ''); 
    
    let degNum = parseFloat(degStr); 
    let minNum = parseFloat(minStr);
    let secNum = parseFloat(secStr); 
    let distNum = parseFloat(distRaw); 
    let hasError = false;
    const commandCell = row.querySelector('.command-output');
    
    const isDegInvalid = isNaN(degNum) || degNum < 0 || degNum > 90 || (degNum === 90 && ((minNum || 0) > 0 || (secNum || 0) > 0));

    if (nsStr !== "" && nsStr !== 'N' && nsStr !== 'S') { cells[2].classList.add('cell-error'); hasError = true; }
    if (ewStr !== "" && ewStr !== 'E' && ewStr !== 'W') { cells[6].classList.add('cell-error'); hasError = true; }
    if (degStr !== "" && isDegInvalid) { cells[3].classList.add('cell-error'); hasError = true; }
    if (minStr !== "" && (isNaN(minNum) || minNum < 0 || minNum >= 60)) { cells[4].classList.add('cell-error'); hasError = true; }
    if (secStr !== "" && (isNaN(secNum) || secNum < 0 || secNum >= 60)) { cells[5].classList.add('cell-error'); hasError = true; }
    if (distRaw !== "" && (isNaN(distNum) || distNum <= 0)) { cells[7].classList.add('cell-error'); hasError = true; }

    if (!hasError && nsStr && degStr !== "" && minStr !== "" && ewStr && distRaw !== "") {
      commandCell.innerText = `@${distNum}<${nsStr}${degNum}d${minNum}'${secStr}"${ewStr}`;
      let secText = (secStr !== "00" && secStr !== "0") ? `${secStr}" ` : ""; 
      row.dataset.techDesc = `${nsStr} ${degNum}° ${minNum}' ${secText}${ewStr}, ${distRaw} M.`;
    } else if (commandCell) { 
      commandCell.innerText = ""; 
      row.dataset.techDesc = "";
    }
  }
}

function updateTableUI() {
  document.querySelectorAll('.lot-card').forEach(card => {
    const h3 = card.querySelector('h3'); 
    const footerBtn = card.querySelector('.add-row-local'); 
    const colorPicker = card.querySelector('.lot-color-picker');
    if (h3 && colorPicker) { h3.style.color = colorPicker.value; } 
    if (footerBtn && h3) { footerBtn.innerText = `+ Add Row to ${h3.innerText.trim()}`; }
  });
}

function clearData() {
  if (confirm("Are you sure you want to clear all inputs and reset the workspace?")) {
    document.getElementById("workspaceContainer").innerHTML = "";
    document.getElementById("lotOwner").value = "";
    document.getElementById("lotNumber").value = "";
    document.getElementById("lotLocation").value = "";
    WorkspaceState.currentProjectId = null;
    WorkspaceState.customLines = [];
    WorkspaceState.customTexts = [];
    addNewLot(); 
    WorkspaceState.needsAutoFit = true; 
    if (typeof handleInputChange === 'function') handleInputChange(); 
    if (typeof showToast === 'function') showToast("Workspace cleared.");
  }
}

function copyCommand(cell) {
  const textToCopy = cell.innerText.trim();
  if (textToCopy !== "") {
    navigator.clipboard.writeText(textToCopy).then(() => showToast("Command copied!")).catch(err => showToast("Failed to copy. Check permissions."));
  }
}

function copyLotCommands(btn) {
  const card = btn.closest('.lot-card'); const commands = [];
  card.querySelectorAll('.command-output').forEach(cell => {
    const txt = cell.innerText.trim(); if (txt) commands.push(txt);
  });
  if (commands.length > 0) { 
    navigator.clipboard.writeText(commands.join(' ')).then(() => showToast("Bulk commands copied!")).catch(err => showToast("Failed to copy. Check permissions."));
  } else { showToast("No valid commands found."); }
}

function copyTechnicalDescription(btn) {
  const card = btn.closest('.lot-card'); const lines = [];
  card.querySelectorAll('tbody tr').forEach(row => {
    const isChecked = row.querySelector('.row-check').checked; 
    const techDesc = row.dataset.techDesc;
    if (isChecked && techDesc) { lines.push(`Line ${row.cells[1].innerText.trim()}: ${techDesc}`); }
  });
  if (lines.length > 0) { 
    navigator.clipboard.writeText(lines.join('\n')).then(() => showToast("Technical description copied!")).catch(err => showToast("Failed to copy. Check permissions."));
  } else { showToast("No valid data to copy."); }
}
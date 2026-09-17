// open.js - Custom .sw Format Import Logic with Error Handling

function importWorkspaceSW(event) {
  const file = event.target.files[0];
  if (!file) return;

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB Limit
  if (file.size > MAX_FILE_SIZE) {
      alert("File Too Large: Please select a .sw file under 5 MB.");
      event.target.value = "";
      return;
  }
  
  if (!file.name.endsWith('.sw')) {
      alert("Invalid Format: Please select a valid Survey Workspace (.sw) file.");
      event.target.value = ""; 
      return;
  }

  const reader = new FileReader();
  
  reader.onload = async function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      if (!importedData.metadata || importedData.metadata.fileType !== ".sw") {
          alert("File Error: The selected file is missing the Survey Workspace Pro signature.");
          return;
      }

      const projectData = importedData.project;
      
      if (!projectData || !Array.isArray(projectData.lots)) {
          alert("Data Error: The .sw file is corrupted or missing essential lot coordinates.");
          return;
      }
      
      // Utilize DRY helper
      if (typeof window.populateWorkspaceFromData === 'function') {
          WorkspaceState.currentProjectId = projectData.id || null;
          window.populateWorkspaceFromData(projectData);
      }
      
      // Isolate storage execution to prevent UI blocking
      try {
          if (typeof StorageManager !== 'undefined') {
             WorkspaceState.currentProjectId = await StorageManager.save(projectData);
             await renderLogs();
          }
      } catch (dbErr) {
          console.warn("Project loaded to workspace, but failed to save to logs:", dbErr);
      }
      
      showToast(".sw file loaded successfully!");
      
    } catch (err) {
      console.error("Import Error:", err);
      alert("Failed to load .sw file. The file data is corrupted or incompatible.\n\nDetails: " + err.message);
    }
  };
  
  reader.onerror = function() {
      alert("File Read Error: Could not read the file from your device.");
  };

  reader.readAsText(file);
  event.target.value = ""; 
}
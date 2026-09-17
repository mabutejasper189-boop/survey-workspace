// save-as.js - Custom .sw Format Export Logic (Refactored)

async function exportWorkspaceSW() {
  try {
    const projectData = serializeWorkspaceToJSON();
    
    if (projectData.lots.length === 0) {
        showToast("Warning: No lots found to save!");
        return;
    }

    const timestamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    // Create the SW structure with a verification signature
    const swPayload = {
      metadata: {
          app: "Survey Workspace Pro",
          version: "1.1", 
          fileType: ".sw",
          exportDate: new Date().toISOString()
      },
      project: { ...projectData, time: timestamp }
    };

    const blob = new Blob([JSON.stringify(swPayload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    
    const safeProjectNum = projectData.number.replace(/[^a-z0-9]/gi, '_');
    a.download = `${safeProjectNum}.sw`;
    a.click();
    
    // Fix: Extended timeout to guarantee browser captures blob
    setTimeout(() => { URL.revokeObjectURL(a.href); }, 1500);
    
    showToast("Project saved as .sw format!");
    
  } catch (error) {
    console.error("Export Error:", error);
    alert("System Error: Could not generate the .sw file.\n\nDetails: " + error.message);
  }
}
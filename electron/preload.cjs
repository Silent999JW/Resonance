const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  chooseDirectory: () => ipcRenderer.invoke('choose-directory'),
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan-directory', dirPath),
  getFileMetadataChunk: (filePath) => ipcRenderer.invoke('get-file-metadata-chunk', filePath),
  readFileAsArrayBuffer: (filePath) => ipcRenderer.invoke('read-file-as-array-buffer', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openPath: (dirPath) => ipcRenderer.invoke('open-path', dirPath),
  saveZipDialog: (defaultName) => ipcRenderer.invoke('save-zip-dialog', defaultName),
  writeFile: (filePath, arrayBuffer) => ipcRenderer.invoke('write-file', { filePath, arrayBuffer }),
});

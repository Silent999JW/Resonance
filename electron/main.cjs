const { app, BrowserWindow, ipcMain, dialog, protocol, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { Readable } = require('stream');

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.flac': return 'audio/flac';
    case '.ogg': case '.oga': return 'audio/ogg';
    case '.m4a': return 'audio/mp4';
    default: return 'audio/mpeg';
  }
}

// Register media:// custom protocol scheme
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, standard: true, corsEnabled: true, supportFetchAPI: true } }
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Resonance — Hi-Res Desktop Player",
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    }
  });

  // Remove menu bar for full immersive layout
  mainWindow.setMenuBarVisibility(false);

  // Load correct URL depending on whether in development mode
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock to prevent duplicate players
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Set up local file responder protocol
    protocol.handle('media', (request) => {
      try {
        const rawUrl = request.url;
        const parsedUrl = new URL(rawUrl);
        let fileRawPath = '';

        // Handle OPTIONS requests (CORS preflight) safely
        if (request.method === 'OPTIONS') {
          return new Response('', {
            status: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
              'Access-Control-Allow-Headers': '*',
              'Access-Control-Max-Age': '86400'
            }
          });
        }

        if (parsedUrl.searchParams.has('path')) {
          fileRawPath = parsedUrl.searchParams.get('path') || '';
        } else if (rawUrl.startsWith('media://local-file/')) {
          fileRawPath = decodeURIComponent(rawUrl.slice('media://local-file/'.length));
        } else {
          fileRawPath = decodeURIComponent(rawUrl.slice('media://'.length));
        }

        // Clean up trailing slash if any standard URL parser appended it
        if (fileRawPath.endsWith('/')) {
          if (!fs.existsSync(fileRawPath) && fs.existsSync(fileRawPath.slice(0, -1))) {
            fileRawPath = fileRawPath.slice(0, -1);
          }
        }

        // Normalize slashes
        fileRawPath = fileRawPath.replace(/\\/g, '/');

        // Clean up Windows and Linux absolute paths
        if (fileRawPath.startsWith('///')) {
          fileRawPath = fileRawPath.slice(3);
        } else if (fileRawPath.startsWith('//')) {
          fileRawPath = fileRawPath.slice(2);
        } else if (fileRawPath.startsWith('/')) {
          // On Windows, /C:/music.mp3 should become C:/music.mp3
          if (fileRawPath[2] === ':' || fileRawPath[1] === ':') {
            fileRawPath = fileRawPath.slice(1);
          }
        }

        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        };

        // Check if file exists
        if (!fs.existsSync(fileRawPath)) {
          console.error(`Media protocol file not found physically: "${fileRawPath}"`);
          return new Response('File not found: ' + fileRawPath, {
            status: 404,
            headers: corsHeaders
          });
        }

        const stats = fs.statSync(fileRawPath);
        const mimeType = getMimeType(fileRawPath);
        const rangeHeader = request.headers.get('range');

        if (!rangeHeader) {
          const nodeStream = fs.createReadStream(fileRawPath);
          const webStream = Readable.toWeb(nodeStream);
          return new Response(webStream, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': mimeType,
              'Content-Length': stats.size.toString(),
              'Accept-Ranges': 'bytes'
            }
          });
        }

        // Parse Range request header (e.g. bytes=0- or bytes=100-200)
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

        if (isNaN(start) || start >= stats.size || end >= stats.size || start > end) {
          return new Response('', {
            status: 416,
            headers: {
              ...corsHeaders,
              'Content-Range': `bytes */${stats.size}`
            }
          });
        }

        const chunksize = (end - start) + 1;
        const nodeStream = fs.createReadStream(fileRawPath, { start, end });
        const webStream = Readable.toWeb(nodeStream);

        return new Response(webStream, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Range': `bytes ${start}-${end}/${stats.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': mimeType
          }
        });
      } catch (err) {
        console.error('Failed to handle media request:', err);
        return new Response('File access error', {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC IPC IPC LOGIC ---

// 1. Choose Directory dialog
ipcMain.handle('choose-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Local Music Directory",
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 2. Scan Directory (recursively find tracks)
ipcMain.handle('scan-directory', async (event, dirPath) => {
  const fileList = [];
  const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.aac', '.m4a'];

  async function recursiveScan(currentDir) {
    try {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await recursiveScan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            try {
              const stats = await fs.promises.stat(fullPath);
              fileList.push({
                name: entry.name,
                path: fullPath,
                size: stats.size,
                mtime: stats.mtimeMs
              });
            } catch (statError) {
              console.warn(`Failed to stat file ${entry.name}:`, statError);
            }
          }
        }
      }
    } catch (readError) {
      console.error(`Failed to read directory ${currentDir}:`, readError);
    }
  }

  await recursiveScan(dirPath);
  return fileList;
});

// 3. Get audio metadata slice (loads first 4MB of native file for ID3 tag reading in parser)
ipcMain.handle('get-file-metadata-chunk', async (event, filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    const size = stats.size;
    const chunkLimit = Math.min(size, 4 * 1024 * 1024); // read up to 4MB max

    const fd = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(chunkLimit);
    try {
      await fd.read(buffer, 0, chunkLimit, 0);
    } finally {
      await fd.close();
    }

    return {
      name: path.basename(filePath),
      size: size,
      mtime: stats.mtimeMs,
      // Pass as standard UInt8Array to bypass context isolation
      buffer: new Uint8Array(buffer)
    };
  } catch (err) {
    console.error(`Failed to read metadata chunk for ${filePath}:`, err);
    throw err;
  }
});

// 4. Read entire file as ArrayBuffer (for full loading, editing, or packaging back into ZIP)
ipcMain.handle('read-file-as-array-buffer', async (event, filePath) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return new Uint8Array(buffer);
  } catch (err) {
    console.error(`Failed to read entire file ${filePath}:`, err);
    throw err;
  }
});

// 5. Open Explorer and highlight
ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to show item in folder:`, err);
    return false;
  }
});

// 6. Open a physical directory
ipcMain.handle('open-path', async (event, dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      await shell.openPath(dirPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to open directory:', err);
    return false;
  }
});

// 7. Save ZIP Native Dialog
ipcMain.handle('save-zip-dialog', async (event, defaultName) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Music Backup ZIP",
    defaultPath: defaultName,
    filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
  });
  if (result.canceled) return null;
  return result.filePath;
});

// 8. Native file write (for zipping and configuration saving)
ipcMain.handle('write-file', async (event, { filePath, arrayBuffer }) => {
  try {
    await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
    return true;
  } catch (err) {
    console.error(`Failed to write file at ${filePath}:`, err);
    throw err;
  }
});

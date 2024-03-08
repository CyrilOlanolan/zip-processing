/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import AdmZip from 'adm-zip';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as fs from 'fs';
import MenuBuilder from './menu';
import { extractFileNames, resolveHtmlPath } from './util';
import { DataFile } from '../renderer/FilesTable';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// FILE SELECTION
ipcMain.on('open-file-dialog', (event) => {
  dialog
    .showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
    })
    .then((result) => {
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];

        // Send the files array back to the renderer process
        event.reply('file-selected', filePath);
      }
    })
    .catch((err) => {
      console.error(err);
      event.reply('file-read-error', err.message);
    });
});

// DESTINATION SELECTION
ipcMain.on('open-destination-dialog', (event, zipPath) => {
  dialog
    .showOpenDialog({
      properties: ['openDirectory'],
    })
    .then((result) => {
      if (!result.canceled && result.filePaths.length > 0) {
        const destinationPath = result.filePaths[0];
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        const files = extractFileNames(zip, zipEntries);

        event.reply('destination-selected', destinationPath, files);
      }
    })
    .catch((err) => {
      console.error(err);
      event.reply('destination-read-error', err.message);
    });
});

// FILE PROCESSING
ipcMain.on('process-files', (event, ...args) => {
  // Get the arguments
  const files = args[0];
  const zipPath = args[1] as string;
  const destination = args[2];

  const zip = new AdmZip(zipPath); // Convert the zip file to an AdmZip object
  const tempZipPath = path.join(destination, '.temp'); // Temporary path to extract the files to (to be deleted after)
  zip.extractAllTo(tempZipPath, true);

  files.map((file: DataFile) => {
    const filePathArray = file.filePath.split('/'); // Split the file path into an array
    filePathArray.pop(); // Remove the file name from the path array
    const { fileName } = file; // Get the file name (renamed or not, it doesn't matter)
    const trueLocation = path.join(destination, path.join(...filePathArray)); // The location of the file, considering subdirectories

    // Create the temporary path if it doesn't exist
    if (!fs.existsSync(tempZipPath)) {
      fs.mkdirSync(tempZipPath, { recursive: true });
    }

    // Create the trueLocation if it doesn't exist
    if (!fs.existsSync(trueLocation)) {
      fs.mkdirSync(trueLocation, { recursive: true });
    }

    if (file.willCopy) {
      console.log(
        `Copying ${path.join(tempZipPath, file.filePath)} to ${path.join(
          trueLocation,
          fileName,
        )}`,
      );

      fs.promises
        .copyFile(
          path.join(tempZipPath, file.filePath),
          path.join(trueLocation, fileName),
        )
        .then(() => {
          file.isProcessed = true;
          event.reply('process-files', files);
        })
        .catch((err) => {
          console.log(err);
          event.reply('process-files-error', err);
        });
    }
  });

  // Delete the .temp directory
  fs.rm(tempZipPath, { recursive: true }, () => {});
  event.reply('process-files', files, true);
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      nodeIntegration: true, // <--- flag
      nodeIntegrationInWorker: true, // <---  for web workers
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);

import { app, BrowserWindow, shell, ipcMain, globalShortcut } from 'electron';
import path from 'node:path';
import { initDatabase } from './db';

// 设置应用名称和 Windows 通知来源标识
app.name = 'FlowDesk';
app.setAppUserModelId('FlowDesk');
import { registerAllIPC } from './ipc';
import { setMainWindowGetter } from './ipc/execution';
import { restoreSchedulers, destroyAllSchedulers } from './engine/scheduler';
import { restoreWatchers, destroyAllWatchers } from './engine/watcher';
import { restoreStartupWorkflows } from './engine/startup-runner';
import { createTray } from './tray';

// Chromium 内存优化
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    backgroundColor: '#0f1117',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  // 立即显示窗口（backgroundColor 深色防止闪白，HTML 内联开屏动画即时渲染）
  mainWindow.show();

  // 关闭时隐藏到托盘，不销毁窗口
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../renderer/index.html')
    );
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function registerWindowIPC(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);
  ipcMain.handle('window:toggle-devtools', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(async () => {
  initDatabase();
  registerAllIPC();
  registerWindowIPC();
  createWindow();
  setMainWindowGetter(() => mainWindow);
  createTray(() => mainWindow);

  // 恢复定时任务和文件监听
  await restoreSchedulers();
  await restoreWatchers();

  // 执行启动工作流
  await restoreStartupWorkflows();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // 关闭窗口不退出，保留在托盘运行
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  destroyAllSchedulers();
  destroyAllWatchers();
  globalShortcut.unregisterAll();
});

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

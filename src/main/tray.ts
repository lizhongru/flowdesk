import { Tray, Menu, nativeImage, BrowserWindow, Notification, app } from 'electron';
import path from 'node:path';
import { getAllWorkflows } from './db/workflow-repo';
import { executeWorkflow } from './engine/executor';
import { saveExecutionLog } from './db/execution-log-repo';

let tray: Tray | null = null;

function getIcon(): Electron.NativeImage {
  const iconPath = path.join(__dirname, '../../resources/icon.png');
  const image = nativeImage.createFromPath(iconPath);
  return image.resize({ width: 16, height: 16 });
}

function buildContextMenu(getMainWindow: () => BrowserWindow | null): Electron.Menu {
  const workflows = getAllWorkflows().filter(w => w.enabled);

  const workflowSubmenu: Electron.MenuItemConstructorOptions[] = workflows.length > 0
    ? workflows.map(w => ({
        label: w.name,
        click: async () => {
          const win = getMainWindow();
          try {
            const log = await executeWorkflow(w, {}, win);
            saveExecutionLog(log);
            if (w.notifyOnComplete && Notification.isSupported()) {
              const statusText = log.status === 'success' ? '执行完成' : log.status === 'failed' ? '执行失败' : '已取消';
              new Notification({ title: `工作流${statusText}`, body: w.name }).show();
            }
          } catch (err: any) {
            new Notification({ title: '执行失败', body: err.message }).show();
          }
        },
      }))
    : [{ label: '暂无工作流', enabled: false }];

  return Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    {
      label: '隐藏窗口',
      click: () => {
        getMainWindow()?.hide();
      },
    },
    { type: 'separator' },
    {
      label: '快捷运行',
      submenu: workflowSubmenu,
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);
}

export function createTray(getMainWindow: () => BrowserWindow | null): void {
  tray = new Tray(getIcon());
  tray.setToolTip('FlowDesk');
  tray.setContextMenu(buildContextMenu(getMainWindow));

  // 双击显示/隐藏窗口
  tray.on('double-click', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
}

export function refreshTrayMenu(getMainWindow: () => BrowserWindow | null): void {
  if (tray) {
    tray.setContextMenu(buildContextMenu(getMainWindow));
  }
}

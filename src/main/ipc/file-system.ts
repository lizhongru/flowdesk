import { ipcMain, dialog, shell } from 'electron';
import fs from 'fs-extra';

export function registerFileSystemIPC(): void {
  ipcMain.handle('file:open-dialog', async (_event, options: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return options.properties?.includes('multiSelections')
      ? result.filePaths
      : result.filePaths[0];
  });

  ipcMain.handle('file:save-dialog', async (_event, options: Electron.SaveDialogOptions) => {
    const result = await dialog.showSaveDialog(options);
    return result.canceled ? null : result.filePath || null;
  });

  ipcMain.handle('file:read-json', async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  });

  ipcMain.handle('file:write-json', async (_event, filePath: string, data: unknown) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  });

  ipcMain.handle('file:open-path', async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });
}

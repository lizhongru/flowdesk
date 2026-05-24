import { BrowserWindow } from 'electron';
import type { ExecutionEvent } from '../../../shared/types';

export class EventBatcher {
  private queue: ExecutionEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private win: BrowserWindow;
  private readonly batchSize = 50;
  private readonly interval = 16; // ~60fps

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  push(event: ExecutionEvent): void {
    this.queue.push(event);
  }

  start(): void {
    this.timer = setInterval(() => this.flush(), this.interval);
  }

  flush(): void {
    if (this.queue.length === 0 || this.win.isDestroyed()) return;
    const batch = this.queue.splice(0, this.batchSize);
    this.win.webContents.send('execution:events-batch', batch);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush(); // 最后一批
  }
}

import type { FlowDeskAPI } from '../preload/index';

declare global {
  interface Window {
    api: FlowDeskAPI;
  }
}

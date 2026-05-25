import type { FlowDeskAPI } from '../preload/index';

declare module '*.png' {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    api: FlowDeskAPI;
  }
}

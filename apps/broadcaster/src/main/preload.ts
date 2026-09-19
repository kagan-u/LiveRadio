import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('broadcaster', {
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  startStream: (config: any) => ipcRenderer.invoke('start-stream', config),
  stopStream: () => ipcRenderer.invoke('stop-stream'),
  getStreamStatus: () => ipcRenderer.invoke('get-stream-status'),
  onStreamProgress: (callback: Function) => {
    ipcRenderer.on('stream-progress', (_, data) => callback(data));
  },
  onStreamError: (callback: Function) => {
    ipcRenderer.on('stream-error', (_, data) => callback(data));
  },
  onStreamStopped: (callback: Function) => {
    ipcRenderer.on('stream-stopped', (_, data) => callback(data));
  },
});

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  oauth: (url) => ipcRenderer.send('oauth-login', url),
  openVlc: (url) => ipcRenderer.send('open-vlc', url),
  windowReload: () => ipcRenderer.send('reload-window'),
  changeBackendPort: (port) => ipcRenderer.send('change-backend-port', port),
  openFolder: (folder) => ipcRenderer.send('open-folder', folder),
  changeDownloadsFolder: () => {
    ipcRenderer.removeAllListeners('receive-settings-json')
    ipcRenderer.send('change-downloads-folder')
    return new Promise((resolve) => {
      ipcRenderer.once('receive-settings-json', (event, updatedSettings) =>
        resolve(updatedSettings)
      )
    })
  },
  saveToSettings: (key, value) => {
    ipcRenderer.send('save-to-settings', key, value)
  },
  getSettingsJson: () => {
    ipcRenderer.removeAllListeners('receive-settings-json')
    ipcRenderer.send('get-settings-json')
    return new Promise((resolve) => {
      ipcRenderer.once('receive-settings-json', (event, data) => resolve(data))
    })
  },
  setDiscordRpc: (activityDetails) => {
    ipcRenderer.send('set-discord-rpc', activityDetails)
  },
  broadcastDiscordRpc: (value) => {
    ipcRenderer.send('broadcast-discord-rpc', value)
  },
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // Auto-updater
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on('update-available', (_e, info) => callback(info)),
  onUpdateNotAvailable: (callback) =>
    ipcRenderer.on('update-not-available', () => callback()),
  onUpdateDownloadProgress: (callback) =>
    ipcRenderer.on('update-download-progress', (_e, progress) => callback(progress)),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on('update-downloaded', () => callback()),
  onUpdateError: (callback) =>
    ipcRenderer.on('update-error', (_e, msg) => callback(msg))
}

const deeplinks = {
  receiveDeeplink: (callback) =>
    ipcRenderer.on('deeplink-received', (event, link) => callback(link))
}

const combinedAPI = {
  ...electronAPI,
  ...deeplinks,
  ...api // Include your custom APIs
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', combinedAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

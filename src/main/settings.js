import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

const anitingPathDocuments = app.getPath('documents') + '/Aniting'
const settingsPath = path.join(anitingPathDocuments, 'settings.json')
let defaultDownloadsDir = path.join(app.getPath('downloads'), 'AnitingDownloads')

let backendPort = 64621

export default class Settings {
  constructor() {
    this.defaultSettings = {
      uploadLimit: -1,
      downloadLimit: -1,
      downloadsFolderPath: defaultDownloadsDir,
      backendPort: backendPort,
      broadcastDiscordRpc: false,
      showAdultContent: false,
      extensionUrls: {}
    }

    this.settings = this.loadSettings()
  }

  loadSettings() {
    // Ensure the settings directory exists
    if (!fs.existsSync(anitingPathDocuments)) {
      fs.mkdirSync(anitingPathDocuments, { recursive: true })
    }
    // create settings.json file if it doesn't exist
    let settings = this.defaultSettings
    if (!fs.existsSync(settingsPath)) {
      try {
        this.settings = settings
        this.saveSettings()
      } catch (error) {
        console.error('Error creating settings.json file:', error)
        dialog.showErrorBox('Error creating settings.json file:', error.message)
      }
    } else {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath))
      } catch (error) {
        console.error('Error reading settings.json file:', error)
        dialog.showErrorBox('Error reading settings.json file:', error.message)
      }
    }
    return settings
  }

  saveSettings() {
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2)) // null, 2 is for pretty printing
    } catch (error) {
      console.error('Error writing settings.json file:', error)
      dialog.showErrorBox('Error writing settings.json file:', error.message)
    }
  }

  get(key) {
    return this.settings[key]
  }

  set(key, value) {
    this.settings[key] = value
    this.saveSettings()
  }

  getSettings() {
    return this.settings
  }

  getDefaultSettings() {
    return this.defaultSettings
  }
}

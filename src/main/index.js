import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.ico?asset'
import { exec } from 'child_process'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import { autoUpdater } from 'electron-updater'

import DiscordRPC from '../renderer/src/utils/discord'
import WebSocket from 'ws'
import announce from '../../common/announce'
import Settings from './settings'
import { mkdirp } from 'mkdirp'
import axios from 'axios'

let chalk
import('chalk').then((module) => {
  chalk = module.default
})

let client = null

const settings = new Settings()

const us = () => {
  if (
    (!settings.get('uploadLimit') && settings.get('uploadLimit') !== 0) ||
    settings.get('uploadLimit') === -1
  )
    return -1
  else return settings.get('uploadLimit')
}
const ds = () => {
  if (
    (!settings.get('downloadLimit') && settings.get('downloadLimit') !== 0) ||
    settings.get('downloadLimit') === -1
  )
    return -1
  else return settings.get('downloadLimit')
}

async function loadWebTorrent() {
  const { default: WebTorrent } = await import('webtorrent')
  try {
    client = new WebTorrent({
      uploadLimit: us(),
      downloadLimit: ds()
    })
  } catch (error) {
    console.error('Error loading WebTorrent:', error)
  }
}
loadWebTorrent()

// import isDev from 'electron-is-dev'
// app.commandLine.appendSwitch('force_low_power_gpu')
// app.commandLine.appendSwitch('force_high_performance_gpu')

let mainWindow
let backendServer
const discordClientId = '1472622289983111261'
let rpcClient = null
let extensionUrls = {}
const wss = new WebSocket.Server({ noServer: true })
// const wss = new WebSocket.Server({ port: 64622 })
// let zoomFactor = 1.0

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    minWidth: 900,
    minHeight: 670,
    backgroundColor: '#1c1c1c',
    show: false,
    // frame: false,
    // frame: process.platform === 'darwin', // Only keep the native frame on Mac
    titleBarStyle: 'hidden',
    icon: icon,
    titleBarOverlay: {
      color: '#17191c00',
      symbolColor: '#eee',
      height: 45
    },
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false,
      devTools: is.dev,
      webSecurity: !is.dev
    }
  })
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit() // Quit the app if another instance is already running
    return
  } else {
    app.on('second-instance', (_event, argv) => {
      // If the user tried to run a second instance, show the existing window
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        mainWindow.focus()

        // On Windows, the deeplink URL is in argv
        const deeplink = argv.find((arg) => arg.startsWith('aniting://'))
        if (deeplink && mainWindow.webContents) {
          mainWindow.webContents.send('deeplink-received', deeplink)
        }
      }
    })
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // app.getGPUInfo('complete').then((info) => {
  //   console.log(info)
  // })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // don't throw an error if the file doesn't exist
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Handle IPC events
  ipcMain.on('minimize-window', () => mainWindow.minimize())
  ipcMain.on('open-folder', (event, folder) => {
    shell.openPath(folder)
  })
  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('close-window', () => mainWindow.close())

  ipcMain.on('oauth-login', (event, authUrl) => {
    // Open the auth URL in the user's default browser so they can use their existing session
    shell.openExternal(authUrl)
  })

  ipcMain.on('open-vlc', (event, command) => {
    exec(command, (error) => {
      if (error) {
        dialog.showErrorBox(
          'Error launching External Player, make sure the path to .exe is correct. You can specify the correct path to it in the settings\n',
          error.message
        )
      }
    })
  })

  // start the backend server
  if (backendServer) {
    backendServer.close(() => {
      console.log('Backend server stopped.')
      startServer() // Restart the server on the new port
    })
  } else {
    startServer() // Start the server if it's not running yet
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  // Reset Zoom to default
  // globalShortcut.register('CommandOrControl+=', () => {
  //   zoomFactor += 0.1
  //   mainWindow.webContents.setZoomFactor(zoomFactor)
  // })

  // globalShortcut.register('CommandOrControl+-', () => {
  //   zoomFactor -= 0.1
  //   if (zoomFactor < 0.1) zoomFactor = 0.1
  //   mainWindow.webContents.setZoomFactor(zoomFactor)
  // })

  // globalShortcut.register('CommandOrControl+0', () => {
  //   zoomFactor = 1.0
  //   mainWindow.webContents.setZoomFactor(zoomFactor)
  // })

  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC ping
  ipcMain.on('ping', () => {})

  // ── AnimeAV1 proxy fetch handlers ──
  ipcMain.handle('proxy_fetch', async (_event, { url, headers }) => {
    try {
      const resp = await fetch(url, { headers: headers || {} })
      const text = await resp.text()
      return text
    } catch (err) {
      console.error('proxy_fetch error:', err)
      return JSON.stringify({ error: err.message })
    }
  })

  ipcMain.handle('proxy_fetch_text', async (_event, { url, headers }) => {
    try {
      const resp = await fetch(url, {
        headers: headers || {},
        redirect: 'follow'
      })
      const body = await resp.text()
      return { body, final_url: resp.url }
    } catch (err) {
      console.error('proxy_fetch_text error:', err)
      return { body: '', final_url: url }
    }
  })

  // ── ManhwaWeb API proxy handlers ──
  const MANHWAWEB_BASE = 'https://manhwawebbackend-production.up.railway.app'

  ipcMain.handle('manhwaweb_search', async (_event, { query }) => {
    try {
      const url = `${MANHWAWEB_BASE}/manhwa/library?buscar=${encodeURIComponent(query)}&estado=&tipo=&erotico=&demografia=&order_item=alfabetico&order_dir=desc&page=0&generes=`
      const resp = await fetch(url)
      const text = await resp.text()
      return text
    } catch (err) {
      console.error('manhwaweb_search error:', err)
      return JSON.stringify({ data: [] })
    }
  })

  ipcMain.handle('manhwaweb_details', async (_event, { mangaId }) => {
    try {
      const url = `${MANHWAWEB_BASE}/manhwa/see/${encodeURIComponent(mangaId)}`
      const resp = await fetch(url)
      const text = await resp.text()
      return text
    } catch (err) {
      console.error('manhwaweb_details error:', err)
      return JSON.stringify({})
    }
  })

  ipcMain.handle('manhwaweb_chapter', async (_event, { chapterId }) => {
    try {
      const url = `${MANHWAWEB_BASE}/chapters/see/${encodeURIComponent(chapterId)}`
      const resp = await fetch(url)
      const text = await resp.text()
      return text
    } catch (err) {
      console.error('manhwaweb_chapter error:', err)
      return JSON.stringify({ chapter: { img: [] } })
    }
  })

  ipcMain.handle('manhwaweb_image', async (_event, { url }) => {
    try {
      const resp = await fetch(url, {
        headers: {
          Referer: 'https://manhwaweb.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      const contentType = resp.headers.get('content-type') || 'image/jpeg'
      const buffer = await resp.arrayBuffer()
      return { data: Array.from(new Uint8Array(buffer)), contentType }
    } catch (err) {
      console.error('manhwaweb_image error:', err)
      return { data: [], contentType: 'image/jpeg' }
    }
  })

  const anitingPathDocuments = app.getPath('documents') + '/Aniting'
  if (!fs.existsSync(anitingPathDocuments)) {
    fs.mkdirSync(anitingPathDocuments, { recursive: true })
  }

  extensionUrls = settings.extensionUrls

  ipcMain.on('change-downloads-folder', () => {
    dialog

      .showOpenDialog({
        title: 'Select Downloads Folder',
        defaultPath: settings.getDefaultSettings().downloadsFolderPath,
        properties: ['openDirectory']
      })
      .then((result) => {
        if (!result.canceled) {
          let t = result.filePaths[0]

          // Save the new downloads directory in settings.json
          settings.set('downloadsFolderPath', t)
          // Send the new downloads directory to the renderer process
          mainWindow.webContents.send('receive-settings-json', settings.getSettings())
        }
      })
      .catch((err) => {
        console.error('Error selecting downloads folder:', err)
      })
  })

  // change port of backend server
  ipcMain.on('change-backend-port', (event, port) => {
    // Save the new backend port in settings.json
    settings.set('backendPort', port)
    // Send the new backend port to the renderer process
    mainWindow.webContents.send('receive-settings-json', settings.getSettings())

    // Restart the backend server
    if (backendServer) {
      backendServer.close(() => {
        startServer() // Restart the server on the new port
      })
    } else {
      startServer() // Start the server if it's not running yet
    }
  })

  ipcMain.on('save-to-settings', (event, key, value) => {
    settings.set(key, value)
  })

  ipcMain.on('get-settings-json', () => {
    mainWindow.webContents.send('receive-settings-json', settings.getSettings())
  })

  ipcMain.on('reload-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.webContents.reload()
    }
  })

  // change discord rpc setting
  ipcMain.on('broadcast-discord-rpc', (event, value) => {
    settings.set('broadcastDiscordRpc', value)
    if (value === false && rpcClient) {
      try {
        rpcClient.disconnect()
        rpcClient = null
      } catch (error) {
        console.error('Error stopping Discord RPC:')
      }
    } else if (value === true) startBroadcastingDiscordRpc()
  })

  createWindow()

  // --- Auto-updater ---
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info)
  })
  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-not-available')
  })
  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) mainWindow.webContents.send('update-download-progress', progress)
  })
  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded')
  })
  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('update-error', err?.message || 'Error desconocido')
  })

  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch(() => {})
  })
  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate().catch(() => {})
  })
  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('aniting2', process.execPath, [path.resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient('aniting2')
  }

  function startBroadcastingDiscordRpc() {
    console.log('Starting Discord RPC...')

    try {
      if (rpcClient) {
        try { rpcClient.disconnect() } catch (_) {}
        rpcClient = null
      }
      rpcClient = new DiscordRPC(discordClientId)
      rpcClient.initialize()

      // Wait for the client to be ready before setting activity
      rpcClient.client.on('ready', () => {
        rpcClient.setActivity({
          details: 'Browsing Aniting',
          state: 'Buscando qué ver...'
        })
      })
    } catch (error) {
      console.error('Error starting Discord RPC:', error)
    }
  }

  // Discord RPC
  if (settings.get('broadcastDiscordRpc') === true) {
    startBroadcastingDiscordRpc()
  }

  // set discord rpc activity
  ipcMain.on('set-discord-rpc', (event, activityDetails) => {
    if (!rpcClient || settings.get('broadcastDiscordRpc') === false) return
    rpcClient.setActivity(activityDetails)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Ensure Discord RPC is cleaned up before quit on all platforms
app.on('before-quit', () => {
  if (rpcClient) {
    try { rpcClient.disconnect() } catch (_) {}
    rpcClient = null
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendServer) {
      backendServer.close()
    }

    app.quit()
  }
})

// Register protocol handler for aniting:// deep links
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('aniting', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('aniting')
}

// macOS: handle deep links via open-url event
app.on('open-url', (_event, url) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('deeplink-received', url)
  }
})

const app2 = express()
// const client = new WebTorrent()

app2.use(cors())

if (settings.get('downloadsFolderPath')) mkdirp(settings.get('downloadsFolderPath'))

/* ------------------------------------------------------ */
/* ------------------------------------------------------ */
/* ------------------------------------------------------ */
/* ------------------------------------------------------ */
/* ------------------------------------------------------ */

function startServer() {
  backendServer = app2.listen(settings.get('backendPort'), () => {
    console.log(`Server running at http://localhost:${settings.get('backendPort')}`)
  })

  backendServer.on('upgrade', (request, socket, head) => {
    console.log('UPGRADE event triggered')

    if (request.url === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } else {
      console.log('Invalid WebSocket upgrade request')
      socket.destroy()
    }
  })
}

/* ----------------- SEED EXISTING FILES ---------------- */
// Seed all existing files on server startup
// let torrentDownloadPath = downloadsFolderPath || defaultDownloadsDir
// const seedExistingFiles = () => {
//   fs.readdir(downloadsDir, (err, files) => {
//     if (err) {
//       console.error('Error reading downloads directory:', err)
//       return
//     }

//     files.forEach((file) => {
//       const filePath = path.join(downloadsDir, file)

//       if (fs.lstatSync(filePath).isFile()) {
//         client.seed(filePath, { path: downloadsDir }, (torrent) => {
//           // console.log(`Seeding file: ${filePath}`);
//           // console.log(`Magnet URI: ${torrent.magnetURI}`);
//           console.log(chalk.bgBlue('Seeding started: '), chalk.cyan(torrent.name))
//           torrent.on('error', (err) => {
//             console.error(chalk.bgRed('Error seeding file:'), err)
//           })
//         })
//       }
//     })
//   })
// }

// // Call the function to start seeding existing files
// seedExistingFiles()
/* ------------------------------------------------------ */

app2.get('/add/:magnet', async (req, res) => {
  let magnet = req.params.magnet

  /* ------------------------------------------------------ */
  // Check if the torrent is already added
  let existingTorrent = await client.get(magnet)
  console.log('Existing torrent:', existingTorrent)

  if (existingTorrent) {
    // If torrent is already added, return its file information
    let files = existingTorrent.files.map((file) => ({
      name: file.name,
      length: file.length
    }))
    // console.log("Existing torrent files:", files);

    return res.status(200).json(files)
  }
  /* ------------------------------------------------------ */

  client.add(
    magnet,
    {
      path: settings.get('downloadsFolderPath'),
      announce: announce
    },
    function (torrent) {
      let files = torrent.files.map((file) => ({
        name: file.name,
        length: file.length
      }))
      // console.log(files);

      res.status(200).json(files)
    }
  )
})

async function loadLastTorrentSession() {
  const lastSession = settings.get('currentAnime')
  if (!lastSession) return
  const streamUrl = lastSession.streamUrl
  const magnet = lastSession.state.magnetUri

  // add the torrent using the sreamUrl
  try {
    const pre = await fetch(
      `http://localhost:${settings.get('backendPort')}/metadata/${encodeURIComponent(magnet)}`
    )
    if (pre.status === 200 && streamUrl) {
      await fetch(streamUrl)
    }
  } catch (error) {
    console.error('Error fetching stream URL:', error)
    return
  }
}

/* ------------------ ADD LAST SESSION ------------------ */
// await 5s before loading the last session, yea i know how bad this is
setTimeout(() => {
  loadLastTorrentSession()
}, 5000)
/* ------------------------------------------------------ */

/* -------------------- GET METADATA -------------------- */
app2.get('/metadata/:magnet', async (req, res) => {
  let magnet = req.params.magnet

  /* ------------------------------------------------------ */
  // Check if the torrent is already added
  let existingTorrent = await client.get(magnet)
  console.log('Existing torrent:', existingTorrent)

  if (existingTorrent) {
    // If torrent is already added, return its file information
    let files = existingTorrent.files.map((file) => ({
      name: file.name,
      length: file.length
    }))
    // console.log('Announce:', existingTorrent.announce);
    // console.log("Existing torrent files:", files);

    return res.status(200).json(files)
  }
  /* ------------------------------------------------------ */

  // stop all other torrents
  client.torrents.forEach((torrent) => {
    console.log(chalk.bgRed('Download Stopped:') + ' ' + chalk.cyan(torrent.name))
    torrent.destroy()
  })

  const torrent = client.add(magnet, {
    path: settings.get('downloadsFolderPath'),
    deselect: true,
    announce: announce
  })

  torrent.on('metadata', () => {
    const files = torrent.files.map((file) => ({
      name: file.name,
      length: file.length
    }))
    console.log(files)

    // deselect all files
    torrent.files.forEach((file) => {
      file.deselect()
    })

    res.status(200).json(files)
  })
})

/* ------------------------------------------------------ */
/* ------------------------------------------------------ */

wss.on('connection', (ws) => {
  console.log('Client connected')
  const interval = setInterval(() => {
    let data = []
    data.push({
      clientDownloadSpeed: client.downloadSpeed,
      clientUploadSpeed: client.uploadSpeed
    })
    const file = client.torrents.map((torrent) => ({
      name: torrent.name,
      length: torrent.length,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      downloaded: torrent.downloaded,
      uploaded: torrent.uploaded,
      progress: torrent.progress,
      done: torrent.done,
      magnet: torrent.magnetURI
    }))

    data = [...data, ...file]

    ws.send(JSON.stringify(data))
  }, 1000)
  // Clear interval when the client disconnects
  ws.on('close', () => {
    console.log('Client disconnected')
    clearInterval(interval)
  })
})

app2.get('/downloadsInfo', async (req, res) => {
  let files = []

  client.torrents.forEach((torrent) => {
    let torrentFiles = {
      name: torrent.name,
      length: torrent.length,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      downloaded: torrent.downloaded,
      uploaded: torrent.uploaded,
      progress: torrent.progress,
      done: torrent.done,
      magnet: torrent.magnetURI
    }

    // files = files.concat(torrentFiles)
    files.push(torrentFiles)
  })

  res.status(200).json(files)
})

/* ------------------------------------------------------ */
app2.get('/hls-proxy/*', async (req, res) => {
  try {
    const subPath = req.params[0]
    const targetUrl = `https://cdn.hvidserv.com/${subPath}`

    const hashMatch = subPath.match(/^(?:m3u8|segs)\/([a-f0-9]+)/)
    const hash = hashMatch ? hashMatch[1] : ''

    console.log(`[HLS Proxy] Fetching ${targetUrl} with hash ${hash}`)

    const response = await axios.get(targetUrl, {
      responseType: subPath.startsWith('m3u8/') ? 'text' : 'arraybuffer',
      validateStatus: () => true,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: `https://cdn.hvidserv.com/play/${hash}`,
        Origin: 'https://cdn.hvidserv.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      }
    })

    if (response.status !== 200) {
      console.error(
        `[HLS Proxy] Upstream returned ${response.status} ${response.statusText} for ${targetUrl}`
      )
      const errText =
        typeof response.data === 'string'
          ? response.data
          : response.data instanceof Buffer
            ? response.data.toString().substring(0, 200)
            : ''
      console.error(`[HLS Proxy] Error Body: ${errText}`)
      return res.status(response.status).send(`Upstream error: ${response.status}`)
    }

    // CORS headers so the renderer can fetch
    res.setHeader('Access-Control-Allow-Origin', '*')

    if (subPath.startsWith('m3u8/')) {
      let text = response.data
      const proxyBase = `http://127.0.0.1:${settings.get('backendPort')}/hls-proxy/`
      // Rewrite absolute CDN URLs to local proxy
      text = text.replace(/https:\/\/cdn\.hvidserv\.com\//g, proxyBase)
      // Rewrite relative segment URLs (e.g. ../segs/...) to absolute proxy URLs
      text = text.replace(/\.\.\/segs\//g, `${proxyBase}segs/`)
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      return res.send(text)
    } else {
      // Los segmentos .html son en realidad fMP4 disfrazado.
      // El CDN los sirve como text/html para evadir detección,
      // pero HLS.js necesita video/mp4 para procesarlos.
      res.setHeader('Content-Type', 'video/mp4')
      return res.send(response.data)
    }
  } catch (err) {
    console.error('[HLS Proxy Error]', err)
    res.status(500).send(`Proxy error: ${err.message}`)
  }
})

/* ------------------------------------------------------ */
app2.get('/streamfile/:magnet/:filename', async function (req, res) {
  let magnet = req.params.magnet
  let filename = req.params.filename

  console.log(magnet)

  let tor = await client.get(magnet)

  if (!tor) {
    return res.status(404).send('Torrent not found')
  }

  let file = tor.files.find((f) => f.name === filename)

  if (!file) {
    return res.status(404).send('No file found in the torrent')
  }
  console.log('[streamfile] Serving:', file.name, 'Size:', file.length)

  file.select()

  // Determine content type based on file extension
  const ext = file.name.split('.').pop().toLowerCase()
  let contentType = 'video/webm' // Default: serve MKV as video/webm (seanime trick)
  if (ext === 'mp4') contentType = 'video/mp4'
  else if (ext === 'webm') contentType = 'video/webm'
  else if (ext === 'avi') contentType = 'video/avi'

  let file_size = file.length
  let range = req.headers.range

  if (!range) {
    // No range header — serve the entire file (needed for initial metadata probing)
    res.writeHead(200, {
      'Content-Length': file_size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive'
    })
    let stream = file.createReadStream()
    stream.pipe(res)
    stream.on('error', function (err) {
      console.error('Stream error:', err)
      if (!res.headersSent) return res.status(500).send('Error streaming the video')
    })
    return
  }

  console.log('Range : ' + range)

  let positions = range.replace(/bytes=/, '').split('-')
  let start = parseInt(positions[0], 10)
  // Cap chunk size at ~5MB to prevent open-ended range requests from trying to stream the entire rest
  const MAX_CHUNK = 5 * 1024 * 1024
  let end = positions[1] ? parseInt(positions[1], 10) : Math.min(start + MAX_CHUNK, file_size - 1)
  // Ensure end doesn't exceed file size
  if (end >= file_size) end = file_size - 1
  let chunksize = end - start + 1

  let head = {
    'Content-Range': `bytes ${start}-${end}/${file_size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize,
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    Connection: 'keep-alive'
  }

  res.writeHead(206, head)

  detailsOfEpisode.percentageWatched = (start / file_size) * 100

  let stream = file.createReadStream({ start, end })
  stream.pipe(res)

  stream.on('error', function (err) {
    console.error('Stream error:', err)
    if (!res.headersSent) {
      return res.status(500).send('Error streaming the video')
    }
  })

  stream.on('close', () => {
    console.log('Stream closed prematurely')
  })
})

// Deselect an episode with the given filename
app2.get('/deselect/:magnet/:filename', async (req, res) => {
  let magnet = req.params.magnet
  let filename = req.params.filename

  let tor = await client.get(magnet)

  if (!tor) {
    return res.status(404).send('Torrent not found')
  }

  let file = tor.files.find((f) => f.name === filename)

  // deselect all files

  if (!file) {
    return res.status(404).send('No file found in the torrent')
  }

  console.log(chalk.bgRed('Download Stopped:') + ' ' + chalk.cyan(file.name))

  file.deselect()
  file.deselect()
  file.deselect()

  res.status(200).send('File deselected successfully')
})

// get download details of a file

let detailsOfEpisode = {
  name: '',
  length: 0,
  downloaded: 0,
  progress: 0,
  percentageWatched: 0
}

app2.get('/detailsepisode/:magnet/:filename', async (req, res) => {
  let magnet = req.params.magnet
  let filename = req.params.filename

  let tor = await client.get(magnet)
  if (!tor) {
    return res.status(404).send('Torrent not found')
  }

  let file = tor.files.find((f) => f.name === filename)
  if (!file) {
    return res.status(404).send('No file found in the torrent')
  }

  // let details = {
  detailsOfEpisode = {
    name: file.name,
    length: file.length,
    downloaded: file.downloaded,
    progress: file.progress,
    percentageWatched: detailsOfEpisode.percentageWatched
  }

  res.status(200).json(detailsOfEpisode)
})

/* ------------------------------------------------------ */

app2.get('/stream/:magnet', async function (req, res) {
  let magnet = req.params.magnet
  console.log(magnet)

  let tor = await client.get(magnet)

  if (!tor) {
    return res.status(404).send('Torrent not found')
  }

  // Find the largest video file (prefer .mkv, then .mp4, then any video)
  let file =
    tor.files.find((f) => f.name.endsWith('.mkv')) ||
    tor.files.find((f) => f.name.endsWith('.mp4')) ||
    tor.files.find((f) => /\.(webm|avi|mov)$/i.test(f.name))

  if (!file) {
    return res.status(404).send('No video file found in the torrent')
  }

  console.log('[stream] Serving:', file.name, 'Size:', file.length)

  // Determine content type based on file extension
  const ext = file.name.split('.').pop().toLowerCase()
  let contentType = 'video/webm' // Default: serve MKV as video/webm (seanime trick)
  if (ext === 'mp4') contentType = 'video/mp4'
  else if (ext === 'webm') contentType = 'video/webm'
  else if (ext === 'avi') contentType = 'video/avi'

  let file_size = file.length
  let range = req.headers.range

  if (!range) {
    // No range header — serve the entire file (needed for initial metadata probing)
    res.writeHead(200, {
      'Content-Length': file_size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive'
    })
    let stream = file.createReadStream()
    stream.pipe(res)
    stream.on('error', function (err) {
      console.error('Stream error:', err)
      if (!res.headersSent) return res.status(500).send('Error streaming the video')
    })
    return
  }

  console.log('Range : ' + range)

  let positions = range.replace(/bytes=/, '').split('-')
  let start = parseInt(positions[0], 10)
  // Cap chunk size at ~5MB to prevent open-ended range requests from trying to stream the entire rest
  const MAX_CHUNK = 5 * 1024 * 1024
  let end = positions[1] ? parseInt(positions[1], 10) : Math.min(start + MAX_CHUNK, file_size - 1)
  // Ensure end doesn't exceed file size
  if (end >= file_size) end = file_size - 1
  let chunksize = end - start + 1

  let head = {
    'Content-Range': `bytes ${start}-${end}/${file_size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize,
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    Connection: 'keep-alive'
  }

  res.writeHead(206, head)

  let stream = file.createReadStream({ start, end })
  stream.pipe(res)

  stream.on('error', function (err) {
    console.error('Stream error:', err)
    if (!res.headersSent) {
      return res.status(500).send('Error streaming the video')
    }
  })

  stream.on('close', () => {
    console.log('Stream closed prematurely')
  })
})

app2.get('/details/:magnet', async (req, res) => {
  let magnet = req.params.magnet

  // Find the torrent by magnet link
  let tor = await client.get(magnet)
  if (!tor) {
    return res.status(404).send('Torrent not found')
  }

  // Prepare torrent details
  let details = {
    name: tor.name,
    length: tor.length,
    downloaded: tor.downloaded,
    uploaded: tor.uploaded,
    downloadSpeed: tor.downloadSpeed,
    uploadSpeed: tor.uploadSpeed,
    progress: tor.progress,
    ratio: tor.ratio,
    numPeers: tor.numPeers
  }

  res.status(200).json(details)
})

/* --------------- Handling VLC streaming --------------- */
// import { get } from 'http'
// import { fileURLToPath } from 'url'
// Full path to VLC executable, change it as needed
const vlcPath = '"C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe"' // Adjust this path as needed

app2.get('/stream-to-vlc', async (req, res) => {
  const { url } = req.query

  if (!url) {
    return res.status(400).send('URL is required')
  }
  const vlcCommand = `${vlcPath} "${url}"`

  exec(vlcCommand, (error) => {
    if (error) {
      console.error(`Error launching VLC: ${error.message}`)
      return res.status(500).send('Error launching VLC')
    }
    res.send('VLC launched successfully')
  })
})
/* ------------------------------------------------------ */

/* -------------- PRIORITIZE FILE DOWNLOAD -------------- */
app2.get('/prioritize-file/:magnet', async (req, res) => {
  const magnet = req.params.magnet
  const filename = req.query.file // optional: specific file in batch torrent

  const tor = await client.get(magnet)
  if (!tor) return res.status(404).send('Torrent not found')

  const file = filename
    ? tor.files.find((f) => f.name === filename)
    : tor.files.find((f) => f.name.endsWith('.mkv') || f.name.endsWith('.MKV')) ||
      tor.files.find((f) => /\.(mp4|webm|avi|mov)$/i.test(f.name))
  if (!file) return res.status(404).send('No video file found in torrent')

  // Select the file — tells WebTorrent to prioritize downloading ALL its pieces
  file.select()
  console.log(
    chalk
      ? chalk.bgGreen('[Priority]') + ' ' + chalk.cyan(`Prioritized all pieces for "${file.name}"`)
      : `[Priority] Prioritized all pieces for "${file.name}"`
  )
  res.json({ ok: true, file: file.name, length: file.length })
})
/* ------------------------------------------------------ */

/* -------------- SUBTITLE EXTRACTION (ASS) ------------- */
import ffmpegLib from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
ffmpegLib.setFfmpegPath(ffmpegStatic)

// In-memory subtitle cache: key = "magnet:trackIndex" or "magnet:filename:trackIndex"
const subtitleCache = new Map()

// Helper: convert milliseconds to ASS time format H:MM:SS.CC
function msToAssTime(ms) {
  const cs = Math.floor(ms / 10) % 100
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / 60000) % 60
  const h = Math.floor(ms / 3600000)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// Helper: build a default ASS header for SRT/UTF8 tracks that lack one
function buildDefaultAssHeader() {
  return `[Script Info]
Title: Default
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,20,20,40,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
}

// Helper: find the MKV file from a torrent (first .mkv found)
function findMkvFile(tor) {
  return tor.files.find((f) => f.name.endsWith('.mkv') || f.name.endsWith('.MKV'))
}

// Helper: find a specific file from a torrent by filename
function findFileByName(tor, filename) {
  return tor.files.find((f) => f.name === filename)
}

/**
 * List subtitle tracks from an MKV torrent file.
 * Uses matroska-subtitles for fast header-only parsing.
 */
app2.get('/subtitle-tracks/:magnet', async (req, res) => {
  const magnet = req.params.magnet
  const filename = req.query.file // optional: specific file in batch torrent

  const tor = await client.get(magnet)
  if (!tor) return res.status(404).json({ error: 'Torrent not found' })

  const file = filename ? findFileByName(tor, filename) : findMkvFile(tor)
  if (!file) return res.status(404).json({ error: 'No MKV file found in torrent' })

  try {
    const { SubtitleParser } = await import('matroska-subtitles')
    const stream = file.createReadStream()
    const parser = new SubtitleParser()
    let responded = false

    parser.once('tracks', (tracks) => {
      responded = true
      try {
        stream.destroy()
      } catch (_) {}
      const mapped = tracks.map((t, i) => ({
        index: i,
        number: t.number,
        language: t.language || 'und',
        name: t.name || `Track ${i + 1}`,
        type: t.type || 'unknown',
        header: t.header || ''
      }))
      console.log(`[Subtitles] Found ${mapped.length} track(s) in "${file.name}"`)
      res.json(mapped)
    })

    parser.once('error', (err) => {
      if (!responded) {
        responded = true
        try {
          stream.destroy()
        } catch (_) {}
        console.error('[Subtitles] Parser error:', err)
        res.status(500).json({ error: 'Error parsing MKV for subtitle tracks' })
      }
    })

    stream.pipe(parser)

    // Timeout: if tracks aren't found in 20 seconds, respond with empty
    setTimeout(() => {
      if (!responded) {
        responded = true
        try {
          stream.destroy()
        } catch (_) {}
        console.log('[Subtitles] Timeout detecting tracks')
        res.json([])
      }
    }, 20000)
  } catch (err) {
    console.error('[Subtitles] Error:', err)
    res.status(500).json({ error: 'Internal error detecting subtitle tracks' })
  }
})

/**
 * Extract subtitle track from MKV using matroska-subtitles (no ffmpeg needed).
 * Reconstructs a full .ass file from the track header + parsed dialogue events.
 * Much faster and works even with partially downloaded torrents.
 * Caches result for subsequent requests.
 * Query params: ?track=0 (default track index in the tracks array), ?file=filename (for batch torrents)
 */
// Helper: build ASS content from parsed dialogue lines and track metadata
function buildAssFromDialogues(dialogueLines, trackType, trackHeader) {
  let assContent = ''

  if (trackType === 'ass' || trackType === 'ssa') {
    if (trackHeader) {
      let header = trackHeader
      if (!header.includes('[Events]')) {
        header += '\n[Events]\n'
        header +=
          'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
      } else if (!header.includes('Format:')) {
        header +=
          'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
      }
      assContent = header
      for (const sub of dialogueLines) {
        const start = msToAssTime(sub.time)
        const end = msToAssTime(sub.time + sub.duration)
        const layer = sub.layer || '0'
        const style = sub.style || 'Default'
        const name = sub.name || ''
        const marginL = sub.marginL || '0'
        const marginR = sub.marginR || '0'
        const marginV = sub.marginV || '0'
        const effect = sub.effect || ''
        const text = sub.text || ''
        assContent += `Dialogue: ${layer},${start},${end},${style},${name},${marginL.padStart(4, '0')},${marginR.padStart(4, '0')},${marginV.padStart(4, '0')},${effect},${text}\n`
      }
    } else {
      assContent = buildDefaultAssHeader()
      for (const sub of dialogueLines) {
        const start = msToAssTime(sub.time)
        const end = msToAssTime(sub.time + sub.duration)
        const text = sub.text || ''
        assContent += `Dialogue: 0,${start},${end},Default,,0000,0000,0000,,${text}\n`
      }
    }
  } else {
    // SRT/UTF8: build ASS from scratch with default header
    assContent = buildDefaultAssHeader()
    for (const sub of dialogueLines) {
      const start = msToAssTime(sub.time)
      const end = msToAssTime(sub.time + sub.duration)
      let text = (sub.text || '')
        .replace(/<b>/gi, '{\\b1}')
        .replace(/<\/b>/gi, '{\\b0}')
        .replace(/<i>/gi, '{\\i1}')
        .replace(/<\/i>/gi, '{\\i0}')
        .replace(/<u>/gi, '{\\u1}')
        .replace(/<\/u>/gi, '{\\u0}')
        .replace(/<br\s*\/?>/gi, '\\N')
        .replace(/<[^>]+>/g, '')
      assContent += `Dialogue: 0,${start},${end},Default,,0000,0000,0000,,${text}\n`
    }
  }
  return assContent
}

app2.get('/subtitles/:magnet', async (req, res) => {
  const magnet = req.params.magnet
  const trackIndex = parseInt(req.query.track || '0')
  const filename = req.query.file
  const cachePrefix = `${magnet}:${filename || ''}`

  // Check cache — serves instantly if this track was already parsed
  const cacheKey = `${cachePrefix}:${trackIndex}`
  if (subtitleCache.has(cacheKey)) {
    console.log('[Subtitles] Serving from cache:', cacheKey)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.send(subtitleCache.get(cacheKey))
  }

  const tor = await client.get(magnet)
  if (!tor) return res.status(404).send('Torrent not found')

  const file = filename ? findFileByName(tor, filename) : findMkvFile(tor)
  if (!file) return res.status(404).send('No MKV file found in torrent')

  console.log(
    `[Subtitles] Extracting ALL tracks from "${file.name}" via matroska-subtitles (requested: ${trackIndex})...`
  )

  // Prioritize the file so WebTorrent downloads all its pieces ASAP
  file.select()

  try {
    const { SubtitleParser } = await import('matroska-subtitles')
    const stream = file.createReadStream()
    const parser = new SubtitleParser()
    let responded = false

    // Collect ALL tracks' metadata and dialogues in one pass
    let allTracks = [] // track metadata from parser
    const dialoguesByTrackNumber = new Map() // trackNumber -> [subtitle events]

    parser.once('tracks', (tracks) => {
      allTracks = tracks
      console.log(`[Subtitles] Found ${tracks.length} tracks, parsing ALL of them`)
      if (trackIndex >= tracks.length) {
        responded = true
        try {
          stream.destroy()
        } catch (_) {}
        return res
          .status(404)
          .send(`Track index ${trackIndex} not found (only ${tracks.length} tracks)`)
      }
      // Initialize collection buckets for each track
      for (const t of tracks) {
        dialoguesByTrackNumber.set(t.number, [])
      }
    })

    // Collect subtitles for ALL tracks simultaneously
    parser.on('subtitle', (subtitle, trackNumber) => {
      const bucket = dialoguesByTrackNumber.get(trackNumber)
      if (bucket) bucket.push(subtitle)
    })

    // Helper: build and cache ASS content for ALL tracks, then respond with the requested one
    function sendSubtitleResponse(isPartial) {
      if (responded) return
      responded = true
      try {
        stream.destroy()
      } catch (_) {}

      // Build ASS content for EACH track and cache it
      let totalLinesCached = 0
      for (let i = 0; i < allTracks.length; i++) {
        const t = allTracks[i]
        const lines = dialoguesByTrackNumber.get(t.number) || []
        if (lines.length === 0 && isPartial) continue // don't cache empty partials

        const assContent = buildAssFromDialogues(lines, t.type || 'ass', t.header || '')
        const trackCacheKey = `${cachePrefix}:${i}`

        // Only cache complete results (not partial)
        if (!isPartial) {
          subtitleCache.set(trackCacheKey, assContent)
        }

        // For partial results, store temporarily so track switching works within this session
        if (isPartial && lines.length > 0) {
          // Use a separate partial cache key so full results can overwrite later
          subtitleCache.set(trackCacheKey, assContent)
        }

        totalLinesCached += lines.length
        console.log(`[Subtitles] Track ${i} (${t.language || 'und'}): ${lines.length} lines`)
      }

      // Now respond with the requested track
      const requestedTrack = allTracks[trackIndex]
      const requestedLines = requestedTrack
        ? dialoguesByTrackNumber.get(requestedTrack.number) || []
        : []

      if (requestedLines.length === 0 && isPartial) {
        const pct = ((file.progress || 0) * 100).toFixed(1)
        console.log(
          `[Subtitles] Timeout: 0 lines for track ${trackIndex} (file ${pct}% downloaded, ${totalLinesCached} total across all tracks)`
        )
        res.setHeader('X-File-Progress', String(file.progress || 0))
        return res.status(504).send(`Subtitle extraction timed out — file ${pct}% downloaded`)
      }

      const assContent = buildAssFromDialogues(
        requestedLines,
        requestedTrack?.type || 'ass',
        requestedTrack?.header || ''
      )
      const label = isPartial ? 'Partial' : 'Full'
      console.log(
        `[Subtitles] ${label}: track ${trackIndex} = ${requestedLines.length} lines (${assContent.length} bytes), all tracks = ${totalLinesCached} lines`
      )

      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('X-File-Progress', String(file.progress || 0))
      if (isPartial) {
        res.setHeader('X-Subtitles-Partial', 'true')
        res.setHeader('X-Subtitles-Lines', String(requestedLines.length))
      }
      res.send(assContent)
    }

    parser.on('finish', () => sendSubtitleResponse(false))

    parser.once('error', (err) => {
      if (!responded) {
        responded = true
        try {
          stream.destroy()
        } catch (_) {}
        console.error('[Subtitles] Parser error:', err)
        res.status(500).send('Error parsing MKV for subtitles: ' + err.message)
      }
    })

    stream.on('error', (err) => {
      if (!responded) {
        responded = true
        console.error('[Subtitles] Stream error:', err)
        res.status(500).send('Error reading file: ' + err.message)
      }
    })

    stream.pipe(parser)

    // 10s timeout — parser reads through available data in <1s then blocks at gaps
    // No point waiting longer; retries will progressively fetch more as download continues
    setTimeout(() => sendSubtitleResponse(true), 10000)
  } catch (err) {
    console.error('[Subtitles] Error:', err)
    if (!res.headersSent) {
      res.status(500).send('Internal error extracting subtitles')
    }
  }
})

/**
 * Extract font attachments from MKV torrent files using ffmpeg.
 * Returns a JSON list of available font filenames, or streams a specific font.
 * Query params: ?file=filename (for batch), ?fontname=fontfile.ttf (to get specific font)
 */
app2.get('/fonts/:magnet', async (req, res) => {
  const magnet = req.params.magnet
  const filename = req.query.file
  const fontName = req.query.fontname

  const tor = await client.get(magnet)
  if (!tor) return res.status(404).json({ error: 'Torrent not found' })

  const mkvFile = filename ? findFileByName(tor, filename) : findMkvFile(tor)
  if (!mkvFile) return res.status(404).json({ error: 'No MKV file found' })

  // Find font attachment files in the torrent (some groups put fonts in the torrent itself)
  const fontFiles = tor.files.filter((f) => {
    const lower = f.name.toLowerCase()
    return (
      lower.endsWith('.ttf') ||
      lower.endsWith('.otf') ||
      lower.endsWith('.woff') ||
      lower.endsWith('.woff2')
    )
  })

  if (fontName) {
    // Stream a specific font file
    const font = fontFiles.find((f) => f.name.endsWith(fontName))
    if (!font) return res.status(404).send('Font not found')
    res.setHeader('Content-Type', 'application/octet-stream')
    const stream = font.createReadStream()
    stream.pipe(res)
    return
  }

  // Return list of available fonts
  res.json(fontFiles.map((f) => ({ name: f.name, length: f.length })))
})

/* ------------------------------------------------------ */

app2.delete('/remove/:magnet', async (req, res) => {
  let magnet = req.params.magnet

  // Find the torrent by magnet link
  let tor = await client.get(magnet)
  if (!tor) {
    return res.status(404).send('Torrent not found')
  }

  // Destroy the torrent to stop downloading and remove it from the client
  tor.destroy((err) => {
    if (err) {
      console.error('Error removing torrent:', err)
      return res.status(500).send('Error removing torrent')
    }
    settings.set('currentAnime', null) // Clear the current anime session

    res.status(200).send('Torrent removed successfully')
  })
})

// ping backend
app2.get('/ping', (req, res) => {
  res.status(200).send('pong')
})

// do not start the server again if it is already running

// app2.listen(64621, () => {
//   console.log('Server running at http://localhost:64621')
// })

module.exports.extensionUrls = extensionUrls

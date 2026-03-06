// DiscordRPC.js
import { Client, register } from 'discord-rpc'
class DiscordRPC {
  constructor(clientId) {
    this.clientId = clientId
    this.client = new Client({ transport: 'ipc' })
    this._retryTimer = null

    this.client.on('ready', () => {
      console.log('Discord RPC is ready!')
    })
  }

  initialize() {
    register(this.clientId)
    this.client.login({ clientId: this.clientId }).catch(() => {
      this._retryTimer = setTimeout(() => this.initialize(), 5000)
      if (this._retryTimer && this._retryTimer.unref) this._retryTimer.unref()
    })
  }

  setActivity(activityDetails) {
    if (!this.client || !this.client.user) return

    this.client.request('SET_ACTIVITY', {
      pid: process.pid,
      activity: {
        timestamps: { start: Date.now() },
        details: activityDetails.details || 'Browsing Aniting',
        state: activityDetails.state || 'Buscando qué ver...',
        assets: {
          large_image: 'logo',
          large_text: 'Aniting',
          ...activityDetails.assets
        },

        buttons: [
          {
            label: 'Download app',
            url: 'https://github.com/anyyting-es/aniting/releases/latest'
          }
        ],
        instance: true,
        type: 3
      }
    })
  }

  clearActivity() {
    if (!this.client || !this.client.user) return
    try {
      this.client.request('SET_ACTIVITY', {
        pid: process.pid,
        activity: null
      })
    } catch (_) {}
  }

  disconnect() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer)
      this._retryTimer = null
    }
    try {
      this.clearActivity()
    } catch (_) {}
    this.client.destroy().then(() => {
      console.log('RPC client disconnected.')
    }).catch(() => {
      console.log('RPC client already disconnected.')
    })
  }
}

export default DiscordRPC

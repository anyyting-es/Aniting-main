/**
 * Local anime tracking store.
 * Stores anime progress, status, and watch time locally in localStorage.
 * Used when the user is not logged into AniList, or for local-only data
 * like video playback position.
 */

const STORE_KEY = 'aniting-local-anime-store'
const PROFILE_KEY = 'aniting-local-profile'

function getStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

// ── Anime entry helpers ──

export function getLocalAnimeEntry(animeId) {
  const store = getStore()
  return store[String(animeId)] || null
}

export function setLocalAnimeStatus(animeId, status, animeMeta = {}) {
  const store = getStore()
  const key = String(animeId)
  if (!store[key]) {
    store[key] = { progress: 0, status: null, updatedAt: Date.now() }
  }
  store[key].status = status
  store[key].updatedAt = Date.now()
  // Save metadata for profile display
  if (animeMeta.title) store[key].title = animeMeta.title
  if (animeMeta.coverImage) store[key].coverImage = animeMeta.coverImage
  if (animeMeta.episodes) store[key].totalEpisodes = animeMeta.episodes
  if (animeMeta.bannerImage) store[key].bannerImage = animeMeta.bannerImage
  if (animeMeta.format) store[key].format = animeMeta.format
  saveStore(store)
  return { id: animeId, status }
}

export function setLocalWatchedEpisodes(animeId, episodesWatched, animeMeta = {}) {
  const store = getStore()
  const key = String(animeId)
  if (!store[key]) {
    store[key] = { progress: 0, status: 'CURRENT', updatedAt: Date.now() }
  }
  store[key].progress = episodesWatched
  store[key].updatedAt = Date.now()
  // Auto-set status
  if (episodesWatched > 0 && (!store[key].status || store[key].status === 'PLANNING')) {
    store[key].status = 'CURRENT'
  }
  if (animeMeta.episodes && episodesWatched >= animeMeta.episodes) {
    store[key].status = 'COMPLETED'
  }
  // Save metadata
  if (animeMeta.title) store[key].title = animeMeta.title
  if (animeMeta.coverImage) store[key].coverImage = animeMeta.coverImage
  if (animeMeta.episodes) store[key].totalEpisodes = animeMeta.episodes
  if (animeMeta.bannerImage) store[key].bannerImage = animeMeta.bannerImage
  if (animeMeta.format) store[key].format = animeMeta.format
  saveStore(store)
  return { id: animeId, progress: episodesWatched }
}

export function getLocalProgress(animeId) {
  const entry = getLocalAnimeEntry(animeId)
  return entry?.progress || 0
}

export function getLocalStatus(animeId) {
  const entry = getLocalAnimeEntry(animeId)
  return entry?.status || null
}

// ── Video playback position (local only, never synced to AniList) ──

const PLAYBACK_KEY = 'aniting-playback-positions'

function getPlaybackStore() {
  try {
    const raw = localStorage.getItem(PLAYBACK_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePlaybackStore(store) {
  localStorage.setItem(PLAYBACK_KEY, JSON.stringify(store))
}

/**
 * Save where the user left off watching a specific episode.
 * @param {string|number} animeId
 * @param {number} episodeNumber
 * @param {number} currentTime - seconds
 * @param {number} duration - total seconds
 */
export function savePlaybackPosition(animeId, episodeNumber, currentTime, duration) {
  const store = getPlaybackStore()
  const key = `${animeId}-${episodeNumber}`
  store[key] = {
    animeId: String(animeId),
    episodeNumber,
    currentTime,
    duration,
    percentage: duration > 0 ? (currentTime / duration) * 100 : 0,
    updatedAt: Date.now()
  }
  savePlaybackStore(store)
}

/**
 * Get the saved playback position for a specific episode.
 */
export function getPlaybackPosition(animeId, episodeNumber) {
  const store = getPlaybackStore()
  const key = `${animeId}-${episodeNumber}`
  return store[key] || null
}

/**
 * Get the latest playback position for an anime (any episode).
 * Useful for "Continue Watching" feature.
 */
export function getLatestPlaybackForAnime(animeId) {
  const store = getPlaybackStore()
  const id = String(animeId)
  let latest = null
  for (const key of Object.keys(store)) {
    if (store[key].animeId === id) {
      if (!latest || store[key].updatedAt > latest.updatedAt) {
        latest = store[key]
      }
    }
  }
  return latest
}

// ── Get all anime entries by status ──

export function getLocalAnimeByStatus(status) {
  const store = getStore()
  return Object.entries(store)
    .filter(([, entry]) => entry.status === status)
    .map(([id, entry]) => ({ id, ...entry }))
}

export function getAllLocalAnime() {
  const store = getStore()
  return Object.entries(store).map(([id, entry]) => ({ id, ...entry }))
}

// ── Local stats ──

export function getLocalStats() {
  const store = getStore()
  const entries = Object.values(store)
  const totalAnime = entries.length
  const episodesWatched = entries.reduce((sum, e) => sum + (e.progress || 0), 0)
  const completed = entries.filter((e) => e.status === 'COMPLETED').length
  const watching = entries.filter((e) => e.status === 'CURRENT').length
  const planning = entries.filter((e) => e.status === 'PLANNING').length
  const paused = entries.filter((e) => e.status === 'PAUSED').length
  const dropped = entries.filter((e) => e.status === 'DROPPED').length
  return { totalAnime, episodesWatched, completed, watching, planning, paused, dropped }
}

// ── Local profile ──

export function getLocalProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : { name: 'Usuario Local', avatar: null }
  } catch {
    return { name: 'Usuario Local', avatar: null }
  }
}

export function saveLocalProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

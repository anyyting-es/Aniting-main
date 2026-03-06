// src/api/manhwaweb.js
// ManhwaWeb API client – calls Electron IPC to avoid CORS
// API base: https://manhwawebbackend-production.up.railway.app

// ── In-memory cache ──
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000

function getCached(key) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data
  cache.delete(key)
  return null
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() })
}

/**
 * Safely parse JSON, returning null if it fails (e.g. HTML error pages)
 */
function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    console.warn('[ManhwaWeb] Response is not valid JSON:', raw?.substring?.(0, 120))
    return null
  }
}

// ── API Functions ──

/**
 * Search manga/manhwa on ManhwaWeb
 * @param {string} query
 * @returns {Promise<Array<{id: string, slug: string, title: string, image: string}>>}
 */
export async function manhwaSearch(query) {
  const cacheKey = `mw-search:${query}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const raw = await window.api.invoke('manhwaweb_search', { query })
    const json = safeParse(raw)

    if (!json?.data) return []

    const results = json.data.map((item) => ({
      id: item._id || item.real_id || '',
      slug: item.real_id || item._id || '',
      title: item.the_real_name || 'Sin titulo',
      image: item._imagen || ''
    }))

    setCache(cacheKey, results)
    return results
  } catch (err) {
    console.error('ManhwaWeb search failed:', err)
    return []
  }
}

/**
 * Parse a raw JSON response into manga details
 */
function parseMangaDetails(json, mangaId) {
  if (!json || (!json.chapters && !json._id && !json.real_id)) return null

  const chapters = (json.chapters || []).map((ch, idx) => ({
    id: `${json._id || mangaId}-${ch.chapter}`,
    number: typeof ch.chapter === 'number' ? ch.chapter : parseFloat(ch.chapter) || idx + 1,
    title: `Capitulo ${ch.chapter}`,
    chapter: String(ch.chapter),
    link: ch.link || ''
  }))

  // Sort chapters ascending
  chapters.sort((a, b) => a.number - b.number)

  return {
    id: json._id || mangaId,
    slug: json.real_id || mangaId,
    title: json.the_real_name || json.name || '',
    image: json._imagen || json.image || '',
    description: json.description || json.synopsis || '',
    status: json.status || '',
    type: json.type || 'Manhwa',
    genres: json.genres || json.genders || [],
    chapters
  }
}

/**
 * Get manga details + chapter list
 * Tries both _id and slug (real_id) if the first attempt returns no chapters
 * @param {string} mangaId
 * @param {string} [slug]
 * @returns {Promise<Object|null>}
 */
export async function manhwaGetDetails(mangaId, slug) {
  const cacheKey = `mw-details:${mangaId}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    // Try with the primary ID first
    const raw = await window.api.invoke('manhwaweb_details', { mangaId })
    const json = safeParse(raw)
    const details = json ? parseMangaDetails(json, mangaId) : null

    if (details && details.chapters.length > 0) {
      setCache(cacheKey, details)
      return details
    }

    // If no chapters found and we have a different slug, try with that
    if (slug && slug !== mangaId) {
      const rawSlug = await window.api.invoke('manhwaweb_details', {
        mangaId: slug
      })
      const jsonSlug = safeParse(rawSlug)
      const detailsSlug = jsonSlug ? parseMangaDetails(jsonSlug, slug) : null
      if (detailsSlug && detailsSlug.chapters.length > 0) {
        setCache(cacheKey, detailsSlug)
        return detailsSlug
      }
    }

    // Return whatever we got (even with 0 chapters)
    if (details) {
      setCache(cacheKey, details)
      return details
    }
    return null
  } catch (err) {
    console.error('ManhwaWeb details failed:', err)
    // Fallback: try with slug if available
    if (slug && slug !== mangaId) {
      try {
        const rawSlug = await window.api.invoke('manhwaweb_details', {
          mangaId: slug
        })
        const jsonSlug = safeParse(rawSlug)
        const detailsSlug = jsonSlug ? parseMangaDetails(jsonSlug, slug) : null
        if (detailsSlug) {
          setCache(cacheKey, detailsSlug)
          return detailsSlug
        }
      } catch {
        /* ignore fallback error */
      }
    }
    return null
  }
}

/**
 * Get chapter page images
 * chapterId format: {mangaId}-{chapterNumber}
 * @param {string} chapterId
 * @returns {Promise<Array<{url: string, index: number}>>}
 */
export async function manhwaGetChapterPages(chapterId) {
  const cacheKey = `mw-pages:${chapterId}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const raw = await window.api.invoke('manhwaweb_chapter', { chapterId })
    const json = safeParse(raw)

    const images = json?.chapter?.img || []

    const pages = images.map((url, idx) => ({
      url,
      index: idx
    }))

    setCache(cacheKey, pages)
    return pages
  } catch (err) {
    console.error('ManhwaWeb chapter pages failed:', err)
    return []
  }
}

/**
 * Proxy a manga image through Electron (to add Referer header)
 * @param {string} url
 * @returns {Promise<string>} blob URL for the image
 */
export async function manhwaGetImage(url) {
  try {
    const result = await window.api.invoke('manhwaweb_image', { url })
    const bytes = result?.data || result
    const contentType = result?.contentType || 'image/jpeg'
    if (!bytes || bytes.length === 0) return null
    const uint8 = new Uint8Array(bytes)
    const blob = new Blob([uint8], { type: contentType })
    return URL.createObjectURL(blob)
  } catch (err) {
    console.error('Image proxy failed:', err)
    return null
  }
}

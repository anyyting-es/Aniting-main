// src/api/animeav1.js
// AnimeAV1 scraper – adapted for Electron (uses IPC proxy for CORS-free requests)

const BASE_URL = 'https://animeav1.com'
const CDN_URL = 'https://cdn.animeav1.com'

// ── Proxy fetch through Electron IPC ──
async function proxyFetch(url, headers) {
  const result = await window.api.invoke('proxy_fetch', {
    url,
    headers: headers || {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json'
    }
  })
  return JSON.parse(result)
}

async function proxyFetchText(url, headers) {
  const result = await window.api.invoke('proxy_fetch_text', {
    url,
    headers: headers || {}
  })
  return { text: result.body, finalUrl: result.final_url }
}

// ── Resolve pointer-based data format ──
function resolveValue(data, pointer) {
  if (typeof pointer === 'number') return data[pointer]
  return pointer
}

// ── Parse search results from __data.json format ──
function parseSearchResults(json, isDub) {
  if (!json?.nodes) return []

  for (const node of json.nodes) {
    if (!node?.uses?.search_params || !node?.data?.length) continue
    const data = node.data
    const rootConfig = data[0]
    if (!rootConfig || typeof rootConfig.results !== 'number') continue

    const animePointers = data[rootConfig.results]
    if (!Array.isArray(animePointers)) continue

    return animePointers
      .map((pointer) => {
        const rawObj = data[pointer]
        if (!rawObj) return null

        const realId = resolveValue(data, rawObj.id)
        const title = resolveValue(data, rawObj.title)
        const slug = resolveValue(data, rawObj.slug)
        if (!title || !slug) return null

        const idPayload = JSON.stringify({ slug, type: isDub ? 'dub' : 'sub' })

        return {
          id: idPayload,
          title,
          image: `${CDN_URL}/covers/${realId}.jpg`,
          url: `${BASE_URL}/media/${slug}`
        }
      })
      .filter(Boolean)
  }
  return []
}

// ── Check if an episode has DUB ──
async function checkDubAvailability(slug, number) {
  const tryCheck = async (n) => {
    try {
      const url = `${BASE_URL}/media/${slug}/${n}/__data.json`
      const json = await proxyFetch(url)
      if (!json.nodes) return false

      for (const node of json.nodes) {
        if (!node?.data) continue
        const root = node.data.find((item) => item && typeof item === 'object' && 'embeds' in item)
        if (root) {
          const embedsObj = node.data[root.embeds]
          if (embedsObj && typeof embedsObj.DUB === 'number') {
            const dubList = node.data[embedsObj.DUB]
            return Array.isArray(dubList) && dubList.length > 0
          }
        }
      }
      return false
    } catch {
      return false
    }
  }

  const hasDb = await tryCheck(number)
  if (!hasDb && (number === 0 || number === 1)) {
    return await tryCheck(number === 0 ? 1 : 0)
  }
  return hasDb
}

// ── Extract streams from server list ──
async function extractStreams(data, serverList, streams) {
  const hlsHeaders = {
    Referer: 'https://animeav1.com/',
    Origin: 'https://animeav1.com',
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  }

  for (const ptr of serverList) {
    const srv = data[ptr]
    if (!srv) continue

    const serverName = resolveValue(data, srv.server)
    const link = resolveValue(data, srv.url)
    if (!serverName || !link) continue

    if (link.includes('undef') || link.includes('null') || !link.startsWith('http')) continue

    if (serverName === 'HLS') {
      const m3u8Url = link.includes('/play/') ? link.replace('/play/', '/m3u8/') : link
      let resolved = null

      try {
        const { text, finalUrl } = await proxyFetchText(m3u8Url, hlsHeaders)
        if (text.includes('#EXTM3U')) {
          resolved = finalUrl || m3u8Url
        }
      } catch {
        resolved = null
      }

      if (!resolved && link !== m3u8Url) {
        try {
          const { text, finalUrl } = await proxyFetchText(link, hlsHeaders)
          if (text.includes('#EXTM3U')) {
            resolved = finalUrl || link
          }
        } catch {
          resolved = null
        }
      }

      if (resolved) {
        streams.push({
          url: resolved,
          quality: 'HLS (Auto)',
          isM3U8: true,
          headers: hlsHeaders
        })
      }
    } else {
      streams.push({
        url: link,
        quality: serverName,
        isM3U8: false
      })
    }
  }
}

// ═══════════════════════════════════════════
// ── Public API ──
// ═══════════════════════════════════════════

export async function av1Search(query) {
  try {
    const params = new URLSearchParams({ page: '1', search: query })
    const url = `${BASE_URL}/catalogo/__data.json?${params}`
    const json = await proxyFetch(url)

    let results = parseSearchResults(json, false)
    if (results.length === 0) {
      results = parseSearchResults(json, true)
    }
    return results
  } catch {
    return []
  }
}

export async function av1GetDetails(animeId, officialId) {
  try {
    let slug
    let type = 'sub'

    try {
      const parsed = JSON.parse(animeId)
      slug = parsed.slug
      if (parsed.type) type = parsed.type
    } catch {
      slug = animeId
    }

    const url = `${BASE_URL}/media/${slug}/__data.json`
    const res = await proxyFetch(url)

    let data = null
    let mediaDescriptor = null

    if (res.nodes) {
      for (const node of res.nodes) {
        if (!node?.data) continue
        if (node.type === 'error') continue
        for (const obj of node.data) {
          if (obj && typeof obj === 'object' && 'slug' in obj && 'episodes' in obj) {
            const slugValue = resolveValue(node.data, obj.slug)
            if (slugValue === slug) {
              data = node.data
              mediaDescriptor = obj
              break
            }
          }
        }
        if (data) break
      }
    }

    // ── Fallback for movies/specials ──
    if (!data || !mediaDescriptor) {
      for (const epNum of [1, 0]) {
        try {
          const epUrl = `${BASE_URL}/media/${slug}/${epNum}/__data.json`
          const epJson = await proxyFetch(epUrl)
          if (!epJson.nodes) continue

          let hasValidStreams = false
          let hasDub = false

          for (const node of epJson.nodes) {
            if (!node?.data) continue
            const root = node.data.find(
              (item) => item && typeof item === 'object' && 'embeds' in item
            )
            if (root) {
              hasValidStreams = true
              const embedsObj = node.data[root.embeds]
              if (embedsObj?.DUB !== undefined) {
                const dubList =
                  typeof embedsObj.DUB === 'number' ? node.data[embedsObj.DUB] : embedsObj.DUB
                if (Array.isArray(dubList) && dubList.length > 0) hasDub = true
              }
              break
            }
          }

          if (hasValidStreams) {
            let title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            for (const node of epJson.nodes) {
              if (!node?.data) continue
              for (const obj of node.data) {
                if (
                  obj &&
                  typeof obj === 'object' &&
                  'title' in obj &&
                  typeof obj.title !== 'number'
                ) {
                  if (typeof obj.title === 'string' && obj.title.length > 3) {
                    title = obj.title
                    break
                  }
                }
              }
            }

            const episodeIdPayload = JSON.stringify({
              slug,
              number: epNum,
              type
            })

            return {
              id: animeId,
              title,
              episodes: [
                {
                  id: episodeIdPayload,
                  number: epNum === 0 ? 1 : epNum,
                  title,
                  url: `${BASE_URL}/media/${slug}/${epNum}`,
                  image: `${CDN_URL}/backdrops/${slug}.jpg`,
                  hasDub
                }
              ]
            }
          }
        } catch {
          continue
        }
      }
      throw new Error('Anime no encontrado')
    }

    const episodeIndexes = data[mediaDescriptor.episodes]
    if (!Array.isArray(episodeIndexes)) throw new Error('Sin episodios')

    const mediaId = resolveValue(data, mediaDescriptor.id)
    const title = resolveValue(data, mediaDescriptor.title) || slug

    // Check DUB on first episode
    let hasDub = false
    if (episodeIndexes.length > 0) {
      const firstEp = data[episodeIndexes[0]]
      let firstEpNum = 1
      if (firstEp && typeof firstEp.number === 'number') {
        const resolved = resolveValue(data, firstEp.number)
        if (typeof resolved === 'number') firstEpNum = resolved
      }
      hasDub = await checkDubAvailability(slug, firstEpNum)
    }

    const episodes = episodeIndexes
      .map((epIdx, i) => {
        const ep = data[epIdx]
        if (!ep) return null

        let realNumber = i + 1
        if (typeof ep.number === 'number') {
          const resolved = resolveValue(data, ep.number)
          if (typeof resolved === 'number') realNumber = resolved
        }

        let streamNumber = realNumber

        // Special handling for Monogatari Series: OFF & MONSTER Season (Official ID: 173533)
        // Source (AnimeAV1) has a special at ep 7, shifting everything after it by 1.
        if (String(officialId) === '173533') {
          if (realNumber >= 7) {
            streamNumber = realNumber + 1
          }
        }

        const displayNumber = realNumber === 0 && episodeIndexes.length === 1 ? 1 : realNumber

        let realTitle = `Episodio ${displayNumber}`
        if (typeof ep.title === 'number') {
          realTitle = data[ep.title] || realTitle
        } else if (ep.title) {
          realTitle = ep.title
        }

        const episodeIdPayload = JSON.stringify({
          slug,
          number: streamNumber,
          type
        })

        return {
          id: episodeIdPayload,
          number: displayNumber,
          title: realTitle,
          url: `${BASE_URL}/media/${slug}/${streamNumber}`,
          image: `${CDN_URL}/backdrops/${mediaId}.jpg`,
          hasDub
        }
      })
      .filter(Boolean)

    return { id: animeId, title, episodes }
  } catch {
    return { id: animeId, title: 'Error', episodes: [] }
  }
}

export async function av1GetStreams(episodeId, overrideType) {
  try {
    let slug
    let number
    let type = 'sub'

    const parsed = JSON.parse(episodeId)
    slug = parsed.slug
    number = parsed.number
    if (overrideType) {
      type = overrideType
    } else if (parsed.type) {
      type = parsed.type
    }

    const url = `${BASE_URL}/media/${slug}/${number}/__data.json`

    const fetchWithRetry = async (retries = 1) => {
      try {
        const json = await proxyFetch(url)
        const streams = []

        let data = null
        let root = null

        if (json.nodes) {
          for (const node of json.nodes) {
            if (!node?.data) continue
            const foundRoot = node.data.find(
              (item) => item && typeof item === 'object' && 'embeds' in item
            )
            if (foundRoot) {
              data = node.data
              root = foundRoot
              break
            }
          }
        }

        if (!data || !root) {
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 1000))
            return fetchWithRetry(retries - 1)
          }
          throw new Error('No servers found')
        }

        const embedsObj = data[root.embeds]
        const catKey = type.toUpperCase()
        const listIndex = embedsObj?.[catKey]

        if (typeof listIndex !== 'number') {
          // Fall back to other type
          const altKey = catKey === 'SUB' ? 'DUB' : 'SUB'
          const altIndex = embedsObj?.[altKey]
          if (typeof altIndex === 'number') {
            const serverList = data[altIndex]
            if (Array.isArray(serverList)) {
              await extractStreams(data, serverList, streams)
            }
          }
        } else {
          const serverList = data[listIndex]
          if (Array.isArray(serverList)) {
            await extractStreams(data, serverList, streams)
          }
        }
        return streams
      } catch (e) {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000))
          return fetchWithRetry(retries - 1)
        }
        return []
      }
    }

    return await fetchWithRetry()
  } catch {
    return []
  }
}

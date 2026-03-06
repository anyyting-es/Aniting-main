// src/renderer/src/api/hentaila.js
// Hentaila scraper mapped to Aniting's IPC proxy

const BASE_URL = 'https://hentaila.com'
const CDN_URL = 'https://cdn.hvidserv.com'

// ── Proxy fetch through Electron IPC ──
async function proxyFetch(url, headers) {
  const result = await window.api.invoke('proxy_fetch', {
    url,
    headers: headers || {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      Referer: BASE_URL + '/'
    }
  })
  return JSON.parse(result)
}

function resolveData(dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) return dataArray

  const resolved = {}
  const template = dataArray[0]

  if (typeof template !== 'object' || template === null) return dataArray

  for (const [key, index] of Object.entries(template)) {
    if (typeof index === 'number' && index >= 0 && index < dataArray.length) {
      resolved[key] = resolveValue(dataArray, index)
    } else {
      resolved[key] = index
    }
  }

  return resolved
}

function resolveValue(dataArray, index) {
  const val = dataArray[index]

  if (val === null || val === undefined) return val
  if (typeof val !== 'object') return val

  if (Array.isArray(val)) {
    return val.map((item) => {
      if (typeof item === 'number' && item >= 0 && item < dataArray.length) {
        return resolveValue(dataArray, item)
      }
      return item
    })
  }

  const obj = {}
  for (const [key, v] of Object.entries(val)) {
    if (
      typeof v === 'number' &&
      v >= 0 &&
      v < dataArray.length &&
      key !== 'id' &&
      key !== 'number' &&
      key !== 'malId' &&
      key !== 'categoryId'
    ) {
      obj[key] = resolveValue(dataArray, v)
    } else {
      obj[key] = v
    }
  }
  return obj
}

function parseSvelteData(raw) {
  if (!raw || !raw.nodes) return null

  const results = []
  for (const node of raw.nodes) {
    if (!node || node.type !== 'data' || !node.data) continue
    results.push(resolveData(node.data))
  }
  return results
}

function extractM3U8FromVIP(vipUrl) {
  if (!vipUrl) return null
  const match = vipUrl.match(/\/play\/([a-f0-9]+)/)
  if (!match) return null
  return `${CDN_URL}/m3u8/${match[1]}`
}

export async function hentailaSearch(query) {
  try {
    let slug = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // return mock result with the guessed slug so `hentailaGetStreams` can do the actual parsing
    return [{ id: slug, slug, title: query }]
  } catch (error) {
    return []
  }
}

export async function hentailaGetDetails(slug) {
  try {
    const url = `${BASE_URL}/media/${slug}/1/__data.json`
    const raw = await proxyFetch(url)

    let mediaInfo = null
    let episodesList = []

    for (const node of raw.nodes) {
      if (!node || node.type !== 'data') continue
      const data = node.data
      if (!data) continue

      const template = data[0]
      if (template && typeof template === 'object' && 'media' in template) {
        const mediaIdx = template.media
        if (typeof mediaIdx === 'number') {
          const mediaTemplate = data[mediaIdx]
          if (mediaTemplate && typeof mediaTemplate === 'object') {
            mediaInfo = {}
            for (const [key, idx] of Object.entries(mediaTemplate)) {
              if (typeof idx === 'number' && idx >= 0 && idx < data.length) {
                const val = data[idx]
                if (key === 'episodes' && Array.isArray(val)) {
                  episodesList = val.map((epIdx) => {
                    if (typeof epIdx === 'number') {
                      const epTemplate = data[epIdx]
                      if (epTemplate && typeof epTemplate === 'object') {
                        const ep = {}
                        for (const [k, v] of Object.entries(epTemplate)) {
                          ep[k] = typeof v === 'number' && v >= 0 && v < data.length ? data[v] : v
                        }
                        return ep
                      }
                    }
                    return epIdx
                  })
                } else {
                  mediaInfo[key] = val
                }
              } else {
                mediaInfo[key] = idx
              }
            }
          }
        }
      }
    }

    if (!mediaInfo) throw new Error('Media not found')

    // Sort episodes
    episodesList = episodesList.sort((a, b) => (a.number || 0) - (b.number || 0))

    const parsedEpisodes = episodesList.map((ep, i) => {
      const title =
        ep.title && typeof ep.title === 'string' ? ep.title : `Episode ${ep.number || i + 1}`
      return {
        id: JSON.stringify({ slug, number: ep.number || i + 1 }),
        number: ep.number || i + 1,
        title: title,
        url: `${BASE_URL}/media/${slug}/${ep.number || i + 1}`,
        hasDub: false
      }
    })

    return {
      id: slug,
      title: mediaInfo.title || slug,
      episodes: parsedEpisodes
    }
  } catch (error) {
    console.error(error)
    return { id: slug, title: 'Error', episodes: [] }
  }
}

export async function hentailaGetStreams(episodeId) {
  try {
    const { slug, number } = JSON.parse(episodeId)
    const url = `${BASE_URL}/media/${slug}/${number}/__data.json`
    const raw = await proxyFetch(url)
    // const parsed = parseSvelteData(raw)

    let embeds = []

    for (const node of raw.nodes) {
      if (!node || node.type !== 'data') continue
      const data = node.data
      if (!data) continue

      const template = data[0]
      if (template && typeof template === 'object' && 'embeds' in template) {
        const embedsIndex = template.embeds
        if (typeof embedsIndex === 'number') {
          const embedsMap = data[embedsIndex]
          if (embedsMap && typeof embedsMap === 'object') {
            for (const [variant, variantIndex] of Object.entries(embedsMap)) {
              const embedArray = data[variantIndex]
              if (Array.isArray(embedArray)) {
                for (const embedIdx of embedArray) {
                  const embedObj = data[embedIdx]
                  if (embedObj && typeof embedObj === 'object') {
                    const serverIdx = embedObj.server
                    const urlIdx = embedObj.url
                    const server = typeof serverIdx === 'number' ? data[serverIdx] : serverIdx
                    const embedUrl = typeof urlIdx === 'number' ? data[urlIdx] : urlIdx

                    embeds.push({
                      variant,
                      server: server || 'Unknown',
                      url: embedUrl || null
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    const streams = []
    for (const embed of embeds) {
      if (!embed.url) continue
      if (embed.server === 'VIP') {
        const m3u8Url = extractM3U8FromVIP(embed.url)
        if (m3u8Url) {
          streams.push({
            url: m3u8Url,
            quality: 'Hentaila VIP (HLS)',
            isM3U8: true,
            needsProxy: true
          })
        }
      } else {
        streams.push({
          url: embed.url,
          quality: embed.server,
          isM3U8: false
        })
      }
    }

    return streams
  } catch (error) {
    console.error('Error fetching Hentaila streams:', error)
    return []
  }
}

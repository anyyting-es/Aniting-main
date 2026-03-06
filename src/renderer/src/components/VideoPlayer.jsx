import axios from 'axios'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@radix-ui/themes'
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  PersonIcon,
  DownloadIcon,
  UploadIcon
} from '@radix-ui/react-icons'
import { toast } from 'sonner'
import Hls from 'hls.js'
import { av1GetStreams, av1Search, av1GetDetails } from '../api/animeav1'
import { hentailaSearch, hentailaGetDetails, hentailaGetStreams } from '../api/hentaila'
import { pickBestResult } from '../utils/bestMatch'
import CustomVideoPlayer from '../components/CustomVideoPlayer'
import { useAnitingContext } from '../utils/ContextProvider'
import useGetAniskipTimes from '../hooks/useGetAniskipTimes'
import formatBytes from '../utils/formatBytes'
import { setWatchedEpisodes } from '../utils/helper'
import {
  savePlaybackPosition,
  getPlaybackPosition,
  setLocalWatchedEpisodes,
  setLocalAnimeStatus,
  getLocalAnimeEntry
} from '../utils/localAnimeStore'

function TorrentStats({ magnetURI, backendPort }) {
  const [details, setDetails] = useState(null)

  useEffect(() => {
    if (!magnetURI) return
    const fetchDetails = () => {
      fetch(`http://localhost:${backendPort}/details/${encodeURIComponent(magnetURI)}`)
        .then((r) => r.json())
        .then(setDetails)
        .catch(() => { })
    }
    fetchDetails()
    const interval = setInterval(fetchDetails, 1000)
    return () => clearInterval(interval)
  }, [magnetURI, backendPort])

  if (!details) return null

  return (
    <div className="mt-3 flex items-center gap-x-4 rounded-md border border-white/5 bg-white/[0.02] px-4 py-2 text-xs tracking-wider text-gray-400">
      <div className="flex items-center gap-x-1.5" title="Pares conectados">
        <PersonIcon width="14" height="14" /> <span>{details.numPeers} pares</span>
      </div>
      <div className="flex items-center gap-x-1.5" title="Velocidad de descarga">
        <DownloadIcon width="14" height="14" />{' '}
        <span>{formatBytes(details.downloadSpeed).replace(' ', '')}/s</span>
      </div>
      <div className="flex items-center" title="Progreso de descarga">
        <span>{((details.progress || 0) * 100).toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-x-1.5" title="Velocidad de subida">
        <UploadIcon width="14" height="14" />{' '}
        <span>{formatBytes(details.uploadSpeed).replace(' ', '')}/s</span>
      </div>
      {details.timeRemaining && details.timeRemaining < Infinity && (
        <div className="text-gray-500" title="Tiempo restante">
          ~{Math.ceil(details.timeRemaining / 60000)} min restante
        </div>
      )}
    </div>
  )
}

export default function VideoPlayer() {
  const loc = useLocation()
  const navigate = useNavigate()
  const { vlcPath, backendPort } = useAnitingContext()
  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  const {
    streamType, // 'hls' or 'torrent'
    streamUrl: initialStreamUrl, // Used for HLS or direct file URL
    magnetUri, // Used for torrents
    streamHeaders: initialStreamHeaders,
    streamQuality: initialStreamQuality,
    episodeTitle,
    episodeNumber,
    animeTitle,
    bannerImage,
    animeCoverImage,
    discordRpcActivity,
    animeId,
    malId,
    progress,
    totalEpisodes,
    nextEpisodeTitle,
    nextEpisodeThumbnail,
    hasDub: hasDubProp,
    episodeIdPayload: initialEpisodeIdPayload,
    episodeDescription,
    // Instant navigation props
    pendingAutoStream,
    pendingNextEpId,
    animeName: animeNameProp,
    animeRomaji,
    animeEnglish,
    isAdult,
    audioTypeHint
  } = loc.state || {}

  const [streamUrl, setStreamUrl] = useState(initialStreamUrl || null)
  const [streamHeaders, setStreamHeaders] = useState(initialStreamHeaders || null)
  const [streamQuality, setStreamQualityState] = useState(initialStreamQuality || '')
  const [episodeIdPayload, setEpisodeIdPayload] = useState(initialEpisodeIdPayload || null)
  const [hasDub, setHasDub] = useState(!!hasDubProp)

  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [videoSrc, setVideoSrc] = useState('')
  const [loadingNextEp, setLoadingNextEp] = useState(false)
  const [resolvingStream, setResolvingStream] = useState(
    !!pendingAutoStream || (!!pendingNextEpId && !initialStreamUrl)
  )
  const watchedMarkedRef = useRef(false)

  // Dynamic metadata that can be populated after resolver fetches details
  const [dynEpisodeDescription, setDynEpisodeDescription] = useState(episodeDescription || '')
  // Add state to track dynamically fetched title in case loc.state is missing it
  const [dynEpisodeTitle, setDynEpisodeTitle] = useState(episodeTitle || '')
  const [dynNextEpisodeTitle, setDynNextEpisodeTitle] = useState(nextEpisodeTitle || '')
  const [dynNextEpisodeThumbnail, setDynNextEpisodeThumbnail] = useState(nextEpisodeThumbnail || '')

  // HLS Specific
  const [qualities, setQualities] = useState([])
  const [currentQuality, setCurrentQuality] = useState(-1)

  // AniSkip — fetch OP/ED skip times
  const { data: skipTimes } = useGetAniskipTimes(malId, episodeNumber)

  // Subtitles
  const [subtitleContent, setSubtitleContent] = useState(null)
  const [subtitleTracks, setSubtitleTracks] = useState([])
  const [currentSubTrack, setCurrentSubTrack] = useState(0)
  const [subsLoading, setSubsLoading] = useState(false)
  const [fontUrls, setFontUrls] = useState([])
  const subRetryTimerRef = useRef(null)
  const subRetryCountRef = useRef(0)

  // Audio type (Sub/Dub)
  const [audioType, setAudioType] = useState(audioTypeHint || 'sub')
  const [audioSwitching, setAudioSwitching] = useState(false)

  // Discord RPC
  function setDiscordRPC() {
    if (!discordRpcActivity) return
    let stateTxt = `Episodio ${episodeNumber}: ${episodeTitle}`
    window.api.setDiscordRpc({
      ...discordRpcActivity,
      state: stateTxt
    })
  }

  useEffect(() => {
    setDiscordRPC()
    return () => {
      window.api.setDiscordRpc({ details: 'Browsing Aniting', state: 'Buscando qué ver...' })
    }
  }, [discordRpcActivity])

  // Clean up subtitle retry timer on unmount
  useEffect(() => {
    return () => {
      if (subRetryTimerRef.current) clearTimeout(subRetryTimerRef.current)
    }
  }, [])

  // ── Resolve stream when navigated with pendingAutoStream or pendingNextEpId ──
  useEffect(() => {
    // Case 1: We already have a stream URL — nothing to resolve
    if (initialStreamUrl) return
    // Case 2: No pending resolution needed
    if (!pendingAutoStream && !pendingNextEpId) return

    let cancelled = false

    async function resolveStream() {
      setResolvingStream(true)
      setIsLoading(true)
      setErrorMsg('')

      try {
        // ── Fast path: we know the episode ID (next ep navigation) ──
        if (pendingNextEpId) {
          const streams = await av1GetStreams(
            pendingNextEpId,
            audioTypeHint && audioTypeHint !== 'sub' ? audioTypeHint : undefined
          )
          if (!cancelled && streams && streams.length > 0) {
            const stream = streams[0]
            setStreamUrl(stream.url)
            setStreamHeaders(stream.headers || null)
            setStreamQualityState(stream.quality || 'HLS')
            setEpisodeIdPayload(pendingNextEpId)
          } else if (!cancelled) {
            setErrorMsg('No se encontró stream para el siguiente episodio.')
            setIsLoading(false)
          }

          // Also fetch details to populate episode descriptions & next episode info
          if (!cancelled) {
            try {
              const parsed = JSON.parse(pendingNextEpId)
              const detailId = JSON.stringify({
                slug: parsed.slug,
                type: parsed.type || 'sub'
              })
              const details = await av1GetDetails(detailId, animeId)
              if (details?.episodes?.length) {
                const currentEp = details.episodes.find(
                  (ep) => ep.number === (parsed.number ?? episodeNumber)
                )
                const nextEp = details.episodes.find(
                  (ep) => ep.number === (parsed.number ?? episodeNumber) + 1
                )
                if (currentEp) {
                  setDynEpisodeDescription(currentEp.description || '')
                  // If we are navigating to this ep via "Next Episode" or "History", title might be missing in loc.state.
                  if (currentEp.title) setDynEpisodeTitle(currentEp.title)
                }

                if (nextEp) {
                  setDynNextEpisodeTitle(nextEp.title || `Episodio ${nextEp.number}`)
                  setDynNextEpisodeThumbnail(nextEp.image || '')
                } else {
                  setDynNextEpisodeTitle(`Episodio ${(parsed.number ?? episodeNumber) + 1}`)
                  setDynNextEpisodeThumbnail('')
                }

                if (currentEp?.hasDub !== undefined) setHasDub(currentEp.hasDub)
              } else {
                setDynNextEpisodeTitle(`Episodio ${(parsed.number ?? episodeNumber) + 1}`)
              }
            } catch (e) {
              console.warn('Could not fetch episode metadata:', e.message)
            }
          }

          if (!cancelled) setResolvingStream(false)
          return
        }

        // ── Search path: auto-select from anime name ──
        const animeName = animeNameProp || animeRomaji || animeEnglish || animeTitle || ''
        if (!animeName) {
          setErrorMsg('No se encontró nombre del anime')
          setResolvingStream(false)
          setIsLoading(false)
          return
        }

        // Try AnimeAV1 first
        let resolved = false
        try {
          const searchResults = await av1Search(animeName)
          if (searchResults && searchResults.length > 0) {
            const best = pickBestResult(searchResults, {
              romaji: animeRomaji,
              english: animeEnglish
            })
            const details = await av1GetDetails(best.id, animeId)
            if (details?.episodes?.length) {
              const epNum = episodeNumber || 1
              const matchedEp =
                details.episodes.find((ep) => ep.number === epNum) || details.episodes[0]
              const streams = await av1GetStreams(matchedEp.id)
              if (!cancelled && streams && streams.length > 0) {
                const stream = streams[0]
                setStreamUrl(stream.url)
                setStreamHeaders(stream.headers || null)
                setStreamQualityState(stream.quality || 'HLS')
                setEpisodeIdPayload(matchedEp.id)
                setHasDub(matchedEp.hasDub || false)
                resolved = true

                // Populate episode metadata (description, title, next episode info)
                if (matchedEp.title) setDynEpisodeTitle(matchedEp.title)
                if (matchedEp.description) setDynEpisodeDescription(matchedEp.description)

                const nextEp = details.episodes.find((ep) => ep.number === epNum + 1)
                if (nextEp) {
                  setDynNextEpisodeTitle(nextEp.title || `Episodio ${epNum + 1}`)
                  setDynNextEpisodeThumbnail(nextEp.image || '')
                } else {
                  setDynNextEpisodeTitle(`Episodio ${epNum + 1}`)
                  setDynNextEpisodeThumbnail('')
                }
              }
            }
          }
        } catch (e) {
          console.warn('AnimeAV1 autoSelect failed, trying fallback...', e.message)
        }

        // Fallback to Hentaila for adult content
        if (!resolved && isAdult) {
          try {
            const searchResults = await hentailaSearch(animeName)
            if (searchResults && searchResults.length > 0) {
              const details = await hentailaGetDetails(searchResults[0].id)
              if (details?.episodes?.length) {
                const epNum = episodeNumber || 1
                const matchedEp =
                  details.episodes.find((ep) => ep.number === epNum) || details.episodes[0]
                const streams = await hentailaGetStreams(matchedEp.id)
                if (!cancelled && streams && streams.length > 0) {
                  const stream = streams[0]
                  setStreamUrl(stream.url)
                  setStreamHeaders(stream.headers || null)
                  setStreamQualityState(stream.quality || 'HLS')
                  resolved = true
                }
              }
            }
          } catch (e) {
            console.warn('Hentaila fallback failed:', e.message)
          }
        }

        if (!cancelled && !resolved) {
          setErrorMsg(
            'No se encontró stream disponible. Regresa a la página del anime e intenta manualmente.'
          )
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error resolving stream:', err)
          setErrorMsg('Error al buscar stream: ' + (err.message || ''))
          setIsLoading(false)
        }
      } finally {
        if (!cancelled) setResolvingStream(false)
      }
    }

    resolveStream()
    return () => {
      cancelled = true
    }
  }, [pendingAutoStream, pendingNextEpId])

  // Core stream initialization logic based on type
  useEffect(() => {
    // Don't init HLS until stream is resolved
    if (streamType === 'hls' && (resolvingStream || !streamUrl)) {
      return
    }
    // Torrents use magnetUri, not streamUrl
    if (streamType === 'torrent' && !magnetUri) {
      return
    }
    if (!streamType) return

    setIsLoading(true)
    setErrorMsg('')

    if (streamType === 'hls') {
      initHLS()
    } else if (streamType === 'torrent') {
      initTorrent()
    } else {
      setErrorMsg('Tipo de stream no reconocido.')
      setIsLoading(false)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      // Cancel any pending subtitle retries
      if (subRetryTimerRef.current) {
        clearTimeout(subRetryTimerRef.current)
        subRetryTimerRef.current = null
      }
      subRetryCountRef.current = 0
    }
  }, [streamType, streamUrl, magnetUri])

  async function initTorrent() {
    try {
      // Add torrent to WebTorrent backend (starts downloading/seeding)
      await axios.get(`http://localhost:${backendPort}/add/${encodeURIComponent(magnetUri)}`)
      // Build the stream URL — the <video> element will fetch this directly
      const url = `http://localhost:${backendPort}/stream/${encodeURIComponent(magnetUri)}`
      setVideoSrc(url)
      setIsLoading(false)

      // Prioritize the full MKV download so subtitles can be extracted ASAP
      axios
        .get(`http://localhost:${backendPort}/prioritize-file/${encodeURIComponent(magnetUri)}`)
        .then(() => console.log('[Priority] MKV file prioritized for full download'))
        .catch((err) => console.warn('[Priority] Could not prioritize file:', err.message))

      // Fetch fonts and subtitle tracks in parallel (non-blocking)
      fetchFonts()
      fetchSubtitleTracksAndAutoLoad()
    } catch (error) {
      console.error('Error init torrent:', error)
      setErrorMsg('No se pudo iniciar el stream del Torrent. El servidor esta corriendo?')
      toast.error('Error al transmitir video', {
        duration: 5000,
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description: 'Asegurate que el backend este ejecutandose.',
        classNames: { title: 'text-rose-500' }
      })
      setIsLoading(false)
    }
  }

  // Fetch font attachments from the torrent (for JASSUB rendering)
  async function fetchFonts() {
    try {
      const resp = await axios.get(
        `http://localhost:${backendPort}/fonts/${encodeURIComponent(magnetUri)}`
      )
      if (resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
        const urls = resp.data.map(
          (f) =>
            `http://localhost:${backendPort}/fonts/${encodeURIComponent(magnetUri)}?fontname=${encodeURIComponent(f.name)}`
        )
        setFontUrls(urls)
        console.log(`[Fonts] Found ${urls.length} font attachments`)
      }
    } catch (err) {
      console.warn('[Fonts] Could not fetch font list:', err.message)
    }
  }

  // Fetch subtitle tracks list, then auto-load the first track
  async function fetchSubtitleTracksAndAutoLoad() {
    try {
      const resp = await axios.get(
        `http://localhost:${backendPort}/subtitle-tracks/${encodeURIComponent(magnetUri)}`
      )
      if (resp.data && resp.data.length > 0) {
        setSubtitleTracks(resp.data)
        console.log('[Subtitles] Tracks found:', resp.data)
        // Auto-load the first subtitle track
        subRetryCountRef.current = 0
        fetchSubtitles(0)
      }
    } catch (err) {
      console.warn('[Subtitles] Could not fetch tracks:', err.message)
    }
  }

  // Fetch subtitle content for a specific track (with progressive auto-retry)
  async function fetchSubtitles(trackIndex = 0) {
    setSubsLoading(true)
    try {
      const resp = await axios.get(
        `http://localhost:${backendPort}/subtitles/${encodeURIComponent(magnetUri)}?track=${trackIndex}`,
        { timeout: 30000 } // 30s — backend responds in ~10s
      )
      if (resp.data && typeof resp.data === 'string' && resp.data.length > 0) {
        setSubtitleContent(resp.data)
        setCurrentSubTrack(trackIndex)

        const isPartial = resp.headers['x-subtitles-partial'] === 'true'
        const lineCount = resp.headers['x-subtitles-lines'] || '?'
        const fileProgress = resp.headers['x-file-progress']
        const pct = fileProgress ? (parseFloat(fileProgress) * 100).toFixed(1) : null
        console.log(
          `[Subtitles] Loaded track ${trackIndex} (${resp.data.length} bytes, partial=${isPartial}, lines=${lineCount}, progress=${pct}%)`
        )

        if (isPartial) {
          toast.success('Subtítulos parciales cargados', {
            duration: 3000,
            description: `${lineCount} líneas — ${pct ? `archivo ${pct}% descargado` : 'completando en segundo plano...'}`
          })

          // Auto-retry to get more subtitles as torrent downloads
          const MAX_RETRIES = 30
          if (subRetryCountRef.current < MAX_RETRIES) {
            subRetryCountRef.current++
            console.log(
              `[Subtitles] Scheduling retry ${subRetryCountRef.current}/${MAX_RETRIES} in 5s...`
            )
            if (subRetryTimerRef.current) clearTimeout(subRetryTimerRef.current)
            subRetryTimerRef.current = setTimeout(() => {
              fetchSubtitles(trackIndex)
            }, 5000)
          }
        } else {
          // Full subtitles loaded — stop retrying
          subRetryCountRef.current = 0
          if (subRetryTimerRef.current) {
            clearTimeout(subRetryTimerRef.current)
            subRetryTimerRef.current = null
          }
          toast.success('Subtítulos completos ✓', {
            duration: 3000,
            description: `Pista ${trackIndex + 1} lista (${lineCount} líneas)`
          })
        }
      }
    } catch (err) {
      console.warn('[Subtitles] Extraction failed:', err.message)
      // Schedule retry regardless — subs will come when more of the file is downloaded
      const MAX_RETRIES = 30
      if (subRetryCountRef.current < MAX_RETRIES) {
        if (subRetryCountRef.current === 0) {
          // First attempt failed — show informative toast
          toast('Descargando archivo para extraer subtítulos...', {
            duration: 4000,
            description: 'Se reintentará cada 5 segundos conforme se descarga el torrent.'
          })
        }
        subRetryCountRef.current++
        console.log(`[Subtitles] Retry ${subRetryCountRef.current}/${MAX_RETRIES} in 5s...`)
        if (subRetryTimerRef.current) clearTimeout(subRetryTimerRef.current)
        subRetryTimerRef.current = setTimeout(() => {
          fetchSubtitles(trackIndex)
        }, 5000)
      }
    } finally {
      setSubsLoading(false)
    }
  }

  function handleSubtitleTrackChange(trackIndex) {
    if (trackIndex !== currentSubTrack) {
      // Reset retry state for the new track
      subRetryCountRef.current = 0
      if (subRetryTimerRef.current) {
        clearTimeout(subRetryTimerRef.current)
        subRetryTimerRef.current = null
      }
      fetchSubtitles(trackIndex)
    }
  }

  function initHLS() {
    if (!streamUrl) {
      setErrorMsg('No se proporciono URL de stream HLS')
      setIsLoading(false)
      return
    }

    const video = videoRef.current
    if (!video) return

    // Proxy CDN URLs that need Referer header (e.g. Hentaila)
    let hlsUrl = streamUrl
    if (hlsUrl.includes('cdn.hvidserv.com')) {
      hlsUrl = hlsUrl.replace(
        'https://cdn.hvidserv.com/',
        `http://127.0.0.1:${backendPort}/hls-proxy/`
      )
      console.log('[HLS] Proxying through backend:', hlsUrl)
    }

    setVideoSrc('') // Let HLS handle the source buffer

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          if (streamHeaders) {
            Object.entries(streamHeaders).forEach(([key, value]) => {
              try {
                xhr.setRequestHeader(key, value)
              } catch { }
            })
          }
        },
        enableWorker: true
      })
      hlsRef.current = hls
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, _data) => {
        setIsLoading(false)
        const levels = hls.levels.map((level, index) => ({
          index,
          label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`
        }))
        setQualities(levels)
        video.play().catch(() => { })
      })

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad()
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
          } else {
            setErrorMsg('Error fatal al reproducir stream HLS')
            hls.destroy()
            setIsLoading(false)
          }
        }
      })

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentQuality(data.level))
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false)
        video.play().catch(() => { })
      })
    } else {
      setErrorMsg('Tu navegador no soporta HLS')
      setIsLoading(false)
    }
  }

  // Keyboard playback controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return
      }
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(video.currentTime - 5, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          video.currentTime = Math.min(video.currentTime + 5, video.duration || 0)
          break
        case ' ':
          e.preventDefault()
          if (video.paused) video.play()
          else video.pause()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          if (document.fullscreenElement) document.exitFullscreen()
          else {
            const container = video.closest('[data-player-root]')
            if (container) container.requestFullscreen()
          }
          break
        case 'm':
        case 'M':
          e.preventDefault()
          video.muted = !video.muted
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Save playback position periodically & mark episode as watched at 80% ──
  useEffect(() => {
    const video = videoRef.current
    if (!video || !animeId || !episodeNumber) return
    let lastSaveTime = 0
    let localEntryEnsured = false

    function onTimeUpdate() {
      const dur = video.duration
      const cur = video.currentTime
      if (!dur || dur <= 0) return

      // Ensure the anime has a local entry so it shows in "Seguir Viendo" right away
      if (!localEntryEnsured) {
        localEntryEnsured = true
        const existing = getLocalAnimeEntry(animeId)
        if (!existing || !existing.status) {
          setLocalAnimeStatus(animeId, 'CURRENT', {
            title: animeTitle || '',
            coverImage: animeCoverImage || '',
            bannerImage: bannerImage || '',
            episodes: totalEpisodes || 0
          })
        }
      }

      // Save playback position every 5 seconds
      if (cur - lastSaveTime >= 5 || lastSaveTime === 0) {
        lastSaveTime = cur
        savePlaybackPosition(animeId, episodeNumber, cur, dur)
      }

      // Mark as watched at 80%
      if (watchedMarkedRef.current) return
      const pct = cur / dur
      if (pct >= 0.8) {
        watchedMarkedRef.current = true
        const newProgress = Math.max(episodeNumber, progress || 0)

        // Always save locally
        setLocalWatchedEpisodes(animeId, newProgress, {
          title: animeTitle || '',
          episodes: totalEpisodes || 0,
          coverImage: animeCoverImage || '',
          bannerImage: bannerImage || '',
        })

        // Update on Anilist if logged in
        const anilistToken = localStorage.getItem('anilist_token')
        if (anilistToken && newProgress > (progress || 0)) {
          setWatchedEpisodes(animeId, newProgress)
            .then(() => {
              toast.success(`Episodio ${episodeNumber} marcado como visto`, {
                duration: 3000,
                description: 'Progreso actualizado en AniList'
              })
            })
            .catch((err) => {
              console.error('Error updating Anilist progress:', err)
              toast.success(`Episodio ${episodeNumber} marcado como visto`, {
                duration: 3000,
                description: 'Progreso guardado localmente'
              })
            })
        } else {
          toast.success(`Episodio ${episodeNumber} marcado como visto`, {
            duration: 3000,
            description: 'Progreso guardado localmente'
          })
        }
      }
    }

    // Restore playback position when video loads
    function onLoadedMetadata() {
      const saved = getPlaybackPosition(animeId, episodeNumber)
      if (saved && saved.currentTime > 0 && saved.percentage < 95) {
        video.currentTime = saved.currentTime
        toast.info(
          `Retomando desde ${Math.floor(saved.currentTime / 60)}:${String(Math.floor(saved.currentTime % 60)).padStart(2, '0')}`,
          {
            duration: 3000
          }
        )
      }
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      // Save position one last time on unmount
      if (video.currentTime > 0 && video.duration > 0) {
        savePlaybackPosition(animeId, episodeNumber, video.currentTime, video.duration)
      }
    }
  }, [animeId, episodeNumber, progress])

  function handleQualityChange(idx) {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = idx
      setCurrentQuality(idx)
    }
  }

  // Navigate to the next episode instantly — stream resolves in the new page
  function handleNextEpisode() {
    if (loadingNextEp) return

    // Destroy current HLS before navigating
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const nextNumber = (episodeNumber || 0) + 1

    if (streamType === 'hls' && episodeIdPayload) {
      try {
        const parsed = JSON.parse(episodeIdPayload)
        const nextEpId = JSON.stringify({ ...parsed, number: (parsed.number || episodeNumber) + 1 })

        navigate('/video', {
          state: {
            pendingAutoStream: false,
            streamType: 'hls',
            streamUrl: null,
            pendingNextEpId: nextEpId,
            streamQuality: streamQuality,
            episodeTitle: dynNextEpisodeTitle || `Episodio ${nextNumber}`,
            episodeNumber: nextNumber,
            animeTitle,
            animeRomaji: animeRomaji || animeTitle,
            animeEnglish: animeEnglish || '',
            animeName: animeNameProp || animeTitle,
            bannerImage,
            animeCoverImage,
            discordRpcActivity,
            animeId,
            malId,
            progress: Math.max(episodeNumber, progress || 0),
            totalEpisodes,
            hasDub: hasDub,
            episodeIdPayload: nextEpId,
            episodeDescription: '',
            nextEpisodeTitle: '',
            nextEpisodeThumbnail: '',
            audioTypeHint: audioType,
            isAdult
          },
          replace: true
        })
        return
      } catch {
        // Fall through to search-based fallback
      }
    }

    // Fallback: use search-based auto-resolution for next episode
    if (streamType === 'hls') {
      navigate('/video', {
        state: {
          pendingAutoStream: true,
          streamType: 'hls',
          streamUrl: null,
          episodeTitle: `Episodio ${nextNumber}`,
          episodeNumber: nextNumber,
          animeTitle,
          animeName: animeNameProp || animeTitle,
          animeRomaji: animeRomaji || animeTitle,
          animeEnglish: animeEnglish || '',
          bannerImage,
          animeCoverImage,
          discordRpcActivity,
          animeId,
          malId,
          progress: Math.max(episodeNumber, progress || 0),
          totalEpisodes,
          isAdult,
          episodeDescription: '',
          nextEpisodeTitle: '',
          nextEpisodeThumbnail: '',
          audioTypeHint: audioType
        },
        replace: true
      })
    } else {
      // Torrent streams don't have next-episode resolution
      if (animeId) navigate(`/anime/${animeId}`)
      else navigate(-1)
    }
  }

  return (
    <div className="flex flex-col items-center pb-16 pt-6 font-space-mono">
      {/* Error Output */}
      {errorMsg && (
        <div className="flex flex-col items-center gap-y-4 px-8 py-20">
          <ExclamationTriangleIcon height="32" width="32" color="#ef4444" />
          <p className="text-lg text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Video + Info Section */}
      {!errorMsg && (
        <>
          {/* Video Player — centered, wider */}
          <div className="w-full max-w-[1402px] px-6">
            <CustomVideoPlayer
              ref={videoRef}
              src={videoSrc || undefined}
              streamType={streamType}
              magnetURI={magnetUri}
              isLoading={isLoading}
              poster={bannerImage || animeCoverImage}
              subtitleContent={subtitleContent}
              subtitleTracks={subtitleTracks}
              currentSubTrack={currentSubTrack}
              onSubtitleTrackChange={handleSubtitleTrackChange}
              onLoadSubtitles={fetchSubtitles}
              subsLoading={subsLoading}
              fontUrls={fontUrls}
              hasDub={!!hasDub}
              audioType={audioType}
              audioSwitching={audioSwitching}
              skipTimes={skipTimes}
              onAudioToggle={async () => {
                if (!hasDub || audioSwitching) return
                const newType = audioType === 'sub' ? 'dub' : 'sub'
                setAudioSwitching(true)
                try {
                  // Save current time before switching
                  const savedTime = videoRef.current?.currentTime || 0
                  // Re-fetch stream with alternate audio type
                  if (episodeIdPayload) {
                    const streams = await av1GetStreams(episodeIdPayload, newType)
                    if (streams && streams.length > 0) {
                      const newStream = streams[0]
                      // Destroy old HLS instance
                      if (hlsRef.current) {
                        hlsRef.current.destroy()
                        hlsRef.current = null
                      }
                      setAudioType(newType)
                      // Re-init HLS with new stream URL
                      const video = videoRef.current
                      if (video && Hls.isSupported()) {
                        let hlsUrl = newStream.url
                        const hls = new Hls({
                          xhrSetup: (xhr) => {
                            if (newStream.headers) {
                              Object.entries(newStream.headers).forEach(([key, value]) => {
                                try {
                                  xhr.setRequestHeader(key, value)
                                } catch { }
                              })
                            }
                          },
                          enableWorker: true
                        })
                        hlsRef.current = hls
                        hls.loadSource(hlsUrl)
                        hls.attachMedia(video)
                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                          video.currentTime = savedTime
                          video.play().catch(() => { })
                          const levels = hls.levels.map((level, index) => ({
                            index,
                            label: level.height
                              ? `${level.height}p`
                              : `${Math.round(level.bitrate / 1000)}kbps`
                          }))
                          setQualities(levels)
                        })
                        hls.on(Hls.Events.ERROR, (_e, data) => {
                          if (data.fatal) {
                            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
                            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR)
                              hls.recoverMediaError()
                          }
                        })
                      }
                    } else {
                      toast.error('No se encontraron streams para ' + newType.toUpperCase())
                    }
                  }
                } catch (err) {
                  console.error('Audio toggle error:', err)
                  toast.error('Error al cambiar audio')
                } finally {
                  setAudioSwitching(false)
                }
              }}
            />
          </div>

          {/* Info row below video — Crunchyroll style */}
          <div className="w-full max-w-[1402px] px-6 pt-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              {/* Left: Episode info */}
              <div className="flex min-w-0 flex-1 flex-col gap-y-1.5">
                <div className="flex items-center gap-x-3">
                  <h1
                    className="cursor-pointer text-base font-semibold tracking-wide text-purple-400 transition-colors hover:text-purple-300"
                    onClick={() => animeId && navigate(`/anime/${animeId}`)}
                    title="Ir al anime"
                  >
                    {animeTitle || 'Reproduciendo'}
                  </h1>
                </div>
                <p className="text-sm font-medium text-white">
                  E{episodeNumber} – {dynEpisodeTitle || `Episodio ${episodeNumber}`}
                </p>
                {dynEpisodeDescription && (
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-400">
                    {dynEpisodeDescription}
                  </p>
                )}

                {/* Quality Control for HLS */}
                {streamType === 'hls' && qualities.length > 1 && (
                  <div className="mt-3 flex items-center gap-x-2">
                    <span className="text-xs text-gray-400">Calidad:</span>
                    <Button
                      size="1"
                      variant={currentQuality === -1 ? 'solid' : 'soft'}
                      color={currentQuality === -1 ? 'purple' : 'gray'}
                      onClick={() => handleQualityChange(-1)}
                    >
                      Auto
                    </Button>
                    {qualities.map((q) => (
                      <Button
                        key={q.index}
                        size="1"
                        variant={currentQuality === q.index ? 'solid' : 'soft'}
                        color={currentQuality === q.index ? 'purple' : 'gray'}
                        onClick={() => handleQualityChange(q.index)}
                      >
                        {q.label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Torrent stats + open in VLC */}
                {streamType === 'torrent' && magnetUri && (
                  <>
                    <TorrentStats magnetURI={magnetUri} backendPort={backendPort} />
                    <div className="mt-3 flex items-center gap-x-3">
                      <Button
                        size="1"
                        color="orange"
                        variant="soft"
                        onClick={async () => {
                          try {
                            const url = `http://localhost:${backendPort}/stream/${encodeURIComponent(magnetUri)}`
                            window.api.openVlc(`${vlcPath} "${url}"`)
                            toast.success('Reproduciendo en VLC', {
                              description: 'Abriendo reproductor externo...'
                            })
                          } catch (e) {
                            toast.error('Error al abrir VLC', {
                              description: 'Recuerda configurar la ruta de VLC en los Ajustes.'
                            })
                          }
                        }}
                      >
                        Abrir en VLC / Player Externo
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Next Episode Card — only when we have actual data for the next episode */}
              {(dynNextEpisodeTitle ||
                (streamType === 'hls' && episodeIdPayload && episodeNumber < totalEpisodes)) && (
                  <div className="shrink-0 lg:w-[320px]">
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-gray-500">
                      {loadingNextEp ? 'Cargando siguiente...' : 'Siguiente episodio'}
                    </p>
                    <div
                      className={`group flex cursor-pointer gap-x-3 overflow-hidden rounded-lg border border-white/5 bg-white/[0.03] transition-all hover:border-purple-500/30 hover:bg-white/[0.06] ${loadingNextEp ? 'pointer-events-none opacity-50' : ''}`}
                      onClick={handleNextEpisode}
                    >
                      {/* Thumbnail */}
                      <div className="relative h-20 w-36 shrink-0 bg-white/5">
                        {dynNextEpisodeThumbnail ? (
                          <img
                            src={dynNextEpisodeThumbnail}
                            alt="next ep"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-600">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        )}
                        {/* Duration placeholder */}
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] text-gray-300">
                          E{episodeNumber + 1}
                        </span>
                      </div>
                      {/* Info */}
                      <div className="flex min-w-0 flex-col justify-center gap-y-0.5 py-2 pr-3">
                        <p className="line-clamp-2 text-xs font-medium text-white transition-colors group-hover:text-purple-300">
                          {dynNextEpisodeTitle || `Episodio ${episodeNumber + 1}`}
                        </p>
                        {hasDub && <p className="text-[10px] text-gray-500">Sub | Dub</p>}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

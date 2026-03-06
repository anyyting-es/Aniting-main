import { format, set } from 'date-fns'
import useNyaaTracker from '../hooks/useNyaaTracker'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Button, Skeleton, Tooltip } from '@radix-ui/themes'
import {
  DiscIcon,
  DividerVerticalIcon,
  DownloadIcon,
  FileIcon,
  MagnifyingGlassIcon,
  PlayIcon
} from '@radix-ui/react-icons'
import useGetoToshoEpisodes from '../hooks/useGetToshoEpisodes'
import nFormatter from '../utils/nFormatter'
import formatBytes from '../utils/formatBytes'
import { av1Search, av1GetDetails, av1GetStreams } from '../api/animeav1'
import { hentailaSearch, hentailaGetDetails, hentailaGetStreams } from '../api/hentaila'
import { TORRENT_ENABLED } from '../utils/featureFlags'
import { pickBestResult } from '../utils/bestMatch'
import { useAnitingContext } from '../utils/ContextProvider'
import { getTitle, isFiller } from '../utils/helper'
import fillersData from '../data/fillers.json'
import { getPlaybackPosition } from '../utils/localAnimeStore'

export default function Episode({
  data,
  anime,
  animeId,
  malId,
  isAdult,
  dualAudio,
  episodeNumber,
  all,
  bannerImage,
  animeCoverImage,

  discordRpcActivity,
  autoSelect,
  nextEpisodeData,
  totalEpisodes
}) {
  const navigate = useNavigate()
  const [active, setActive] = useState(false)
  const progress = data?.progress || 0
  const [torrentData, setTorrentData] = useState([])
  const { titleLanguage } = useAnitingContext()
  const {
    isLoading,
    data: toshoEps,
    error
  } = useGetoToshoEpisodes(active ? data?.quality : null, data?.aids, data?.eids ? data.eids : null)

  // ── AnimeAV1 state ──
  const [av1Loading, setAv1Loading] = useState(false)
  const [av1Streams, setAv1Streams] = useState([])
  const [av1Error, setAv1Error] = useState('')
  const [av1Fetched, setAv1Fetched] = useState(false)
  const [av1EpMeta, setAv1EpMeta] = useState({ id: null, hasDub: false })

  // ── Hentaila state ──
  const [hentailaLoading, setHentailaLoading] = useState(false)
  const [hentailaStreams, setHentailaStreams] = useState([])
  const [hentailaError, setHentailaError] = useState('')
  const [hentailaFetched, setHentailaFetched] = useState(false)

  const [autoAv1Loading, setAutoAv1Loading] = useState(false)

  async function handleAutoSelectStream() {
    // Navigate instantly to the player - stream resolution happens there
    navigate('/video', {
      state: {
        pendingAutoStream: true,
        streamType: 'hls',
        streamUrl: null,
        episodeTitle: data?.title || '',
        episodeNumber: episodeNumber,
        animeTitle: getTitle(anime, titleLanguage),
        animeName: anime?.romaji || anime?.english || '',
        animeRomaji: anime?.romaji || '',
        animeEnglish: anime?.english || '',
        bannerImage: bannerImage,
        animeCoverImage: animeCoverImage,
        discordRpcActivity: discordRpcActivity,
        animeId: animeId,
        malId: malId,
        progress: progress,
        totalEpisodes: totalEpisodes || 0,
        isAdult: isAdult || false,
        episodeDescription: data?.overview || data?.summary || '',
        nextEpisodeTitle: nextEpisodeData?.title || '',
        nextEpisodeThumbnail: nextEpisodeData?.thumbnail
          ? nextEpisodeData.thumbnail.startsWith('/')
            ? `https://image.tmdb.org/t/p/w300${nextEpisodeData.thumbnail}`
            : nextEpisodeData.thumbnail
          : ''
      }
    })
    return

    // Old code below kept as fallback reference
    setAutoAv1Loading(true)
    setAv1Error('')
    try {
      const animeName = anime?.romaji || anime?.english || ''
      if (!animeName) throw new Error('No se encontró nombre del anime')

      // Always try AnimeAV1 first
      let av1Success = false
      try {
        const searchResults = await av1Search(animeName)
        if (searchResults && searchResults.length > 0) {
          const best = pickBestResult(searchResults, {
            romaji: anime?.romaji,
            english: anime?.english
          })
          const details = await av1GetDetails(best.id)
          if (details?.episodes?.length) {
            const epNum = episodeNumber || 1
            const matchedEp =
              details.episodes.find((ep) => ep.number === epNum) || details.episodes[0]
            const streams = await av1GetStreams(matchedEp.id)
            if (streams && streams.length > 0) {
              onAv1StreamClick(streams[0], matchedEp.id, matchedEp.hasDub)
              av1Success = true
            }
          }
        }
      } catch (e) {
        console.warn('AnimeAV1 autoSelect failed, trying fallback...', e.message)
      }

      // Fallback to Hentaila only if AnimeAV1 failed and content is adult
      if (!av1Success && isAdult) {
        const searchResults = await hentailaSearch(animeName)
        if (!searchResults || searchResults.length === 0)
          throw new Error('No se encontró en AnimeAV1 ni Hentaila')

        const details = await hentailaGetDetails(searchResults[0].id)
        if (!details?.episodes?.length) throw new Error('Sin episodios disponibles')

        const epNum = episodeNumber || 1
        const matchedEp = details.episodes.find((ep) => ep.number === epNum) || details.episodes[0]
        const streams = await hentailaGetStreams(matchedEp.id)
        if (!streams || streams.length === 0) throw new Error('Sin streams disponibles')

        onHentailaStreamClick(streams[0])
        av1Success = true
      }

      if (!av1Success) throw new Error('No se encontró en AnimeAV1')
    } catch (err) {
      console.error('AutoSelect error:', err)
      setAv1Error(err.message || 'Error al auto-seleccionar stream')
      setActive(true) // Fallback to dropdown
    } finally {
      setAutoAv1Loading(false)
    }
  }

  async function handleFetchAv1Streams() {
    if (av1Fetched) return
    setAv1Loading(true)
    setAv1Error('')
    try {
      const animeName = anime?.romaji || anime?.english || ''
      if (!animeName) {
        setAv1Error('No se encontró nombre del anime')
        return
      }
      const searchResults = await av1Search(animeName)
      if (!searchResults || searchResults.length === 0) {
        setAv1Error('No se encontró en AnimeAV1')
        return
      }
      // Pick best matching result by title similarity
      const best = pickBestResult(searchResults, {
        romaji: anime?.romaji,
        english: anime?.english
      })
      const details = await av1GetDetails(best.id, animeId)
      if (!details?.episodes?.length) {
        setAv1Error('Sin episodios en AnimeAV1')
        return
      }
      // Match by episode number
      const epNum = episodeNumber || 1
      const matchedEp = details.episodes.find((ep) => ep.number === epNum) || details.episodes[0]
      const streams = await av1GetStreams(matchedEp.id)
      if (!streams || streams.length === 0) {
        setAv1Error('Sin streams disponibles')
        return
      }
      setAv1Streams(streams)
      setAv1Fetched(true)
      setAv1EpMeta({ id: matchedEp.id, hasDub: matchedEp.hasDub || false })
    } catch (err) {
      console.error('AnimeAV1 error:', err)
      setAv1Error('Error al obtener streams de AnimeAV1')
    } finally {
      setAv1Loading(false)
    }
  }

  function onAv1StreamClick(stream, episodeId, hasDub) {
    navigate('/video', {
      state: {
        streamType: 'hls',
        streamUrl: stream.url,
        streamHeaders: stream.headers || null,
        streamQuality: stream.quality,
        episodeTitle: data?.title || '',
        episodeNumber: episodeNumber,
        animeTitle: getTitle(anime, titleLanguage),
        bannerImage: bannerImage,
        animeCoverImage: animeCoverImage,
        discordRpcActivity: discordRpcActivity,
        animeId: animeId,
        malId: malId,
        progress: progress,
        totalEpisodes: totalEpisodes || 0,
        hasDub: hasDub || false,
        episodeIdPayload: episodeId || null,
        episodeDescription: data?.overview || data?.summary || '',
        nextEpisodeTitle: nextEpisodeData?.title || '',
        nextEpisodeThumbnail: nextEpisodeData?.thumbnail
          ? nextEpisodeData.thumbnail.startsWith('/')
            ? `https://image.tmdb.org/t/p/w300${nextEpisodeData.thumbnail}`
            : nextEpisodeData.thumbnail
          : ''
      }
    })
  }

  async function handleFetchHentailaStreams() {
    if (hentailaFetched) return
    setHentailaLoading(true)
    setHentailaError('')
    try {
      const animeName = anime?.romaji || anime?.english || ''
      if (!animeName) throw new Error('No se encontró nombre del anime')

      const searchResults = await hentailaSearch(animeName)
      if (!searchResults || searchResults.length === 0)
        throw new Error('No se encontró en Hentaila')

      const details = await hentailaGetDetails(searchResults[0].id)
      if (!details?.episodes?.length) throw new Error('Sin episodios en Hentaila')

      const epNum = episodeNumber || 1
      const matchedEp = details.episodes.find((ep) => ep.number === epNum) || details.episodes[0]
      const streams = await hentailaGetStreams(matchedEp.id)

      if (!streams || streams.length === 0) throw new Error('Sin streams disponibles')

      setHentailaStreams(streams)
      setHentailaFetched(true)
    } catch (err) {
      console.error('Hentaila error:', err)
      setHentailaError('Error al obtener streams de Hentaila: ' + err.message)
    } finally {
      setHentailaLoading(false)
    }
  }

  function onHentailaStreamClick(stream) {
    navigate('/video', {
      state: {
        streamType: 'hls',
        streamUrl: stream.url,
        streamHeaders: stream.headers || null,
        streamQuality: stream.quality,
        episodeTitle: data?.title || '',
        episodeNumber: episodeNumber,
        animeTitle: getTitle(anime, titleLanguage),
        bannerImage: bannerImage,
        animeCoverImage: animeCoverImage,
        discordRpcActivity: discordRpcActivity,
        animeId: animeId,
        malId: malId,
        progress: progress,
        totalEpisodes: totalEpisodes || 0,
        episodeDescription: data?.overview || data?.summary || '',
        nextEpisodeTitle: nextEpisodeData?.title || '',
        nextEpisodeThumbnail: nextEpisodeData?.thumbnail
          ? nextEpisodeData.thumbnail.startsWith('/')
            ? `https://image.tmdb.org/t/p/w300${nextEpisodeData.thumbnail}`
            : nextEpisodeData.thumbnail
          : ''
      }
    })
  }

  // on pressing escape, close the dropdown
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') {
        setActive(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  function handleClick() {
    // e.stopPropagation()
    if (all) {
      setActive(!active)
      return
    }
    // Always go directly to HLS player (skip server selection)
    handleAutoSelectStream()
  }

  function onTorrentClick(torrent) {
    navigate('/video', {
      state: {
        streamType: 'torrent',
        magnetUri: torrent.magnet_uri,
        episodeTitle: data.title,
        episodeNumber: episodeNumber,
        animeTitle: getTitle(anime, titleLanguage),
        animeName: anime?.romaji || anime?.english || anime?.title || anime,
        bannerImage: bannerImage,
        animeCoverImage: animeCoverImage,
        discordRpcActivity: discordRpcActivity,
        animeId: animeId,
        malId: malId,
        progress: progress
      }
    })
  }

  useEffect(() => {
    if (dualAudio) {
      const temp = toshoEps?.filter((torrent) => {
        const title = torrent?.title

        // Ensure that the title exists and is a string before using toLowerCase
        if (typeof title === 'string') {
          const lowerCaseTitle = title.toLowerCase()
          return (
            lowerCaseTitle.includes('dual audio') ||
            lowerCaseTitle.includes('dual-audio') ||
            lowerCaseTitle.includes('english dub') ||
            lowerCaseTitle.includes('eng dub')
          )
        }
        return false
      })

      setTorrentData(temp)
    } else {
      setTorrentData(toshoEps)
    }
  }, [dualAudio, toshoEps])

  torrentData?.sort((a, b) => b.seeders - a.seeders)

  // check if the episode was released after the last 2 days
  const isRecent =
    data?.airdate &&
    (() => {
      const airDate = new Date(data.airdate) // Convert airdate to Date object
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2) // Set to two days ago

      return airDate > twoDaysAgo && airDate <= new Date() // Check if within the last two days
    })()

  const isUpcoming =
    data?.airdate &&
    (() => {
      const airDate = new Date(data.airdate)
      const today = new Date()
      // Normalize both dates to YYYY-MM-DD (ignoring time)
      airDate.setHours(0, 0, 0, 0) // Set airDate to the start of the day (00:00:00)
      today.setHours(0, 0, 0, 0)
      return airDate > today
    })()

  // if the data is undefined, then it is a filler episode or a recap episode ot a movie
  if (all)
    return (
      <div
        onClick={() => handleClick()}
        className="relative m-1 cursor-default border border-gray-700 p-3 font-space-mono transition-all duration-100 ease-in-out hover:bg-[#1e1e20]"
      >
        <div className="flex items-center justify-between">
          <div className="flex gap-x-1 font-space-mono font-medium opacity-90">
            <div>
              <p className="flex gap-x-2 font-space-mono text-lg font-medium opacity-90">
                <span className="flex items-center gap-2 text-gray-400">
                  Todo <MagnifyingGlassIcon />
                </span>
                | {getTitle(anime, titleLanguage)}
              </p>
            </div>
          </div>
        </div>
        {TORRENT_ENABLED && active && (
          <div className="mt-3 flex flex-col gap-y-2">
            {isLoading && <Skeleton width={'50%'} />}
            {error && <p className="font-space-mono text-red-500">Error al buscar torrents</p>}

            {!isLoading && torrentData?.length === 0 && (
              <p className="font-space-mono text-red-500">No se encontraron torrents</p>
            )}

            {torrentData?.map((torrent) => (
              <div
                key={torrent.title}
                className="group flex animate-fade-down cursor-pointer flex-col gap-y-1 border-2 border-[#2c2d3c] bg-[#111113] px-2 py-2 transition-all duration-150 ease-in-out animate-duration-500 hover:border-[#c084fc90]" //0f1012
                onClick={() => onTorrentClick(torrent)}
              >
                <div className="mr-1 flex min-w-32 items-center gap-x-4 p-1">
                  <div className="flex items-center gap-x-1">
                    <p className="font-space-mono text-xs opacity-60">
                      {nFormatter(torrent.seeders)}
                    </p>
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  </div>

                  <div className="flex items-center gap-x-1">
                    <p className="font-space-mono text-xs opacity-60">
                      {nFormatter(torrent.leechers)}
                    </p>
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  </div>

                  <div className="flex items-center gap-x-1">
                    <p className="font-space-mono text-xs opacity-60">
                      {nFormatter(torrent.torrent_downloaded_count)}
                    </p>
                    <DownloadIcon height={12} width={12} color="gray" />
                  </div>

                  <div className="flex items-center gap-x-1">
                    <p className="text-nowrap font-space-mono text-xs opacity-60">
                      {torrent.num_files}
                    </p>
                    <FileIcon height={12} width={12} color="gray" />
                  </div>

                  <div className="flex items-center gap-x-1">
                    <p className="text-nowrap font-space-mono text-xs opacity-60">
                      {formatBytes(torrent.total_size, 1)}
                    </p>
                    <DiscIcon height={12} width={12} color="gray" />
                  </div>
                </div>
                <p className="cursor-pointer font-space-mono text-sm tracking-wide opacity-55 transition-all duration-150 ease-in-out group-hover:text-purple-400 group-hover:opacity-100">
                  {torrent.title}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )

  // if the data is defined, then it is a normal episode
  if (episodeNumber <= progress && data?.hideWatchedEpisodes) return null
  const isWatched = episodeNumber <= progress

  const isEpisodeFiller = isFiller(animeId, episodeNumber, fillersData)

  // Local playback progress for this episode
  const playback = getPlaybackPosition(animeId, episodeNumber)
  const playbackPercent = playback ? Math.min(playback.percentage, 100) : 0

  return (
    <div
      className={`relative flex w-full cursor-default flex-col border border-gray-700 font-space-mono transition-all duration-100 ease-in-out hover:bg-[#1e1e20] hover:opacity-100 ${isWatched ? 'opacity-50' : ''}`}
    >
      {/* Playback progress bar at the bottom */}
      {playbackPercent > 0 && !isWatched && (
        <div className="absolute bottom-0 left-0 right-0 z-10 h-[3px] bg-white/10">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${playbackPercent}%` }}
          ></div>
        </div>
      )}
      <div className="flex">
        {data.thumbnail && (
          <div className="relative mr-3 flex-shrink-0">
            <img
              loading="lazy"
              src={data.thumbnail}
              alt="episode_img"
              className="duration-400 hover:shadow-lg h-28 animate-fade object-cover transition-all ease-in-out hover:shadow-white/10"
            />
            {/* Mini progress bar on thumbnail */}
            {playbackPercent > 0 && !isWatched && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/50">
                <div
                  className="h-full bg-indigo-400"
                  style={{ width: `${playbackPercent}%` }}
                ></div>
              </div>
            )}
            {/* Time badge on thumbnail */}
            {playback && playback.currentTime > 0 && (
              <div className="absolute bottom-1.5 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] text-white backdrop-blur-sm">
                {Math.floor(playback.currentTime / 60)}:
                {String(Math.floor(playback.currentTime % 60)).padStart(2, '0')}
              </div>
            )}
          </div>
        )}

        <div
          onClick={() => handleClick()}
          className={`h-full w-full cursor-default p-2 font-space-mono transition-all duration-100 ease-in-out hover:bg-[#1e1e20] hover:opacity-100`}
        >
          <div
            className={`flex h-full items-center justify-between ${isUpcoming ? 'opacity-25' : ''}`}
          >
            <div className="flex items-center gap-x-1 font-space-mono font-medium opacity-90">
              {/* <p className="text-lg">{episodeNumber}. </p> */}
              <div>
                <p className="flex items-center gap-2 font-space-mono text-lg font-medium opacity-100">
                  {episodeNumber <= progress && (
                    <Tooltip content="Visto">
                      <p className="h-2 min-h-2 w-2 min-w-2 rounded-full bg-green-500"></p>
                    </Tooltip>
                  )}
                  <p className="line-clamp-1 flex items-center gap-2">
                    {data.epNum}. {data.title}
                    {isEpisodeFiller && (
                      <span className="rounded bg-orange-500/80 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-white">
                        Relleno
                      </span>
                    )}
                  </p>
                </p>
                {autoAv1Loading ? (
                  <p className="mt-1 line-clamp-1 animate-pulse font-space-mono text-sm font-medium text-purple-400">
                    Cargando stream...
                  </p>
                ) : (
                  data.overview && (
                    // <Tooltip content={data.overview}>
                    <p className="mt-1 line-clamp-3 font-space-mono text-sm font-medium opacity-60">
                      {data.overview}
                    </p>
                    // </Tooltip>
                  )
                )}
              </div>
            </div>
            <div className="flex w-fit gap-x-2 text-xs">
              {/* <p className="">{data.filler ? "Filler" : "Not Filler"}</p> */}
              {/* <p>{data.recap ? "Recap" : "Not Recap"}</p> */}
              <div className="ml-4 h-5 w-[1px] bg-[#333]"></div> {/* Divider */}
              {data.airdate && (
                <p
                  className={`text-nowrap ${isRecent ? 'text-purple-400 opacity-90' : 'opacity-50'}`}
                >
                  {format(new Date(data.airdate), 'dd MMM yyyy')}
                </p>
              )}
              {/* {isRecent && <div className="h-5 w-[1px] bg-[#333]"></div>} Divider */}
              <div className="h-5 w-[1px] bg-[#333]"></div> {/* Divider */}
              {/* <p className="opacity-60">{data.score}</p> */}
            </div>
          </div>
        </div>
      </div>

      {active && (
        <div className="mx-3 my-3 flex flex-col gap-y-2">
          {/* ── AnimeAV1 Streaming Directo (shown for ALL content) ── */}
          <div className="mb-2 border-b border-[#2c2d3c] pb-2">
            <div className="flex items-center gap-x-2">
              <Button
                size="1"
                color="purple"
                variant="soft"
                onClick={(e) => {
                  e.stopPropagation()
                  handleFetchAv1Streams()
                }}
                disabled={av1Loading || av1Fetched}
              >
                <PlayIcon height={12} width={12} />
                {av1Loading
                  ? 'Buscando...'
                  : av1Fetched
                    ? 'AnimeAV1 cargado'
                    : 'Ver en AnimeAV1 (Streaming Directo)'}
              </Button>
              {av1Error && <p className="text-xs text-red-400">{av1Error}</p>}
            </div>
            {av1Streams.length > 0 && (
              <div className="mt-2 flex flex-col gap-y-1">
                {av1Streams.map((stream, idx) => (
                  <div
                    key={idx}
                    className="group flex animate-fade-down cursor-pointer items-center gap-x-3 border-2 border-[#3b2d5c] bg-[#1a1127] px-3 py-2 transition-all duration-150 ease-in-out animate-duration-500 hover:border-[#a855f790]"
                    onClick={() => onAv1StreamClick(stream, av1EpMeta.id, av1EpMeta.hasDub)}
                  >
                    <PlayIcon height={14} width={14} color="#a855f7" />
                    <span className="font-space-mono text-sm tracking-wide text-purple-300 opacity-80 transition-all group-hover:opacity-100">
                      {stream.quality} {stream.isM3U8 ? '• HLS' : '• Directo'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Hentaila Streaming Directo ── */}
          {isAdult && (
            <div className="mb-2 border-b border-[#2c2d3c] pb-2">
              <div className="flex items-center gap-x-2">
                <Button
                  size="1"
                  color="red"
                  variant="soft"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFetchHentailaStreams()
                  }}
                  disabled={hentailaLoading || hentailaFetched}
                >
                  <PlayIcon height={12} width={12} />
                  {hentailaLoading
                    ? 'Buscando...'
                    : hentailaFetched
                      ? 'Hentaila cargado'
                      : 'Ver en Hentaila'}
                </Button>
                {hentailaError && <p className="text-xs text-red-400">{hentailaError}</p>}
              </div>
              {hentailaStreams.length > 0 && (
                <div className="mt-2 flex flex-col gap-y-1">
                  {hentailaStreams.map((stream, idx) => (
                    <div
                      key={idx}
                      className="group flex animate-fade-down cursor-pointer items-center gap-x-3 border-2 border-[#5c2d2d] bg-[#271111] px-3 py-2 transition-all duration-150 ease-in-out animate-duration-500 hover:border-[#f7555590]"
                      onClick={() => onHentailaStreamClick(stream)}
                    >
                      <PlayIcon height={14} width={14} color="#f75555" />
                      <span className="font-space-mono text-sm tracking-wide text-red-300 opacity-80 transition-all group-hover:opacity-100">
                        {stream.quality} {stream.isM3U8 ? '• HLS' : '• Directo'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Torrents (disabled via feature flag) ── */}
          {TORRENT_ENABLED && (
            <>
              {isLoading && <Skeleton width={'50%'} className="mb-1" />}
              {error && <p className="font-space-mono text-red-500">Error al buscar torrents</p>}
              {!isLoading && torrentData?.length === 0 && (
                <p className="font-space-mono text-red-500">No se encontraron torrents</p>
              )}
              {torrentData?.map((torrent) => (
                <div
                  key={torrent.title}
                  className="group flex animate-fade-down cursor-pointer flex-col gap-y-1 border-2 border-[#2c2d3c] bg-[#111113] px-2 py-2 transition-all duration-150 ease-in-out animate-duration-500 hover:border-[#c084fc90]" //0f1012
                  onClick={() => onTorrentClick(torrent)}
                >
                  <div className="mr-1 flex min-w-32 items-center gap-x-4 p-1">
                    <div className="flex items-center gap-x-1">
                      <p className="font-space-mono text-xs opacity-60">
                        {nFormatter(torrent.seeders)}
                      </p>
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>

                    <div className="flex items-center gap-x-1">
                      <p className="font-space-mono text-xs opacity-60">
                        {nFormatter(torrent.leechers)}
                      </p>
                      <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    </div>

                    <div className="flex items-center gap-x-1">
                      <p className="font-space-mono text-xs opacity-60">
                        {nFormatter(torrent.torrent_downloaded_count)}
                      </p>
                      <DownloadIcon height={12} width={12} color="gray" />
                    </div>

                    <div className="flex items-center gap-x-1">
                      <p className="text-nowrap font-space-mono text-xs opacity-60">
                        {torrent.num_files}
                      </p>
                      <FileIcon height={12} width={12} color="gray" />
                    </div>

                    <div className="flex items-center gap-x-1">
                      <p className="text-nowrap font-space-mono text-xs opacity-60">
                        {formatBytes(torrent.total_size, 1)}
                      </p>
                      <DiscIcon height={12} width={12} color="gray" />
                    </div>
                  </div>
                  <p className="cursor-pointer font-space-mono text-sm tracking-wide opacity-55 transition-all duration-150 ease-in-out group-hover:text-purple-400 group-hover:opacity-100">
                    {torrent.title}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Skeleton } from '@radix-ui/themes'
import { useNavigate } from 'react-router-dom'
import useGetAniZipMappings from '../hooks/useGetAniZipMappings'
import useGetTmdbSeasonEpisodes from '../hooks/useGetTmdbSeasonEpisodes'
import { useAnitingContext } from '../utils/ContextProvider'
import { TMDB_EXCEPTIONS } from '../utils/tmdbExceptions'
import { getTitle } from '../utils/helper'
import { getLatestPlaybackForAnime } from '../utils/localAnimeStore'

function CurrentlyWatchingCard({ data }) {
  const [imageIsLoading, setImageIsLoading] = useState(true)
  const navigate = useNavigate()
  const { tmdbApiKey, titleLanguage } = useAnitingContext()

  const isManga = data?.type === 'MANGA'
  const nextEpisode = (data?.mediaListEntry?.progress || 0) + 1

  // Only fetch AniZip/TMDB mappings for anime, not manga
  const { data: mappingsData } = useGetAniZipMappings(isManga ? null : data?.id)

  // Check if we have a manual exception for this AniList ID
  const exception = data?.id ? TMDB_EXCEPTIONS[String(data.id)] : null

  const tmdbId = exception?.tmdbId || mappingsData?.mappings?.themoviedb_id || null
  const firstAbsEpisode =
    exception?.absoluteStartOffset !== undefined
      ? exception.absoluteStartOffset
      : Number(mappingsData?.episodes?.['1']?.absoluteEpisodeNumber) || 1

  const anizipEpisodeCount = mappingsData?.episodes
    ? Object.keys(mappingsData.episodes).filter((k) => !isNaN(k)).length
    : 0
  const totalEpCount = data?.episodes || anizipEpisodeCount || 0

  const { data: tmdbEpisodeMap } = useGetTmdbSeasonEpisodes(
    isManga ? null : tmdbId,
    firstAbsEpisode,
    tmdbApiKey,
    totalEpCount
  )

  const animeTitle = getTitle(data?.title, titleLanguage)
  let episodicTitle = animeTitle
  let episodicThumbnail = data?.bannerImage || data?.coverImage?.extraLarge
  let episodeData = null

  // Check if the next episode exists and has already aired
  const nextEpData = !isManga && mappingsData?.episodes?.[nextEpisode]
  const nextEpAirdate = nextEpData?.airdate ? new Date(nextEpData.airdate) : null
  const hasAired = nextEpAirdate ? nextEpAirdate <= new Date() : !!nextEpData

  if (!isManga && nextEpData && hasAired) {
    episodeData = nextEpData

    // Calculate the TMDB key taking the override offset into consideration if it exists
    const tmdbKey = exception
      ? exception.absoluteStartOffset + Number(episodeData.episode) - 1
      : (episodeData.absoluteEpisodeNumber ?? episodeData.episode)

    const tmdbEp = tmdbEpisodeMap?.[tmdbKey]

    episodicTitle =
      tmdbEp?.name ||
      episodeData.title?.es ||
      episodeData.title?.['es-419'] ||
      episodeData.title?.en ||
      episodeData.title?.['x-jat'] ||
      episodeData.title?.jp ||
      `Episodio ${nextEpisode}`
    episodicThumbnail = tmdbEp?.still_path || episodeData.image || episodicThumbnail
  } else if (isManga) {
    episodicTitle = `Capitulo ${nextEpisode}`
  }

  const progressLabel = isManga ? 'Leido' : 'Visto'
  const nextLabel = isManga
    ? `Capitulo ${nextEpisode}`
    : `Episodio ${nextEpisode}: ${episodicTitle}`

  // Use local playback position for the progress bar (video time watched)
  const latestPlayback = getLatestPlaybackForAnime(data?.id)
  const isFinished = latestPlayback && latestPlayback.percentage >= 80
  const progressPercent = latestPlayback && !isFinished ? Math.min(latestPlayback.percentage, 100) : 0

  // Determine the episode to resume (latest played or next unwatched)
  const resumeEpisode = (latestPlayback && !isFinished) ? latestPlayback.episodeNumber : nextEpisode

  function handleClick() {
    if (isManga) {
      navigate(`/manga/${data?.id}`)
      return
    }
    // Navigate directly to the player with pendingAutoStream
    navigate('/video', {
      state: {
        pendingAutoStream: true,
        streamType: 'hls',
        streamUrl: null,
        episodeTitle: episodicTitle || '',
        episodeNumber: resumeEpisode,
        animeTitle: animeTitle,
        animeName: data?.title?.romaji || data?.title?.english || animeTitle,
        animeRomaji: data?.title?.romaji || '',
        animeEnglish: data?.title?.english || '',
        bannerImage: data?.bannerImage || '',
        animeCoverImage: data?.coverImage?.extraLarge || data?.coverImage?.medium || '',
        animeId: data?.id,
        malId: data?.idMal || null,
        progress: data?.mediaListEntry?.progress || 0,
        totalEpisodes: data?.episodes || 0,
        isAdult: data?.isAdult || false,
        episodeDescription: '',
        nextEpisodeTitle: '',
        nextEpisodeThumbnail: ''
      }
    })
  }

  return (
    <div className="w-full pb-4" onClick={handleClick}>
      <div className="flex h-full cursor-pointer flex-col gap-y-1.5 font-space-mono transition-transform ease-in-out hover:scale-[1.02]">
        {/* Image Container - made smaller */}
        <div className="shadow-lg relative aspect-video w-full overflow-hidden rounded-md">
          {imageIsLoading && <Skeleton className="absolute inset-0 z-0 h-full w-full" />}

          <img
            src={episodicThumbnail}
            className="h-full w-full object-cover transition-all duration-300 ease-in-out"
            onLoad={() => setImageIsLoading(false)}
            onError={() => setImageIsLoading(false)}
            alt={episodicTitle}
          />

          {/* Episode Progress Count Badge */}
          <div className="shadow-sm absolute bottom-3 right-2 z-10 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {progressLabel}: {data.mediaListEntry?.progress || 0}
            {latestPlayback && !isFinished ? ` • ${Math.floor(latestPlayback.currentTime / 60)}min` : ''}
          </div>

          {/* Progress Bar - shows local video playback progress */}
          <div className="absolute bottom-0 left-0 right-0 z-10 h-1 bg-white/20">
            <div className="h-full bg-indigo-500" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        {/* Text Details */}
        <div className="flex flex-col px-1 tracking-wider">
          <div className="line-clamp-1 text-xs font-semibold text-gray-100" title={nextLabel}>
            {nextLabel}
          </div>
          <div className="line-clamp-1 w-full text-[11px] text-gray-400" title={animeTitle}>
            {animeTitle}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CurrentlyWatchingCard

import { Link, useNavigate, useParams } from 'react-router-dom'
import useGetAnimeById from '../hooks/useGetAnimeById'
import { format, fromUnixTime } from 'date-fns'
import { useEffect, useState } from 'react'
import Episode from '../components/Episode'
import { DropdownMenu, Skeleton } from '@radix-ui/themes'
import { toast } from 'sonner'
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  StarIcon
} from '@radix-ui/react-icons'
import useGetAniZipMappings from '../hooks/useGetAniZipMappings'
import useGetAnimeByMalId from '../hooks/useGetAnimeByMalId'
import useGetTmdbData from '../hooks/useGetTmdbData'
import useGetTmdbSeasonEpisodes from '../hooks/useGetTmdbSeasonEpisodes'
import { autop } from '@wordpress/autop'
import parse from 'html-react-parser'
import { useAnitingContext } from '../utils/ContextProvider'
import AnilistEditorModal from '../components/AnilistEditorModal'
import BooksLogo from '../assets/symbols/BooksLogo'
import Pagination from '../components/Pagination'
import CustomSearch from '../components/CustomSearch'
import { hentailaSearch, hentailaGetDetails } from '../api/hentaila'
import { TMDB_EXCEPTIONS } from '../utils/tmdbExceptions'
import { getTitle } from '../utils/helper'
import seasonsData from '../data/seasons.json'
import customEpisodesData from '../data/customEpisodes.json'
import CenteredLoader from '../ui/CenteredLoader'
import { getLocalProgress } from '../utils/localAnimeStore'

export default function AnimePage() {
  const anitingContext = useAnitingContext()
  const { glow, tmdbApiKey, titleLanguage } = anitingContext
  const { animeId } = useParams()
  const navigate = useNavigate()
  const { isLoading, animeData, error, status } = useGetAnimeById(animeId)
  const malId = animeData?.idMal

  const anilistToken = localStorage.getItem('anilist_token')
  const isLoggedIn = !!anilistToken

  const [episodesWatched, setEpisodesWatched] = useState(
    animeData?.mediaListEntry?.progress || getLocalProgress(animeId) || 0
  )

  useEffect(() => {
    if (isLoggedIn && animeData?.mediaListEntry?.progress !== undefined) {
      setEpisodesWatched(animeData.mediaListEntry.progress)
    } else {
      const localProg = getLocalProgress(animeId)
      if (localProg > 0) setEpisodesWatched(localProg)
    }
  }, [animeData?.mediaListEntry?.progress, animeId, isLoggedIn])

  const [quality] = useState('All')
  const { isLoading: isLoadingMappings, data: mappingsData } = useGetAniZipMappings(animeId)

  // Check if we have a manual exception for this AniList ID
  const exception = animeId ? TMDB_EXCEPTIONS[String(animeId)] : null

  const customData = animeId ? customEpisodesData[String(animeId)] : null
  let customEps = null
  let customDescription = null
  let isAbsolute = false

  if (Array.isArray(customData)) {
    customEps = customData
  } else if (customData) {
    customEps = customData.episodes
    customDescription = customData.description
    isAbsolute = !!customData.absolute
  }

  const tmdbId = exception?.tmdbId || mappingsData?.mappings?.themoviedb_id || null
  // Use absoluteEpisodeNumber of first episode to locate the correct TMDB season
  const firstAbsEpisode =
    exception?.absoluteStartOffset !== undefined
      ? exception.absoluteStartOffset
      : Number(mappingsData?.episodes?.['1']?.absoluteEpisodeNumber) || 1

  // Count episodes from anizip mappings (more reliable for long anime)
  const anizipEpisodeCount = mappingsData?.episodes
    ? Object.keys(mappingsData.episodes).filter((k) => !isNaN(k)).length
    : 0
  const totalEpCount = animeData?.episodes || anizipEpisodeCount || 0

  const { data: tmdbData } = useGetTmdbData(tmdbId, tmdbApiKey)
  const { data: tmdbEpisodeMap } = useGetTmdbSeasonEpisodes(tmdbId, firstAbsEpisode, tmdbApiKey, totalEpCount)
  const spanishDescription =
    customDescription || exception?.descriptionOverride || tmdbData?.overview || null

  const { data: malIdData, error: errorMalId } = useGetAnimeByMalId(malId || null)

  let episodesAnizip = mappingsData?.episodes
  let aniZip_titles = {
    en: '',
    ja: '',
    xJat: '',
    malTitleRomaji: '',
    malTitleEnglish: ''
  }
  if (mappingsData?.titles) {
    aniZip_titles.en = mappingsData?.titles?.en || ''
    aniZip_titles.ja = mappingsData?.titles?.ja || ''
    aniZip_titles.xJat = mappingsData?.titles['x-jat'] || ''
    aniZip_titles.malTitleRomaji = malIdData?.data?.titles?.[0]?.title || ''
    aniZip_titles.malTitleEnglish = malIdData?.data?.titles?.[4]?.title || ''
  }

  if (episodesAnizip) {
    episodesAnizip = Object.keys(episodesAnizip)?.map((key) => episodesAnizip[key])
    let tempEps = episodesAnizip.map((ep) => {
      if (isNaN(ep.episode)) return null
      const tmdbKey = exception
        ? exception.absoluteStartOffset + Number(ep.episode) - 1
        : (ep.absoluteEpisodeNumber ?? ep.episode)
      const tmdbEp = tmdbEpisodeMap?.[tmdbKey]

      return {
        epNum: ep.episode,
        title:
          tmdbEp?.name ||
          ep.title?.es ||
          ep.title?.['es-419'] ||
          ep.title?.en ||
          ep.title?.['x-jat'] ||
          ep.title?.jp ||
          `Episodio ${ep.episode}`,
        thumbnail: ep.image || tmdbEp?.still_path,
        airdate: ep.airdate,
        overview: tmdbEp?.overview || ep.overview,
        aids: mappingsData?.mappings?.anidb_id,
        eids: ep.anidbEid
      }
    })

    // remove null values
    tempEps = tempEps.filter((ep) => ep !== null)
    episodesAnizip = tempEps
  }
  const [dualAudio] = useState(false)
  const [hideWatchedEpisodes] = useState(false)

  // Custom Auto-Select State persisting in LocalStorage
  const [autoSelect, setAutoSelect] = useState(() => {
    const saved = localStorage.getItem('aniting-autoselect')
    return saved === null ? true : saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('aniting-autoselect', autoSelect)
  }, [autoSelect])

  const [showFullDescription, setShowFullDescription] = useState(false)
  const [showRelations, setShowRelations] = useState(false)

  const [pageSize, setPageSize] = useState(100)
  const [pageNo, setPageNo] = useState(0)

  // ── Hentaila Episodes Fetching ──
  const [hentailaEpisodes, setHentailaEpisodes] = useState([])
  const [loadingHentaila, setLoadingHentaila] = useState(false)

  useEffect(() => {
    if (animeData?.isAdult) {
      const fetchHentaila = async () => {
        setLoadingHentaila(true)
        try {
          const animeName = animeData?.title?.romaji || animeData?.title?.english || ''
          const search = await hentailaSearch(animeName)
          if (search && search.length > 0) {
            const details = await hentailaGetDetails(search[0].id)
            if (details && details.episodes) {
              setHentailaEpisodes(
                details.episodes.map((ep) => ({
                  epNum: ep.number,
                  title: ep.title
                }))
              )
            }
          }
        } catch (e) {
          console.error('Error fetching Hentaila episodes:', e)
        } finally {
          setLoadingHentaila(false)
        }
      }
      fetchHentaila()
    }
  }, [animeData?.isAdult, animeData?.title?.romaji, animeData?.title?.english])

  const [searchEpisode, setSearchEpisode] = useState('')

  const activityDetails = {
    details: `${getTitle(animeData?.title, titleLanguage)}`,
    state: `Explorando ${getTitle(animeData?.title, titleLanguage)}`,
    assets: {
      large_image: animeData?.coverImage?.medium || animeData?.coverImage.extraLarge,
      small_image: 'logo',
      small_text: 'Aniting'
    }
  }

  function setDiscordRPC() {
    if (!animeData) return
    window.api.setDiscordRpc(activityDetails)
  }

  useEffect(() => {
    setDiscordRPC()
    return () => {
      window.api.setDiscordRpc({ details: 'Browsing Aniting', state: 'Buscando qué ver...' })
    }
  }, [animeData, episodesWatched, malIdData])

  if (isLoading) return <CenteredLoader />

  if (error || errorMalId) {
    toast.error('Error al obtener el Anime', {
      icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
      description: `No se pudo obtener el anime: ${error?.message || errorMalId?.message}`,
      classNames: {
        title: 'text-rose-500'
      }
    })
  }

  if (status !== 'success') return <CenteredLoader />

  const relations = animeData?.relations?.edges.filter((edge) => edge.node.type === 'ANIME')

  const data = animeData

  const startDate = data?.startDate
    ? new Date(data.startDate.year, data.startDate.month - 1, data.startDate.day)
    : null

  let animeEpisodes = data?.streamingEpisodes
  animeEpisodes?.sort((a, b) => {
    const aNum = parseInt(a.title.split(' ')[1])
    const bNum = parseInt(b.title.split(' ')[1])
    return aNum - bNum
  })

  if (episodesAnizip && episodesAnizip.length > 0) {
    animeEpisodes = episodesAnizip
  } else if (data?.isAdult && hentailaEpisodes?.length > 0) {
    animeEpisodes = hentailaEpisodes
  }

  // Inject custom episodes if available
  if (customEps && customEps.length > 0) {
    if (isAbsolute) {
      animeEpisodes = customEps
    } else {
      animeEpisodes = [...(animeEpisodes || []), ...customEps]
    }
  }

  const genresString = data?.genres?.join(', ') || ''

  const aniZipBanner =
    mappingsData?.images?.find(
      (img) => img.coverType === 'Background' || img.coverType === 'Fanart'
    )?.url || mappingsData?.images?.find((img) => img.coverType === 'Banner')?.url
  const finalBanner = data?.bannerImage || aniZipBanner || data?.coverImage?.extraLarge
  const isFallbackCover = !data?.bannerImage && !aniZipBanner

  // ── Episode search / slice logic ──
  const searchNum = parseInt(searchEpisode, 10)
  const hasSearch = !isNaN(searchNum) && searchNum > 0
  let displayEpisodes = animeEpisodes || []
  if (hasSearch) {
    const startIdx = Math.max(0, searchNum - 1)
    displayEpisodes = displayEpisodes.slice(startIdx)
  } else {
    displayEpisodes = displayEpisodes.slice(pageNo * pageSize, pageNo * pageSize + pageSize)
  }

  // ── Seasons logic ──
  const currentSeasonGroup = seasonsData?.mappings?.find(
    (group) =>
      group.id_principal === Number(animeId) ||
      group.items.some((item) => String(item.id) === String(animeId))
  )

  return (
    <div className="relative">
      {finalBanner && (
        <div className="relative overflow-hidden">
          {glow && (
            <div className="animate-fade-down">
              <img
                src={finalBanner}
                className="absolute top-7 z-0 h-72 w-full object-cover opacity-70 blur-3xl brightness-75 saturate-150 2xl:h-96"
                alt=""
              />
            </div>
          )}
          <img
            src={finalBanner}
            className={`z-10 h-72 w-full animate-fade-down object-cover brightness-90 transition-all ease-in-out 2xl:h-96 ${isFallbackCover ? 'scale-105 blur-sm saturate-150' : ''}`}
            alt=""
          />
        </div>
      )}
      <div className="z-30 mx-auto animate-fade px-6 py-4 lg:container">
        <div className="flex justify-between gap-x-7">
          <img
            src={data?.coverImage.extraLarge}
            alt=""
            className={`duration-400 relative ${finalBanner ? 'bottom-[4rem]' : ''} shadow-xl drop-shadow-2xl h-[25rem] w-72 animate-fade-up rounded-md object-cover transition-all ease-in-out`}
          />
          <div className="flex-1 justify-start gap-y-0">
            <p className="flex items-center justify-between font-space-mono text-xl font-medium tracking-wider">
              <span>{getTitle(data?.title, titleLanguage)}</span>
              {currentSeasonGroup && (
                <DropdownMenu.Root modal={false}>
                  <DropdownMenu.Trigger>
                    <button className="flex items-center gap-1 rounded bg-gray-600/20 px-2 py-1 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-600/40 focus:outline-none">
                      {currentSeasonGroup.estrategia === 'ARCOS' ? 'Arcos' : 'Temporadas'}{' '}
                      <DropdownMenu.TriggerIcon />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content variant="solid" color="gray" highContrast>
                    {currentSeasonGroup.items.map((item, idx) => (
                      <DropdownMenu.Item
                        key={item.id || idx}
                        color={
                          currentSeasonGroup.estrategia === 'ARCOS'
                            ? 'gray'
                            : String(item.id) === String(animeId)
                              ? 'indigo'
                              : 'gray'
                        }
                        onClick={() => {
                          if (currentSeasonGroup.estrategia === 'ARCOS') {
                            setPageNo(Math.floor((item.range[0] - 1) / pageSize))
                          } else if (String(item.id) !== String(animeId)) {
                            navigate(`/anime/${item.id}`)
                          }
                        }}
                      >
                        {item.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              )}
            </p>
            <p className="text mb-2 border-b border-[#545454] pb-2 font-space-mono font-medium tracking-wider opacity-80">
              {data?.title.english}
              {data?.title?.native ? ` • ${data?.title?.native}` : ''}
            </p>
            <div className="mb-2 flex w-fit items-center gap-x-2 border-b border-[#545454] pb-2 text-xs text-gray-300">
              <p className="">{data?.format}</p>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <p>{`${data?.episodes ? data?.episodes : '?'} episodios`}</p>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <p>({data?.status})</p>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <p className="text-xs opacity-60">
                {data && format(new Date(startDate), 'MMMM yyyy')}
              </p>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <p className="opacity-60">{data?.season}</p>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              {data.averageScore && (
                <>
                  <div className="flex gap-x-1 tracking-wide opacity-90">
                    <StarIcon /> {data.averageScore} / 100
                  </div>
                  <div className="h-5 w-[1px] bg-[#333]"></div>
                </>
              )}
              <div className="flex gap-x-1 tracking-wide opacity-90">
                <PersonIcon />
                {data.popularity.toLocaleString()}
              </div>
            </div>
            {genresString && (
              <div className="mb-2 flex w-fit gap-x-1 border-b border-[#545454] pb-2 font-space-mono text-xs tracking-wide opacity-90">
                {genresString}{' '}
                {data?.airingSchedule?.nodes[0]?.episode
                  ? ` • Episode ${data?.airingSchedule.nodes[0].episode} : ${format(fromUnixTime(data?.airingSchedule.nodes[0].airingAt), 'dd-LLL-yyyy hh:mm a')}`
                  : ''}
              </div>
            )}

            <div
              className={`relative flex ${showFullDescription ? '' : 'max-h-[9.55rem]'} cursor-pointer flex-col gap-y-2 overflow-hidden pb-6 font-space-mono text-sm opacity-55 transition-all`}
              onClick={() => setShowFullDescription(!showFullDescription)}
            >
              {parse(
                autop(
                  spanishDescription ||
                  malIdData?.data?.synopsis ||
                  data?.description ||
                  'Sin descripción'
                )
              )}
              {!showFullDescription && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#111113] to-transparent" />
              )}
            </div>
            <div className="mt-6 flex items-center gap-x-5">
              {relations?.length > 0 && (
                <div
                  className="cursor-pointer opacity-80 transition-opacity hover:opacity-100"
                  onClick={() => setShowRelations(!showRelations)}
                >
                  <BooksLogo />
                </div>
              )}
              <Link target="_blank" to={`https://anilist.co/anime/${data?.id}`}>
                <div className="cursor-pointer opacity-80 transition-opacity hover:opacity-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                  >
                    <path
                      d="M4.5 4H9.5V7H7.5V17H9.5V20H4.5V4ZM14.5 4H19.5V7H17.5V17H19.5V20H14.5V4ZM7.5 10H17.5V14H7.5V10Z"
                      fill="#02A9FF"
                    />
                  </svg>
                </div>
              </Link>
              {malId && (
                <Link target="_blank" to={`https://myanimelist.net/anime/${malId}`}>
                  <div className="cursor-pointer opacity-80 transition-opacity hover:opacity-100">
                    <svg
                      viewBox="0 0 1024 1024"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                    >
                      <path
                        d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm252.3 752.3H638.6l-89.9-146.9-89.9 146.9H333l138.8-226.5L333 301.6l125.7-.1 89.9 146.9 89.9-146.9h125.7l138.8 224.2-138.7 226.6z"
                        fill="#2E51A2"
                      />
                    </svg>
                  </div>
                </Link>
              )}
              {data?.trailer?.site === 'youtube' && (
                <Link target="_blank" to={`https://www.youtube.com/watch?v=${data?.trailer.id}`}>
                  <div className="cursor-pointer opacity-80 transition-opacity hover:opacity-100">
                    <svg
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                    >
                      <path
                        d="M1012.928 286.048c-11.84-44.48-46.912-79.52-91.392-91.392C841.024 167.36 512 167.36 512 167.36s-329.024 0-409.536 27.296c-44.48 11.872-79.52 46.912-91.392 91.392-27.296 80.512-27.296 248.608-27.296 248.608s0 168.128 27.296 248.64c11.872 44.48 46.912 79.52 91.392 91.392 80.512 27.296 409.536 27.296 409.536 27.296s329.024 0 409.536-27.296c44.48-11.872 79.552-46.912 91.392-91.392 27.296-80.512 27.296-248.64 27.296-248.64s0-168.096-27.296-248.608z"
                        fill="#FF0000"
                      ></path>
                      <path
                        d="M409.6 651.904l267.584-139.904-267.584-139.936z"
                        fill="#FFFFFF"
                      ></path>
                    </svg>
                  </div>
                </Link>
              )}
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <AnilistEditorModal
                anilist_data={data}
                setEpisodesWatchedMainPage={setEpisodesWatched}
              />
            </div>
          </div>
        </div>

        {relations && showRelations && (
          <div
            className={`grid ${finalBanner ? '' : 'mt-14'} h-full w-full animate-fade grid-cols-2 animate-duration-300 xl:grid-cols-3`}
          >
            {relations.map((relation, ix) => (
              <div
                key={ix}
                className="my-2 h-fit cursor-pointer transition-all duration-200 ease-in-out"
                onClick={() =>
                  navigate(
                    `/${relation?.node?.type === 'ANIME' ? 'anime' : 'manga'}/${relation?.node?.id}`
                  )
                }
              >
                <div className="flex w-[25rem] font-space-mono text-xs text-[#dcdcdc]">
                  <Skeleton
                    style={{
                      borderRadius: '0rem'
                    }}
                  >
                    <img
                      src={relation?.node?.coverImage?.medium}
                      alt=""
                      className="h-28 w-20 object-cover transition-all ease-in-out"
                    />
                  </Skeleton>
                  <div className="flex w-full flex-col items-start border border-gray-700 py-2 pl-2">
                    <p className="line-clamp-3 pr-3">{relation?.node?.title?.userPreferred}</p>
                    <p
                      className={`my-2 line-clamp-3 border ${['text-cyan-400', 'text-orange-400'][
                        ['SEQUEL', 'PREQUEL'].indexOf(relation?.relationType)
                        ]
                        } border-[#545454] bg-[#00000080] px-1`}
                    >
                      {relation?.relationType?.replace('_', ' ')}{' '}
                      {relation?.node?.seasonYear ? ` | ${relation?.node?.seasonYear}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {true && (
          <div className="mb-96 mt-12">
            <div className="flex items-center gap-x-3">
              <p className="font-space-mono text-lg font-medium opacity-90">Episodios</p>
              <div className="flex items-center gap-1 rounded border border-[#3a3a3f] bg-[#1a1a1e] px-2 py-1">
                <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-500" />
                <input
                  type="number"
                  min="1"
                  placeholder="Ep #"
                  value={searchEpisode}
                  onChange={(e) => setSearchEpisode(e.target.value)}
                  className="w-14 bg-transparent font-space-mono text-xs text-gray-300 outline-none placeholder:text-gray-600"
                />
                {searchEpisode && (
                  <button
                    onClick={() => setSearchEpisode('')}
                    className="ml-0.5 text-gray-500 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>
              {!hasSearch && (
                <Pagination
                  arraySize={animeEpisodes?.length}
                  pageSize={pageSize}
                  setPageSize={setPageSize}
                  pageNo={pageNo}
                  setPageNo={setPageNo}
                  position={'relative'}
                  progress={episodesWatched}
                />
              )}
              <CustomSearch
                anime={data.title}
                animeId={data.id}
                data={{
                  progress: episodesWatched,
                  hideWatchedEpisodes,
                  quality
                }}
                bannerImage={finalBanner}
                animeCoverImage={data?.coverImage?.extraLarge}
              />
            </div>
            {(isLoadingMappings || loadingHentaila) && <Skeleton className="mt-3 h-12" />}
            {!(isLoadingMappings || loadingHentaila) && (
              <div className="mt-3 grid grid-cols-1 gap-y-3">
                <Episode
                  all={true}
                  anime={data.title}
                  isAdult={data?.isAdult}
                  dualAudio={dualAudio}
                  data={{
                    aids: mappingsData?.mappings?.anidb_id,
                    quality,
                    eids: 0
                  }}
                  bannerImage={finalBanner}
                  animeCoverImage={data?.coverImage?.extraLarge}
                  discordRpcActivity={activityDetails}
                  autoSelect={autoSelect}
                  totalEpisodes={data?.episodes || 0}
                />
                {displayEpisodes?.map((episode, ix) => {
                  const realIndex = hasSearch ? searchNum - 1 + ix : ix + pageNo * pageSize
                  return (
                    <Episode
                      key={'ep -' + realIndex}
                      anime={data.title}
                      animeId={data.id}
                      malId={malId}
                      isAdult={data?.isAdult}
                      data={{
                        ...episode,
                        progress: episodesWatched,
                        hideWatchedEpisodes,
                        quality
                      }}
                      dualAudio={dualAudio}
                      episodeNumber={realIndex + 1}
                      aniZip_titles={aniZip_titles}
                      bannerImage={finalBanner}
                      animeCoverImage={data?.coverImage?.extraLarge}
                      discordRpcActivity={activityDetails}
                      autoSelect={autoSelect}
                      nextEpisodeData={animeEpisodes?.[realIndex + 1] || null}
                      totalEpisodes={data?.episodes || 0}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

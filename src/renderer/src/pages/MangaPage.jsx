import { Link, useNavigate, useParams } from 'react-router-dom'
import useGetMangaById from '../hooks/useGetMangaById'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import CenteredLoader from '../ui/CenteredLoader'
import { Button, Skeleton, Tooltip } from '@radix-ui/themes'
import { toast } from 'sonner'
import { MagnifyingGlassIcon, PersonIcon, StarIcon } from '@radix-ui/react-icons'
import { autop } from '@wordpress/autop'
import parse from 'html-react-parser'
import { useAnitingContext } from '../utils/ContextProvider'
import AniListLogo from '../assets/symbols/AniListLogo'
import AnilistEditorModal from '../components/AnilistEditorModal'
import BooksLogo from '../assets/symbols/BooksLogo'
import Pagination from '../components/Pagination'
import { manhwaSearch, manhwaGetDetails } from '../api/manhwaweb'

// A simpler component to list a chapter
function Chapter({ data, chapterNumber, onRead }) {
  const progress = data?.progress || 0

  if (data?.number <= progress && data?.hideWatchedEpisodes) return null

  return (
    <div
      className="flex w-full cursor-pointer flex-col border border-gray-700 font-space-mono transition-all duration-100 ease-in-out hover:bg-[#1e1e20] hover:opacity-100"
      onClick={() => onRead(data)}
    >
      <div className="flex">
        <div
          className={`h-full w-full cursor-pointer p-2 font-space-mono transition-all duration-100 ease-in-out hover:bg-[#1e1e20] hover:opacity-100`}
        >
          <div className={`flex h-full items-center justify-between`}>
            <div className="flex items-center gap-x-1 font-space-mono font-medium opacity-90">
              <div>
                <div className="flex items-center gap-2 font-space-mono text-lg font-medium opacity-100">
                  {data?.number <= progress && (
                    <Tooltip content="Leido">
                      <p className="h-2 min-h-2 w-2 min-w-2 rounded-full bg-green-500"></p>
                    </Tooltip>
                  )}
                  <p className="line-clamp-1">{data.title}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MangaPage() {
  const anitingContext = useAnitingContext()
  const { glow } = anitingContext

  const mangaId = useParams().mangaId
  const { isLoading, mangaData, error, status } = useGetMangaById(mangaId)

  const anilistProgress = mangaData?.mediaListEntry?.progress || 0
  const localProgress = parseInt(localStorage.getItem(`manga_progress_${mangaId}`) || '0', 10)
  const [chaptersWatched, setChaptersWatched] = useState(Math.max(anilistProgress, localProgress))

  useEffect(() => {
    const aniP = mangaData?.mediaListEntry?.progress || 0
    const locP = parseInt(localStorage.getItem(`manga_progress_${mangaId}`) || '0', 10)
    setChaptersWatched(Math.max(aniP, locP))
  }, [mangaData?.mediaListEntry?.progress, mangaId])
  const navigate = useNavigate()
  const [hideWatchedEpisodes, setHideWatchedEpisodes] = useState(false)

  const [showFullDescription, setShowFullDescription] = useState(false)
  const [showRelations, setShowRelations] = useState(false)

  const [pageSize, setPageSize] = useState(100)
  const [pageNo, setPageNo] = useState(0)
  const [searchChapter, setSearchChapter] = useState('')

  // ── ManhwaWeb Chapters Fetching ──
  const [manhwaChapters, setManhwaChapters] = useState([])
  const [loadingManhwa, setLoadingManhwa] = useState(false)

  useEffect(() => {
    if (mangaData) {
      const fetchManhwa = async () => {
        setLoadingManhwa(true)
        try {
          const mangaName = mangaData?.title?.romaji || mangaData?.title?.english || ''
          console.log('[MangaPage] Searching ManhwaWeb for:', mangaName)
          const search = await manhwaSearch(mangaName)
          console.log('[MangaPage] Search results:', search)
          if (search && search.length > 0) {
            const details = await manhwaGetDetails(search[0].id, search[0].slug)
            console.log('[MangaPage] Details:', details)
            if (details && details.chapters) {
              setManhwaChapters(details.chapters)
            }
          }
        } catch (e) {
          console.error('Error fetching Manhwa chapters:', e)
        } finally {
          setLoadingManhwa(false)
        }
      }
      fetchManhwa()
    }
  }, [mangaData?.title?.romaji, mangaData?.title?.english])

  const activityDetails = {
    details: `${mangaData?.title?.romaji || ''} ${mangaData?.title?.native ? '• ' + mangaData.title.native : ''}`,
    state: `Browsing ${mangaData?.title?.romaji || ''}`,
    assets: {
      large_image: mangaData?.coverImage?.medium || mangaData?.coverImage?.extraLarge,
      small_image: 'logo',
      small_text: 'Aniting'
    }
  }

  function setDiscordRPC() {
    if (!mangaData) return
    window.api.setDiscordRpc(activityDetails)
  }

  useEffect(() => {
    setDiscordRPC()
    return () => {
      window.api.setDiscordRpc({ details: 'Explorando Manga' })
    }
  }, [mangaData, chaptersWatched])

  function handleReadChapter(chapter) {
    // Navigate to manga reader with chapter info
    navigate(`/manga/${mangaId}/read/${chapter.id}`, {
      state: {
        chapters: manhwaChapters,
        currentChapter: chapter,
        mangaTitle: mangaData?.title?.romaji || mangaData?.title?.english || '',
        anilistId: mangaId
      }
    })
  }

  if (isLoading) return <CenteredLoader />

  if (error) {
    throw new Error(error)
  }

  if (status !== 'success') return <CenteredLoader />

  const relations = mangaData?.relations?.edges.filter(
    (edge) => edge.node.type === 'MANGA' || edge.node.type === 'ANIME'
  )

  const data = mangaData

  const startDate = data?.startDate
    ? new Date(data.startDate.year, data.startDate.month - 1, data.startDate.day)
    : null

  const endDate = data?.endDate
    ? new Date(data.endDate.year, data.endDate.month - 1, data.endDate.day)
    : null

  // Use Manhwaweb chapters
  let finalChapters = manhwaChapters

  if (finalChapters) {
    // Ensure ascending order
    finalChapters.sort((a, b) => a.number - b.number)
  }

  // ── Chapter search / slice logic ──
  const searchChapterNum = parseInt(searchChapter, 10)
  const hasChapterSearch = !isNaN(searchChapterNum) && searchChapterNum > 0
  let displayChapters = finalChapters || []
  if (hasChapterSearch) {
    // Find the index of the first chapter >= searchChapterNum
    const startIdx = displayChapters.findIndex((ch) => ch.number >= searchChapterNum)
    displayChapters = startIdx >= 0 ? displayChapters.slice(startIdx) : []
  } else {
    displayChapters = displayChapters.slice(pageNo * pageSize, pageNo * pageSize + pageSize)
  }

  const genresString = data?.genres?.join(', ') || ''

  const finalBanner = data?.bannerImage || data?.coverImage?.extraLarge
  const isFallbackCover = !data?.bannerImage

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
            src={data?.coverImage?.extraLarge}
            alt=""
            className={`duration-400 relative ${finalBanner ? 'bottom-[4rem]' : ''} shadow-xl drop-shadow-2xl h-[25rem] w-72 animate-fade-up rounded-md object-cover transition-all ease-in-out`}
          />
          <div className="flex-1 justify-start gap-y-0">
            <p className="font-space-mono text-xl font-medium tracking-wider">
              {data?.title?.romaji}
            </p>
            <p className="text mb-2 border-b border-[#545454] pb-2 font-space-mono font-medium tracking-wider opacity-80">
              {data?.title?.english}
              {data?.title?.native ? ` \u2022 ${data?.title?.native}` : ''}
            </p>
            <div className="mb-2 flex w-fit items-center gap-x-2 border-b border-[#545454] pb-2 text-xs text-gray-300">
              <p className="">{data?.format}</p>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <p>{`${data?.chapters ? data?.chapters : '?'} capitulos`}</p>
              {data?.volumes && (
                <>
                  <div className="h-5 w-[1px] bg-[#333]"></div>
                  <p>{`${data.volumes} volumenes`}</p>
                </>
              )}
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <p>({data?.status})</p>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <p className="text-xs opacity-60">
                {data && startDate && format(startDate, 'MMMM yyyy')}
              </p>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              {data?.averageScore && (
                <>
                  <div className="flex gap-x-1 tracking-wide opacity-90">
                    <StarIcon /> {data.averageScore} / 100
                  </div>
                  <div className="h-5 w-[1px] bg-[#333]"></div>
                </>
              )}
              <div className="flex gap-x-1 tracking-wide opacity-90">
                <PersonIcon />
                {data?.popularity?.toLocaleString()}
              </div>
            </div>
            {genresString && (
              <div className="mb-2 flex w-fit gap-x-1 border-b border-[#545454] pb-2 font-space-mono text-xs tracking-wide opacity-90">
                {genresString}
              </div>
            )}

            <div
              className={`relative flex ${showFullDescription ? '' : 'max-h-[9.55rem]'} flex-col gap-y-2 overflow-hidden pb-6 font-space-mono text-sm opacity-55 transition-all`}
              onClick={() => setShowFullDescription(!showFullDescription)}
            >
              {parse(autop(data?.description || 'Sin descripcion'))}
              {!showFullDescription && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#111113] to-transparent" />
              )}
            </div>
            <div className="mt-6 flex items-center gap-x-5">
              {relations?.length > 0 && (
                <Button
                  size={'1'}
                  variant="ghost"
                  color={showRelations ? 'blue' : 'gray'}
                  onClick={() => setShowRelations(!showRelations)}
                >
                  <BooksLogo />
                </Button>
              )}
              <Link target="_blank" to={`https://anilist.co/manga/${data?.id}`}>
                <Button size={'1'} variant="ghost" color="gray">
                  <AniListLogo />
                </Button>
              </Link>
              <div className="h-5 w-[1px] bg-[#333]"></div>
              <AnilistEditorModal
                anilist_data={data}
                setEpisodesWatchedMainPage={setChaptersWatched}
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

        <div className="mb-96 mt-12">
          <div className="flex items-center gap-x-3">
            <p className="font-space-mono text-lg font-medium opacity-90">Capitulos</p>
            {/* Chapter number search */}
            <div className="flex items-center gap-1 rounded border border-[#3a3a3f] bg-[#1a1a1e] px-2 py-1">
              <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-500" />
              <input
                type="number"
                min="1"
                placeholder="Cap #"
                value={searchChapter}
                onChange={(e) => setSearchChapter(e.target.value)}
                className="w-14 bg-transparent font-space-mono text-xs text-gray-300 outline-none placeholder:text-gray-600"
              />
              {searchChapter && (
                <button
                  onClick={() => setSearchChapter('')}
                  className="ml-0.5 text-gray-500 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
            <Button
              variant="soft"
              size={'1'}
              onClick={() => setHideWatchedEpisodes(!hideWatchedEpisodes)}
              color={hideWatchedEpisodes ? 'blue' : 'gray'}
            >
              Ocultar Capitulos Leidos
            </Button>
            {!hasChapterSearch && (
              <Pagination
                arraySize={finalChapters?.length}
                pageSize={pageSize}
                setPageSize={setPageSize}
                pageNo={pageNo}
                setPageNo={setPageNo}
                position={'relative'}
                progress={chaptersWatched}
              />
            )}
          </div>
          {loadingManhwa && <Skeleton className="mt-3 h-12" />}
          {!loadingManhwa && (
            <div className="mt-3 grid grid-cols-1 gap-y-3">
              {displayChapters?.length === 0 && (
                <p className="mt-2 font-space-mono text-sm italic text-gray-500">
                  No se encontraron capitulos
                </p>
              )}
              {displayChapters?.map((chapter, ix) => (
                <Chapter
                  key={'ch-' + chapter.id}
                  data={{
                    ...chapter,
                    progress: chaptersWatched,
                    hideWatchedEpisodes
                  }}
                  chapterNumber={chapter.number}
                  onRead={handleReadChapter}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

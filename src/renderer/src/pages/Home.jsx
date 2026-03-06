import AnimeCard from '../components/AnimeCard'
import useTopAiringAnime from '../hooks/useTopAiringAnime'
// (legacy import removed)
import InfiniteScroll from 'react-infinite-scroll-component'
import { getTopAnime, searchAnilist } from '../utils/helper'
import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Button, Spinner, Tooltip } from '@radix-ui/themes'
import { toast } from 'sonner'
import { ExclamationTriangleIcon, PersonIcon, StarIcon, VideoIcon } from '@radix-ui/react-icons'
import SkeletonAnimeCard from '../skeletons/SkeletonAnimeCard'
import { getCurrentSeason } from '../utils/currentSeason'
import { Carousel } from 'react-responsive-carousel'
import 'react-responsive-carousel/lib/styles/carousel.min.css'
import HTMLReactParser from 'html-react-parser/lib/index'
import { useNavigate } from 'react-router-dom'
import { useAnitingContext } from '../utils/ContextProvider'
import useGetAnilistSearch from '../hooks/useGetAnilistSearch'
import CurrentlyWatchingCard from '../components/CurrentlyWatchingCard'
import { getLocalAnimeByStatus, getLatestPlaybackForAnime } from '../utils/localAnimeStore'

const HERO_CAROUSEL_DATA = [
  {
    title: 'Sousou no Frieren',
    anilistId: 154587,
    logo: 'https://artworks.thetvdb.com/banners/v4/series/424536/clearlogo/693245c866f9b.png',
    description:
      'El rey demonio ha sido derrotado y el grupo de héroes victoriosos regresa a casa antes de disolverse. Los cuatro (la maga Frieren, el héroe Himmel, el sacerdote Heiter y el guerrero Eisen) recuerdan su viaje de una década cuando llega el momento de despedirse unos de otros.',
    fondo: 'https://artworks.thetvdb.com/banners/v4/series/424536/backgrounds/6973cfb5d01a0.jpg',
    episodes: 28,
    averageScore: 92,
    popularity: 456781,
    format: 'TV'
  },
  {
    title: 'Sentenced to be a Hero',
    anilistId: 167152,
    logo: 'https://artworks.thetvdb.com/banners/v4/series/437266/clearlogo/692f7b69ed5ee.png',
    description:
      'En un mundo donde el heroísmo es un castigo, Xylo Forbartz, un asesino de diosas condenado, lucha contra hordas interminables de abominaciones monstruosas como parte de la Unidad de Héroes Penales 9004. La muerte no es una escapatoria, solo un ciclo de resurrección y combate implacable. Pero cuando Xylo se encuentra con una nueva y misteriosa diosa, su improbable alianza desencadena una rebelión.',
    fondo: 'https://artworks.thetvdb.com/banners/v4/series/437266/backgrounds/68cfdb564c6da.jpg',
    episodes: 12,
    averageScore: 78,
    popularity: 54102,
    format: 'TV'
  },
  {
    title: 'Oshi No KO',
    anilistId: 166531,
    logo: 'https://artworks.thetvdb.com/banners/v4/series/421069/clearlogo/6440fff03273e.png',
    description:
      'El Dr. Goro renace como hijo de la joven estrella Ai Hoshino después de que su acosador delirante lo asesine. Ahora quiere ayudar a su nueva madre a llegar a lo más alto, pero ¿qué puede hacer un niño ante los oscuros entresijos de la industria del entretenimiento?',
    fondo: 'https://artworks.thetvdb.com/banners/v4/series/421069/backgrounds/6564f2cc723b4.jpg',
    episodes: 13,
    averageScore: 85,
    popularity: 384912,
    format: 'TV'
  },
  {
    title: 'Fire Force',
    anilistId: 114853,
    logo: 'https://artworks.thetvdb.com/banners/v4/series/355480/clearlogo/611ca33b347aa.png',
    description:
      'Mientrás se extiende el caos, Shinra y la Compañía 8 luchan por detener un incendio definitivo que aniquilará el mundo.',
    fondo: 'https://artworks.thetvdb.com/banners/series/355480/backgrounds/5e84d85ae5a76.jpg',
    episodes: 24,
    averageScore: 82,
    popularity: 201243,
    format: 'TV'
  },
  {
    title: 'Fate/strange Fake',
    anilistId: 159491,
    logo: 'https://artworks.thetvdb.com/banners/v4/series/436779/clearlogo/6742a5a87b886.png',
    description:
      'Una nueva Guerra del Santo Grial se prepara en un pequeño y nuevo país pese a la oposición de los magos, pero es una Guerra del Santo Grial falsa, artificial, cuyo objetivo escapa a los miembros de la Torre del Reloj.',
    fondo: 'https://artworks.thetvdb.com/banners/v4/series/436779/backgrounds/64a23f3ae73a0.jpg',
    episodes: 1,
    averageScore: 88,
    popularity: 154032,
    format: 'TV'
  }
]

export default function Home() {
  const { userId } = useAnitingContext()

  const {
    isLoading,
    data: topAiringAnime,
    error,
    status
  } = useGetAnilistSearch(
    {
      sort: 'POPULARITY_DESC', // Hentai doesn't always have RELEASING
      status_in: '[RELEASING]',
      season: getCurrentSeason(),
      format_not: 'MUSIC'
    },
    1,
    49
  )

  const {
    isLoadingCurrentlyWatching,
    data: currentlyWatching,
    errorCurrentlyWatching
  } = useGetAnilistSearch(
    userId
      ? {
        watchStatus: 'CURRENT',
        userId: userId
      }
      : {}
  )

  const {
    data,
    fetchNextPage,
    isFetching,
    error: infiniteQueryError
  } = useInfiniteQuery({
    queryKey: ['top_animes'],
    queryFn: ({ pageParam = 1 }) => searchAnilist({ sort: 'POPULARITY_DESC' }, pageParam),

    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      return allPages.length + 1
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 // 1 hour
  })

  useEffect(() => {
    if (infiniteQueryError) {
      toast.error(`Error al obtener los Mejores Anime`, {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description: infiniteQueryError?.message,
        classNames: {
          title: 'text-rose-500'
        }
      })
    }
  }, [infiniteQueryError])

  const [topAnime, setTopAnime] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    if (data) {
      const newTopAnime = data.pages
        .map((page) => page)
        .flat()
        .filter(Boolean)
      setTopAnime(newTopAnime)
    }
  }, [data])
  const [showAllWatching, setShowAllWatching] = useState(false)
  const [showAllLocalWatching, setShowAllLocalWatching] = useState(false)

  return (
    <div className="select-none font-space-mono tracking-tight">
      {HERO_CAROUSEL_DATA?.length > 0 && (
        <div className={`w-full`}>
          <style>
            {`
              .carousel .control-dots {
                bottom: 2% !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                width: auto !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background-color: #00000080 !important;
                padding: 6px 12px !important;
                border: 1px solid #ffffff20 !important;
                border-radius: 8px !important;
                backdrop-filter: blur(8px) !important;
                margin: 0 !important;
                z-index: 30 !important;
              }
              .carousel .slide {
                pointer-events: none !important;
              }
              .carousel .slide.selected {
                pointer-events: auto !important;
              }
              .carousel.carousel-slider .control-arrow {
                width: 60px !important;
                z-index: 25 !important;
                opacity: 0 !important;
              }
              .carousel.carousel-slider .control-arrow:hover {
                opacity: 0.6 !important;
                background: rgba(0,0,0,0.3) !important;
              }
            `}
          </style>
          <div className="animate-fade">
            <Carousel
              axis="horizontal"
              showArrows={true}
              showThumbs={false}
              autoPlay
              interval={12000}
              transitionTime={1200}
              animationHandler="fade"
              swipeable={false}
              infiniteLoop
              showIndicators={false}
              onClickItem={(index) => navigate(`/anime/${HERO_CAROUSEL_DATA[index].anilistId}`)}
              renderIndicator={(onClickHandler, isSelected, index, label) => {
                const defStyle =
                  'w-2.5 h-2.5 mx-1.5 rounded-full transition-all duration-300 ease-in-out cursor-pointer z-30 inline-block drop-shadow-md'
                const style = isSelected
                  ? `${defStyle} bg-[#ffffff] scale-110`
                  : `${defStyle} bg-[#ffffff50] hover:bg-[#ffffff90]`
                return (
                  <button
                    style={{}}
                    className={style}
                    onClick={onClickHandler}
                    onKeyDown={onClickHandler}
                    value={index}
                    key={index}
                    role="button"
                    tabIndex={0}
                    aria-label={`${label} ${index + 1}`}
                  />
                )
              }}
            >
              {HERO_CAROUSEL_DATA.map((item) => (
                <div
                  key={item.anilistId + 'heroAnime'}
                  className="3xl:h-[90vh] relative h-[65vh] w-full cursor-pointer xl:h-[75vh] 2xl:h-[85vh]"
                >
                  <div
                    className="absolute bottom-[5%] left-0 z-20 ml-5 flex w-7/12 cursor-pointer flex-col items-start justify-end gap-y-3 px-4 xl:ml-10 xl:gap-y-4 2xl:ml-16"
                    onClick={() => navigate(`/anime/${item.anilistId}`)}
                  >
                    {/* Logo */}
                    {item.logo ? (
                      <img
                        src={item.logo}
                        alt={item.title}
                        className="h-20 w-auto object-contain object-left drop-shadow-3xl lg:h-24 xl:h-28 2xl:h-36"
                      />
                    ) : (
                      <div className="line-clamp-1 max-w-xl py-1 text-start text-3xl font-bold tracking-wider text-white drop-shadow-3xl 2xl:text-5xl">
                        {item.title}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex gap-x-6 border border-[#ffffff40] bg-[#00000040] px-2 py-1.5 text-xs backdrop-blur-[2px]">
                      <div>{item.episodes || 0} episodios</div>
                      {item.averageScore && (
                        <div className="flex items-center gap-x-1 tracking-wide">
                          <StarIcon /> {item.averageScore} / 100
                        </div>
                      )}
                      {item.popularity && (
                        <div className="flex items-center gap-x-1 tracking-wide">
                          <PersonIcon />
                          {item.popularity.toLocaleString()}
                        </div>
                      )}
                      {item.format && (
                        <div className="flex items-center gap-x-1 tracking-wide">
                          <VideoIcon className="h-4 w-4 text-white" />
                          {item.format.slice(0, 3)}
                        </div>
                      )}
                    </div>

                    {/* Synopsis */}
                    {item.description && (
                      <div className="drop-shadow-md line-clamp-4 w-full text-left text-xs font-medium tracking-wide text-gray-200 lg:text-sm 2xl:text-base">
                        {item.description}
                      </div>
                    )}

                    {/* Más Info button */}
                    <div className="flex cursor-pointer items-center gap-x-2 border border-[#ffffff50] bg-[#ffffff12] px-4 py-2 text-sm font-medium tracking-wider text-white backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-[#ffffff80] hover:bg-[#ffffff25] active:scale-95">
                      Más Info
                    </div>
                  </div>

                  <img
                    src={item.fondo}
                    alt={item.title}
                    className="3xl:h-[90vh] h-[65vh] w-full object-cover object-top xl:h-[75vh] 2xl:h-[85vh]"
                  />

                  <div className="pointer-events-none absolute bottom-0 z-10 h-40 w-full bg-gradient-to-t from-[#111113] via-[#11111380] to-transparent"></div>
                </div>
              ))}
            </Carousel>
          </div>
        </div>
      )}

      {error && <div className="text-red-500">Error al obtener contenido : {error.message}</div>}

      {userId && currentlyWatching?.length > 0 && (
        <div className="mx-3 mt-4">
          <div className="mb-2 ml-5 flex items-center justify-between border-b border-gray-700 pb-1 pr-4 font-space-mono text-lg font-bold tracking-wider">
            <span>Seguir Viendo</span>
            {currentlyWatching?.length > 6 && (
              <button
                onClick={() => setShowAllWatching(!showAllWatching)}
                className="text-xs font-medium text-gray-400 transition-colors hover:text-white"
              >
                {showAllWatching ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>
          <div
            className={`grid animate-fade grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-3 gap-y-3 overflow-hidden px-2 pl-4 transition-all duration-500 ${showAllWatching ? 'max-h-[2000px]' : 'max-h-[185px]'}`}
          >
            {[...currentlyWatching]
              .filter((anime) => {
                const progress = anime.mediaListEntry?.progress || 0
                const nextEpNum = progress + 1
                const nextAiring = anime.nextAiringEpisode

                // If the anime is finished and we've watched all episodes, hide it
                if (anime.status === 'FINISHED' && anime.episodes && progress >= anime.episodes) {
                  return false
                }

                // If the next episode to watch hasn't aired yet, hide it
                // nextAiringEpisode.episode is the NEXT ep that will air — if it equals
                // or is less than our nextEpNum, that episode hasn't aired yet
                if (nextAiring && nextAiring.episode <= nextEpNum) {
                  return false
                }

                return true
              })
              .sort((a, b) => {
                const tA = getLatestPlaybackForAnime(a.id)?.updatedAt || 0
                const tB = getLatestPlaybackForAnime(b.id)?.updatedAt || 0
                return tB - tA
              })
              .map((anime) => (
                <CurrentlyWatchingCard key={anime.id + 'currentlyWatching'} data={anime} />
              ))}
          </div>
        </div>
      )}

      {/* Local "Seguir Viendo" when not logged in to Anilist */}
      {!userId &&
        (() => {
          const localWatching = getLocalAnimeByStatus('CURRENT').sort((a, b) => {
            const tA = getLatestPlaybackForAnime(a.id)?.updatedAt || a.updatedAt || 0
            const tB = getLatestPlaybackForAnime(b.id)?.updatedAt || b.updatedAt || 0
            return tB - tA
          })
          if (localWatching.length === 0) return null
          return (
            <div className="mx-3 mt-4">
              <div className="mb-2 ml-5 flex items-center justify-between border-b border-gray-700 pb-1 pr-4 font-space-mono text-lg font-bold tracking-wider">
                <span>Seguir Viendo</span>
                {localWatching.length > 6 && (
                  <button
                    onClick={() => setShowAllLocalWatching(!showAllLocalWatching)}
                    className="text-xs font-medium text-gray-400 transition-colors hover:text-white"
                  >
                    {showAllLocalWatching ? 'Ver menos' : 'Ver más'}
                  </button>
                )}
              </div>
              <div className={`grid animate-fade grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-3 gap-y-3 overflow-hidden px-2 pl-4 transition-all duration-500 ${showAllLocalWatching ? 'max-h-[2000px]' : 'max-h-[185px]'}`}>
                {localWatching
                  .filter((entry) => {
                    const latestPlayback = getLatestPlaybackForAnime(entry.id)
                    const isFinished = latestPlayback && latestPlayback.percentage >= 80
                    if (isFinished && entry.totalEpisodes && entry.progress >= entry.totalEpisodes) {
                      return false
                    }
                    return true
                  })
                  .map((entry) => (
                    <CurrentlyWatchingCard
                      key={entry.id + 'localWatching'}
                      data={{
                        id: Number(entry.id),
                        title: { romaji: entry.title, english: entry.title },
                        coverImage: { extraLarge: entry.coverImage, medium: entry.coverImage },
                        bannerImage: entry.bannerImage || entry.coverImage,
                        episodes: entry.totalEpisodes || 0,
                        mediaListEntry: { progress: entry.progress || 0 },
                        format: entry.format || 'TV'
                      }}
                    />
                  ))}
              </div>
            </div>
          )
        })()}

      {/* {status === 'success' && !error && ( */}
      {!error && (
        <div className="mx-5 mt-8">
          <div className="mb-2 border-b border-gray-700 pb-1 font-space-mono text-lg font-bold tracking-wider">
            Anime en Emisión
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-4 overflow-x-visible pl-4">
            {!isLoading &&
              !error &&
              topAiringAnime?.map((anime) => (
                <AnimeCard key={anime.id + 'topAiringAnime'} data={anime} />
              ))}
            {isLoading && (
              <>
                <SkeletonAnimeCard />
                <SkeletonAnimeCard />
                <SkeletonAnimeCard />
                <SkeletonAnimeCard />
                <SkeletonAnimeCard />
                <SkeletonAnimeCard />
                <SkeletonAnimeCard />
              </>
            )}
          </div>
        </div>
      )}

      {infiniteQueryError && (
        <div className="text-red-500">
          Error al obtener los Mejores Anime : {infiniteQueryError.message}
        </div>
      )}

      {!infiniteQueryError && topAnime?.length > 0 && (
        <div className="mx-5 mt-12">
          <div className="mb-2 border-b border-gray-700 pb-1 font-space-mono text-lg font-bold tracking-wider">
            Mejores Anime
          </div>

          <div className={`mb-2 w-full`}>
            <div className="animate-fade">
              <Carousel
                axis="horizontal"
                showArrows={true}
                showThumbs={false}
                autoPlay
                interval={5000}
                infiniteLoop
                renderIndicator={false}
                emulateTouch
              >
                {topAnime.slice(0, 8).map((anime) => (
                  // gradient from left to right black to transparent
                  <div
                    key={anime.id + 'bannerAnime'}
                    className="relative h-72 cursor-pointer 2xl:h-96"
                    onClick={() =>
                      navigate(`/${anime.type === 'MANGA' ? 'manga' : 'anime'}/${anime.id}`, {
                        state: { data: anime }
                      })
                    }
                  >
                    <div className="mask absolute h-full w-8/12 bg-gradient-to-r from-[#141414] backdrop-blur-md"></div>
                    <div className="absolute ml-5 flex h-full flex-col items-start justify-center gap-y-2 px-2 2xl:gap-y-6">
                      <div className="line-clamp-1 max-w-xl bg-gradient-to-r from-[#14141480] py-1 text-start text-2xl font-semibold tracking-wider text-white drop-shadow-3xl">
                        {anime.title.romaji}
                      </div>
                      <div className="mb-4 line-clamp-1 max-w-2xl text-start text-xs tracking-wider text-white drop-shadow-3xl">
                        {anime.title.english}
                      </div>

                      {anime.description && (
                        <div className="line-clamp-[9] w-80 text-left text-xs tracking-wide">
                          {HTMLReactParser(anime.description)}
                        </div>
                      )}

                      <div className="flex gap-x-8 border border-[#ffffff70] bg-[#00000050] px-1 py-1 text-xs backdrop-blur-[2px]">
                        <div>{anime.episodes || 0} episodios</div>
                        {anime.averageScore && (
                          <div className="flex items-center gap-x-1 tracking-wide">
                            <StarIcon /> {anime.averageScore} / 100
                          </div>
                        )}
                        <div className="flex items-center gap-x-1 tracking-wide">
                          <PersonIcon />
                          {anime.popularity.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-x-1 tracking-wide">
                          <VideoIcon className="h-4 w-4 text-white" />
                          {anime.format.slice(0, 3)}
                        </div>
                      </div>
                    </div>
                    <img
                      src={anime.bannerImage}
                      alt=""
                      className="h-72 w-full object-cover 2xl:h-96"
                    />
                  </div>
                ))}
              </Carousel>
            </div>
          </div>

          <InfiniteScroll
            style={{ all: 'unset' }}
            dataLength={topAnime?.length}
            next={() => fetchNextPage()}
            hasMore={topAnime?.length < 500}
            loader={
              <div className="flex items-center justify-center gap-x-2 overflow-hidden">
                <h4>Cargando...</h4>
                <Spinner />
              </div>
            }
          >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-4 overflow-x-visible pl-4">
              {topAnime?.map((anime) => {
                return <AnimeCard key={anime.id + 'topAnime'} data={anime} />
              })}
              {isFetching && (
                <>
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                  <SkeletonAnimeCard />
                </>
              )}
            </div>
          </InfiniteScroll>
        </div>
      )}
    </div>
  )
}

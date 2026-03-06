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

export default function MangaHome() {
  const { userId, contentType } = useAnitingContext()

  // const { isLoading, topAiringAnime, error, status } = useTopAiringAnime()
  // media(type: ANIME, sort: TRENDING_DESC, status_in: [RELEASING], isAdult: false)
  const isHentai = contentType === 'HENTAI'

  const {
    isLoading,
    data: topAiringAnime,
    error,
    status
  } = useGetAnilistSearch(
    {
      sort: 'TRENDING_DESC', // Manga doesn't use seasons
      status_in: '[RELEASING]',
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
    queryKey: ['top_animes', contentType],
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
      toast.error(`Error al obtener los Mejores Manga`, {
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

  return (
    <div className="select-none font-space-mono tracking-tight">
      {error && <div className="text-red-500">Error al obtener contenido : {error.message}</div>}

      {!isLoading && topAiringAnime?.length > 0 && (
        <div className="mb-2 mt-4 w-full">
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
              {topAiringAnime.slice(0, 8).map((anime) => (
                // gradient from left to right black to transparent
                <div
                  key={anime.id + 'bannerAiring'}
                  className="relative h-72 cursor-pointer 2xl:h-96"
                  onClick={() =>
                    navigate(`/${anime.type === 'ANIME' ? 'anime' : 'manga'}/${anime.id}`, {
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
                      <div>{anime.chapters || '?'} capitulos</div>
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
                    src={anime.bannerImage || anime.coverImage.extraLarge}
                    alt=""
                    className="h-72 w-full object-cover 2xl:h-96"
                  />
                </div>
              ))}
            </Carousel>
          </div>
        </div>
      )}

      {userId && currentlyWatching?.length > 0 && (
        <div className="mx-3 mt-4">
          <div className="mb-2 ml-5 flex items-center justify-between border-b border-gray-700 pb-1 pr-4 font-space-mono text-lg font-bold tracking-wider">
            <span>Continuar Leyendo</span>
            {currentlyWatching?.length > 4 && (
              <button
                onClick={() => setShowAllWatching(!showAllWatching)}
                className="text-xs font-medium text-gray-400 transition-colors hover:text-white"
              >
                {showAllWatching ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>
          <div
            className={`grid animate-fade grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-4 overflow-hidden px-2 pl-4 transition-all duration-500 ${showAllWatching ? 'max-h-[2000px]' : 'max-h-[260px]'}`}
          >
            {currentlyWatching?.map((anime) => (
              <CurrentlyWatchingCard key={anime.id + 'currentlyWatching'} data={anime} />
            ))}
          </div>
        </div>
      )}

      {/* {status === 'success' && !error && ( */}
      {!error && (
        <div className="mx-5 mt-8">
          <div className="mb-2 border-b border-gray-700 pb-1 font-space-mono text-lg font-bold tracking-wider">
            Manga en Publicación
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
          Error al obtener los Mejores Manga : {infiniteQueryError.message}
        </div>
      )}

      {!infiniteQueryError && topAnime?.length > 0 && (
        <div className="mx-5 mt-12">
          <div className="mb-2 border-b border-gray-700 pb-1 font-space-mono text-lg font-bold tracking-wider">
            Mejores Manga
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

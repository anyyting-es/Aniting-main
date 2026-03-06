import { useQuery } from '@tanstack/react-query'

/**
 * Fetches TMDB TV series data in Spanish (es-ES) using the TMDB ID
 * from AniZip mappings. Requires a free TMDB API key.
 * https://www.themoviedb.org/settings/api
 */
export default function useGetTmdbData(tmdbId, apiKey) {
  const { isLoading, data, error } = useQuery({
    queryKey: ['tmdb_es', tmdbId, apiKey],
    queryFn: async () => {
      if (!tmdbId || !apiKey) return null

      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}?language=es-ES&api_key=${apiKey}`
      )
      if (!res.ok) return null
      const json = await res.json()
      return json
    },
    enabled: Boolean(tmdbId && apiKey),
    staleTime: 1000 * 60 * 5 // 5 minutos
  })

  return { isLoading, data, error }
}

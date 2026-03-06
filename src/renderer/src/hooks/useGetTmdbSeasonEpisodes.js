import { useQuery } from '@tanstack/react-query'

/**
 * Fetches the correct TMDB season(s) in Spanish (es-ES) for an AniList entry.
 *
 * For short anime (1-2 cours) this typically fetches a single season.
 * For long-running anime (Bleach, One Piece, etc.) where AniList has one entry
 * spanning many TMDB seasons, it fetches ALL seasons covering the episode range
 * so every episode gets thumbnail/title data.
 *
 * @param {number} tmdbId - TMDB show ID
 * @param {number} firstAbsEpisode - absoluteEpisodeNumber of the first episode
 * @param {string} apiKey - TMDB API key
 * @param {number} totalEpisodes - total number of episodes in this AniList entry
 */
export default function useGetTmdbSeasonEpisodes(tmdbId, firstAbsEpisode, apiKey, totalEpisodes) {
  const absStart = firstAbsEpisode ?? 1
  const absEnd = absStart + (totalEpisodes || 1) - 1

  const { isLoading, data, error } = useQuery({
    queryKey: ['tmdb_season_es_v4', tmdbId, absStart, absEnd, apiKey],
    queryFn: async () => {
      if (!tmdbId || !apiKey) return {}

      // Step 1: fetch show info to get per-season episode counts
      const showRes = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}?language=es-ES&api_key=${apiKey}`
      )
      if (!showRes.ok) return {}
      const show = await showRes.json()

      // Filter out Season 0 (specials)
      const seasons = (show.seasons || []).filter((s) => s.season_number > 0)

      // Step 2: find ALL TMDB seasons that overlap with our [absStart, absEnd] range
      let running = 0
      const seasonsToFetch = []

      for (const s of seasons) {
        const seasonStart = running + 1
        const seasonEnd = running + s.episode_count

        // This season overlaps with our range if seasonStart <= absEnd AND seasonEnd >= absStart
        if (seasonStart <= absEnd && seasonEnd >= absStart) {
          seasonsToFetch.push({ seasonNumber: s.season_number, offset: running })
        }

        // If we've passed our range, no need to continue
        if (seasonStart > absEnd) break

        running += s.episode_count
      }

      // If no season matched, try fetching season 1 as fallback
      if (seasonsToFetch.length === 0) {
        seasonsToFetch.push({ seasonNumber: 1, offset: 0 })
      }

      // Step 3: fetch all needed seasons in parallel
      const seasonFetches = seasonsToFetch.map(async ({ seasonNumber, offset }) => {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?language=es-ES&api_key=${apiKey}`
        )
        if (!res.ok) return []
        const json = await res.json()
        return (json.episodes || []).map((ep) => ({
          absNum: offset + ep.episode_number,
          name: ep.name || null,
          overview: ep.overview || null,
          still_path: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null
        }))
      })

      const results = await Promise.all(seasonFetches)

      // Step 4: build map keyed by absoluteEpisodeNumber
      const map = {}
      for (const episodes of results) {
        for (const ep of episodes) {
          map[ep.absNum] = {
            name: ep.name,
            overview: ep.overview,
            still_path: ep.still_path
          }
        }
      }
      return map
    },
    enabled: Boolean(tmdbId && apiKey),
    staleTime: 1000 * 60 * 5
  })

  return { isLoading, data: data || {}, error }
}

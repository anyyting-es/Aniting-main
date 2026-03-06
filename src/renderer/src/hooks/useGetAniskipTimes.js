import { useQuery } from '@tanstack/react-query'

/**
 * Fetches OP/ED skip times from the AniSkip API (v2).
 * Uses MAL ID + episode number.
 *
 * @param {number|null} malId - MyAnimeList ID
 * @param {number|null} episodeNumber - Episode number
 * @param {number} episodeLength - Approximate episode length in seconds (0 = return all)
 */
export default function useGetAniskipTimes(malId, episodeNumber, episodeLength = 0) {
  const { isLoading, data, error } = useQuery({
    queryKey: ['aniskip', malId, episodeNumber],
    queryFn: async () => {
      if (!malId || !episodeNumber) return null

      const params = new URLSearchParams({
        types: 'op',
        episodeLength: String(episodeLength)
      })
      // Add types separately to get both op and ed
      params.delete('types')
      params.append('types', 'op')
      params.append('types', 'ed')

      const res = await fetch(
        `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?${params.toString()}`
      )
      if (!res.ok) return null
      const json = await res.json()

      if (!json.found || !json.results?.length) return null

      // Normalize results
      return json.results.map((r) => ({
        type: r.skipType, // 'op' or 'ed'
        startTime: r.interval.startTime,
        endTime: r.interval.endTime,
        skipId: r.skipId,
        episodeLength: r.episodeLength
      }))
    },
    enabled: Boolean(malId && episodeNumber),
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1
  })

  return { isLoading, data: data || null, error }
}

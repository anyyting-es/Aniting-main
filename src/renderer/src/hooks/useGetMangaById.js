import { useQuery } from '@tanstack/react-query'
import { getMangaById } from '../utils/helper'

export default function useGetMangaById(id) {
  console.log('Fetching manga with id:', id)

  const {
    isLoading,
    data: mangaData,
    error,
    status
  } = useQuery({
    queryKey: ['cur_manga', id],
    queryFn: () => getMangaById(id),
    staleTime: 1000 * 60 * 20 // 20 mins
  })

  return { isLoading, mangaData, error, status }
}

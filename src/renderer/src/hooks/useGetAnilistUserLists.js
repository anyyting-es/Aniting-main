import { useQuery } from '@tanstack/react-query'
import { getAnilistUserLists } from '../utils/auth'

export default function useGetAnilistUserLists(userId) {
  const { isLoading, data, error, status } = useQuery({
    queryKey: ['user_lists', userId],
    queryFn: () => {
      if (userId) return getAnilistUserLists(userId)
      return null
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5 // 5 mins
  })

  return { isLoading, data, error, status }
}

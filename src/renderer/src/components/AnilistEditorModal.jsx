import { useState, useEffect } from 'react'
import AniListLogo from '../assets/symbols/AniListLogo'
import { Button, DropdownMenu, Spinner, TextField } from '@radix-ui/themes'
import { setAnimeStatus, setWatchedEpisodes as setWatchedEpisodesAnilist } from '../utils/helper'
import {
  setLocalAnimeStatus,
  setLocalWatchedEpisodes,
  getLocalAnimeEntry
} from '../utils/localAnimeStore'
import { toast } from 'sonner'
import { ExclamationTriangleIcon, MinusIcon, PlusIcon } from '@radix-ui/react-icons'

const STATUS_MAP = {
  PLANNING: 'PLANNING',
  WATCHING: 'CURRENT',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  DROPPED: 'DROPPED',
  REPEATING: 'REPEATING'
}

function AnilistEditorModal({ anilist_data, setEpisodesWatchedMainPage, customStyle }) {
  const anilistToken = localStorage.getItem('anilist_token')
  const isLoggedIn = !!anilistToken

  // Build anime metadata for local storage
  const animeMeta = {
    title: anilist_data?.title?.romaji || anilist_data?.title?.english || '',
    coverImage: anilist_data?.coverImage?.extraLarge || anilist_data?.coverImage?.medium || '',
    episodes: anilist_data?.episodes || 0,
    bannerImage: anilist_data?.bannerImage || '',
    format: anilist_data?.format || ''
  }

  // Determine initial values from anilist or local
  const localEntry = getLocalAnimeEntry(anilist_data?.id)

  const initialStatus = isLoggedIn
    ? anilist_data?.mediaListEntry?.status || null
    : localEntry?.status || null

  const initialProgress = isLoggedIn
    ? anilist_data?.mediaListEntry?.progress || 0
    : localEntry?.progress || 0

  const [title, setTitle] = useState(
    initialStatus
      ? initialStatus[0].toUpperCase() + initialStatus.slice(1).toLowerCase()
      : 'Agregar'
  )

  const [anilistModalOpen, setAnilistModalOpen] = useState(false)
  const [episodesWatched, setEpisodesWatched] = useState(initialProgress)
  const [updating, setUpdating] = useState(false)

  // Sync from anilist data if logged in
  useEffect(() => {
    if (isLoggedIn && anilist_data?.mediaListEntry?.progress !== undefined) {
      setEpisodesWatched(anilist_data.mediaListEntry.progress)
    }
  }, [anilist_data?.mediaListEntry?.progress, isLoggedIn])

  async function handleStatusChange(newStatus) {
    setUpdating(true)

    if (isLoggedIn) {
      const response = await setAnimeStatus(anilist_data.id, newStatus)
      setUpdating(false)
      if (response?.status) {
        // Also save locally
        setLocalAnimeStatus(anilist_data.id, newStatus, animeMeta)
        toast.success('AniList actualizado', {
          description: `Estado del anime actualizado a ${newStatus}`,
          classNames: { title: 'text-green-500' }
        })
        setTitle(newStatus[0].toUpperCase() + newStatus.slice(1).toLowerCase())
      } else {
        toast.error('Error al actualizar AniList', {
          description: 'No se pudo actualizar AniList',
          icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
          classNames: { title: 'text-rose-500' }
        })
      }
    } else {
      // Local mode
      setLocalAnimeStatus(anilist_data.id, newStatus, animeMeta)
      setUpdating(false)
      toast.success('Estado actualizado (local)', {
        description: `Estado del anime actualizado a ${newStatus}`,
        classNames: { title: 'text-green-500' }
      })
      setTitle(newStatus[0].toUpperCase() + newStatus.slice(1).toLowerCase())
    }
  }

  async function anilistEpisodeHandler(action) {
    let new_episode = episodesWatched
    const total_episodes = anilist_data?.episodes || 100000000
    if (!isNaN(action)) {
      if (action === episodesWatched) return
      if (action > total_episodes || action < 0) {
        toast.error('Número de episodio inválido', {
          description: 'Número de episodio inválido',
          icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
          classNames: { title: 'text-rose-500' }
        })
        return
      }
      new_episode = action
    }
    if (action === 'increase' && new_episode < total_episodes) {
      new_episode += 1
    } else if (action === 'increase' && new_episode >= total_episodes) {
      return
    }
    if (action === 'decrease' && new_episode > 0) {
      new_episode -= 1
    } else if (action === 'decrease' && new_episode <= 0) {
      return
    }
    try {
      setUpdating(true)

      if (isLoggedIn) {
        await setWatchedEpisodesAnilist(anilist_data.id, new_episode)
      }
      // Always save locally too
      setLocalWatchedEpisodes(anilist_data.id, new_episode, animeMeta)

      if (setEpisodesWatchedMainPage) setEpisodesWatchedMainPage(new_episode)
      if (title === 'Agregar') {
        setTitle('Current')
      }
      setEpisodesWatched(new_episode)
      setUpdating(false)
    } catch (error) {
      toast.error('Error al actualizar', {
        description: isLoggedIn ? 'No se pudo actualizar AniList' : 'Error al guardar',
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        classNames: { title: 'text-rose-500' }
      })
      console.error(error)
    }
  }

  return (
    <div className="font-space-mono">
      {anilist_data && (
        <div className={`flex items-center gap-x-4`}>
          <div className="font-space-mono">
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger>
                <Button
                  size={'1'}
                  variant=""
                  style={{
                    borderRadius: '0rem'
                  }}
                  onClick={() => setAnilistModalOpen(true)}
                >
                  <div className="flex items-center justify-center">
                    <div className="ml-[-8px] mr-2 gap-x-1 bg-slate-700 px-1">
                      <AniListLogo />
                    </div>
                    {title}
                  </div>
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {Object.keys(STATUS_MAP).map((key) => (
                  <DropdownMenu.Item
                    key={key}
                    color="gray"
                    onSelect={() => {
                      handleStatusChange(STATUS_MAP[key])
                    }}
                  >
                    {STATUS_MAP[key][0].toUpperCase() + STATUS_MAP[key].slice(1).toLowerCase()}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
          {customStyle !== 'buttonOnly' && (
            <div className="flex border border-[#545454]">
              <Button
                size={'1'}
                color="gray"
                variant="soft"
                onClick={() => anilistEpisodeHandler('decrease')}
                style={{
                  borderRadius: '0rem'
                }}
              >
                <MinusIcon width={'16px'} height={'16px'} />
              </Button>
              <div className="flex items-center">
                <TextField.Root
                  placeholder="?"
                  size={'1'}
                  className="w-10"
                  value={episodesWatched}
                  onChange={(e) => setEpisodesWatched(e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    textAlign: 'right',
                    boxShadow: 'none',
                    fontFamily: 'Space Mono'
                  }}
                  onBlur={() => {
                    // setEpisodesWatched(parseInt(episodesWatched))
                    anilistEpisodeHandler(parseInt(episodesWatched))
                  }}
                ></TextField.Root>
                <p className="ml-2 mr-8 text-nowrap pb-[2.41px] text-xs">
                  / {anilist_data?.episodes || '?'}
                </p>
              </div>
              <Button
                size={'1'}
                color="gray"
                variant="soft"
                onClick={() => anilistEpisodeHandler('increase')}
                style={{
                  borderRadius: '0rem'
                }}
              >
                <PlusIcon width={'16px'} height={'16px'} />
              </Button>
            </div>
          )}
          {updating && <Spinner />}
        </div>
      )}
    </div>
  )
}

export default AnilistEditorModal

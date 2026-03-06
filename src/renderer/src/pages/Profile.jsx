import { useState, useRef } from 'react'
import { useAnitingContext } from '../utils/ContextProvider'
import useGetAnilistProfile from '../hooks/useGetAnilistProfile'
import useGetAnilistUserLists from '../hooks/useGetAnilistUserLists'
import { Button, Tabs, TextField } from '@radix-ui/themes'
import { PersonIcon, Pencil1Icon } from '@radix-ui/react-icons'
import { anilistAuthUrl } from '../utils/auth'
import { useNavigate } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import {
  getLocalStats,
  getLocalAnimeByStatus,
  getLocalProfile,
  saveLocalProfile
} from '../utils/localAnimeStore'

export default function Profile() {
  const navigate = useNavigate()
  const anilistToken = localStorage.getItem('anilist_token')
  const isLoggedIn = !!anilistToken

  const { isLoading, data: userProfile, error } = useGetAnilistProfile(anilistToken)

  const { data: userLists, isLoading: isLoadingLists } = useGetAnilistUserLists(userProfile?.id)

  const handleLogin = () => {
    window.api.oauth(anilistAuthUrl)
  }

  // ── Local profile state ──
  const [localProfile, setLocalProfile] = useState(getLocalProfile())
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(localProfile.name || '')
  const fileInputRef = useRef(null)
  const localStats = getLocalStats()

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const updated = { ...localProfile, avatar: ev.target.result }
      saveLocalProfile(updated)
      setLocalProfile(updated)
    }
    reader.readAsDataURL(file)
  }

  function handleNameSave() {
    const updated = { ...localProfile, name: nameInput.trim() || 'Usuario Local' }
    saveLocalProfile(updated)
    setLocalProfile(updated)
    setEditingName(false)
  }

  // ── Not logged in: show local profile ──
  if (!isLoggedIn) {
    const localWatching = getLocalAnimeByStatus('CURRENT')
    const localCompleted = getLocalAnimeByStatus('COMPLETED')
    const localPlanning = getLocalAnimeByStatus('PLANNING')
    const localPaused = getLocalAnimeByStatus('PAUSED')

    return (
      <div className="min-h-screen animate-fade p-8">
        {/* HEADER */}
        <div className="mb-0 flex flex-col items-center gap-6 lg:flex-row lg:items-end">
          <div className="flex flex-1 flex-col items-center gap-6 p-4 sm:flex-row">
            {/* Avatar */}
            <div className="group relative">
              {localProfile.avatar ? (
                <img
                  src={localProfile.avatar}
                  alt="avatar"
                  className="h-28 w-28 cursor-pointer rounded-full object-cover"
                  onClick={() => fileInputRef.current?.click()}
                />
              ) : (
                <div
                  className="flex h-28 w-28 cursor-pointer items-center justify-center rounded-full bg-gray-700"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PersonIcon className="h-12 w-12 text-gray-400" />
                </div>
              )}
              <div
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => fileInputRef.current?.click()}
              >
                <Pencil1Icon className="h-6 w-6 text-white" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Name */}
            <div className="flex flex-col items-center sm:items-start">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <TextField.Root
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                    size="2"
                    style={{ fontFamily: 'Space Mono' }}
                  />
                  <Button size="1" color="green" onClick={handleNameSave}>
                    Guardar
                  </Button>
                </div>
              ) : (
                <h1
                  className="cursor-pointer font-space-mono text-3xl font-bold tracking-wider transition-colors hover:text-gray-300"
                  onClick={() => setEditingName(true)}
                >
                  {localProfile.name || 'Usuario Local'}
                </h1>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Perfil local &bull;{' '}
                <span
                  className="cursor-pointer text-green-400 hover:underline"
                  onClick={handleLogin}
                >
                  Conectar con AniList
                </span>
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col justify-center p-4">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              <div className="flex flex-col items-center text-center">
                <span className="mb-1 text-xs text-gray-400">Total Anime</span>
                <span className="font-space-mono text-xl font-bold">{localStats.totalAnime}</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="mb-1 text-xs text-gray-400">Episodios Vistos</span>
                <span className="font-space-mono text-xl font-bold text-green-400">
                  {localStats.episodesWatched}
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="mb-1 text-xs text-gray-400">Completados</span>
                <span className="font-space-mono text-xl font-bold text-blue-400">
                  {localStats.completed}
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="mb-1 text-xs text-gray-400">Viendo</span>
                <span className="font-space-mono text-xl font-bold text-yellow-400">
                  {localStats.watching}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* LOCAL LISTS */}
        <div className="mt-8 p-4">
          <h2 className="mb-6 font-space-mono text-xl font-bold text-white">Tus Listas</h2>
          <Tabs.Root defaultValue="Watching">
            <Tabs.List className="mb-6 border-b border-gray-700">
              {[
                { key: 'Watching', label: 'Viendo', data: localWatching },
                { key: 'Completed', label: 'Completados', data: localCompleted },
                { key: 'Planning', label: 'Planeados', data: localPlanning },
                { key: 'Paused', label: 'Pausados', data: localPaused }
              ].map(({ key, label, data }) => (
                <Tabs.Trigger
                  key={key}
                  value={key}
                  className="flex items-center gap-2 px-4 py-2 font-space-mono text-base"
                >
                  <span>{label}</span>
                  <span className="text-gray-500">&nbsp;&bull;&nbsp;</span>
                  <span className="text-sm text-gray-500">{data.length}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {[
              { key: 'Watching', data: localWatching },
              { key: 'Completed', data: localCompleted },
              { key: 'Planning', data: localPlanning },
              { key: 'Paused', data: localPaused }
            ].map(({ key, data }) => (
              <Tabs.Content key={key} value={key}>
                {data.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                    {data.map((entry) => (
                      <div
                        key={entry.id}
                        className="cursor-pointer font-space-mono transition-transform hover:scale-105"
                        onClick={() => navigate(`/anime/${entry.id}`)}
                      >
                        <img
                          src={entry.coverImage || ''}
                          alt={entry.title || 'Anime'}
                          className="h-64 w-full rounded-md object-cover"
                        />
                        <p className="mt-2 line-clamp-2 text-sm text-gray-200">
                          {entry.title || `Anime #${entry.id}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {entry.progress || 0} / {entry.totalEpisodes || '?'} episodios
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-8 text-center text-gray-400">No hay animes en esta lista.</p>
                )}
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </div>
      </div>
    )
  }

  // ── Logged in: Anilist profile ──
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
      </div>
    )
  }

  if (error || !userProfile) {
    return (
      <div className="p-8 text-center text-rose-500">
        Error al cargar el perfil: {error?.message || 'Usuario no encontrado'}
      </div>
    )
  }

  return (
    <div className="min-h-screen animate-fade p-8">
      {/* HEADER & STATS SECTION (Side by side) */}
      <div className="mb-0 flex flex-col items-center gap-6 lg:flex-row lg:items-end">
        {/* User Info */}
        <div className="flex flex-1 flex-col items-center gap-6 p-4 sm:flex-row">
          <img
            src={userProfile.avatar?.large}
            alt={userProfile.name}
            className="h-28 w-28 rounded-full object-cover"
          />
          <div className="flex flex-col items-center sm:items-start">
            <h1 className="font-space-mono text-3xl font-bold tracking-wider">
              {userProfile.name}
            </h1>
            {userProfile.about && (
              <p className="mt-2 text-sm text-gray-400">
                <span dangerouslySetInnerHTML={{ __html: userProfile.about }} />
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col justify-center p-4">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="flex flex-col items-center text-center">
              <span className="mb-1 text-xs text-gray-400">Total Anime</span>
              <span className="font-space-mono text-xl font-bold">
                {userProfile.statistics?.anime?.count || 0}
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="mb-1 text-xs text-gray-400">Episodios Vistos</span>
              <span className="font-space-mono text-xl font-bold text-green-400">
                {userProfile.statistics?.anime?.episodesWatched || 0}
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="mb-1 text-xs text-gray-400">Días Vistos</span>
              <span className="font-space-mono text-xl font-bold text-blue-400">
                {Math.round(userProfile.statistics?.anime?.minutesWatched / 60 / 24) || 0}
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="mb-1 text-xs text-gray-400">Media Puntuación</span>
              <span className="font-space-mono text-xl font-bold text-yellow-400">
                {userProfile.statistics?.anime?.meanScore || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LISTS SECTION */}
      <div className="mt-8 p-4">
        <h2 className="mb-6 font-space-mono text-xl font-bold text-white">Tus Listas</h2>
        {isLoadingLists ? (
          <div className="text-center text-gray-400">Cargando listas...</div>
        ) : !userLists || userLists.length === 0 ? (
          <div className="text-center text-gray-400">
            No se encontraron listas o no tienes animes agregados.
          </div>
        ) : (
          <Tabs.Root defaultValue="Watching">
            <Tabs.List className="mb-6 border-b border-gray-700">
              {['Watching', 'Completed', 'Planning', 'Paused'].map((status) => {
                const listData = userLists.find(
                  (list) =>
                    list.name.toLowerCase() === status.toLowerCase() ||
                    list.status === status.toUpperCase()
                )
                const count = listData?.entries?.length || 0
                const label = {
                  Watching: 'Viendo',
                  Completed: 'Completados',
                  Planning: 'Planeados',
                  Paused: 'Pausados'
                }[status]

                return (
                  <Tabs.Trigger
                    key={status}
                    value={status}
                    className="flex items-center gap-2 px-4 py-2 font-space-mono text-base"
                  >
                    <span>{label}</span>
                    <span className="text-gray-500">&nbsp;•&nbsp;</span>
                    <span className="text-sm text-gray-500">{count}</span>
                  </Tabs.Trigger>
                )
              })}
            </Tabs.List>

            {/* Contenido de cada pestaña */}
            {['Watching', 'Completed', 'Planning', 'Paused'].map((status) => {
              const listData = userLists.find(
                (list) =>
                  list.name.toLowerCase() === status.toLowerCase() ||
                  list.status === status.toUpperCase()
              )

              return (
                <Tabs.Content key={status} value={status}>
                  {listData && listData.entries?.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                      {listData.entries.map((entry) => (
                        <AnimeCard key={entry.media.id} data={entry.media} />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-8 text-center text-gray-400">No hay animes en esta lista.</p>
                  )}
                </Tabs.Content>
              )
            })}
          </Tabs.Root>
        )}
      </div>
    </div>
  )
}

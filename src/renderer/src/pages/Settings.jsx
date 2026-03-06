import { Button, Checkbox, Flex, Switch, TextField, Select } from '@radix-ui/themes'
import { useAnitingContext } from '../utils/ContextProvider'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { TORRENT_ENABLED } from '../utils/featureFlags'

export default function Settings() {
  const {
    glow,
    setGlow,
    vlcPath,
    setVlcPath,
    autoUpdateAnilistEpisode,
    setAutoUpdateAnilistEpisode,
    scrollOpacity,
    setScrollOpacity,
    hideHero,
    setHideHero,
    checkForUpdates,
    setCheckForUpdates,
    backendPort,
    setBackendPort,
    broadcastDiscordRpc,
    setBroadcastDiscordRpc,
    hoverCard,
    setHoverCard,
    settings,
    setSettings,
    smoothScroll,
    setSmoothScroll,
    uploadLimit,
    setUploadLimit,
    downloadLimit,
    setDownloadLimit,
    showAdultContent,
    setShowAdultContent,
    setContentType,
    titleLanguage,
    setTitleLanguage,
    appFont,
    setAppFont
  } = useAnitingContext()

  // const [settingsJson, setSettingsJson] = useState({})

  const [tempBackendPort, setTempBackendPort] = useState(backendPort)
  const [tempUploadLimit, setTempUploadLimit] = useState(uploadLimit === -1 ? '' : uploadLimit)
  const [tempDownloadLimit, setTempDownloadLimit] = useState(
    downloadLimit === -1 ? '' : downloadLimit
  )

  // --- Auto-updater state ---
  const [updateStatus, setUpdateStatus] = useState('idle') // idle | checking | available | downloading | ready | error | up-to-date
  const [updateInfo, setUpdateInfo] = useState(null)
  const [downloadPercent, setDownloadPercent] = useState(0)

  useEffect(() => {
    const api = window.api
    if (!api?.onUpdateAvailable) return

    api.onUpdateAvailable((info) => {
      setUpdateInfo(info)
      setUpdateStatus('available')
    })
    api.onUpdateNotAvailable(() => {
      setUpdateStatus('up-to-date')
    })
    api.onUpdateDownloadProgress((progress) => {
      setUpdateStatus('downloading')
      setDownloadPercent(Math.round(progress.percent || 0))
    })
    api.onUpdateDownloaded(() => {
      setUpdateStatus('ready')
    })
    api.onUpdateError((msg) => {
      setUpdateStatus('error')
      toast.error('Error al buscar actualizaciones: ' + msg)
    })
  }, [])

  const handleCheckForUpdates = useCallback(() => {
    setUpdateStatus('checking')
    window.api.checkForUpdates()
  }, [])

  const handleDownloadUpdate = useCallback(() => {
    setUpdateStatus('downloading')
    setDownloadPercent(0)
    window.api.downloadUpdate()
  }, [])

  const handleInstallUpdate = useCallback(() => {
    window.api.installUpdate()
  }, [])

  function toggleGlow() {
    const newGlowState = !glow // Determine the new state
    setGlow(newGlowState) // Update context state
    localStorage.setItem('glow', newGlowState ? 'true' : 'false') // Update localStorage correctly
  }

  function updateVlcPath(e) {
    // replace double quotes with empty string
    const newPath = e.target.value.replace(/"/g, '')
    setVlcPath(`"${newPath}"`)
    localStorage.setItem('vlcPath', `"${newPath}"`)
  }

  function updateUploadLimit(e) {
    let newSpeed = -1
    let value = parseInt(e.target.value, 10) // Convert input to number
    setTempUploadLimit(value)
    if (!isNaN(value) && value > -1) {
      newSpeed = value
      window.api.saveToSettings('uploadLimit', newSpeed * 1024)
    } else {
      window.api.saveToSettings('uploadLimit', newSpeed)
    }
    setUploadLimit(newSpeed)
  }
  function updateDownloadLimit(e) {
    let newSpeed = -1
    let value = parseInt(e.target.value, 10) // Convert input to number
    setTempDownloadLimit(value)
    if (!isNaN(value) && value > -1) {
      newSpeed = value
      window.api.saveToSettings('downloadLimit', newSpeed * 1024)
    } else {
      window.api.saveToSettings('downloadLimit', newSpeed)
    }
    setDownloadLimit(newSpeed)
  }

  function toggleAutoUpdateAnilistEpisode() {
    const newAutoUpdateAnilistEpisodeState = !autoUpdateAnilistEpisode
    setAutoUpdateAnilistEpisode(newAutoUpdateAnilistEpisodeState)
    localStorage.setItem(
      'autoUpdateAnilistEpisode',
      newAutoUpdateAnilistEpisodeState ? 'true' : 'false'
    )
  }

  function toggleScrollOpacity() {
    const newScrollOpacityState = !scrollOpacity
    setScrollOpacity(newScrollOpacityState)
    localStorage.setItem('scrollOpacity', newScrollOpacityState ? 'true' : 'false')
  }

  function toggleHideHero() {
    const newHideHeroState = !hideHero
    setHideHero(newHideHeroState)
    localStorage.setItem('hideHero', newHideHeroState ? 'true' : 'false')
    if (newHideHeroState === true) {
      localStorage.setItem('scrollOpacity', 'false')
      setScrollOpacity(false)
    }
  }

  function toggleCheckForUpdates() {
    const newCheckForUpdatesState = !checkForUpdates
    setCheckForUpdates(newCheckForUpdatesState)
    localStorage.setItem('checkForUpdates', newCheckForUpdatesState ? 'true' : 'false')
  }

  function toggleShowAdultContent() {
    const newState = !showAdultContent
    setShowAdultContent(newState)
    localStorage.setItem('showAdultContent', newState ? 'true' : 'false')

    if (!newState) {
      const type = localStorage.getItem('contentType')
      if (type === 'HENTAI') {
        localStorage.setItem('contentType', 'ANIME')
        setContentType('ANIME')
      }
    }
  }

  // async function getSettingsJson() {
  //   let data = await window.api.getSettingsJson()
  //   setSettingsJson(data)
  // }

  async function changeDownloadsFolder() {
    let data = await window.api.changeDownloadsFolder()
    // setSettingsJson(data)
    setSettings(data)
  }

  function toggleHoverCard() {
    const newHoverCardState = !hoverCard
    setHoverCard(newHoverCardState)
    localStorage.setItem('hoverCard', newHoverCardState ? 'true' : 'false')
  }

  function toggleSmoothScroll() {
    const newSmoothScrollState = !smoothScroll
    setSmoothScroll(newSmoothScrollState)
    localStorage.setItem('smoothScroll', newSmoothScrollState ? 'true' : 'false')
  }

  return (
    <div className="w-full animate-fade select-none px-16 py-10 font-space-mono animate-duration-500">
      <div className="mb-8 border-b border-gray-700 pb-2 font-semibold tracking-wider text-[#b5b5b5ff]">
        Settings
      </div>

      <div className="flex flex-col gap-4 tracking-wide text-[#b5b5b5ff]">
        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold">Efecto de Brillo</p>
            <p className="text-xs">
              Activar o desactivar el efecto de brillo alrededor de los banners y el efecto de
              brillo al pasar el cursor sobre las tarjetas de anime.
            </p>
          </div>
          <Switch
            checked={glow}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={toggleGlow}
          />
        </div>

        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold">Actualizar Episodios Automáticamente en Anilist</p>
            <p className="text-xs">
              Si está activado, Aniting actualizará automáticamente el episodio en Anilist cuando se
              haya visto más del 80% del episodio.
            </p>
          </div>
          <Switch
            checked={autoUpdateAnilistEpisode}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={toggleAutoUpdateAnilistEpisode}
          />
        </div>

        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold">Opacidad al Desplazar</p>
            <p className="text-xs">
              Activar el efecto de opacidad al desplazar en la página principal. Desactivarlo
              <b> mejorará ligeramente el rendimiento</b>.
            </p>
          </div>
          <Switch
            checked={scrollOpacity}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={toggleScrollOpacity}
          />
        </div>

        <div
          className="flex w-full items-center justify-between bg-[#202022] px-4 py-2"
          style={{ display: 'none' }}
        >
          <div className="switch_card">
            <p className="font-bold">Ocultar Hero en Página Principal</p>
            <p className="text-xs">
              Ocultar la sección hero en la página principal. Al activarlo se desactivará el efecto
              de opacidad al desplazar.
            </p>
          </div>
          <Switch
            checked={hideHero}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={toggleHideHero}
          />
        </div>
        <div
          className="flex w-full items-center justify-between bg-[#202022] px-4 py-2"
          style={{ display: 'none' }}
        >
          <div className="switch_card">
            <p className="font-bold">Popup modal al pasar sobre tarjetas de anime</p>
            <p className="text-xs">
              Activar o desactivar el popup modal al pasar el cursor sobre las tarjetas de anime.{' '}
              <br /> Desactivarlo
              <b> mejorará ligeramente el rendimiento</b> y reducirá el lag al desplazar.
            </p>
          </div>
          <Switch
            checked={hoverCard}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={toggleHoverCard}
          />
        </div>
        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold">Buscar Actualizaciones al Iniciar</p>
            <p className="text-xs">
              Si está activado, Aniting buscará actualizaciones automáticamente al iniciar la app y
              te notificará si hay una nueva versión disponible.
            </p>
          </div>
          <Switch
            checked={checkForUpdates}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={toggleCheckForUpdates}
          />
        </div>

        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold text-red-500">Mostrar Contenido Hentai (+18)</p>
            <p className="text-xs">
              Al activarlo, la búsqueda y las listas principales mostrarán exclusivamente contenido
              para adultos (Hentai) a través de la API de AniList.
            </p>
          </div>
          <Switch
            checked={showAdultContent}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={toggleShowAdultContent}
          />
        </div>

        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold">Idioma del Título</p>
            <p className="text-xs">
              Selecciona en qué idioma prefieres ver los títulos de los animes.
            </p>
          </div>
          <Select.Root
            value={titleLanguage}
            onValueChange={(value) => {
              setTitleLanguage(value)
              localStorage.setItem('titleLanguage', value)
            }}
          >
            <Select.Trigger className="w-32" />
            <Select.Content>
              <Select.Item value="romaji">Romaji</Select.Item>
              <Select.Item value="english">Inglés</Select.Item>
              <Select.Item value="native">Nativo</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold">Fuente de la Aplicación</p>
            <p className="text-xs">
              Selecciona el estilo de fuente global que usará Aniting en sus textos y diseños.
            </p>
          </div>
          <Select.Root
            value={appFont}
            onValueChange={(value) => {
              setAppFont(value)
            }}
          >
            <Select.Trigger className="w-32" />
            <Select.Content>
              <Select.Item value="robotic">Space Mono</Select.Item>
              <Select.Item value="normal">Inter</Select.Item>
              <Select.Item value="poppins">Poppins</Select.Item>
              <Select.Item value="montserrat">Montserrat</Select.Item>
              <Select.Item value="outfit">Outfit</Select.Item>
              <Select.Item value="fira">Fira Code</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <div
          className="flex w-full items-center justify-between bg-[#202022] px-4 py-2"
          style={{ display: 'none' }}
        >
          <div className="text_input_card">
            <p className="font-bold">Ruta del Reproductor Externo (VLC)</p>
            <p className="text-xs">
              Establece la ruta al archivo ejecutable del reproductor multimedia externo.
            </p>
            <p className="text-xs">Ruta actual: {vlcPath}</p>
          </div>
          <TextField.Root
            placeholder={vlcPath}
            value={vlcPath.replace(/"/g, '')}
            onInput={updateVlcPath}
            className="w-1/2"
          ></TextField.Root>
        </div>

        {TORRENT_ENABLED && (
          <>
            <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
              <div className="text_input_card">
                <p className="font-bold">Velocidad Máxima de Descarga</p>
                <p className="text-xs">
                  Establece la velocidad máxima de descarga para torrents. <br /> Deja vacío para
                  velocidad ilimitada. <b>Reinicia</b> la app después de cambiar la velocidad.
                </p>
                <p className="text-xs">
                  Velocidad actual: {downloadLimit === -1 ? 'Ilimitada' : downloadLimit + ' KB/s'}
                </p>
              </div>
              <TextField.Root
                type="number"
                placeholder={'Ilimitada'}
                onInput={updateDownloadLimit}
                value={tempDownloadLimit}
                className="w-1/2"
              ></TextField.Root>
            </div>

            <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
              <div className="text_input_card">
                <p className="font-bold">Velocidad Máxima de Subida</p>
                <p className="text-xs">
                  Establece la velocidad máxima de subida para torrents. <br /> Deja vacío para
                  velocidad ilimitada. <b>Reinicia</b> la app después de cambiar la velocidad.
                </p>
                <p className="text-xs">
                  Velocidad actual: {uploadLimit === -1 ? 'Ilimitada' : uploadLimit + ' KB/s'}
                </p>
              </div>
              <TextField.Root
                type="number"
                placeholder={'Ilimitada'}
                onInput={updateUploadLimit}
                value={tempUploadLimit}
                className="w-1/2"
              ></TextField.Root>
            </div>

            <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
              <div className="button_card">
                <p className="font-bold">Cambiar Ubicación de Descarga de Torrents</p>
                <p className="text-xs">
                  Cambiar la ubicación predeterminada de descarga de archivos torrent.
                </p>
                <p className="text-xs">Ruta actual: &quot;{settings.downloadsFolderPath}&quot;</p>
              </div>
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  changeDownloadsFolder()
                }}
              >
                Cambiar Carpeta de Descarga
              </Button>
            </div>
          </>
        )}
        {/* Form with input */}

        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="">
            <p className="font-bold">Cambiar Puerto del Backend</p>
            <p className="text-xs">
              Cambiar el puerto del servidor backend. <b className="tracking-wider">Reinicia</b> la
              app después de cambiar el puerto y actualiza las cookies.
              <br />
              No cambies el puerto innecesariamente.
            </p>
            <p className="text-xs">
              Puerto actual: <b className="tracking-wider">{backendPort}</b>
            </p>
          </div>

          <div className="flex w-fit">
            <TextField.Root
              placeholder={backendPort}
              type="number"
              value={tempBackendPort}
              onInput={(e) => setTempBackendPort(e.target.value)}
              className="w-24"
              style={{
                borderRadius: '0.25rem 0 0 0.25rem'
              }}
            ></TextField.Root>

            <Button
              variant="outline"
              color="gray"
              onClick={() => {
                setBackendPort(tempBackendPort)
                window.api.changeBackendPort(tempBackendPort)
                toast.success('Puerto del backend cambiado a ' + tempBackendPort)
                // window.api.changeBackendPort(64622)
              }}
              style={{
                borderRadius: '0 0.25rem 0.25rem 0',
                // boxShadow: '0 0 1px 0px #4863bd'
                boxShadow: 'none',
                border: '1px solid #4e5359',
                borderLeft: '0px'
              }}
            >
              Save
            </Button>
          </div>
        </div>

        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold">Discord RPC</p>
            <p className="text-xs">Transmitir tu actividad en Aniting a Discord.</p>
          </div>
          <Switch
            checked={broadcastDiscordRpc}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={() => {
              setBroadcastDiscordRpc(!broadcastDiscordRpc)
              window.api.broadcastDiscordRpc(!broadcastDiscordRpc)
            }}
          />
        </div>

        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
          <div className="switch_card">
            <p className="font-bold">Desplazamiento Suave</p>
            <p className="text-xs">
              Activar o desactivar el efecto de desplazamiento suave en la página principal. <br />{' '}
              Desactivarlo podría reducir el lag al desplazar.
            </p>
          </div>
          <Switch
            checked={smoothScroll}
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onCheckedChange={() => {
              toggleSmoothScroll()
            }}
          />
        </div>
      </div>

      <div className="keyboard_shortcuts mt-8">
        <div className="mb-8 border-b border-gray-700 pb-2 font-semibold tracking-wider text-[#b5b5b5ff]">
          Atajos de Teclado
        </div>
        <div className="flex flex-col gap-4 tracking-wide text-[#b5b5b5ff]">
          <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
            <div className="switch_card">
              <p className="font-bold">Alt + Flecha Izquierda/Derecha</p>
              <p className="text-xs">Navegar entre páginas usando Alt + Flecha Izquierda/Derecha</p>
            </div>
          </div>
          {/* <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
            <div className="switch_card">
              <p className="font-bold">Ctrl + R</p>
              <p className="text-xs">Refresh the page using Ctrl + R</p>
            </div>
          </div> */}
          <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
            <div className="switch_card">
              <p className="font-bold">Ctrl + K</p>
              <p className="text-xs">Enfocar la barra de búsqueda usando Ctrl + K</p>
            </div>
          </div>
          <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-2">
            <div className="switch_card">
              <p className="font-bold">Arrow Left/Right</p>
              <p className="text-xs">
                Adelantar/retroceder video 5s usando Flecha Izquierda/Derecha
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actualizaciones */}
      <div className="mb-4 mt-8 border-b border-gray-700 pb-2 font-semibold tracking-wider text-[#b5b5b5ff]">
        Actualizaciones
      </div>
      <div className="flex flex-col gap-4 tracking-wide text-[#b5b5b5ff]">
        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-3">
          <div className="switch_card">
            <p className="font-bold">Buscar actualizaciones</p>
            <p className="text-xs text-gray-400">
              {updateStatus === 'idle' && 'Verificar si hay una nueva versión disponible.'}
              {updateStatus === 'checking' && 'Buscando actualizaciones...'}
              {updateStatus === 'up-to-date' && 'Ya tienes la última versión.'}
              {updateStatus === 'available' && `Nueva versión disponible: v${updateInfo?.version}`}
              {updateStatus === 'downloading' && `Descargando actualización... ${downloadPercent}%`}
              {updateStatus === 'ready' && 'Actualización lista. Reinicia para instalar.'}
              {updateStatus === 'error' && 'Error al buscar actualizaciones. Intenta de nuevo.'}
            </p>
            {updateStatus === 'downloading' && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${downloadPercent}%` }}
                />
              </div>
            )}
          </div>
          <div className="ml-6 flex shrink-0 gap-2">
            {(updateStatus === 'idle' || updateStatus === 'error' || updateStatus === 'up-to-date') && (
              <Button size="2" variant="soft" onClick={handleCheckForUpdates}>
                Buscar
              </Button>
            )}
            {updateStatus === 'available' && (
              <Button size="2" variant="soft" color="green" onClick={handleDownloadUpdate}>
                Descargar
              </Button>
            )}
            {updateStatus === 'ready' && (
              <Button size="2" variant="soft" color="green" onClick={handleInstallUpdate}>
                Instalar y reiniciar
              </Button>
            )}
            {updateStatus === 'checking' && (
              <Button size="2" variant="soft" disabled>
                Buscando...
              </Button>
            )}
            {updateStatus === 'downloading' && (
              <Button size="2" variant="soft" disabled>
                {downloadPercent}%
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Discord */}
      <div className="mb-4 mt-8 border-b border-gray-700 pb-2 font-semibold tracking-wider text-[#b5b5b5ff]">
        Comunidad
      </div>
      <div className="flex flex-col gap-4 tracking-wide text-[#b5b5b5ff]">
        <div className="flex w-full items-center justify-between bg-[#202022] px-4 py-3">
          <div className="switch_card flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#5865F2">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
            </svg>
            <div>
              <p className="font-bold">Discord</p>
              <p className="text-xs text-gray-400">
                Únete a nuestra comunidad para soporte, novedades y sugerencias.
              </p>
            </div>
          </div>
          <Button
            size="2"
            variant="soft"
            color="iris"
            style={{ marginLeft: '1.5rem', cursor: 'pointer' }}
            onClick={() => window.open('https://discord.com/invite/3fAyERkNwn', '_blank')}
          >
            Unirme al Discord
          </Button>
        </div>
      </div>

      <p className="mt-8 text-xs opacity-45">
        Esta aplicación y sus servidores no alojan ni distribuyen archivos o medios con derechos de
        autor. Es un proyecto educativo construido únicamente para aprender sobre nuevas
        tecnologías.
      </p>
    </div>
  )
}

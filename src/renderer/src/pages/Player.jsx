import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import StreamStats from '../components/StreamStats'
import { Button } from '@radix-ui/themes'
import { toast } from 'sonner'
import { ExclamationTriangleIcon, LightningBoltIcon, TrashIcon } from '@radix-ui/react-icons'
import EpisodesPlayer from '../components/EpisodesPlayer'
import StreamStatsEpisode from '../components/StreamStatsEpisode'
import 'plyr-react/plyr.css'
import Plyr from 'plyr-react'
import { useAnitingContext } from '../utils/ContextProvider'

export default function Player(query) {
  const magnetURI = useParams().magnetId
  const ref = useRef(null)

  const [videoSrc, setVideoSrc] = useState('')
  const [subtitleSrc, setSubtitleSrc] = useState('')
  const [files, setFiles] = useState([])
  const { vlcPath, backendPort } = useAnitingContext()
  // receive params from navigation hook
  const loc = useLocation()
  const { episodeTitle, episodeNumber, animeTitle, bannerImage, discordRpcActivity } =
    loc.state.state
  console.log(loc.state)

  function setDiscordRPC() {
    if (!discordRpcActivity) return
    window.api.setDiscordRpc({
      ...discordRpcActivity,
      state: `Episode ${episodeNumber}: ${episodeTitle}`
    })
  }

  useEffect(() => {
    setDiscordRPC()
    return () => {
      window.api.setDiscordRpc({ details: 'Explorando Anime' })
    }
  }, [discordRpcActivity])

  const handleKeyDown = (event) => {
    if (ref.current && ref.current.plyr) {
      const player = ref.current.plyr
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault() // Prevent default browser behavior (scrolling)
          player.currentTime = Math.max(player.currentTime - 5, 0) // Seek backward 5 seconds
          break
        case 'ArrowRight':
          event.preventDefault() // Prevent default browser behavior
          player.currentTime = Math.min(player.currentTime + 5, player.duration) // Seek forward 5 seconds
          break
        default:
          break
      }
    }
  }

  // Attach event listener to the entire window

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [videoSrc])

  // console.log(magnetURI);

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Step 1: Add the torrent
      const response = await axios.get(
        `http://localhost:${backendPort}/add/${encodeURIComponent(magnetURI)}`
      )
      console.log(response)
      // Step 2: Set the video source for streaming
      setVideoSrc(`http://localhost:${backendPort}/stream/${encodeURIComponent(magnetURI)}`)
      // Step 3: Set the subtitle source
      setSubtitleSrc(`http://localhost:${backendPort}/subtitles/${encodeURIComponent(magnetURI)}`)
    } catch (error) {
      console.error('Error adding the torrent or streaming video', error)

      toast.error('Error al transmitir video', {
        duration: 5000,
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description:
          'No se pudo transmitir el video, asegúrate que el torrent sea válido y que el servidor Backend esté ejecutándose.',
        classNames: {
          title: 'text-rose-500'
        }
      })
    }
  }

  const getFiles = async () => {
    let temp_obj = {
      streamUrl: null,
      ...loc.state
    }
    window.api.saveToSettings('currentAnime', temp_obj)

    try {
      console.log('Inside getFiles')

      const response = await axios.get(
        `http://localhost:${backendPort}/metadata/${encodeURIComponent(magnetURI)}`
      )
      console.log('magnetURI: ' + magnetURI)

      console.log(response)
      const data = await response.data
      setFiles(data)
      console.log('files: ' + data)
    } catch (error) {
      toast.error('El Backend no está ejecutándose en tu máquina local', {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description:
          'El Backend no está ejecutándose en tu máquina local o NO se encontraron archivos en el torrent',
        classNames: {
          title: 'text-rose-500'
        }
      })

      console.error('Error getting torrent details', error)
    }
  }

  const handleVlcStream = async () => {
    try {
      await axios.get(`http://localhost:${backendPort}/add/${encodeURIComponent(magnetURI)}`)

      // Send a request to the server to open VLC with the video stream URL
      await axios.get(
        `http://localhost:${backendPort}/stream-to-vlc?url=${encodeURIComponent(
          `http://localhost:${backendPort}/stream/${encodeURIComponent(magnetURI)}`
        )}`
      )
    } catch (error) {
      console.error('Error streaming to VLC', error)
      toast.error('Error al transmitir a VLC', {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description: 'Asegúrate que VLC esté instalado y la ruta esté configurada correctamente.',
        classNames: {
          title: 'text-rose-500'
        }
      })
    }
  }
  // log current path
  console.log('Current path:', window.location.pathname)

  const checkBackendRunning = async () => {
    try {
      const response = await axios.get(`http://localhost:${backendPort}/ping`)
      console.log(response)

      if (response.status === 200) {
        toast.success('Backend ejecutándose', {
          icon: <LightningBoltIcon height="16" width="16" color="#ffffff" />,
          description: 'Backend ejecutándose en tu máquina local',
          classNames: {
            title: 'text-green-500'
          }
        })
      }
    } catch (error) {
      toast.error('Backend no está ejecutándose', {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description: 'Backend no está ejecutándose en tu máquina local',
        classNames: {
          title: 'text-rose-500'
        }
      })

      console.error('Error checking if the backend is running', error)
    }
  }

  /* ------------------------------------------------------ */

  /* ---------------- Handling batch files ---------------- */

  const handleStreamBrowser = (episode) => {
    // save the data in the settings
    let temp_obj = {
      episodeName: episode,
      streamUrl: `http://localhost:${backendPort}/streamfile/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`,
      ...loc.state
    }
    console.log(temp_obj)

    window.api.saveToSettings('currentAnime', temp_obj)

    setVideoSrc(
      `http://localhost:${backendPort}/streamfile/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`
    )
  }
  console.log(videoSrc)

  const playerRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [currentEpisode, setCurrentEpisode] = useState('')

  const plyrProps = {
    source: {
      type: 'video',
      sources: [
        {
          src: videoSrc,
          type: 'video/webm'
        }
      ],
      autoplay: true
    }
  }

  const handleStreamVlc = async (episode) => {
    // save the data in the settings
    let temp_obj = {
      episodeName: episode,
      streamUrl: `http://localhost:${backendPort}/streamfile/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`,
      ...loc.state
    }
    window.api.saveToSettings('currentAnime', temp_obj)

    try {
      window.api.openVlc(
        `${vlcPath} http://localhost:${backendPort}/streamfile/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`
      )
    } catch (error) {
      console.error('Error streaming to VLC', error)
      toast.error('Error al transmitir a VLC', {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description:
          'Asegúrate que VLC esté instalado y la ruta correcta esté configurada y el Backend esté ejecutándose.',
        classNames: {
          title: 'text-rose-500'
        }
      })
    }
  }

  const stopEpisodeDownload2 = async (episode) => {
    try {
      // Send a DELETE request to remove the torrent
      console.log(
        `http://localhost:${backendPort}/deselect/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`
      )

      await axios.get(
        `http://localhost:${backendPort}/deselect/${encodeURIComponent(magnetURI)}/${encodeURIComponent(episode)}`
      )

      // Clear the video and subtitle sources
      setCurrentEpisode('')
      setVideoSrc('')
      setSubtitleSrc('')

      // Dispose of the player if it's active
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }

      toast.success('Torrent eliminado exitosamente', {
        icon: <TrashIcon height="16" width="16" color="#ffffff" />,
        description: 'Descarga del episodio detenida exitosamente',
        classNames: {
          title: 'text-green-500'
        }
      })
    } catch (error) {
      console.error("Couldn't stop episode download", error)

      toast.error('No se pudo detener la descarga', {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description:
          'Puedes detenerla manualmente reiniciando el servidor o eliminando el torrent completamente.',
        classNames: {
          title: 'text-rose-500'
        }
      })
    }
  }

  // for some reason, calling this function twice works, WebTorrent's file.deselect() is known to be buggy
  const stopEpisodeDownload = async (episode) => {
    await stopEpisodeDownload2(episode)
    await stopEpisodeDownload2(episode)
  }

  /* ------------------------------------------------------ */
  const handleRemoveTorrent = async () => {
    try {
      // Send a DELETE request to remove the torrent
      await axios.delete(`http://localhost:${backendPort}/remove/${encodeURIComponent(magnetURI)}`)

      // Clear the video and subtitle sources
      setVideoSrc('')
      setCurrentEpisode('')
      setSubtitleSrc('')
      setFiles([])

      // Dispose of the player if it's active
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }

      toast.success('Torrent eliminado exitosamente', {
        icon: <TrashIcon height="16" width="16" color="#ffffff" />,
        description: 'El torrent ha sido eliminado exitosamente',
        classNames: {
          title: 'text-green-500'
        }
      })
    } catch (error) {
      console.error('Error removing the torrent', error)

      toast.error('Error al eliminar el torrent', {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description:
          'No se pudo eliminar el torrent, puedes eliminarlo manualmente reiniciando el servidor.',
        classNames: {
          title: 'text-rose-500'
        }
      })
    }
  }

  return (
    <div className="mb-32 flex items-center justify-center px-8 font-space-mono">
      <div className="w-full">
        {videoSrc && (
          <div className="flex w-full justify-center">
            <div className="mx-0 aspect-video w-4/6 lg2:mx-32">
              <Plyr {...plyrProps} ref={ref} />
            </div>
          </div>
        )}

        {/* We basiically do this to prevent video player re-render */}
        {currentEpisode && (
          <StreamStatsEpisode
            magnetURI={magnetURI}
            episode={currentEpisode}
            stopEpisodeDownload={stopEpisodeDownload}
            setCurrentEpisode={setCurrentEpisode}
            currentEpisode={currentEpisode}
            handleStreamVlc={handleStreamVlc}
            setVideoSrc={setVideoSrc}
          />
        )}

        <div className="fixed-width border border-gray-700 bg-[#1d1d20] p-4">
          <StreamStats magnetURI={magnetURI} />

          <div className="mt-5 flex gap-x-3">
            <Button onClick={getFiles} size="1" color="blue" variant="soft" type="submit">
              Obtener Archivos
            </Button>
            <Button size="1" color="red" variant="soft" onClick={handleRemoveTorrent}>
              Detener y Eliminar Anime
            </Button>
            <Button size="1" color="green" variant="soft" onClick={checkBackendRunning}>
              Verificar Backend
            </Button>
          </div>
        </div>
        {files && (
          <div className="mt-8">
            {files.map((file) => (
              <EpisodesPlayer
                key={file.name}
                file={file}
                handleStreamBrowser={handleStreamBrowser}
                handleStreamVlc={handleStreamVlc}
                stopEpisodeDownload={stopEpisodeDownload}
                setCurrentEpisode={setCurrentEpisode}
              />
            ))}{' '}
          </div>
        )}
      </div>
    </div>
  )
}

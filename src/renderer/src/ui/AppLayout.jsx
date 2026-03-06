import { Button, Theme } from '@radix-ui/themes'
import { Link, Outlet, useNavigate, useNavigation } from 'react-router-dom'
import Loader from './Loader'
import { toast, Toaster } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import { ReactLenis } from '@studio-freight/react-lenis'
import { DownloadIcon } from '@radix-ui/react-icons'
import { useAnitingContext } from '../utils/ContextProvider'

const DISCORD_INVITE = 'https://discord.com/invite/3fAyERkNwn'
const DISCORD_DISMISSED_KEY = 'aniting-discord-dismissed'

function DiscordIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  )
}

function DiscordPopup({ onDismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] animate-fade">
      <div className="flex items-center gap-3 rounded-xl border border-[#5865F2]/30 bg-[#1a1a2e] px-4 py-3 shadow-lg shadow-[#5865F2]/10 backdrop-blur-md">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5865F2]">
          <DiscordIcon size={18} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-white">¡Únete al Discord!</p>
          <p className="text-[10px] text-gray-400">Comunidad, soporte y novedades</p>
        </div>
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noreferrer"
          className="ml-2 rounded-md bg-[#5865F2] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#4752C4]"
          onClick={onDismiss}
        >
          Unirme
        </a>
        <button
          onClick={onDismiss}
          className="ml-1 text-gray-500 transition-colors hover:text-white"
          title="Cerrar"
        >
          <svg width="14" height="14" viewBox="0 0 15 15" fill="currentColor">
            <path d="M11.782 4.032a.575.575 0 1 0-.813-.814L7.5 6.687 4.032 3.218a.575.575 0 0 0-.814.814L6.687 7.5l-3.469 3.468a.575.575 0 0 0 .814.814L7.5 8.313l3.469 3.469a.575.575 0 0 0 .813-.814L8.313 7.5l3.469-3.468z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function StartupUpdateToast({ info, onDownload, onDismiss }) {
  const [status, setStatus] = useState('available') // available | downloading | ready
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const api = window.api
    if (!api) return
    api.onUpdateDownloadProgress((progress) => {
      setStatus('downloading')
      setPercent(Math.round(progress.percent || 0))
    })
    api.onUpdateDownloaded(() => {
      setStatus('ready')
    })
    api.onUpdateError(() => {
      setStatus('available') // allow retry
    })
  }, [])

  return (
    <div className="font-space-mono text-sm">
      <div className="mb-1 font-bold">¡Nueva versión disponible!</div>
      <div className="text-xs text-gray-300">
        Versión disponible: <span className="font-semibold">v{info?.version}</span>
      </div>
      {status === 'downloading' && (
        <div className="mt-2">
          <div className="mb-1 text-xs text-gray-400">Descargando... {percent}%</div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
      <div className="mt-2 flex gap-2">
        {status === 'available' && (
          <Button
            size="1"
            color="green"
            variant="soft"
            onClick={() => {
              setStatus('downloading')
              setPercent(0)
              window.api.downloadUpdate()
            }}
          >
            <DownloadIcon className="mr-1" />
            Descargar
          </Button>
        )}
        {status === 'ready' && (
          <Button
            size="1"
            color="green"
            variant="soft"
            onClick={() => window.api.installUpdate()}
          >
            Instalar y reiniciar
          </Button>
        )}
        {status === 'available' && (
          <Button size="1" variant="ghost" color="gray" onClick={onDismiss}>
            Más tarde
          </Button>
        )}
      </div>
    </div>
  )
}

export default function AppLayout({ props }) {
  const navigation = useNavigation()
  const isLoading = navigation.state === 'loading'
  const [theme, setTheme] = useState('dark')
  const { checkForUpdates, smoothScroll } = useAnitingContext()
  const startupCheckDone = useRef(false)

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
    console.log(theme)
  }

  // use alt + arrow keys to navigate between pages
  const navigate = useNavigate()
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        navigate(-1)
      }
      if (e.altKey && e.key === 'ArrowRight') {
        navigate(1)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate])

  /* ------------- DISCORD FIRST-LAUNCH POPUP ------------ */
  const [showDiscord, setShowDiscord] = useState(() => {
    return !localStorage.getItem(DISCORD_DISMISSED_KEY)
  })

  function dismissDiscord() {
    localStorage.setItem(DISCORD_DISMISSED_KEY, '1')
    setShowDiscord(false)
  }

  /* ------------- CHECK FOR UPDATES ON STARTUP (electron-updater) ------------ */
  useEffect(() => {
    if (!checkForUpdates || startupCheckDone.current) return
    startupCheckDone.current = true

    const api = window.api
    if (!api?.onUpdateAvailable) return

    let toastId = null

    const handleUpdateAvailable = (info) => {
      toastId = toast(
        <StartupUpdateToast
          info={info}
          onDismiss={() => toast.dismiss(toastId)}
        />,
        { duration: Infinity }
      )
    }

    api.onUpdateAvailable(handleUpdateAvailable)

    // Trigger the check
    api.checkForUpdates()
  }, [checkForUpdates])

  // const MainComponent = () => {
  //   return (
  //     <Theme appearance={theme}>
  //       <Toaster
  //         theme={theme}
  //         // richColors
  //         unstyled={false}
  //         toastOptions={{
  //           classNames: {
  //             error: 'bg-[#1c1317] border border-rose-500',
  //             success: 'bg-[#131c16] border border-green-500',
  //             icon: 'opacity-80',
  //             description: 'font-space-mono text-white opacity-90'
  //           }
  //         }}
  //       />
  //       <div
  //         className="layout flex flex-col font-inter"
  //         style={{
  //           direction: 'ltr'
  //         }}
  //       >
  //         {isLoading && <Loader />}
  //         <Header />
  //         <main className="">{props || <Outlet />}</main>
  //       </div>
  //     </Theme>
  //   )
  // }

  /* ------------------------------------------------------ */
  return (
    <>
      {/* {smoothScroll ? (
        <ReactLenis root options={{ lerp: 0.15 }}>
          <MainComponent />
        </ReactLenis>
      ) : (
        <MainComponent />
      )} */}
      {smoothScroll ? (
        <ReactLenis root options={{ lerp: 0.15 }}>
          <Theme appearance={theme}>
            <Toaster
              theme={theme}
              // richColors
              unstyled={false}
              toastOptions={{
                classNames: {
                  error: 'bg-[#1c1317] border border-rose-500',
                  success: 'bg-[#131c16] border border-green-500',
                  icon: 'opacity-80',
                  description: 'font-space-mono text-white opacity-90'
                }
              }}
            />
            <div
              className="layout flex flex-col font-inter"
              style={{
                direction: 'ltr'
              }}
            >
              {isLoading && <Loader />}
              <Header />
              <main className="">{props || <Outlet />}</main>
              {showDiscord && <DiscordPopup onDismiss={dismissDiscord} />}
            </div>
          </Theme>
        </ReactLenis>
      ) : (
        <Theme appearance={theme}>
          <Toaster
            theme={theme}
            // richColors
            unstyled={false}
            toastOptions={{
              classNames: {
                error: 'bg-[#1c1317] border border-rose-500',
                success: 'bg-[#131c16] border border-green-500',
                icon: 'opacity-80',
                description: 'font-space-mono text-white opacity-90'
              }
            }}
          />
          <div
            className="layout flex flex-col font-inter"
            style={{
              direction: 'ltr'
            }}
          >
            {isLoading && <Loader />}
            <Header />
            <main className="">{props || <Outlet />}</main>
            {showDiscord && <DiscordPopup onDismiss={dismissDiscord} />}
          </div>
        </Theme>
      )}
    </>
  )
}

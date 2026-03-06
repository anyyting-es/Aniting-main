import { Button, Theme } from '@radix-ui/themes'
import { Link, Outlet, useNavigate, useNavigation } from 'react-router-dom'
import Loader from './Loader'
import { toast, Toaster } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import { ReactLenis } from '@studio-freight/react-lenis'
import { DownloadIcon } from '@radix-ui/react-icons'
import { useAnitingContext } from '../utils/ContextProvider'

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
          </div>
        </Theme>
      )}
    </>
  )
}

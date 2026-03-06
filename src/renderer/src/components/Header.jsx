import SearchBar from './SearchBar'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import appLogo from '../assets/zenshinLogo.png'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DividerVerticalIcon,
  DownloadIcon,
  ExclamationTriangleIcon,
  GearIcon,
  GitHubLogoIcon,
  LayersIcon,
  LightningBoltIcon,
  OpenInNewWindowIcon,
  PersonIcon
} from '@radix-ui/react-icons'
import { Button, DropdownMenu, Tooltip } from '@radix-ui/themes'
import { anilistAuthUrl } from '../utils/auth'
import { useEffect, useState } from 'react'
import useGetAnilistProfile from '../hooks/useGetAnilistProfile'
import { toast } from 'sonner'
import axios from 'axios'
import AniListLogo from '../assets/symbols/AniListLogo'
import { useAnitingContext } from '../utils/ContextProvider'
import DownloadMeter from './DownloadMeter'

export default function Header() {
  const navigate = useNavigate()
  const { setUserId, backendPort, settings, contentType, setContentType, showAdultContent } =
    useAnitingContext()

  const checkBackendRunning = async () => {
    let mainJsBP = await window.api.getSettingsJson()
    try {
      // const response = await axios.get(`http://localhost:${backendPort}/ping`)
      const response = await axios.get(`http://localhost:${backendPort}/ping`)
      // console.log(response)

      if (response.status === 200) {
        toast.success('Backend ejecutándose', {
          icon: <LightningBoltIcon height="16" width="16" color="#ffffff" />,
          description: `Backend ejecutándose en tu máquina local: ${backendPort} - ${mainJsBP.backendPort}`,
          classNames: {
            title: 'text-green-500'
          }
        })
      }
    } catch (error) {
      toast.error('Backend no está ejecutándose', {
        icon: <ExclamationTriangleIcon height="16" width="16" color="#ffffff" />,
        description: `Backend no está ejecutándose en tu máquina local: ${backendPort} - ${mainJsBP.backendPort}`,
        classNames: {
          title: 'text-rose-500'
        }
      })

      console.error('Error checking if the backend is running', error)
    }
  }

  /* -------------------- ANILIST AUTH -------------------- */
  const [anilistToken, setAnilistToken] = useState(localStorage.getItem('anilist_token') || '')

  useEffect(() => {
    window.electron.receiveDeeplink((deeplink) => {
      // console.log('Deeplink received in React app:', link)
      const arr = deeplink.split('#')
      const hash = arr[1]
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')

      if (accessToken) {
        // Store the access token in local storage
        localStorage.setItem('anilist_token', accessToken)
        // Clear guest manga progress so AniList data takes over
        Object.keys(localStorage)
          .filter((k) => k.startsWith('manga_progress_'))
          .forEach((k) => localStorage.removeItem(k))
        // refresh the page
        window.location.reload()
      }
    })
  }, [])

  const {
    isLoading,
    data: userProfile,
    error: userProfileError,
    status
  } = useGetAnilistProfile(anilistToken)

  useEffect(() => {
    if (userProfile) {
      setUserId(userProfile.id)
    }
  }, [userProfile])

  // console.log('anilistToken: ', anilistToken)

  const handleLogin = () => {
    // window.location.href = anilistAuthUrl
    // shell.openExternal(anilistAuthUrl)
    window.api.oauth(anilistAuthUrl)
  }

  const handleLogout = () => {
    localStorage.removeItem('anilist_token')
    localStorage.removeItem('anilist_id')
    localStorage.removeItem('anilist_name')
    setAnilistToken('')
    setUserId('')

    // refresh the page
    window.location.reload()
  }

  if (userProfileError) {
    toast.error('Error al obtener Perfil de AniList', {
      description: userProfileError?.message,
      classNames: {
        title: 'text-rose-500'
      }
    })
  }
  // async function getSettingsJson() {
  //   let data = await window.api.getSettingsJson()
  //   setSettingsJson(data)
  // }
  const { pathname } = useLocation()

  return (
    <div className="draggable sticky top-0 z-50 flex h-11 items-center justify-between border-[#5a5e6750] bg-[#111113] bg-opacity-60 px-4 py-3 backdrop-blur-md">
      <div className="nodrag flex items-center justify-center gap-x-2">
        <Link
          className="nodrag hover: font-spaceMono flex w-fit cursor-pointer select-none items-center gap-x-2 rounded-sm p-1 transition-all duration-200 hover:bg-[#70707030]"
          to={'/'}
        >
          <img src={appLogo} alt="logo" className="h-6 w-6 rounded-sm object-contain" />
          <span className="text-base font-bold tracking-wide">Aniting</span>
        </Link>
        {/* <DividerVerticalIcon width={20} height={20} color="#ffffff40" /> */}
        {/* <a className="nodrag" href="https://github.com/hitarth-gg" target="_blank" rel="noreferrer">
          <Button color="gray" variant="ghost" size={'1'}>
            <GitHubLogoIcon className="my-1" width={17} height={17} />
          </Button>
        </a> */}

        <DividerVerticalIcon width={20} height={20} color="#ffffff40" />
        <div className="flex gap-4">
          <Button color="gray" variant="ghost" size={'1'} onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="my-1" width={16} height={16} />
          </Button>
          <Button color="gray" variant="ghost" size={'1'} onClick={() => navigate(1)}>
            <ArrowRightIcon className="my-1" width={16} height={16} />
          </Button>
        </div>
        <DividerVerticalIcon width={20} height={20} color="#ffffff40" />
        <Link to="/newreleases">
          <Button className="nodrag" color="gray" variant="soft" size={'1'}>
            {/* <div className="p-1 font-space-mono text-[.8rem]">New Releases</div> */}
            <div className="font-space-mono text-[.8rem]">Reciente</div>
          </Button>
        </Link>
        {/* <DividerVerticalIcon width={20} height={20} color="#ffffff40" /> */}

        <Button
          className="nodrag"
          size="1"
          color="gray"
          variant="soft"
          onClick={() => navigate('/anilist')}
          style={{
            padding: '0 .4rem'
          }}
        >
          {/* <DashboardIcon /> */}
          <AniListLogo style="h-5 w-5" />
        </Button>
        <DropdownMenu.Root className="nodrag w-fit">
          <DropdownMenu.Trigger>
            <Button className="nodrag" color="gray" variant="soft" size="1">
              <div className="font-space-mono text-[.8rem]">
                {contentType === 'ANIME' ? 'Anime' : contentType === 'MANGA' ? 'Manga' : 'Hentai'}
              </div>
              <DropdownMenu.TriggerIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item
              onClick={() => {
                setContentType('ANIME')
                localStorage.setItem('contentType', 'ANIME')
                navigate('/')
              }}
            >
              Anime
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onClick={() => {
                setContentType('MANGA')
                localStorage.setItem('contentType', 'MANGA')
                navigate('/manga')
              }}
            >
              Manga
            </DropdownMenu.Item>
            {showAdultContent && (
              <DropdownMenu.Item
                onClick={() => {
                  setContentType('HENTAI')
                  localStorage.setItem('contentType', 'HENTAI')
                  navigate('/hentai')
                }}
              >
                Hentai
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        {/* <Button
          className="nodrag"
          size="1"
          color="gray"
          variant="soft"
          onClick={() => navigate('/bookmarks')}
        >
          <BookmarkIcon />
        </Button> */}
      </div>

      <div className="nodrag mx-5 w-2/6">
        <SearchBar />
      </div>
      <div className="nodrag mr-36 flex items-center justify-center gap-x-4">
        {/* <Button
          color="gray"
          variant="soft"
          size={"1"}
          onClick={() => navigate("/downloads")}
        >
          <DownloadIcon />
        </Button>
        <DownloadMeter /> */}

        {true && (
          <DropdownMenu.Root className="nodrag" modal={false}>
            <DropdownMenu.Trigger>
              <Button variant="ghost" color="gray">
                <div className="flex animate-fade items-center gap-x-2">
                  {userProfile ? (
                    <img
                      src={userProfile.avatar.large}
                      alt="avatar"
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <PersonIcon className="my-1" width={16} height={16} />
                  )}
                  <div className="font-space-mono text-[.8rem]">
                    {userProfile?.name || 'anonuser'}
                  </div>
                </div>
                <DropdownMenu.TriggerIcon className="ml-1" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              {/* <DropdownMenu.Item
                onClick={
                  () => window.open("https://github.com/hitarth-gg", "_blank")
                }
                shortcut={<OpenInNewWindowIcon />}
              >
                GitHub <GitHubLogoIcon />
              </DropdownMenu.Item> */}
              {/* <DropdownMenu.Item
                color="green"
                onClick={checkBackendRunning}
                shortcut={<LayersIcon />}
              >
                Verificar Backend
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  window.api.openFolder(settings.downloadsFolderPath)
                }
                shortcut={<DownloadIcon />}
              >
                Descargas
              </DropdownMenu.Item> */}
              <DropdownMenu.Item
                color="blue"
                onClick={() => navigate('/profile')}
                shortcut={<PersonIcon />}
              >
                Perfil
              </DropdownMenu.Item>
              <DropdownMenu.Item
                color="gray"
                onClick={() => navigate('/settings')}
                shortcut={<GearIcon />}
              >
                Ajustes
              </DropdownMenu.Item>
              {/* <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.Item>Move to project…</DropdownMenu.Item>
                  <DropdownMenu.Item>Move to folder…</DropdownMenu.Item>

                  <DropdownMenu.Separator />
                  <DropdownMenu.Item>Advanced options…</DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub> */}
              <DropdownMenu.Separator />
              {userProfile ? (
                <DropdownMenu.Item color="red" onClick={handleLogout}>
                  Cerrar Sesión
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item color="green" onClick={handleLogin}>
                  Iniciar Sesión con AniList
                </DropdownMenu.Item>
              )}
              {/* <Button color='gray' onClick={() => navigate('/test')}>Test</Button> */}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}

        {/* <Link target="_blank" to="https://github.com/anyyting-es/aniting"> */}
        {/* <Button color="gray" variant="ghost" size={'1'}> */}
        {/* <div className="p-1 text-[.8rem]">How to use</div> */}
        {/* </Button> */}
        {/* </Link> */}
        {/* <Button
          className="nodrag"
          color="gray"
          variant="ghost"
          size={'1'}
          // onClick={() => toggleGlow()}
          onClick={() => navigate('/settings')}
          style={{
            padding: '0 1rem'
          }}
        >
          <GearIcon className="my-1 cursor-pointer" width={16} height={16} />
        </Button> */}
      </div>
    </div>
  )
}

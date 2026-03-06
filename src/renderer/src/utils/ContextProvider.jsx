import { createContext, useContext, useEffect, useState } from 'react'
import { isTruthyWithZero } from '../../../../common/utils'

const AnitingContext = createContext()

export function useAnitingContext() {
  const context = useContext(AnitingContext)
  if (context === undefined) {
    throw new Error('useAnitingContext must be used within an AnitingProvider')
  }
  return context
}

export default function AnitingProvider({ children }) {
  const [glow, setGlow] = useState(true)
  const [vlcPath, setVlcPath] = useState('"C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe"')
  const [autoUpdateAnilistEpisode, setAutoUpdateAnilistEpisode] = useState(true)
  const [scrollOpacity, setScrollOpacity] = useState(false)
  const [hideHero, setHideHero] = useState(false)
  const [userId, setUserId] = useState('')
  const [checkForUpdates, setCheckForUpdates] = useState(true)
  const [backendPort, setBackendPort] = useState(64621)
  const [broadcastDiscordRpc, setBroadcastDiscordRpc] = useState(false)
  const [hoverCard, setHoverCard] = useState(true)
  const [settings, setSettings] = useState({})
  const [smoothScroll, setSmoothScroll] = useState(true)
  const [uploadLimit, setUploadLimit] = useState(-1)
  const [downloadLimit, setDownloadLimit] = useState(-1)
  const [tmdbApiKey, setTmdbApiKey] = useState(import.meta.env.VITE_TMDB_API_KEY || '')
  const [showAdultContent, setShowAdultContent] = useState(false)
  const [contentType, setContentType] = useState('ANIME') // ANIME, MANGA, HENTAI
  const [titleLanguage, setTitleLanguage] = useState('romaji') // romaji, english, native
  const [appFont, setAppFont] = useState('robotic') // robotic, normal

  useEffect(() => {
    const glow = localStorage.getItem('glow')
    if (glow) {
      setGlow(glow === 'true')
    }

    const vlcPath = localStorage.getItem('vlcPath')
    if (vlcPath) {
      setVlcPath(vlcPath)
    }

    const autoUpdateAnilistEpisode = localStorage.getItem('autoUpdateAnilistEpisode')
    if (autoUpdateAnilistEpisode) {
      setAutoUpdateAnilistEpisode(autoUpdateAnilistEpisode === 'true')
    }

    const scrollOpacity = localStorage.getItem('scrollOpacity')
    if (scrollOpacity) {
      setScrollOpacity(scrollOpacity === 'true')
    }

    const hideHero = localStorage.getItem('hideHero')
    if (hideHero) {
      setHideHero(hideHero === 'true')
    }

    const updateCheck = localStorage.getItem('checkForUpdates')
    if (updateCheck) {
      setCheckForUpdates(updateCheck === 'true')
    }

    // getSettingsJson
    const getSettingsJson = async () => {
      const settings = await window.api.getSettingsJson()
      if (settings.backendPort) {
        setBackendPort(settings.backendPort)
      }
      if (settings.broadcastDiscordRpc) {
        setBroadcastDiscordRpc(settings.broadcastDiscordRpc)
      }
      if (isTruthyWithZero(settings.uploadLimit) && settings.uploadLimit !== -1) {
        setUploadLimit(parseInt(settings.uploadLimit) / 1024)
      }
      if (isTruthyWithZero(settings.downloadLimit) && settings.downloadLimit !== -1) {
        setDownloadLimit(parseInt(settings.downloadLimit) / 1024)
      }
      setSettings(settings)
    }

    const animateHoverCard = localStorage.getItem('hoverCard')
    if (animateHoverCard) {
      setHoverCard(animateHoverCard === 'true')
    }

    const smoothScroll = localStorage.getItem('smoothScroll')
    if (smoothScroll && smoothScroll === 'false') {
      setSmoothScroll(smoothScroll === 'false')
    }

    const tmdbApiKey = localStorage.getItem('tmdbApiKey')
    if (tmdbApiKey) {
      setTmdbApiKey(tmdbApiKey)
    }

    const adultContent = localStorage.getItem('showAdultContent')
    if (adultContent) {
      setShowAdultContent(adultContent === 'true')
    }

    const titleLang = localStorage.getItem('titleLanguage')
    if (titleLang) {
      setTitleLanguage(titleLang)
    }

    const savedAppFont = localStorage.getItem('aniting-app-font')
    if (savedAppFont) {
      setAppFont(savedAppFont)
    }

    // Always force ANIME on app load as requested by user
    setContentType('ANIME')
    localStorage.setItem('contentType', 'ANIME')

    getSettingsJson()
  }, [])

  useEffect(() => {
    localStorage.setItem('aniting-app-font', appFont)
    if (appFont !== 'robotic') {
      document.documentElement.setAttribute('data-font', appFont)
    } else {
      document.documentElement.removeAttribute('data-font')
    }
  }, [appFont])

  return (
    <AnitingContext.Provider
      value={{
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
        userId,
        setUserId,
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
        tmdbApiKey,
        setTmdbApiKey,
        showAdultContent,
        setShowAdultContent,
        contentType,
        setContentType,
        titleLanguage,
        setTitleLanguage,
        appFont,
        setAppFont
      }}
    >
      {children}
    </AnitingContext.Provider>
  )
}

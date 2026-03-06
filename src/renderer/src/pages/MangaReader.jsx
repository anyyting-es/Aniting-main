import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { manhwaGetChapterPages, manhwaGetImage } from '../api/manhwaweb'
import { Spinner } from '@radix-ui/themes'
import { ChevronLeftIcon, ChevronRightIcon, GearIcon, Cross2Icon } from '@radix-ui/react-icons'
import { setWatchedEpisodes } from '../utils/helper'
import { toast } from 'sonner'

// ── Reading modes ──
const MODES = {
  LONG_STRIP: 'long_strip',
  SINGLE: 'single',
  DOUBLE: 'double'
}

const FIT = {
  CONTAIN: 'contain',
  WIDTH: 'width',
  HEIGHT: 'height',
  ORIGINAL: 'original'
}

const DIRECTION = {
  LTR: 'ltr',
  RTL: 'rtl'
}

// ── Defaults ──
const DEFAULT_SETTINGS = {
  mode: MODES.LONG_STRIP,
  fit: FIT.WIDTH,
  direction: DIRECTION.LTR,
  pageGap: true,
  showProgress: true
}

const PRELOAD_AHEAD = 3

function getReaderSettings() {
  try {
    const saved = localStorage.getItem('manga_reader_settings')
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
  } catch { }
  return DEFAULT_SETTINGS
}

function saveReaderSettings(settings) {
  localStorage.setItem('manga_reader_settings', JSON.stringify(settings))
}

// ── Proxied Image component with cache support ──
function ProxiedImage({ src, alt, className, style, onLoad, imageCache }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const blobUrlRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setBlobUrl(null)

    // Check cache first
    if (imageCache?.current?.has(src)) {
      const cached = imageCache.current.get(src)
      blobUrlRef.current = cached
      setBlobUrl(cached)
      setLoading(false)
      return
    }

    manhwaGetImage(src).then((url) => {
      if (cancelled) {
        // Don't revoke — it may be in cache from preloading
        return
      }
      if (url) {
        blobUrlRef.current = url
        setBlobUrl(url)
        setLoading(false)
        // Store in cache
        if (imageCache?.current) {
          imageCache.current.set(src, url)
        }
      } else {
        setError(true)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      // Don't revoke blob URLs on unmount — they stay in cache
    }
  }, [src])

  useEffect(() => {
    if (blobUrl && onLoad) onLoad()
  }, [blobUrl])

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-[#18181b] ${className || ''}`}
        style={{ minHeight: '300px', ...style }}
      >
        <Spinner size="3" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-[#18181b] text-sm text-gray-500 ${className || ''}`}
        style={{ minHeight: '200px', ...style }}
      >
        Error al cargar imagen
      </div>
    )
  }

  return <img src={blobUrl} alt={alt} className={className} style={style} />
}

// ── Toggle Switch ──
function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? 'bg-indigo-500' : 'bg-[#3a3a3f]'
        }`}
    >
      <span
        className={`shadow-md absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'
          }`}
      />
    </button>
  )
}

// ── Segmented Control ──
function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-[#1a1a1e] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 ${value === opt.value
              ? 'shadow-lg bg-indigo-500/90 text-white shadow-indigo-500/20'
              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Settings Modal ──
function ReaderSettingsModal({ settings, setSettings, onClose }) {
  const update = (key, value) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveReaderSettings(next)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="shadow-2xl w-[420px] rounded-2xl border border-white/[0.08] bg-[#1c1c20]/95 p-6 backdrop-blur-xl"
        style={{
          animation: 'settingsIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 25px 50px -12px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
              <GearIcon className="h-4 w-4 text-indigo-400" />
            </div>
            <h2 className="font-space-mono text-sm font-semibold tracking-wide text-white">
              Ajustes de Lectura
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-all hover:bg-white/10 hover:text-white"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
        </div>

        {/* Reading Mode */}
        <div className="mb-5">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Modo de Lectura
          </p>
          <SegmentedControl
            options={[
              { value: MODES.LONG_STRIP, label: 'Scroll' },
              { value: MODES.SINGLE, label: 'Simple' },
              { value: MODES.DOUBLE, label: 'Doble' }
            ]}
            value={settings.mode}
            onChange={(v) => update('mode', v)}
          />
        </div>

        {/* Page Fit */}
        <div className="mb-5">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Ajuste de Pagina
          </p>
          <SegmentedControl
            options={[
              { value: FIT.CONTAIN, label: 'Contener' },
              { value: FIT.WIDTH, label: 'Ancho' },
              { value: FIT.HEIGHT, label: 'Alto' },
              { value: FIT.ORIGINAL, label: 'Original' }
            ]}
            value={settings.fit}
            onChange={(v) => update('fit', v)}
          />
        </div>

        {/* Reading Direction */}
        <div className="mb-6">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Direccion
          </p>
          <SegmentedControl
            options={[
              { value: DIRECTION.LTR, label: 'Izq → Der' },
              { value: DIRECTION.RTL, label: 'Der → Izq' }
            ]}
            value={settings.direction}
            onChange={(v) => update('direction', v)}
          />
        </div>

        {/* Divider */}
        <div className="mb-5 h-px bg-white/[0.06]" />

        {/* Toggles */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Espacio entre Paginas</span>
            <ToggleSwitch checked={settings.pageGap} onChange={(v) => update('pageGap', v)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Barra de Progreso</span>
            <ToggleSwitch
              checked={settings.showProgress}
              onChange={(v) => update('showProgress', v)}
            />
          </div>
        </div>
      </div>

      {/* Inline keyframes for entrance animation */}
      <style>{`
        @keyframes settingsIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Main Reader ──
export default function MangaReader() {
  const { mangaId, chapterId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const { chapters, currentChapter, mangaTitle, anilistId } = location.state || {}

  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [settings, setSettings] = useState(getReaderSettings)
  const [showSettings, setShowSettings] = useState(false)

  const scrollRef = useRef(null)
  const currentPageRef = useRef(0)

  // Image cache: Map<url, blobUrl> — persists across page navigation within the same chapter
  const imageCache = useRef(new Map())

  // Find current chapter index within sorted chapter list
  const sortedChapters = useMemo(
    () => (chapters || []).slice().sort((a, b) => a.number - b.number),
    [chapters]
  )
  const currentIdx = sortedChapters.findIndex((ch) => ch.id === chapterId)
  const prevChapter = currentIdx > 0 ? sortedChapters[currentIdx - 1] : null
  const nextChapter = currentIdx < sortedChapters.length - 1 ? sortedChapters[currentIdx + 1] : null

  // Keep ref in sync
  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  // ── Load chapter pages ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPages([])
    setCurrentPage(0)

    // Clear image cache when chapter changes
    const oldCache = imageCache.current
    imageCache.current = new Map()
    // Revoke old blob URLs
    for (const blobUrl of oldCache.values()) {
      URL.revokeObjectURL(blobUrl)
    }

    manhwaGetChapterPages(chapterId)
      .then((result) => {
        if (cancelled) return
        if (result.length === 0) {
          setError('No se encontraron paginas para este capitulo')
        }
        setPages(result)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Error al cargar capitulo')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [chapterId])

  // ── Scroll to top when chapter changes ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0 })
    }
  }, [chapterId])

  // ── Preload upcoming pages (single/double modes) ──
  useEffect(() => {
    if (settings.mode === MODES.LONG_STRIP || pages.length === 0) return

    const step = settings.mode === MODES.DOUBLE ? 2 : 1
    const start = currentPage + step
    const end = Math.min(start + PRELOAD_AHEAD, pages.length)

    for (let i = start; i < end; i++) {
      const url = pages[i]?.url
      if (url && !imageCache.current.has(url)) {
        // Preload into cache
        manhwaGetImage(url).then((blobUrl) => {
          if (blobUrl && imageCache.current) {
            imageCache.current.set(url, blobUrl)
          }
        })
      }
    }
  }, [currentPage, pages, settings.mode])

  // ── Track scroll progress in long strip mode ──
  useEffect(() => {
    if (settings.mode !== MODES.LONG_STRIP || !scrollRef.current) return
    const container = scrollRef.current

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      if (pages.length === 0) return
      const pageHeight = scrollHeight / pages.length
      const page = Math.floor((scrollTop + clientHeight / 2) / pageHeight)
      setCurrentPage(Math.min(page, pages.length - 1))
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [settings.mode, pages.length])

  // ── Mark chapter as read (local + AniList) ──
  function markChapterRead(chapterNumber) {
    if (!anilistId || !chapterNumber) return

    // Local progress: store highest chapter read
    const key = `manga_progress_${anilistId}`
    const prev = parseInt(localStorage.getItem(key) || '0', 10)
    const newProgress = Math.max(prev, chapterNumber)
    localStorage.setItem(key, String(newProgress))

    // AniList sync (if logged in)
    const token = localStorage.getItem('anilist_token')
    if (token) {
      setWatchedEpisodes(parseInt(anilistId), newProgress)
        .then(() => {
          toast.success('Progreso actualizado', {
            description: `Capitulo ${newProgress} marcado como leido`,
            classNames: { title: 'text-green-500' }
          })
        })
        .catch((err) => {
          console.error('AniList progress update failed:', err)
        })
    }
  }

  function navigateToChapter(chapter) {
    // Mark current chapter as read before navigating away
    if (currentChapter?.number) {
      markChapterRead(currentChapter.number)
    }
    navigate(`/manga/${mangaId}/read/${chapter.id}`, {
      state: {
        chapters: sortedChapters,
        currentChapter: chapter,
        mangaTitle,
        anilistId
      },
      replace: true
    })
  }

  // ── Page navigation for single/double modes ──
  const goToNextPage = useCallback(() => {
    const step = settings.mode === MODES.DOUBLE ? 2 : 1
    const cp = currentPageRef.current
    if (cp + step < pages.length) {
      setCurrentPage(cp + step)
    } else if (nextChapter) {
      navigateToChapter(nextChapter)
    }
  }, [settings.mode, pages.length, nextChapter])

  const goToPrevPage = useCallback(() => {
    const step = settings.mode === MODES.DOUBLE ? 2 : 1
    const cp = currentPageRef.current
    if (cp - step >= 0) {
      setCurrentPage(cp - step)
    } else if (prevChapter) {
      navigateToChapter(prevChapter)
    }
  }, [settings.mode, prevChapter])

  // ── Keyboard navigation ──
  useEffect(() => {
    const handleKey = (e) => {
      if (showSettings) return
      // Ignore alt+arrow (used by AppLayout for history navigation)
      if (e.altKey) return

      const isRTL = settings.direction === DIRECTION.RTL

      if (settings.mode === MODES.LONG_STRIP) {
        // In long strip, arrows still work for fine scrolling
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'd') {
        isRTL ? goToPrevPage() : goToNextPage()
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        isRTL ? goToNextPage() : goToPrevPage()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [settings.mode, settings.direction, showSettings, goToNextPage, goToPrevPage])

  // ── Fit styles ──
  function getImageStyle() {
    switch (settings.fit) {
      case FIT.WIDTH:
        return { width: '100%', height: 'auto', maxWidth: '900px' }
      case FIT.HEIGHT:
        return { height: '100%', width: 'auto' }
      case FIT.CONTAIN:
        return { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
      case FIT.ORIGINAL:
        return {}
      default:
        return { width: '100%', maxWidth: '900px' }
    }
  }

  const imageStyle = getImageStyle()
  const gapClass = settings.pageGap ? 'gap-y-2' : 'gap-y-0'

  // ── Progress bar ──
  const progressPercent = pages.length > 0 ? ((currentPage + 1) / pages.length) * 100 : 0

  // ── Render pages based on mode ──
  function renderPages() {
    if (pages.length === 0) return null

    if (settings.mode === MODES.LONG_STRIP) {
      return (
        <div className={`mx-auto flex flex-col items-center ${gapClass}`}>
          {pages.map((page, idx) => (
            <ProxiedImage
              key={`${chapterId}-${idx}`}
              src={page.url}
              alt={`Pagina ${idx + 1}`}
              style={imageStyle}
              className="select-none"
              imageCache={imageCache}
            />
          ))}
        </div>
      )
    }

    if (settings.mode === MODES.SINGLE) {
      const page = pages[currentPage]
      if (!page) return null
      return (
        <div
          className="flex h-full items-center justify-center"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const isRTL = settings.direction === DIRECTION.RTL
            if (x < rect.width / 2) {
              isRTL ? goToNextPage() : goToPrevPage()
            } else {
              isRTL ? goToPrevPage() : goToNextPage()
            }
          }}
        >
          <ProxiedImage
            key={`${chapterId}-${currentPage}`}
            src={page.url}
            alt={`Pagina ${currentPage + 1}`}
            style={imageStyle}
            className="select-none"
            imageCache={imageCache}
          />
        </div>
      )
    }

    if (settings.mode === MODES.DOUBLE) {
      const isRTL = settings.direction === DIRECTION.RTL
      const page1 = pages[currentPage]
      const page2 = pages[currentPage + 1]
      const left = isRTL ? page2 : page1
      const right = isRTL ? page1 : page2

      return (
        <div
          className={`flex h-full items-center justify-center ${settings.pageGap ? 'gap-x-2' : 'gap-x-0'}`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            if (x < rect.width / 2) {
              isRTL ? goToNextPage() : goToPrevPage()
            } else {
              isRTL ? goToPrevPage() : goToNextPage()
            }
          }}
        >
          {left && (
            <ProxiedImage
              key={`${chapterId}-${currentPage}-L`}
              src={left.url}
              alt={`Pagina`}
              style={{ ...imageStyle, maxWidth: '50%', maxHeight: '100%' }}
              className="select-none"
              imageCache={imageCache}
            />
          )}
          {right && (
            <ProxiedImage
              key={`${chapterId}-${currentPage + 1}-R`}
              src={right.url}
              alt={`Pagina`}
              style={{ ...imageStyle, maxWidth: '50%', maxHeight: '100%' }}
              className="select-none"
              imageCache={imageCache}
            />
          )}
        </div>
      )
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-[#111113]"
        style={{ height: 'calc(100vh - 2.75rem)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner size="3" />
          <p className="font-space-mono text-sm text-gray-400">Cargando capitulo...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 bg-[#111113]"
        style={{ height: 'calc(100vh - 2.75rem)' }}
      >
        <p className="font-space-mono text-sm text-red-400">{error}</p>
        <button
          onClick={() => navigate(`/manga/${mangaId}`)}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
        >
          Volver al Manga
        </button>
      </div>
    )
  }

  return (
    <div className="relative bg-[#111113]" style={{ height: 'calc(100vh - 2.75rem)' }}>
      {/* ── Small overlay: title + page counter + settings (top-right, doesn't take space) ── */}
      <div className="absolute right-2 top-2 z-50 flex items-center gap-3 rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm">
        <div className="font-space-mono">
          <p className="line-clamp-1 text-xs font-medium text-white/80">{mangaTitle}</p>
          <p className="text-[10px] text-gray-400">
            {currentChapter?.title || `Cap. ${currentChapter?.number || ''}`}
            {' · '}
            {currentPage + 1}/{pages.length}
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="rounded p-1 text-gray-300 transition-colors hover:bg-[#333] hover:text-white"
        >
          <GearIcon className="h-4 w-4" />
        </button>
      </div>

      {/* ── Reader Area (full height) ── */}
      <div
        ref={scrollRef}
        data-lenis-prevent
        className={`h-full overflow-auto ${settings.mode === MODES.LONG_STRIP ? '' : 'overflow-hidden'
          }`}
        style={{
          scrollBehavior: 'smooth'
        }}
      >
        {renderPages()}

        {/* End-of-chapter navigation for long strip */}
        {settings.mode === MODES.LONG_STRIP && pages.length > 0 && (
          <div className="flex items-center justify-center gap-6 py-12">
            {prevChapter && (
              <button
                onClick={() => navigateToChapter(prevChapter)}
                className="flex items-center gap-2 rounded bg-[#2a2a2d] px-4 py-2 font-space-mono text-sm text-gray-200 transition-colors hover:bg-indigo-600"
              >
                <ChevronLeftIcon /> Capitulo Anterior
              </button>
            )}
            {nextChapter && (
              <button
                onClick={() => navigateToChapter(nextChapter)}
                className="flex items-center gap-2 rounded bg-[#2a2a2d] px-4 py-2 font-space-mono text-sm text-gray-200 transition-colors hover:bg-indigo-600"
              >
                Siguiente Capitulo <ChevronRightIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Side Page Arrows (navigate pages in single/double, chapters in long_strip) ── */}
      {settings.mode !== MODES.LONG_STRIP && (
        <>
          <button
            onClick={() => {
              const isRTL = settings.direction === DIRECTION.RTL
              isRTL ? goToNextPage() : goToPrevPage()
            }}
            className="absolute left-0 top-1/2 z-40 -translate-y-1/2 rounded-r-lg bg-black/30 px-1.5 py-6 text-white/40 transition-all hover:bg-indigo-600/80 hover:px-2.5 hover:text-white"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <button
            onClick={() => {
              const isRTL = settings.direction === DIRECTION.RTL
              isRTL ? goToPrevPage() : goToNextPage()
            }}
            className="absolute right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg bg-black/30 px-1.5 py-6 text-white/40 transition-all hover:bg-indigo-600/80 hover:px-2.5 hover:text-white"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </>
      )}

      {/* ── Progress bar ── */}
      {settings.showProgress && (
        <div className="absolute bottom-0 left-0 right-0 z-[60] h-1 bg-white/10">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettings && (
        <ReaderSettingsModal
          settings={settings}
          setSettings={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

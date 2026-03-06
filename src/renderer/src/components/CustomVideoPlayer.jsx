import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback
} from 'react'
import {
  PlayIcon,
  PauseIcon,
  TrackPreviousIcon,
  TrackNextIcon,
  SpeakerLoudIcon,
  SpeakerOffIcon,
  EnterFullScreenIcon,
  ExitFullScreenIcon,
  BorderWidthIcon,
  ChatBubbleIcon,
  GearIcon,
  TimerIcon
} from '@radix-ui/react-icons'
// --- ASS subtitle parser utilities ---
function assTimeToSeconds(t) {
  const [h, m, rest] = t.split(':')
  const [s, cs] = rest.split('.')
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(cs) / 100
}

function parseAssDialogues(assContent) {
  if (!assContent) return []
  const cues = []
  for (const line of assContent.split('\n')) {
    if (!line.startsWith('Dialogue:')) continue
    const parts = line.substring('Dialogue:'.length).trim().split(',')
    if (parts.length < 10) continue
    const start = assTimeToSeconds(parts[1].trim())
    const end = assTimeToSeconds(parts[2].trim())
    const text = parts.slice(9).join(',')
    cues.push({ start, end, text })
  }
  return cues.sort((a, b) => a.start - b.start)
}

function cleanAssText(text) {
  return text
    .replace(/\{\\[^}]*\}/g, '') // strip all override tags {\...}
    .replace(/\\N/g, '\n') // hard line break
    .replace(/\\n/g, '\n') // soft line break
    .trim()
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')
  if (h) return `${h}:${m.toString().padStart(2, '0')}:${s}`
  return `${m}:${s}`
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

const CustomVideoPlayer = forwardRef(
  (
    {
      src,
      streamType,
      magnetURI,
      onNext,
      onPrev,
      isLoading,
      poster,
      subtitleContent,
      subtitleTracks,
      currentSubTrack,
      onSubtitleTrackChange,
      onLoadSubtitles,
      subsLoading,
      fontUrls,
      hasDub,
      audioType,
      audioSwitching,
      onAudioToggle,
      skipTimes
    },
    ref
  ) => {
    const internalRef = useRef(null)
    const containerRef = useRef(null)
    const [activeSubs, setActiveSubs] = useState([])
    const parsedCuesRef = useRef([])
    useImperativeHandle(ref, () => internalRef.current)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [buffered, setBuffered] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const [subsVisible, setSubsVisible] = useState(true)
    const [playbackSpeed, setPlaybackSpeed] = useState(1)
    const [showSpeedMenu, setShowSpeedMenu] = useState(false)
    const [showSubMenu, setShowSubMenu] = useState(false)
    const [isBuffering, setIsBuffering] = useState(false)

    // Seek bar drag & hover state
    const [isSeeking, setIsSeeking] = useState(false)
    const [seekPreviewPct, setSeekPreviewPct] = useState(null)
    const [hoverPct, setHoverPct] = useState(null)
    const seekBarRef = useRef(null)

    // Subtitle style settings
    const [subStyle, setSubStyle] = useState({
      fontSize: 32, // scale value (cqw = value/10)
      bgOpacity: 0, // 0 = transparent, 1 = black
      outline: 5, // outline strength
      bottomOffset: 6, // % from bottom
      fontFamily: 'Arial' // font
    })

    const hideTimeoutRef = useRef(null)
    const speedMenuRef = useRef(null)
    const subMenuRef = useRef(null)

    // --- Parse ASS content into cues when subtitleContent changes ---
    useEffect(() => {
      if (!subtitleContent) {
        parsedCuesRef.current = []
        setActiveSubs([])
        return
      }
      const cues = parseAssDialogues(subtitleContent)
      parsedCuesRef.current = cues
      console.log(`[Subs] Parsed ${cues.length} subtitle cues`)
    }, [subtitleContent])

    // --- Sync active subtitles with video time ---
    useEffect(() => {
      const video = internalRef.current
      if (!video) return

      let rafId = null
      function onTimeUpdate() {
        const t = video.currentTime
        const cues = parsedCuesRef.current
        if (!cues.length) return
        // Find all cues that overlap current time
        const active = []
        for (const c of cues) {
          if (c.start > t + 0.1) break // cues are sorted, no need to check further
          if (c.end > t) active.push(c)
        }
        setActiveSubs(active)
      }
      video.addEventListener('timeupdate', onTimeUpdate)
      // Also update on seek
      video.addEventListener('seeked', onTimeUpdate)
      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate)
        video.removeEventListener('seeked', onTimeUpdate)
        if (rafId) cancelAnimationFrame(rafId)
      }
    }, [])

    // Toggle subtitle visibility
    const toggleSubtitles = useCallback(() => {
      setSubsVisible((prev) => !prev)
    }, [])

    // Auto-hide controls
    const resetHideTimer = useCallback(() => {
      setShowControls(true)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => {
        if (!showSpeedMenu && !showSubMenu) {
          setShowControls(false)
        }
      }, 3000)
    }, [showSpeedMenu, showSubMenu])

    useEffect(() => {
      return () => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      }
    }, [])

    // Keep controls visible when paused
    useEffect(() => {
      if (!isPlaying) {
        setShowControls(true)
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      }
    }, [isPlaying])

    // Close menus when clicking outside
    useEffect(() => {
      function handleClickOutside(e) {
        if (speedMenuRef.current && !speedMenuRef.current.contains(e.target)) {
          setShowSpeedMenu(false)
        }
        if (subMenuRef.current && !subMenuRef.current.contains(e.target)) {
          setShowSubMenu(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement)
      }
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    // Update buffered amount
    useEffect(() => {
      const video = internalRef.current
      if (!video) return
      const onProgress = () => {
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1))
        }
      }
      video.addEventListener('progress', onProgress)
      return () => video.removeEventListener('progress', onProgress)
    }, [])

    // Buffering state detection
    useEffect(() => {
      const video = internalRef.current
      if (!video) return
      const onWaiting = () => setIsBuffering(true)
      const onPlaying = () => setIsBuffering(false)
      const onCanPlay = () => setIsBuffering(false)
      video.addEventListener('waiting', onWaiting)
      video.addEventListener('playing', onPlaying)
      video.addEventListener('canplay', onCanPlay)
      return () => {
        video.removeEventListener('waiting', onWaiting)
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('canplay', onCanPlay)
      }
    }, [])

    const togglePlay = () => {
      if (!internalRef.current) return
      if (isPlaying) internalRef.current.pause()
      else internalRef.current.play()
    }

    const toggleMute = () => {
      if (!internalRef.current) return
      internalRef.current.muted = !isMuted
    }

    const handleVolumeChange = (e) => {
      const newVol = parseFloat(e.target.value)
      if (!internalRef.current) return
      internalRef.current.volume = newVol
      if (newVol > 0 && isMuted) internalRef.current.muted = false
    }

    const getSeekPct = useCallback((clientX) => {
      const bar = seekBarRef.current
      if (!bar) return 0
      const rect = bar.getBoundingClientRect()
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }, [])

    const handleSeekMouseDown = useCallback(
      (e) => {
        e.preventDefault()
        setIsSeeking(true)
        const pct = getSeekPct(e.clientX)
        setSeekPreviewPct(pct)
        setCurrentTime(pct * duration)

        const onMouseMove = (ev) => {
          const p = getSeekPct(ev.clientX)
          setSeekPreviewPct(p)
          setCurrentTime(p * duration)
        }

        const onMouseUp = (ev) => {
          const p = getSeekPct(ev.clientX)
          if (internalRef.current) {
            internalRef.current.currentTime = p * duration
          }
          setCurrentTime(p * duration)
          setIsSeeking(false)
          setSeekPreviewPct(null)
          window.removeEventListener('mousemove', onMouseMove)
          window.removeEventListener('mouseup', onMouseUp)
        }

        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
      },
      [duration, getSeekPct]
    )

    const handleSeekHover = useCallback(
      (e) => {
        if (isSeeking) return
        setHoverPct(getSeekPct(e.clientX))
      },
      [isSeeking, getSeekPct]
    )

    const handleSeekLeave = useCallback(() => {
      if (!isSeeking) setHoverPct(null)
    }, [isSeeking])

    const toggleFullscreen = async () => {
      if (!containerRef.current) return
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen().catch(() => { })
      } else {
        await document.exitFullscreen().catch(() => { })
      }
    }

    const handleDoubleClick = (e) => {
      // Don't trigger on controls
      if (e.target.closest('[data-controls]')) return
      toggleFullscreen()
    }

    const togglePiP = async () => {
      if (!internalRef.current) return
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await internalRef.current.requestPictureInPicture()
      }
    }

    const changeSpeed = (speed) => {
      setPlaybackSpeed(speed)
      if (internalRef.current) internalRef.current.playbackRate = speed
      setShowSpeedMenu(false)
    }

    const progressPct = duration ? (currentTime / duration) * 100 : 0
    const bufferedPct = duration ? (buffered / duration) * 100 : 0

    const hasSubtitles = subtitleTracks && subtitleTracks.length > 0

    return (
      <div
        ref={containerRef}
        data-player-root
        style={{ containerType: 'inline-size' }}
        className={`group relative flex aspect-video w-full select-none items-center justify-center overflow-hidden bg-black font-space-mono leading-[0] ${!showControls && isPlaying ? 'cursor-none' : ''}`}
        onMouseMove={resetHideTimer}
        onMouseLeave={() => {
          if (isPlaying) {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
            setShowControls(false)
          }
          setShowSpeedMenu(false)
          setShowSubMenu(false)
        }}
        onDoubleClick={handleDoubleClick}
      >
        <video
          ref={internalRef}
          src={src}
          className="block h-full w-full object-contain"
          crossOrigin="anonymous"
          preload="auto"
          playsInline
          controls={false}
          onClick={togglePlay}
          poster={poster}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onVolumeChange={(e) => {
            setVolume(e.target.volume)
            setIsMuted(e.target.muted)
          }}
          style={{ visibility: isLoading ? 'hidden' : 'visible' }}
        />

        {/* Subtitle Overlay */}
        {subsVisible && activeSubs.length > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-y-1 px-8"
            style={{ bottom: `${subStyle.bottomOffset}%` }}
          >
            {activeSubs.map((cue, i) => {
              const cleaned = cleanAssText(cue.text)
              if (!cleaned) return null
              const outlineScaled = (subStyle.outline * subStyle.fontSize) / 40
              const outlineShadow = Array.from({ length: 8 }, (_, idx) => {
                const angle = (idx * Math.PI) / 4
                const x = Math.round(Math.cos(angle) * outlineScaled)
                const y = Math.round(Math.sin(angle) * outlineScaled)
                return `${x}px ${y}px 0 #000`
              }).join(', ')
              return (
                <div
                  key={`${cue.start}-${i}`}
                  className="max-w-[85%] rounded px-3 py-1 text-center"
                  style={{
                    backgroundColor:
                      subStyle.bgOpacity > 0
                        ? `rgba(0, 0, 0, ${subStyle.bgOpacity})`
                        : 'transparent',
                    color: '#fff',
                    fontFamily: `${subStyle.fontFamily}, Helvetica, sans-serif`,
                    fontSize: `${subStyle.fontSize / 10}cqw`,
                    fontWeight: 900,
                    lineHeight: 1.3,
                    WebkitTextStroke: `${outlineScaled}px #000`,
                    paintOrder: 'stroke fill',
                    textShadow: outlineShadow,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {cleaned}
                </div>
              )
            })}
          </div>
        )}

        {/* Loading / Buffering Spinner */}
        {(isLoading || isBuffering) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
          </div>
        )}

        {/* AniSkip – Skip OP/ED Button */}
        {(() => {
          const activeSeg = skipTimes?.find(
            (s) => currentTime >= s.startTime && currentTime < s.endTime
          )
          if (!activeSeg) return null
          return (
            <button
              className="absolute bottom-24 right-6 z-30 rounded-md border border-white/20 bg-black/80 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-purple-600/80 hover:scale-105"
              onClick={() => {
                if (internalRef.current) internalRef.current.currentTime = activeSeg.endTime
              }}
            >
              {activeSeg.type === 'op' ? 'Saltar Opening' : 'Saltar Ending'}
            </button>
          )
        })()}

        {/* Controls Overlay */}
        <div
          data-controls
          className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)'
          }}
        >
          {/* Seek Bar */}
          <div className="px-4 pb-1 pt-8">
            <div
              ref={seekBarRef}
              className={`group/seek relative w-full cursor-pointer rounded-full bg-white/20 transition-all ${isSeeking ? 'h-2' : 'h-1 hover:h-1.5'}`}
              onMouseDown={handleSeekMouseDown}
              onMouseMove={handleSeekHover}
              onMouseLeave={handleSeekLeave}
            >
              {/* Buffered */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-white/30"
                style={{ width: `${bufferedPct}%` }}
              />
              {/* AniSkip segment markers */}
              {skipTimes?.map((seg) => {
                if (!duration) return null
                const left = (seg.startTime / duration) * 100
                const width = ((seg.endTime - seg.startTime) / duration) * 100
                return (
                  <div
                    key={seg.skipId}
                    className="absolute top-0 h-full rounded-full opacity-60"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: seg.type === 'op' ? '#22d3ee' : '#a78bfa'
                    }}
                    title={seg.type === 'op' ? 'Opening' : 'Ending'}
                  />
                )
              })}
              {/* Progress */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-purple-500"
                style={{
                  width: `${seekPreviewPct !== null ? seekPreviewPct * 100 : progressPct}%`
                }}
              />
              {/* Thumb */}
              <div
                className={`shadow-md absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-purple-400 transition-opacity ${isSeeking ? 'opacity-100' : 'opacity-0 group-hover/seek:opacity-100'}`}
                style={{
                  left: `calc(${seekPreviewPct !== null ? seekPreviewPct * 100 : progressPct}% - 6px)`
                }}
              />
              {/* Hover time tooltip */}
              {(hoverPct !== null || seekPreviewPct !== null) && duration > 0 && (
                <div
                  className="shadow-lg pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-black/90 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white"
                  style={{
                    left: `${(seekPreviewPct !== null ? seekPreviewPct : hoverPct) * 100}%`
                  }}
                >
                  {formatTime((seekPreviewPct !== null ? seekPreviewPct : hoverPct) * duration)}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex items-center justify-between px-4 pb-3 pt-2">
            {/* Left Controls */}
            <div className="flex items-center gap-x-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="text-white transition-transform hover:scale-110"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <PauseIcon width="22" height="22" />
                ) : (
                  <PlayIcon width="22" height="22" />
                )}
              </button>

              {/* Prev / Next */}
              {onPrev && (
                <button
                  onClick={onPrev}
                  className="text-gray-300 hover:text-white"
                  title="Anterior"
                >
                  <TrackPreviousIcon width="18" height="18" />
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  className="text-gray-300 hover:text-white"
                  title="Siguiente"
                >
                  <TrackNextIcon width="18" height="18" />
                </button>
              )}

              {/* Volume */}
              <div className="flex items-center gap-x-1.5">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-gray-200"
                  title="Silenciar"
                >
                  {isMuted || volume === 0 ? (
                    <SpeakerOffIcon width="18" height="18" />
                  ) : (
                    <SpeakerLoudIcon width="18" height="18" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-purple-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                />
              </div>

              {/* Time */}
              <span className="ml-1 text-xs font-medium tabular-nums tracking-wide text-gray-200">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-x-3">
              {/* Speed Control */}
              <div className="relative" ref={speedMenuRef}>
                <button
                  onClick={() => {
                    setShowSpeedMenu((p) => !p)
                    setShowSubMenu(false)
                  }}
                  className={`flex items-center gap-x-1 text-xs transition-colors ${playbackSpeed !== 1
                    ? 'text-purple-400 hover:text-purple-300'
                    : 'text-gray-300 hover:text-white'
                    }`}
                  title="Velocidad"
                >
                  <TimerIcon width="15" height="15" />
                  <span>{playbackSpeed}x</span>
                </button>

                {showSpeedMenu && (
                  <div className="shadow-xl absolute bottom-full right-0 mb-2 rounded-md border border-white/10 bg-black/95 py-1 backdrop-blur-sm">
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => changeSpeed(s)}
                        className={`block w-full whitespace-nowrap px-4 py-1.5 text-left text-xs transition-colors ${playbackSpeed === s
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        {s}x {s === 1 && '(Normal)'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Audio (Sub/Dub) Toggle */}
              {hasDub && (
                <button
                  onClick={onAudioToggle}
                  disabled={audioSwitching}
                  className={`rounded px-2 py-0.5 text-xs font-bold tracking-wider transition-all ${audioSwitching
                    ? 'animate-pulse bg-purple-500/30 text-purple-300'
                    : audioType === 'dub'
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    }`}
                  title={audioType === 'sub' ? 'Cambiar a Latino' : 'Cambiar a Japonés'}
                >
                  {audioSwitching ? '...' : audioType === 'sub' ? 'JAP' : 'LAT'}
                </button>
              )}

              {/* Subtitle Controls */}
              <div className="relative" ref={subMenuRef}>
                <button
                  onClick={() => {
                    setShowSubMenu((p) => !p)
                    setShowSpeedMenu(false)
                  }}
                  className={`transition-colors ${subsVisible && subtitleContent
                    ? 'text-purple-400 hover:text-purple-300'
                    : 'text-gray-400 hover:text-white'
                    }`}
                  title="Subtítulos"
                >
                  <ChatBubbleIcon width="16" height="16" />
                </button>

                {showSubMenu && (
                  <div className="shadow-xl absolute bottom-full right-0 mb-2 min-w-[180px] rounded-md border border-white/10 bg-black/95 py-1 backdrop-blur-sm">
                    {/* Toggle visibility */}
                    {subtitleContent && (
                      <button
                        onClick={() => {
                          toggleSubtitles()
                          setShowSubMenu(false)
                        }}
                        className="block w-full px-4 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                      >
                        {subsVisible ? 'Ocultar Subtítulos' : 'Mostrar Subtítulos'}
                      </button>
                    )}

                    {/* Load subtitles button if not loaded yet */}
                    {hasSubtitles && !subtitleContent && !subsLoading && (
                      <button
                        onClick={() => {
                          onLoadSubtitles?.(0)
                          setShowSubMenu(false)
                        }}
                        className="block w-full px-4 py-1.5 text-left text-xs text-purple-400 hover:bg-purple-500/20"
                      >
                        Cargar Subtítulos
                      </button>
                    )}

                    {subsLoading && (
                      <div className="px-4 py-1.5 text-xs text-gray-500">
                        Extrayendo subtítulos...
                      </div>
                    )}

                    {/* Track listing */}
                    {hasSubtitles && subtitleContent && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-gray-500">
                          Pistas
                        </div>
                        {subtitleTracks.map((t, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              onSubtitleTrackChange?.(i)
                              setShowSubMenu(false)
                            }}
                            className={`block w-full px-4 py-1.5 text-left text-xs transition-colors ${currentSubTrack === i
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'text-gray-300 hover:bg-white/10 hover:text-white'
                              }`}
                          >
                            {t.name || t.language || `Track ${i + 1}`}
                            {t.language && t.name ? ` (${t.language})` : ''}
                          </button>
                        ))}
                      </>
                    )}

                    {!hasSubtitles && (
                      <div className="px-4 py-1.5 text-xs text-gray-500">
                        Sin pistas de subtítulos
                      </div>
                    )}

                    {/* Style Editor */}
                    {subtitleContent && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-gray-500">
                          Estilo
                        </div>

                        {/* Font Size */}
                        <div className="flex items-center gap-x-2 px-4 py-1.5">
                          <span className="w-16 text-[10px] text-gray-400">Tamaño</span>
                          <input
                            type="range"
                            min="20"
                            max="60"
                            step="2"
                            value={subStyle.fontSize}
                            onChange={(e) =>
                              setSubStyle((s) => ({
                                ...s,
                                fontSize: Number(e.target.value)
                              }))
                            }
                            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-purple-500 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                          />
                          <span className="w-8 text-right text-[10px] tabular-nums text-gray-400">
                            {subStyle.fontSize}
                          </span>
                        </div>

                        {/* Outline */}
                        <div className="flex items-center gap-x-2 px-4 py-1.5">
                          <span className="w-16 text-[10px] text-gray-400">Contorno</span>
                          <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.5"
                            value={subStyle.outline}
                            onChange={(e) =>
                              setSubStyle((s) => ({
                                ...s,
                                outline: Number(e.target.value)
                              }))
                            }
                            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-purple-500 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                          />
                          <span className="w-8 text-right text-[10px] tabular-nums text-gray-400">
                            {subStyle.outline}
                          </span>
                        </div>

                        {/* Background */}
                        <div className="flex items-center gap-x-2 px-4 py-1.5">
                          <span className="w-16 text-[10px] text-gray-400">Fondo</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={subStyle.bgOpacity}
                            onChange={(e) =>
                              setSubStyle((s) => ({
                                ...s,
                                bgOpacity: Number(e.target.value)
                              }))
                            }
                            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-purple-500 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                          />
                          <span className="w-8 text-right text-[10px] tabular-nums text-gray-400">
                            {Math.round(subStyle.bgOpacity * 100)}%
                          </span>
                        </div>

                        {/* Position */}
                        <div className="flex items-center gap-x-2 px-4 py-1.5">
                          <span className="w-16 text-[10px] text-gray-400">Posición</span>
                          <input
                            type="range"
                            min="2"
                            max="40"
                            step="1"
                            value={subStyle.bottomOffset}
                            onChange={(e) =>
                              setSubStyle((s) => ({
                                ...s,
                                bottomOffset: Number(e.target.value)
                              }))
                            }
                            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-purple-500 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                          />
                          <span className="w-8 text-right text-[10px] tabular-nums text-gray-400">
                            {subStyle.bottomOffset}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* PiP */}
              <button
                onClick={togglePiP}
                className="text-gray-300 hover:text-white"
                title="Picture in Picture"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <rect
                    x="12"
                    y="9"
                    width="8"
                    height="6"
                    rx="1"
                    fill="currentColor"
                    opacity="0.5"
                  />
                </svg>
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-gray-300 hover:text-white"
                title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
              >
                {isFullscreen ? (
                  <ExitFullScreenIcon width="18" height="18" />
                ) : (
                  <EnterFullScreenIcon width="18" height="18" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

CustomVideoPlayer.displayName = 'CustomVideoPlayer'
export default CustomVideoPlayer

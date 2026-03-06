import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { Code, Skeleton, Spinner, TextField } from '@radix-ui/themes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import SearchResults from './SearchResults'
import { searchAnime } from '../utils/helper'
import { useNavigate } from 'react-router-dom'

export default function SearchBar() {
  const [searchText, setSearchText] = useState('')
  const [searchData, setSearchData] = useState([])
  const [isActive, setIsActive] = useState(false)
  const navigate = useNavigate()

  const inputRef = useRef(null)
  const searchBarRef = useRef(null)

  // console.log(searchText)

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchBarRef.current && !searchBarRef.current.contains(event.target)) {
        setIsActive(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [searchBarRef])

  const handleSearchChange = (event) => {
    setSearchData([])
    setSearchText(event.target.value)
    // console.log(event.target.value);
  }

  const [searching, setSearching] = useState(false)
  const handleSearchText = useCallback(async function handleSearchText(searchText) {
    if (searchText) {
      setSearching(true)
      const data = await searchAnime(searchText)
      setSearching(false)
      setSearchData(data)
    } else {
      toast.error('Búsqueda inválida', {
        icon: <MagnifyingGlassIcon height="16" width="16" color="#ffffff" />,
        description: 'Por favor ingresa una búsqueda válida',
        classNames: {
          title: 'text-rose-500'
        }
      })
      return
    }
  }, [])

  // console.log(searchData)

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter' && inputRef.current === document.activeElement) {
        handleSearchText(searchText)
      }
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault()
        inputRef.current.select()
        inputRef.current.focus()
      }
    }

    document.addEventListener('keydown', handleKeyPress)

    return () => {
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [handleSearchText, searchText])

  return (
    <div ref={searchBarRef} className="relative">
      <div className="draggable px-3">
        <TextField.Root
          placeholder={'Buscar'}
          className="nodrag capitalize"
          onInput={handleSearchChange}
          ref={inputRef}
          type="text"
          value={searchText}
          onFocus={() => setIsActive(true)}
        // onBlur={() => setIsActive(false)}
        >
          <TextField.Slot>
            <MagnifyingGlassIcon height="16" width="16" />
          </TextField.Slot>
          <TextField.Slot
            className="transition-all duration-100 ease-in-out hover:cursor-pointer hover:bg-[#5a5e6750]"
            onClick={() => handleSearchText(searchText)}
          >
            <Code size={'1'} color="gray" variant="outline">
              ctrl
            </Code>
            <Code size={'1'} color="gray" variant="outline">
              k
            </Code>
          </TextField.Slot>
        </TextField.Root>
      </div>

      {isActive && (
        <div className="absolute mt-1 flex w-full animate-fade-down flex-col justify-center rounded-sm animate-duration-[400ms]">
          {/* {true && ( */}
          {searching && (
            <div className="flex flex-col items-center justify-center gap-y-5 bg-[#111113] p-2 backdrop-blur-sm">
              <div className="flex w-full items-start gap-x-4">
                <Skeleton className="h-12 w-12" />
                <div className="flex flex-col gap-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2 w-48" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
              {/* <Spinner /> */}
            </div>
          )}

          {searchData?.map((x) => (
            <SearchResults key={x.id} data={x} setIsActive={setIsActive} />
          ))}

          {searchText && !searching && (
            <div
              className="mt-1 cursor-pointer border-t border-[#5a5e6750] px-4 py-2 text-center text-xs text-blue-400 transition-all duration-200 hover:bg-[#5a5e6750] hover:text-blue-300"
              onClick={() => {
                setIsActive(false)
                sessionStorage.setItem('search_term_stored', `"${searchText}"`)

                const storedParams =
                  JSON.parse(sessionStorage.getItem('anilist_search_params')) || {}
                storedParams.title = `"${searchText}"`
                sessionStorage.setItem('anilist_search_params', JSON.stringify(storedParams))

                navigate('/anilist')
              }}
            >
              Ver todos los resultados
            </div>
          )}
        </div>
      )}
    </div>
  )
}

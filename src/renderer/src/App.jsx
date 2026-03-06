import { createHashRouter, RouterProvider, useLocation } from 'react-router-dom'
import AppLayout from './ui/AppLayout'
import Home from './pages/Home'
import MangaHome from './pages/MangaHome'
import HentaiHome from './pages/HentaiHome'
import ErrorPage from './pages/ErrorPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import AnimePage from './pages/AnimePage'
import MangaPage from './pages/MangaPage'
import MangaReader from './pages/MangaReader'
import Player from './pages/Player'
import NewReleases from './pages/NewReleases'
import AnilistAuthCallback from './components/AnilistAuthCallback'
import Settings from './pages/Settings'
import Bookmarks from './pages/Bookmarks'
import Anilist from './pages/Anilist'
import Downloads from './pages/Downloads'
import VideoPlayer from './components/VideoPlayer'
import Profile from './pages/Profile'

const VideoPlayerRoute = () => {
  const location = useLocation()
  return <VideoPlayer key={location.key} />
}

// import { lazy } from "react";

// const AnimePage = lazy(() => import("./pages/AnimePage"));
// const VideoPlayer = lazy(() => import("./components/VideoPlayer"));

const router = createHashRouter([
  {
    element: <AppLayout />,
    errorElement: <AppLayout props={<ErrorPage />} />,
    children: [
      {
        path: '/',
        element: <Home />,
        errorElement: <ErrorPage />
      },
      {
        path: '/manga',
        element: <MangaHome />,
        errorElement: <ErrorPage />
      },
      {
        path: '/hentai',
        element: <HentaiHome />,
        errorElement: <ErrorPage />
      },
      {
        path: '/manga/:mangaId',
        element: <MangaPage />,
        errorElement: <ErrorPage />
      },
      {
        path: '/manga/:mangaId/read/:chapterId',
        element: <MangaReader />,
        errorElement: <ErrorPage />
      },
      {
        path: '/anime/:animeId',
        element: <AnimePage />,
        errorElement: <ErrorPage />
      },
      {
        path: '/video',
        element: <VideoPlayerRoute />,
        errorElement: <ErrorPage />
      },
      {
        path: '/newreleases',
        element: <NewReleases />,
        errorElement: <ErrorPage />
      },
      {
        path: '/anilistauthcallback',
        element: <AnilistAuthCallback />,
        errorElement: <ErrorPage />
      },
      {
        path: '/bookmarks',
        element: <Bookmarks />,
        errorElement: <ErrorPage />
      },
      {
        path: '/downloads',
        element: <Downloads />,
        errorElement: <ErrorPage />
      },
      {
        path: '/anilist',
        element: <Anilist />,
        errorElement: <ErrorPage />
      },
      {
        path: '/settings',
        element: <Settings />,
        errorElement: <ErrorPage />
      },
      {
        path: '/profile',
        element: <Profile />,
        errorElement: <ErrorPage />
      }
    ]
  }
])

function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // staleTime: 60 * 1000, // staleTime is the time in milliseconds after which the data is considered stale
        staleTime: 0,
        refetchOnWindowFocus: false
      }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <div data-lenis-prevent="true">
        <ReactQueryDevtools initialIsOpen={false} />
      </div>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from './components/AppShell'
import Setup from './pages/Setup'
import Home from './pages/Home'
import Library from './pages/Library'
import MediaDetail from './pages/MediaDetail'
import People from './pages/People'
import Settings from './pages/Settings'
import ImportProgress from './components/ImportProgress'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          {/* AppShell is a layout route: renders sidebar + <Outlet /> */}
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/library/:name" element={<Library />} />
            <Route path="/library/:name/media/:id" element={<MediaDetail />} />
            <Route path="/library/:name/people" element={<People />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
        <ImportProgress />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { SlidersHorizontal, ArrowUpAZ, ArrowDownAZ } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConnectDogeSCMDialog } from './components/connect-dogescm-dialog'
import { apps } from './data/apps'

const route = getRouteApi('/_authenticated/apps/')

type AppType = 'all' | 'connected' | 'notConnected'

const appText = new Map<AppType, string>([
  ['all', 'All Apps'],
  ['connected', 'Connected'],
  ['notConnected', 'Not Connected'],
])

// A typing burst should leave one history entry behind, not one per keystroke,
// so the filter is written to the URL only once the user pauses.
const FILTER_WRITE_DELAY_MS = 300

export function Apps() {
  // The search params are the single source of truth for the three controls, so
  // a same-route `popstate` (browser Back/Forward) rehydrates them for free.
  const { filter = '', type: appType = 'all', sort = 'asc' } = route.useSearch()
  const navigate = route.useNavigate()

  // The filter box is the one control that cannot read straight from the URL:
  // it has to stay responsive while the debounced write is still pending, so it
  // keeps local state and is reconciled with the URL below.
  const [searchTerm, setSearchTerm] = useState(filter)
  const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>(
    {}
  )

  // Remembering the value we wrote is what distinguishes our own debounced
  // write echoing back from a `filter` that arrived through the browser's
  // history or a pasted URL. Only the latter may overwrite what is being typed.
  const writtenFilter = useRef(filter)
  const filterWriteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (filter === writtenFilter.current) return

    // An external navigation wins over an edit that has not been written yet.
    if (filterWriteTimeout.current) {
      clearTimeout(filterWriteTimeout.current)
      filterWriteTimeout.current = null
    }

    writtenFilter.current = filter
    setSearchTerm(filter)
  }, [filter])

  useEffect(() => {
    return () => {
      if (filterWriteTimeout.current) clearTimeout(filterWriteTimeout.current)
    }
  }, [])

  const appList = apps.map((app) => ({
    ...app,
    connected: connectedApps[app.name] ?? app.connected,
  }))

  const filteredApps = appList
    .sort((a, b) =>
      sort === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    )
    .filter((app) =>
      appType === 'connected'
        ? app.connected
        : appType === 'notConnected'
          ? !app.connected
          : true
    )
    .filter((app) => app.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)

    if (filterWriteTimeout.current) clearTimeout(filterWriteTimeout.current)
    filterWriteTimeout.current = setTimeout(() => {
      filterWriteTimeout.current = null
      writtenFilter.current = value
      navigate({
        replace: true,
        search: (prev) => ({
          ...prev,
          filter: value || undefined,
        }),
      })
    }, FILTER_WRITE_DELAY_MS)
  }

  const handleTypeChange = (value: AppType) => {
    navigate({
      search: (prev) => ({
        ...prev,
        type: value === 'all' ? undefined : value,
      }),
    })
  }

  const handleSortChange = (value: 'asc' | 'desc') => {
    navigate({ search: (prev) => ({ ...prev, sort: value }) })
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      {/* ===== Content ===== */}
      <Main fixed>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            App Integrations
          </h1>
          <p className='text-muted-foreground'>
            Here&apos;s a list of your apps for the integration!
          </p>
        </div>
        <div className='my-4 flex items-end justify-between sm:my-0 sm:items-center'>
          <div className='flex flex-col gap-4 sm:my-4 sm:flex-row'>
            {/* Screen-reader-only: the placeholder alone is not a label, and it
                disappears the moment the user types. */}
            <Label htmlFor='apps-filter' className='sr-only'>
              Filter apps
            </Label>
            <Input
              id='apps-filter'
              name='filter'
              placeholder='Filter apps...'
              className='h-9 w-40 lg:w-62.5'
              value={searchTerm}
              onChange={handleSearch}
            />
            <Select value={appType} onValueChange={handleTypeChange}>
              {/* `combobox` takes no name from its content, so the selected
                  value cannot double as the control's accessible name. */}
              <SelectTrigger
                className='w-40'
                aria-label='Filter apps by connection status'
              >
                <SelectValue>{appText.get(appType)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Apps</SelectItem>
                <SelectItem value='connected'>Connected</SelectItem>
                <SelectItem value='notConnected'>Not Connected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={sort} onValueChange={handleSortChange}>
            {/* Icon-only trigger: without this it has no accessible name at all. */}
            <SelectTrigger className='w-16' aria-label='Sort apps'>
              <SelectValue>
                <SlidersHorizontal size={18} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent align='end'>
              <SelectItem value='asc'>
                <div className='flex items-center gap-4'>
                  <ArrowUpAZ size={16} />
                  <span>Ascending</span>
                </div>
              </SelectItem>
              <SelectItem value='desc'>
                <div className='flex items-center gap-4'>
                  <ArrowDownAZ size={16} />
                  <span>Descending</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator className='shadow-sm' />
        <ul className='faded-bottom no-scrollbar grid gap-4 overflow-auto pt-4 pb-16 md:grid-cols-2 lg:grid-cols-3'>
          {filteredApps.length === 0 && (
            <li className='col-span-full'>
              {/* `status` announces the empty result to assistive technology,
                  which an empty grid on its own never does. */}
              <div
                role='status'
                className='flex flex-col items-center gap-1 rounded-lg border border-dashed p-8 text-center'
              >
                <p className='font-semibold'>No apps found</p>
                <p className='text-sm text-muted-foreground'>
                  Try a different search term or connection filter.
                </p>
              </div>
            </li>
          )}
          {filteredApps.map((app) => (
            <li
              key={app.name}
              className='rounded-lg border p-4 hover:shadow-md'
            >
              <div className='mb-8 flex items-center justify-between'>
                <div
                  className={`flex size-10 items-center justify-center rounded-lg bg-muted p-2`}
                >
                  {app.logo}
                </div>
                {app.name === 'DogeSCM' ? (
                  <ConnectDogeSCMDialog
                    connected={app.connected}
                    onConnected={() =>
                      setConnectedApps((prev) => ({
                        ...prev,
                        [app.name]: true,
                      }))
                    }
                  />
                ) : (
                  <Button
                    variant='outline'
                    size='sm'
                    className={`${app.connected ? 'border border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900' : ''}`}
                  >
                    {app.connected ? 'Connected' : 'Connect'}
                  </Button>
                )}
              </div>
              <div>
                <h2 className='mb-1 font-semibold'>{app.name}</h2>
                {/* Semantic token, not `text-gray-500`: the palette value kept
                    the same foreground in both themes and fell under 4.5:1 on
                    the dark background. */}
                <p className='line-clamp-2 text-muted-foreground'>{app.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </Main>
    </>
  )
}

import React from 'react'
import PurpleIcon from '../PurpleIcon'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

type Props = {
  heading?: string 
  mainIcon: React.ReactNode 
  leftIcon: React.ReactNode 
  rightIcon: React.ReactNode 
  children?: React.ReactNode 
  placeholder?: string
  /** Replaces the default search input (e.g. room MultiSelect on Messages). */
  searchControl?: React.ReactNode
  /** Hide the search row entirely (e.g. lead profile). */
  hideSearch?: boolean
}

const PageHeader = ({ 
  heading, 
  mainIcon, 
  leftIcon, 
  rightIcon, 
  children, 
  placeholder,
  searchControl,
  hideSearch = false,
}: Props) => {
  const showSearchRow = !hideSearch || Boolean(children)

  return (
    <div className="flex w-full shrink-0 flex-col gap-8">
      <div className="w-full flex justify-center sm:justify-between items-center gap-8 flex-wrap">
        <p className="text-primary text-4xl font-semibold">{heading}</p>
        <div className="relative md:mr-28">
          <PurpleIcon className="absolute -left-4 -top-3 -z-10 -rotate-45 py-3">{leftIcon}
          </PurpleIcon>
          <PurpleIcon className="z-10 backdrop-blue">{mainIcon}
          </PurpleIcon>
          <PurpleIcon className="absolute -right-4 -z-10 py-3 rotate-45 -top-3">{rightIcon}
          </PurpleIcon>
        </div>
      </div>
      {showSearchRow ? (
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-3">
          {!hideSearch ? (
            <div className="relative min-w-0 flex-1">
              {searchControl ?? (
                <>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    type="text"
                    placeholder={placeholder || 'Search...'}
                    className="h-10 rounded-md pl-10"
                  />
                </>
              )}
            </div>
          ) : null}
          {children ? (
            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 md:w-auto">
              {children}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default PageHeader
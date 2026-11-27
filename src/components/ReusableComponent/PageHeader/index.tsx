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
  /** Shorter title for phones (e.g. "Your Leads"); `heading` is used from sm up. */
  mobileHeading?: string
  /**
   * Phones only: shown on the title row, right-aligned (e.g. a view toggle). When set, `children`
   * are hidden on phones so the same control is not shown twice.
   */
  mobileAside?: React.ReactNode
  /** Hide the search row on phones (e.g. when the page has its own filter below). */
  hideSearchOnMobile?: boolean
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
  mobileHeading,
  mobileAside,
  hideSearchOnMobile = false,
}: Props) => {
  const showSearchRow = !hideSearch || Boolean(children)
  // Nothing left in the row on phones: drop the row itself so it leaves no gap.
  const rowHiddenOnPhone = hideSearchOnMobile && (!children || Boolean(mobileAside))

  return (
    <div className="flex w-full shrink-0 flex-col gap-5 sm:gap-8">
      <div className="w-full flex justify-between items-center gap-3 sm:gap-8 flex-wrap">
        <p className="text-primary text-2xl sm:text-4xl font-semibold break-words">
          {mobileHeading ? (
            <>
              <span className="sm:hidden">{mobileHeading}</span>
              <span className="hidden sm:inline">{heading}</span>
            </>
          ) : (
            heading
          )}
        </p>
        {mobileAside ? <div className="shrink-0 sm:hidden">{mobileAside}</div> : null}
        {/* Decorative icon cluster: hidden on phones, where vertical space matters more. */}
        <div className="relative hidden sm:block md:mr-28">
          <PurpleIcon className="absolute -left-4 -top-3 -z-10 -rotate-45 py-3">{leftIcon}
          </PurpleIcon>
          <PurpleIcon className="z-10 backdrop-blue">{mainIcon}
          </PurpleIcon>
          <PurpleIcon className="absolute -right-4 -z-10 py-3 rotate-45 -top-3">{rightIcon}
          </PurpleIcon>
        </div>
      </div>
      {showSearchRow ? (
        <div
          className={`${rowHiddenOnPhone ? 'hidden sm:flex' : 'flex'} w-full flex-col gap-3 md:flex-row md:items-center md:gap-3`}
        >
          {!hideSearch ? (
            <div className={`relative min-w-0 flex-1 ${hideSearchOnMobile ? 'hidden sm:block' : ''}`}>
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
            <div
              // Without a search box the controls get the whole row (so one can sit at the far right).
              className={`${mobileAside ? 'hidden sm:flex' : 'flex'} w-full shrink-0 flex-wrap items-center justify-end gap-2 ${hideSearch ? 'md:flex-1' : 'md:w-auto'}`}
            >
              {children}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default PageHeader
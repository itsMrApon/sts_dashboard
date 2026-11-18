'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

/** A single row in the list. */
export interface Category {
  id: string | number
  title: string
  subtitle?: string
  icon?: React.ReactNode
  onClick?: () => void
  /** Larger title (e.g. the first or most important item). */
  featured?: boolean
  /** Small label next to the title (status, type…). */
  badge?: React.ReactNode
  /**
   * A button on the right of the row (e.g. delete), in place of the icon. Shown on hover or
   * selection; always shown on touch screens. Rendered outside the row button (no nested buttons).
   */
  action?: React.ReactNode
}

export interface CategoryListProps {
  title: string
  subtitle?: string
  categories: Category[]
  headerIcon?: React.ReactNode
  className?: string
  /** The selected row: drawn like a hovered row (expanded, bracketed, primary). */
  activeId?: string | number | null
  /** Tighter header and rows, for sidebars. */
  compact?: boolean
  /** Shown between the header and the rows (buttons, search…). */
  toolbar?: React.ReactNode
  /** Shown under the rows (e.g. an "add" button). */
  footer?: React.ReactNode
  /** Shown instead of the rows when there are none. */
  empty?: React.ReactNode
  /** A small control at the end of the header row (compact only), e.g. a collapse button. */
  headerAction?: React.ReactNode
  /** Extra classes for each row box (e.g. a darker fill on a tinted surface). */
  rowClassName?: string
}

/**
 * A list of large, tappable rows. Hovering (or selecting) a row expands it, draws corner
 * brackets and reveals its icon.
 */
export const CategoryList = ({
  title,
  subtitle,
  categories,
  headerIcon,
  className,
  activeId = null,
  compact = false,
  toolbar,
  footer,
  empty,
  headerAction,
  rowClassName,
}: CategoryListProps) => {
  const [hoveredItem, setHoveredItem] = useState<string | number | null>(null)

  return (
    <div className={cn('w-full bg-background p-8 text-foreground', compact && 'p-4', className)}>
      <div className={cn('mx-auto max-w-4xl', compact && 'max-w-none')}>
        {/* Header */}
        <div className={cn('mb-12 text-center md:mb-16', compact && 'mb-4 flex items-center gap-3 text-left md:mb-4')}>
          {headerIcon && (
            <div
              className={cn(
                'mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground',
                compact && 'mb-0 h-10 w-10 shrink-0',
              )}
            >
              {headerIcon}
            </div>
          )}
          <div className={cn(compact && headerAction && 'min-w-0 flex-1')}>
            <h1 className={cn('mb-2 text-4xl font-bold tracking-tight md:text-5xl', compact && 'mb-0 text-lg leading-tight md:text-lg')}>{title}</h1>
            {subtitle && (
              <h2 className={cn('text-4xl font-bold text-muted-foreground md:text-5xl', compact && 'text-lg leading-tight md:text-lg')}>{subtitle}</h2>
            )}
          </div>
          {compact && headerAction ? <div className="shrink-0 self-start">{headerAction}</div> : null}
        </div>

        {toolbar}

        {/* Rows */}
        {categories.length === 0 ? empty : null}
        <div className={cn('space-y-3', compact && 'space-y-2')}>
          {categories.map((category) => {
            const lit = hoveredItem === category.id || activeId === category.id
            return (
              <div
                key={category.id}
                className="group relative"
                onMouseEnter={() => setHoveredItem(category.id)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <button
                  type="button"
                  onClick={category.onClick}
                  onFocus={() => setHoveredItem(category.id)}
                  onBlur={() => setHoveredItem(null)}
                  aria-current={activeId === category.id ? 'true' : undefined}
                  className={cn(
                    'relative block w-full cursor-pointer overflow-hidden border bg-card text-left transition-all duration-300 ease-in-out focus-visible:outline-none',
                    rowClassName,
                    lit
                      ? cn('border-primary bg-primary/5 shadow-lg shadow-primary/20', compact ? 'h-24' : 'h-32')
                      : cn('border-border hover:border-primary/50', compact ? 'h-[4.5rem]' : 'h-24'),
                  )}
                >
                  {/* Corner brackets */}
                  {lit && (
                    <>
                      <span aria-hidden className="absolute left-3 top-3 h-6 w-6">
                        <span className="absolute left-0 top-0 h-0.5 w-4 bg-primary" />
                        <span className="absolute left-0 top-0 h-4 w-0.5 bg-primary" />
                      </span>
                      <span aria-hidden className="absolute bottom-3 right-3 h-6 w-6">
                        <span className="absolute bottom-0 right-0 h-0.5 w-4 bg-primary" />
                        <span className="absolute bottom-0 right-0 h-4 w-0.5 bg-primary" />
                      </span>
                    </>
                  )}

                  <span
                    className={cn(
                      'flex h-full items-center justify-between gap-3 px-6 md:px-8',
                      compact && 'px-5 md:px-5',
                      category.action && (compact ? 'pr-12 md:pr-12' : 'pr-16 md:pr-16'),
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'truncate font-bold transition-colors duration-300',
                            category.featured
                              ? compact
                                ? 'text-lg'
                                : 'text-2xl md:text-3xl'
                              : compact
                                ? 'text-base'
                                : 'text-xl md:text-2xl',
                            lit ? 'text-primary' : 'text-foreground',
                          )}
                        >
                          {category.title}
                        </span>
                        {category.badge}
                      </span>
                      {category.subtitle && (
                        <span
                          className={cn(
                            'mt-1 block truncate text-sm transition-colors duration-300 md:text-base',
                            compact && 'text-xs md:text-xs',
                            lit ? 'text-foreground/90' : 'text-muted-foreground',
                          )}
                        >
                          {category.subtitle}
                        </span>
                      )}
                    </span>

                    {/* Icon appears on hover / selection (unless the row has an action there) */}
                    {category.icon && lit && !category.action && (
                      <span className="text-primary transition-opacity duration-300 animate-in fade-in">{category.icon}</span>
                    )}
                  </span>
                </button>
                {category.action ? (
                  <span
                    className={cn(
                      'absolute right-3 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-300',
                      lit ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
                    )}
                  >
                    {category.action}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
        {footer}
      </div>
    </div>
  )
}

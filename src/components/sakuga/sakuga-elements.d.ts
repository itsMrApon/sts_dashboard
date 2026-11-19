import type * as React from 'react'

type SakugaProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  class?: string
  disabled?: boolean
  [attribute: `data-${string}`]: string | undefined
}

/** The Sakuga custom elements (public/sakuga-vfx), so they can be used in JSX. */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sakuga-button': SakugaProps & { variant?: 'secondary'; type?: string }
      'sakuga-toggle': SakugaProps & { checked?: boolean; label?: string; name?: string; value?: string }
      'sakuga-tabs': SakugaProps & { label?: string; selected?: number | string }
      'sakuga-progress': SakugaProps & { label?: string; value?: number | string; demo?: boolean }
      'sakuga-toast': SakugaProps & { duration?: number | string }
      'sakuga-input': SakugaProps & Record<string, unknown>
      'sakuga-tooltip': SakugaProps & { side?: string }
    }
  }
}

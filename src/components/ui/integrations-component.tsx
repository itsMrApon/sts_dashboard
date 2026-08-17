import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

export function IntegrationCard({
  title,
  description,
  children,
  link,
  cta = 'Learn More',
  badge,
  aside,
}: {
  title: string
  description: string
  children: React.ReactNode
  link: string
  cta?: string
  badge?: string
  aside?: React.ReactNode
}) {
  return (
    <Card className="p-6">
      <div className="relative">
        <div className="*:size-10">{children}</div>

        <div className="space-y-2 py-6">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium">{title}</h3>
            {badge ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground line-clamp-2 text-sm">{description}</p>
        </div>

        <div className="flex flex-wrap items-start gap-3 border-t border-dashed pt-6">
          <Button asChild variant="secondary" size="sm" className="gap-1 pr-2 shadow-none">
            <Link href={link}>
              {cta}
              <ChevronRight className="ml-0 !size-3.5 opacity-50" />
            </Link>
          </Button>
          {aside}
        </div>
      </div>
    </Card>
  )
}

export default function IntegrationsSection({
  heading,
  description,
  action,
  children,
}: {
  heading: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="py-8 md:py-16">
        <div className="mx-auto max-w-5xl px-2 sm:px-6">
          <div className="text-center">
            <h2 className="text-balance text-3xl font-semibold md:text-4xl">{heading}</h2>
            <p className="text-muted-foreground mt-6">{description}</p>
            {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
        </div>
      </div>
    </section>
  )
}

import { Badge } from '@/components/ui/badge'

type Props = {
  source: string
}

export const LeadSourceBadge = ({ source }: Props) => {
  switch (source) {
    case 'GOOGLE_MAPS':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">Google Maps</Badge>
    case 'GOOGLE_SEARCH':
      return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-xs">Google Search</Badge>
    case 'LINKEDIN':
      return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs">LinkedIn</Badge>
    case 'INSTAGRAM':
      return <Badge className="bg-pink-500/10 text-pink-500 border-pink-500/20 text-xs">Instagram</Badge>
    case 'PROJECT':
      return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">Project</Badge>
    case 'PRODUCT':
      return <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 text-xs">Product</Badge>
    case 'WEBINAR':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">Project / product</Badge>
    case 'MANUAL':
      return <Badge variant="outline" className="text-xs">Manual</Badge>
    default:
      return <Badge variant="outline" className="text-xs">{source}</Badge>
  }
}

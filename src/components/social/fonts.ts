import { Geist, Geist_Mono } from 'next/font/google'

/** The diagram-design type pair: names in Geist, technical labels in Geist Mono. Used by SocialDiagram. */
export const diagramSans = Geist({ subsets: ['latin'], variable: '--font-dd-sans', display: 'swap' })
export const diagramMono = Geist_Mono({ subsets: ['latin'], variable: '--font-dd-mono', display: 'swap' })

/** Put on any wrapper around SocialDiagram: the palette variables and both font variables. */
export const diagramThemeClass = `dd-theme ${diagramSans.variable} ${diagramMono.variable}`

export type Project = {
  name: string
  description: string
  href: string
}

export const PROJECTS: Project[] = [
  {
    name: 'Superstream',
    description: 'A Solana-based protocol for real-time streaming payments',
    href: 'https://superstream.finance/',
  },
  {
    name: 'garvitpahal.com',
    description: 'My personal website. You are here',
    href: 'https://garvitpahal.com/',
  },
  {
    name: 'jslib',
    description: 'JS/TS libraries and configs I use in my personal projects',
    href: 'https://github.com/gpahal/jslib',
  },
  {
    name: 'golib',
    description: 'Go libraries that I use in my projects',
    href: 'https://github.com/gpahal/golib',
  },
  {
    name: 'hgraph',
    description: 'Graph datastore implemented in Haskell',
    href: 'https://github.com/gpahal/hgraph',
  },
  {
    name: 'solana-fellowship',
    description: 'Stuff I worked on as part of the Solana Fellowship',
    href: 'https://github.com/gpahal/solana-fellowship',
  },
  {
    name: 'go-algos',
    description: 'Common data structures, algorithms and design patterns in Go',
    href: 'https://github.com/gpahal/go-algos',
  },
  {
    name: 'kvs',
    description: 'A go interface for kv stores with an in-memory implementation',
    href: 'https://github.com/gpahal/kvs',
  },
  {
    name: 'head',
    description: 'A go library for parsing information in a HTML head tag',
    href: 'https://github.com/gpahal/head',
  },
]

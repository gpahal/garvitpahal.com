import type { Metadata } from 'next'

import { generatePageMetadata } from '@/lib/metadata'
import { H1, H2 } from '@/components/lib/heading'
import { Link } from '@/components/lib/link'

export const runtime = 'edge'

export const metadata: Metadata = generatePageMetadata({
  pathname: '/uses',
  title: 'Tech stack - Garvit Pahal',
})

export default function UsesPage() {
  return (
    <>
      <header className="mb-5">
        <H1>Tech Stack</H1>
      </header>
      <div className="prose">
        <p>
          This is rough list of the products I use daily as a software engineer. Check out{' '}
          <Link href="https://uses.tech/">uses.tech</Link> for a list of other people&apos;s /uses pages!
        </p>
        <p>
          There was a time in my early 20&apos;s when I used to enjoy building my own desktop and OS from scratch. I
          still enjoy tinkering with new tech but I depend on a simple setup so that I focus more on my work.
        </p>
        <p></p>
        <H2>Hardware</H2>
        <ul>
          <li>
            Laptop: <Link href="https://a.co/d/8kU4wFO">MacBook Pro M1 14&quot;</Link>
          </li>
          <li>
            Monitor:{' '}
            <Link href="https://www.dellstore.com/dell-27-4k-uhd-usb-c-monitor-s2722qc.html">
              Dell S2722QC 27-inch 4K UHD
            </Link>
          </li>
          <li>
            Keyboard:{' '}
            <Link href="https://www.logitech.com/products/combos/mk850-wireless-keyboard-mouse.920-008229.html">
              Logitech MK850 Performance Wireless
            </Link>
          </li>
          <li>
            Mouse:{' '}
            <Link href="https://www.logitech.com/products/mice/mx-master-3s.910-006561.html">
              Logitech MX Master 3 Wireless
            </Link>
          </li>
          <li>
            Headphones:{' '}
            <Link href="https://www.bose.com/products/headphones/noise_cancelling_headphones/quietcomfort-headphones-45.html">
              Bose QuietComfort 45 Wireless
            </Link>
          </li>
        </ul>
        <H2>Development Tools</H2>
        <ul>
          <li>
            IDE: <Link href="https://www.jetbrains.com/idea/">IntelliJ IDEA</Link> and{' '}
            <Link href="https://code.visualstudio.com/">VS Code</Link>
          </li>
          <li>
            Code management: <Link href="https://github.com/">Github</Link>
          </li>
          <li>
            AI assistant: <Link href="https://github.com/features/copilot">GitHub Copilot</Link>
          </li>
          <li>
            API testing: <Link href="https://www.postman.com/">Postman</Link>
          </li>
        </ul>
        <H2>Design tools</H2>
        <ul>
          <li>
            Interface design: <Link href="https://www.figma.com/">Figma</Link>
          </li>
          <li>
            Graphic design: <Link href="https://www.canva.com/">Canva</Link>
          </li>
        </ul>
        <H2>Productivity tools</H2>
        <ul>
          <li>
            Knowledge base: <Link href="https://www.notion.so/">Notion</Link>
          </li>
          <li>
            Task management: <Link href="https://linear.app/">Linear</Link>
          </li>
          <li>
            Email: <Link href="https://mail.google.com/">Gmail</Link>
          </li>
          <li>
            Calendar: <Link href="https://calendar.google.com/">Google Calendar</Link> and{' '}
            <Link href="https://cron.com/">Cron</Link>
          </li>
          <li>
            File management and backup: <Link href="https://drive.google.com/">Google Drive</Link> and{' '}
            <Link href="https://www.dropbox.com/">Dropbox</Link>
          </li>
        </ul>
        <H2>Misc</H2>
        <ul>
          <li>
            Browser: <Link href="https://arc.net/">Arc</Link>
          </li>
          <li>
            DNS: <Link href="https://1.1.1.1/">WARP by Cloudflare</Link>
          </li>
          <li>
            Window manager: <Link href="https://magnet.crowdcafe.com/">Magnet</Link>
          </li>
          <li>
            Break reminders: <Link href="https://www.dejal.com/timeout/">Time Out</Link>
          </li>
          <li>
            Blue light filter: <Link href="https://justgetflux.com/">f.lux</Link>
          </li>
        </ul>
      </div>
    </>
  )
}

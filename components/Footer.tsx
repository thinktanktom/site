import Image from 'next/image'
import { Github, Linkedin, ExternalLink, Twitter } from 'lucide-react'

function TelegramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  )
}

const links = [
  {
    href: 'https://github.com/thinktanktom',
    label: 'GitHub',
    Icon: Github,
  },
  {
    href: 'https://linkedin.com/in/thinktanktom',
    label: 'LinkedIn',
    Icon: Linkedin,
  },
  {
    href: 'https://x.com/th1nktanktom',
    label: 'Twitter',
    Icon: Twitter,
  },
  {
    href: 'https://t.me/th1nktanktom',
    label: 'Telegram',
    Icon: TelegramIcon,
  },
  {
    href: 'https://www.upwork.com/freelancers/~018a1dbf1094588c7e',
    label: 'Upwork',
    Icon: ExternalLink,
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-chrome mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/ttt_icon.svg"
            alt="thinktanktom"
            width={24}
            height={24}
            className="object-contain"
            unoptimized
          />
          <p className="font-mono text-sm text-muted tracking-wider">
            © {new Date().getFullYear()} thinktanktom
          </p>
        </div>
        <div className="flex items-center gap-6">
          {links.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-accent transition-colors duration-200"
              aria-label={label}
            >
              <Icon size={18} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}

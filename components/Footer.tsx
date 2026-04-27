import { Github, Linkedin, ExternalLink } from 'lucide-react'

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
    href: 'https://www.upwork.com/freelancers/thinktanktom',
    label: 'Upwork',
    Icon: ExternalLink,
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-chrome mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-mono text-sm text-muted tracking-wider">
          © 2025 ThinkTankTom
        </p>
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

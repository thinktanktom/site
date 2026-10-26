export interface ExperienceEntry {
  role: string
  org?: string
  orgLink?: string
  start: string // e.g. "Jun 2020"
  end: string // e.g. "Jul 2020" or "Present"
  summary: string
  stack: string[]
  link?: { href: string; label: string }
}

// Curated from a private work-history record — short consultations are
// merged or omitted for readability; financial figures are left out.
// Direct clients and named companies below; standalone Upwork-channel
// engagements are grouped separately in `upworkProjects`.
//
// Order is now plain reverse-chronological by `start`, because /work sorts it
// that way regardless (lib/work.ts) and two orderings disagreeing was just a
// trap. It used to be "deliberate (BankX and the AI orchestration role lead)",
// which stopped making sense when BankX ended.
//
// Reconciled against the work-experience record (draft 9, 26 Oct 2026) on
// 2026-10-26. Three changes from that pass:
//   - BankX ENDED Dec 2025. It is no longer the lead entry and no longer
//     "Present"; the Upwork contract is still open only because the client
//     still pays through it, which is not the engagement.
//   - The single "AI Agent-Orchestration Engineer / Independent client /
//     Apr 2026" entry was a conflation of two engagements for the SAME client
//     as BankX, and the start date was wrong. It is now LockBox
//     (Jan – Jul 2026) and AgentXSD (Jul 2026 – present).
//   - NOT represented here: the Community Outreach Ruflo droplet for the same
//     client. Its dates are an open item in the record, and a page sorted by
//     date cannot place an undated entry without inventing one.
export const experience: ExperienceEntry[] = [
  {
    role: 'AI Agent-Orchestration Engineer',
    org: 'AgentXSD',
    start: 'Jul 2026',
    end: 'Present',
    summary:
      'Built and hardened a dedicated self-hosted Claude Code / Ruflo box for AgentXSD, the component LockBox is deployed behind — plus a permanent run-control layer (one version at a time, locked plans, retry caps, human approval gates) after early runs fell into re-assessment loops, and a Claude Desktop extension so a non-technical client can drive it.',
    stack: ['Ruflo', 'Claude Code', 'MCP', 'Docker Compose', 'Caddy', 'MongoDB', 'DigitalOcean'],
    link: { href: '/projects/RufloOrchestration/introduction', label: 'Project writeup' },
  },
  {
    role: 'Trading Infrastructure Engineer',
    org: 'Independent client',
    start: 'Jun 2026',
    end: 'Present',
    summary:
      'Signal-delivery infrastructure for a Micro E-mini S&P 500 futures bot: a Spring Boot webhook server queuing TradingView alerts, a Python polling client, and a Telegram notifier for trade and system events.',
    stack: ['Java', 'Spring Boot', 'SQLite', 'Python', 'Caddy'],
    link: { href: '/projects/FractalWebhook/introduction', label: 'Project writeup' },
  },
  {
    role: 'AI Payment System Engineer',
    org: 'LockBox',
    start: 'Jan 2026',
    end: 'Jul 2026',
    summary:
      'Developed a multi-asset, multi-chain AI payment system — policy engine, LockScript compiler, ZKP circuits and SDKs — almost entirely through Ruflo agent orchestration, generating the agents, skills and instruction files for the build. All components finished and tested; deployment waits on the AgentXSD integration.',
    stack: ['Ruflo', 'Anthropic Claude', 'Claude Code', 'MCP', 'DigitalOcean'],
  },
  {
    role: 'Network Engineer',
    org: 'Ctrlbit',
    orgLink: 'https://ctrlbit.com',
    start: 'Jun 2024',
    end: 'Nov 2024',
    summary:
      'Co-built an SD-WAN product for MikroTik hardware with a family friend — dual-SIM failover via GenieACS/TR-069 and a guide for network-booting OpenWRT onto RouterBOARD devices. The venture wound down after import-tax changes on the hardware.',
    stack: ['MikroTik RouterOS', 'OpenWRT', 'GenieACS', 'Node.js'],
    link: { href: '/projects/CtrlbitSDWAN', label: 'Project writeup' },
  },
  {
    role: 'Lead Smart Contract Engineer',
    org: 'BankX Protocol',
    orgLink: 'https://bankx.io',
    start: 'Oct 2021',
    end: 'Dec 2025',
    summary:
      'Wrote and deployed the XSD/BankX contract suite — a silver-pegged stablecoin with no liquidations, PID-controlled collateral ratios, and protocol-owned liquidity — live across 8 chains and covered by CoinFabrik and independent audits plus an active Immunefi bug bounty. Four years as the sole contract engineer, closing in Dec 2025.',
    stack: ['Solidity', 'Hardhat', 'Foundry', 'Chainlink', 'OpenZeppelin'],
    link: { href: '/projects/BankX/introduction', label: 'Project writeup' },
  },
  {
    role: 'Blockchain Developer',
    org: 'Nord Finance',
    start: 'Jul 2021',
    end: 'Sep 2021',
    summary:
      'Wrote automated test suites for the DeFi contracts behind Nord Finance’s interest-bearing savings products — deposits, withdrawals, yield accounting, access control — using local and mainnet-forked environments. Contributed to the design of a decentralized loan application.',
    stack: ['Solidity', 'Hardhat', 'Ganache'],
  },
  {
    role: 'Deep Learning Research Engineer',
    org: 'Lambda Vision',
    start: 'Oct 2020',
    end: 'Feb 2021',
    summary:
      'Ported an open-source visible-watermark detection and removal model to TensorFlow 2.x, then concluded the approach wasn’t accurate enough to ship and moved on.',
    stack: ['Python', 'TensorFlow'],
  },
  {
    role: 'Deep Learning Engineer',
    org: 'Appcilious',
    start: 'Aug 2020',
    end: 'Sep 2020',
    summary:
      'Built and deployed an AI background-removal web app on the U-2-Net segmentation model, containerized and shipped to Heroku and AWS EC2.',
    stack: ['Python', 'PyTorch', 'Docker', 'Flask'],
    link: { href: '/projects/BackgroundRemovalApp', label: 'Project writeup' },
  },
  {
    role: 'Machine Learning Engineer',
    org: 'GIEOM',
    start: 'Jun 2020',
    end: 'Jul 2020',
    summary:
      'Built a face-alignment pipeline for a KYC product (rotation correction via dlib facial landmarks) and an LDA topic-modelling pipeline for document analysis.',
    stack: ['Python', 'dlib', 'OpenCV'],
    link: { href: '/projects/KYCFaceAlignment', label: 'Project writeup' },
  },
]

// Standalone engagements sourced through Upwork, newest first.
export const upworkProjects: ExperienceEntry[] = [
  {
    role: 'React → Shopify Liquid Migration',
    start: 'Feb 2026',
    end: 'work completed',
    summary:
      'Migrated a client’s React storefront to a custom Shopify Liquid theme with GitHub-integrated deploys.',
    stack: ['React', 'TypeScript', 'Shopify Liquid', 'Vite'],
    link: { href: 'https://github.com/thinktanktom/OREA', label: 'GitHub' },
  },
  {
    role: 'Based Agents — Smart Contract Suite',
    start: 'Jul 2024',
    end: 'Feb 2025',
    summary:
      'Built and deployed the Based Agents contract suite — Protocol Rewards, Bonding Curve, Bag Token, Bag Governance, and an upgradeable Bag Factory — with Hardhat tests run against a mainnet fork.',
    stack: ['Solidity', 'Hardhat', 'Sepolia'],
    /* Points at the writeup, not the repo, so lib/work.ts's generic
       "an entry whose link goes into /projects/ owns that writeup" rule absorbs
       it like the other six. This was the last project needing a hand-written
       pairing; changed 2026-10-26 so that no pairing table is needed at all.
       The repo is not lost -- content/projects/BasedAgents.mdx carries it as
       `github`, and lib/work.ts surfaces that alongside the writeup link. */
    link: { href: '/projects/BasedAgents/introduction', label: 'Project writeup' },
  },
  {
    role: 'Rust / Soroban Smart Contract Engineer',
    start: 'Aug 2023',
    end: 'Jul 2024',
    summary:
      'Fixed bugs across two contracts in a client’s Stellar Soroban codebase, deployed to Stellar and Futurenet, and trained their team to deploy and operate it themselves.',
    stack: ['Rust', 'Stellar Soroban'],
  },
  {
    role: 'Perpetual Futures Platform + NFT Marketplace',
    start: 'Jan 2022',
    end: 'Jan 2023',
    summary:
      'Solidity work on a decentralized perpetual futures platform, plus an end-to-end NFT marketplace build — asset pinning via IPFS/Pinata through to an OpenSea listing.',
    stack: ['Solidity', 'BSC', 'IPFS'],
  },
  {
    role: 'Hashmasks-Style NFT Clone',
    start: 'Aug 2021',
    end: 'Jan 2022',
    summary:
      'Built a Hashmasks-style NFT project, recreating its on-chain randomization algorithm, and deployed it to BSC.',
    stack: ['Solidity', 'BSC'],
    link: { href: 'https://github.com/thinktanktom/onchain-randomization', label: 'GitHub' },
  },
  {
    role: 'Early Freelance Solidity Engineering',
    start: 'Apr 2021',
    end: 'Jul 2021',
    summary:
      'Early smart contract freelancing across several short contracts: a mint/burn ERC-20 token, a BSC staking and lending contract integrating Venus Protocol and PancakeSwap, and a BEP-20 reflection token forked from RFI.',
    stack: ['Solidity', 'BSC', 'Truffle'],
  },
]

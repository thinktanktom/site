export interface ExperienceEntry {
  role: string
  org: string
  orgLink?: string
  start: string // e.g. "Jun 2020"
  end: string // e.g. "Jul 2020" or "Present"
  summary: string
  stack: string[]
  link?: { href: string; label: string }
}

// Newest first. Curated from a private work-history record — short
// consultations and near-duplicate short Upwork jobs are merged or
// omitted for readability; financial figures are left out.
export const experience: ExperienceEntry[] = [
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
    role: 'AI Agent-Orchestration Engineer',
    org: 'LockBox (client)',
    start: 'Apr 2026',
    end: 'Present',
    summary:
      'Built, deployed, and hardened self-hosted Claude Code / Ruflo agent-orchestration servers the client uses to develop a multi-chain asset platform — plus a permanent run-control layer (locked plans, retry caps, human approval gates) after early runs fell into re-assessment loops.',
    stack: ['Ruflo', 'Claude Code', 'MCP', 'Docker Compose', 'Caddy', 'DigitalOcean'],
    link: { href: '/projects/LockBox/introduction', label: 'Project writeup' },
  },
  {
    role: 'React → Shopify Liquid Migration',
    org: 'Upwork client',
    start: 'Feb 2026',
    end: 'work completed',
    summary:
      'Migrated a client’s React storefront to a custom Shopify Liquid theme with GitHub-integrated deploys.',
    stack: ['React', 'TypeScript', 'Shopify Liquid', 'Vite'],
  },
  {
    role: 'Smart Contract Engineer',
    org: 'Based Agents',
    start: 'Jul 2024',
    end: 'Feb 2025',
    summary:
      'Built and deployed the Based Agents contract suite — Protocol Rewards, Bonding Curve, Bag Token, Bag Governance, and an upgradeable Bag Factory — with Hardhat tests run against a mainnet fork.',
    stack: ['Solidity', 'Hardhat', 'Sepolia'],
    link: { href: 'https://github.com/BasedAgents/smart-contracts', label: 'GitHub' },
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
  },
  {
    role: 'Rust / Soroban Smart Contract Engineer',
    org: 'Upwork client',
    start: 'Aug 2023',
    end: 'Jul 2024',
    summary:
      'Fixed bugs across two contracts in a client’s Stellar Soroban codebase, deployed to Stellar and Futurenet, and trained their team to deploy and operate it themselves.',
    stack: ['Rust', 'Stellar Soroban'],
  },
  {
    role: 'Lead Smart Contract Engineer',
    org: 'BankX Protocol',
    orgLink: 'https://bankx.io',
    start: 'Oct 2021',
    end: 'Present',
    summary:
      'Wrote and deployed the XSD/BankX contract suite — a silver-pegged stablecoin with no liquidations, PID-controlled collateral ratios, and protocol-owned liquidity — live across 8 chains and covered by CoinFabrik and independent audits plus an active Immunefi bug bounty. Implementation and testing are mine; the protocol’s economic design is the founding team’s.',
    stack: ['Solidity', 'Hardhat', 'Foundry', 'Chainlink', 'OpenZeppelin'],
    link: { href: '/projects/BankX/introduction', label: 'Project writeup' },
  },
  {
    role: 'Blockchain Developer',
    org: 'Upwork client',
    start: 'Jan 2022',
    end: 'Jan 2023',
    summary:
      'Solidity work on a decentralized perpetual futures platform, plus an end-to-end NFT marketplace build — asset pinning via IPFS/Pinata through to an OpenSea listing.',
    stack: ['Solidity', 'BSC', 'IPFS'],
  },
  {
    role: 'Smart Contract Engineer',
    org: 'Upwork client',
    start: 'Aug 2021',
    end: 'Jan 2022',
    summary:
      'Built a Hashmasks-style NFT project, recreating its on-chain randomization algorithm, and deployed it to BSC.',
    stack: ['Solidity', 'BSC'],
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
    role: 'Freelance Solidity Engineer',
    org: 'Upwork (various clients)',
    start: 'Apr 2021',
    end: 'Jul 2021',
    summary:
      'Early smart contract freelancing: a mint/burn ERC-20 token, a BSC staking and lending contract integrating Venus Protocol and PancakeSwap, and a BEP-20 reflection token forked from RFI.',
    stack: ['Solidity', 'BSC', 'Truffle'],
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
  },
  {
    role: 'Machine Learning Engineer',
    org: 'GIEOM',
    start: 'Jun 2020',
    end: 'Jul 2020',
    summary:
      'Built a face-alignment pipeline for a KYC product (rotation correction via dlib facial landmarks) and an LDA topic-modelling pipeline for document analysis.',
    stack: ['Python', 'dlib', 'OpenCV'],
  },
]

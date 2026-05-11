// Client-safe: no Node.js imports. Contains only the static sidebar structure.

export interface SidebarLeaf {
  title: string
  slug: string[]
}

export interface SidebarGroup {
  title: string
  items: SidebarLeaf[]
}

export type SidebarEntry = SidebarLeaf | SidebarGroup

export function isSidebarGroup(entry: SidebarEntry): entry is SidebarGroup {
  return 'items' in entry
}

export const sidebarNav: SidebarEntry[] = [
  { title: 'Introduction', slug: ['introduction'] },
  {
    title: 'Concepts',
    items: [
      { title: 'Silver Peg', slug: ['concepts', 'silver-peg'] },
      { title: 'Collateral Ratio', slug: ['concepts', 'collateral-ratio'] },
      { title: 'ICDC', slug: ['concepts', 'icdc'] },
      { title: 'Interest Accrual', slug: ['concepts', 'interest-accrual'] },
      { title: 'Protocol-Owned Liquidity', slug: ['concepts', 'protocol-owned-liquidity'] },
    ],
  },
  {
    title: 'Contracts',
    items: [
      { title: 'XSD Stablecoin', slug: ['contracts', 'xsd-stablecoin'] },
      { title: 'BankX Token', slug: ['contracts', 'bankx-token'] },
      { title: 'Collateral Pool', slug: ['contracts', 'collateral-pool'] },
      { title: 'PID Controller', slug: ['contracts', 'pid-controller'] },
      { title: 'Reward Manager', slug: ['contracts', 'reward-manager'] },
      { title: 'Router', slug: ['contracts', 'router'] },
      { title: 'Pools', slug: ['contracts', 'pools'] },
      { title: 'Oracles', slug: ['contracts', 'oracles'] },
      { title: 'Treasury Pool', slug: ['contracts', 'treasury-pool'] },
      { title: 'Rules Engine', slug: ['contracts', 'rules-engine'] },
      { title: 'XSD Buy Function', slug: ['contracts', 'xsd-buy-function'] },
      { title: 'AI DeFi Broker', slug: ['contracts', 'aidefi-broker'] },
    ],
  },
  {
    title: 'Guides',
    items: [
      { title: 'Minting XSD', slug: ['guides', 'minting-xsd'] },
      { title: 'Redeeming XSD', slug: ['guides', 'redeeming-xsd'] },
      { title: 'Adding Collateral', slug: ['guides', 'adding-collateral'] },
      { title: 'Buyback & Burn', slug: ['guides', 'buyback-and-burn'] },
      { title: 'Staking Rewards', slug: ['guides', 'staking-rewards'] },
      { title: 'Using AI DeFi', slug: ['guides', 'using-aidefi'] },
    ],
  },
  {
    title: 'Security',
    items: [
      { title: 'Access Control', slug: ['security', 'access-control'] },
      { title: 'Reentrancy', slug: ['security', 'reentrancy'] },
      { title: 'Arbitrage Restrictions', slug: ['security', 'arbitrage-restrictions'] },
    ],
  },
  {
    title: 'AI DeFi',
    items: [
      { title: 'Overview', slug: ['aidefi', 'overview'] },
    ],
  },
  { title: 'Deployments', slug: ['deployments'] },
]

/**
 * Single source of truth for everything personal on the site.
 */
export const SITE = {
  firstName: 'Sayan',
  lastName: 'Naskar',
  title: 'Sayan Naskar',
  description: 'Personal notes, learning pages and diagrams.',
  /** One is picked at random for the footer on each page load. */
  taglines: [
    'Learning in public.',
    'Notes, drawn out.',
    'Thanks for reading!',
  ],
  url: 'https://nascarsayan.github.io',
  author: 'Sayan Naskar',
  copyrightStart: 2026,
};

export type NavLink = { label: string; href: string; description?: string };

export const NAV: NavLink[] = [
  { label: 'Pages', href: '/' },
  { label: 'Learn', href: '/learn/' },
  { label: 'Glossary', href: '/glossary/' },
  { label: 'About', href: '/about/' },
];

export const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/nascarsayan', icon: 'github' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nascarsayan/', icon: 'linkedin' },
] as const;

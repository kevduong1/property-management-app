import { Text } from 'react-native';

/**
 * Lightweight emoji-based icon set. Keeps the MVP dependency-free; can be
 * swapped for a vector icon font later without touching call sites.
 */
const ICONS: Record<string, string> = {
  grid: '▦',
  building: '🏢',
  layers: '🗂️',
  home: '🏠',
  door: '🚪',
  users: '👥',
  file: '📄',
  dollar: '💵',
  receipt: '🧾',
  wrench: '🔧',
  folder: '📁',
  chart: '📊',
  settings: '⚙️',
  plus: '＋',
  search: '🔍',
  filter: '⛃',
  back: '‹',
  chevron: '›',
  check: '✓',
  close: '✕',
  edit: '✎',
  trash: '🗑️',
  logout: '⏻',
  bell: '🔔',
  phone: '📞',
  mail: '✉️',
  calendar: '📅',
  bank: '🏦',
  key: '🔑',
};

export function Icon({
  name,
  size = 16,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <Text style={{ fontSize: size, lineHeight: size + 4 }} className={className}>
      {ICONS[name] ?? '•'}
    </Text>
  );
}

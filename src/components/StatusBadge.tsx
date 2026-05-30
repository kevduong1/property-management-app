import { Badge, type BadgeVariant } from '@/components/ui';

type StatusMap = Record<string, { label: string; variant: BadgeVariant }>;

/** Render a Badge from a status map keyed by enum value. */
export function StatusBadge({ map, value }: { map: StatusMap; value: string | null | undefined }) {
  if (!value) return null;
  const cfg = map[value] ?? { label: value, variant: 'muted' as BadgeVariant };
  return <Badge label={cfg.label} variant={cfg.variant} />;
}

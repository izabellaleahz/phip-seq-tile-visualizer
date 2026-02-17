const HOST_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  human: {
    bg: 'bg-blue-100 dark:bg-blue-900/50',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Human',
  },
  bat: {
    bg: 'bg-purple-100 dark:bg-purple-900/50',
    text: 'text-purple-700 dark:text-purple-300',
    label: 'Bat',
  },
  bird: {
    bg: 'bg-green-100 dark:bg-green-900/50',
    text: 'text-green-700 dark:text-green-300',
    label: 'Bird',
  },
};

export default function HostBadge({ host }: { host: string }) {
  const style = HOST_STYLES[host] || HOST_STYLES.human;
  return (
    <span
      className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

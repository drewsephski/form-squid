export function parseIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatResponseTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatUpdated(value: string, now = Date.now()) {
  const delta = now - new Date(value).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) {
    return "Updated just now";
  }
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

export function formatPublished(value: string, now = Date.now()) {
  const delta = now - new Date(value).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) {
    return "Published just now";
  }
  if (minutes < 60) {
    return `Published ${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Published ${hours}h ago`;
  }
  return `Published ${formatResponseTime(value)}`;
}

export function formatRelativeAgo(value: string, now = Date.now()) {
  const delta = Math.max(0, now - new Date(value).getTime());
  const seconds = Math.round(delta / 1000);
  if (seconds < 60) {
    return `${Math.max(seconds, 1)}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

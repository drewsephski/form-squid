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

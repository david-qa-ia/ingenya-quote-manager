/** SCRUM-117: show the search shortcut the way the current keyboard writes it. */
export function searchShortcutLabel(
  platform: string = typeof navigator === 'undefined'
    ? ''
    : `${navigator.platform} ${navigator.userAgent}`,
): string {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘ K' : 'Ctrl K';
}

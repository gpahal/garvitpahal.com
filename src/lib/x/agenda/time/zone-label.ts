/**
 * Such as "India Standard Time (Asia/Calcutta)", or the id alone for a zone this browser does not
 * know. UTC and its aliases read as "UTC" alone, since their name would only be an offset.
 */
export function zoneLabel(timeZone: string, now: number): string {
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longGeneric' })
  } catch {
    return timeZone
  }
  // `Intl` resolves every alias of UTC, `Etc/Zulu` and `Etc/GMT` among them, to `UTC`.
  if (format.resolvedOptions().timeZone === 'UTC') {
    return 'UTC'
  }
  const name = format.formatToParts(now).find((part) => part.type === 'timeZoneName')?.value
  return name === undefined || name === '' ? timeZone : `${name} (${timeZone})`
}

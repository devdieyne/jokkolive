/** Tiny classname concat utility — same pattern as the dashboard. */
export function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

/**
 * Tiny className combiner — accepts strings, undefineds and false-y values
 * and joins the truthy ones with a space. Avoids pulling in `clsx`.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(' ');
}

export function getGroupedTableToneClass(useAltTone: boolean): string {
  return useAltTone ? 'table-row-contrast-alt' : 'table-row-contrast-base';
}

export function getGroupedStickyToneClass(useAltTone: boolean): string {
  return useAltTone ? 'table-sticky-contrast-alt' : 'table-sticky-contrast-base';
}

export function getZebraTableToneClass(index: number): string {
  return index % 2 === 0 ? 'table-row-contrast-base' : 'table-row-contrast-alt';
}

export function getZebraStickyToneClass(index: number): string {
  return index % 2 === 0 ? 'table-sticky-contrast-base' : 'table-sticky-contrast-alt';
}

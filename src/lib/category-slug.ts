export function normalizeCategorySlug(value: string): string {
  return value.trim().toLowerCase().replace(/-+/g, '-');
}

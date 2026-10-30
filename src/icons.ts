// Ikon garis 24px yang dipakai bersama halaman peta dan halaman riset.
export const icons = {
  home: '<path d="m3 10 9-7 9 7v11H3z"/><path d="M9 21v-8h6v8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  train:
    '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M9 18l-2 3m8-3 2 3M9 14h.01M15 14h.01"/>',
  bus: '<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 11h16M8 3v8m8-8v8M7 15h.01M17 15h.01M7 19v2m10-2v2"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  research:
    '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M9 12h6M9 16h6M9 8h2"/>',
};
export function icon(name: keyof typeof icons): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

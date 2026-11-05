/** Di bawah 640px panel tampil sebagai bottom sheet; di atasnya sebagai popover melayang. */
export const isSheetViewport = () => typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches;

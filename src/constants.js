export const MIN_ZOOM_VALUE = 0.1;
export const MAX_ZOOM_VALUE = 1.5;
export const DEFAULT_ZOOM_VALUE = 1;

export const MIN_SPACING_SYSTEM_VALUE = 0;
export const MAX_SPACING_SYSTEM_VALUE = 48;
export const DEFAULT_SPACING_SYSTEM_VALUE = 4;

export const MIN_MEASURES_PER_LINE_VALUE = 0;
export const MAX_MEASURES_PER_LINE_VALUE = 16;
export const DEFAULT_MEASURES_PER_LINE_VALUE = 0;

export const LARGE_FILE_SIZE_WARNING_THRESHOLD_IN_BYTES = 3 * 1000 * 1000;

// Rough, adjustable safety ceiling: audio playback renders every note as an individually
// scheduled piano sample offline, which gets impractically slow for very large/dense pieces
// (e.g. full orchestral movements). Not derived from a precise measurement - tune based on
// real-world experience.
export const MAX_NOTE_COUNT_FOR_PLAYBACK = 800;

export const DEFAULT_HIGHLIGHT_COLOR_VALUE = '#00ff00';

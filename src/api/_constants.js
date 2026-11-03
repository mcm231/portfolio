// Valid tag values for portfolio entries. Update this list to add/remove tags.
export const TAGS = Object.freeze([
  // Portfolio categories
  "writing",
  "traditional-art",
  "digital-art",
  "programming",
  // Writing
  "photography",
  "videography",
  "music",
  "sound-design",
  "editing",
  "storytelling",
  "composition",
  "color-grading",
  // Traditional art
  "watercolor",
  "acrylics",
  "charcoal",
  "pencil",
  "ink",
  "pastels",
  "oil-paint",
  "gouache",
  // Digital art
  "illustration",
  "3d-modeling",
  "ui-ux",
  "animation",
  "concept-art",
  "graphic-design",
  "photo-editing",
  "digital-painting",
  // Programming
  "react",
  "python",
  "javascript",
  "typescript",
  "node",
  "django",
  "apis",
  "docker",
  // Other
  "games",
]);

export const TAGS_SET = new Set(TAGS);

export function isValidTag(tag) {
  return TAGS_SET.has(tag);
}

/**
 * Resource / Material metadata helpers for course notes and files.
 * Encodes protection permissions (View Only vs Allow Download) cleanly.
 */

export interface ResourceMetadata {
  notes: string;
  viewOnly: boolean;
  allowDownload: boolean;
}

export function parseResourceMetadata(rawNotes?: string | null): ResourceMetadata {
  if (!rawNotes) {
    return { notes: "", viewOnly: false, allowDownload: true };
  }
  let text = String(rawNotes).trim();
  let viewOnly = false;

  if (text.startsWith("[VIEW_ONLY]")) {
    viewOnly = true;
    text = text.replace(/^\[VIEW_ONLY\]\s*/i, "");
  } else if (text.startsWith("[ALLOW_DOWNLOAD]")) {
    viewOnly = false;
    text = text.replace(/^\[ALLOW_DOWNLOAD\]\s*/i, "");
  }

  return {
    notes: text,
    viewOnly,
    allowDownload: !viewOnly,
  };
}

export function serializeResourceMetadata(notes: string, viewOnly: boolean): string {
  const trimmed = notes.trim();
  const tag = viewOnly ? "[VIEW_ONLY]" : "[ALLOW_DOWNLOAD]";
  return trimmed ? `${tag} ${trimmed}` : tag;
}

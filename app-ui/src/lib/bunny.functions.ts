import { createClientRpc } from "./server-fn";

export const createBunnyTusUpload = createClientRpc<
  { title: string },
  {
    endpoint: string;
    videoId: string;
    libraryId: string;
    authorizationSignature: string;
    authorizationExpire: number;
    iframeUrl: string;
  }
>("createBunnyTusUpload");

export const deleteBunnyVideo = createClientRpc<{ url: string }, { ok: boolean; skipped?: boolean }>("deleteBunnyVideo");

export const syncLessonDuration = createClientRpc<{ lessonId: string }, { duration: string; seconds: number }>(
  "syncLessonDuration",
);

export const syncAllLessonDurations = createClientRpc<
  { courseId?: string; force?: boolean } | undefined,
  { updated: number; skipped: number; errors: number; total: number; results: any[] }
>("syncAllLessonDurations");

import { createClientRpc } from "./server-fn";

export const resolveCourseForLearn = createClientRpc<{ slug: string; userId?: string | null }, any>(
  "resolveCourseForLearn",
);

export const resolveCoursePublic = createClientRpc<{ slug: string }, any>("resolveCoursePublic");

export const getEnrolledCoursesByIds = createClientRpc<
  { courseIds: string[]; userId: string },
  { ok: true; courses: any[] }
>("getEnrolledCoursesByIds");

export const deductLessonView = createClientRpc<
  { lessonId: string; courseId: string; userId?: string | null },
  { ok: boolean; error?: string; viewsUsed: number }
>("deductLessonView");

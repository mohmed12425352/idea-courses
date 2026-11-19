import { createClientRpc } from "./server-fn";

export type AttendanceSettings = {
  late_after_minutes: number;
  required_percent: number;
  min_minutes: number;
};

export const getAttendanceSettings = createClientRpc<void, AttendanceSettings>("getAttendanceSettings");
export const saveAttendanceSettings = createClientRpc<Partial<AttendanceSettings>, AttendanceSettings>("saveAttendanceSettings");
export const getSessionAttendance = createClientRpc<{ sessionId: string }, any>("getSessionAttendance");
export const getCourseAttendanceSummary = createClientRpc<{ courseId: string }, any>("getCourseAttendanceSummary");
export const syncSessionAttendance = createClientRpc<{ sessionId: string }, any>("syncSessionAttendance");
export const importMeetAttendanceCsv = createClientRpc<{ sessionId: string; csv: string }, any>("importMeetAttendanceCsv");
export const setAttendanceStatus = createClientRpc<
  { sessionId: string; userId: string; status: string; minutes?: number },
  { ok: boolean }
>("setAttendanceStatus");
export const sendAttendanceNotices = createClientRpc<
  { sessionId: string; userIds?: string[]; note?: string },
  { ok: boolean; sent: number; total: number }
>("sendAttendanceNotices");
export const recordSessionJoin = createClientRpc<{ sessionId: string }, { ok: boolean; status: string }>("recordSessionJoin");
export const recordSessionRecordingWatch = createClientRpc<{ sessionId: string }, { ok: boolean; status: string }>(
  "recordSessionRecordingWatch",
);
export const setCertificateBlock = createClientRpc<
  { userId: string; courseId: string; blocked: boolean; reason?: string },
  { ok: boolean }
>("setCertificateBlock");

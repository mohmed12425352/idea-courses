import { createClientRpc } from "./server-fn";

export const createZoomMeeting = createClientRpc<
  { title: string; description?: string; scheduledAt: string; durationMinutes: number },
  { meetUrl: string; startUrl: string; meetingId: string }
>("createZoomMeeting");

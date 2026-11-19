import { createClientRpc } from "./server-fn";

export const createMeetLink = createClientRpc<
  { title: string; description?: string; scheduledAt: string; durationMinutes: number },
  { meetUrl: string; eventId: string; htmlLink: string }
>("createMeetLink");

import { createClientRpc } from "./server-fn";

export const syncSessionRecording = createClientRpc<{ sessionId: string }, any>("syncSessionRecording");
export const getRecordingProgress = createClientRpc<{ sessionId: string }, any>("getRecordingProgress");
export const getSessionTimeline = createClientRpc<{ sessionId: string }, any>("getSessionTimeline");

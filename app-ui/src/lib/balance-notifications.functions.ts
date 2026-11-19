import { createClientRpc } from "./server-fn";

export type BalanceReminderItem = {
  userId: string;
  amount: number;
  courseTitle?: string | null;
  note?: string | null;
  link?: string | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  dueDate?: string | null;
};

export const sendBalanceReminders = createClientRpc<
  { items: BalanceReminderItem[] },
  { ok: boolean; sent: number; total: number; results: Array<{ ok: boolean; userId: string; reason?: string }> }
>("sendBalanceReminders");

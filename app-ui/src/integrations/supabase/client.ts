import { apiClient } from "@/lib/api-sdk";

// Unified frontend client talking directly to the standalone Node.js Express backend
export const supabase = apiClient;

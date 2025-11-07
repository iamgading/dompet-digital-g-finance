import { Prisma, $Enums } from "@prisma/client";

export type AssistantChatRole = $Enums.ChatRole;

export interface ChatTurnDTO {
  id: string;
  role: AssistantChatRole;
  text: string;
  createdAt: string;
  sessionId?: string | null;
  payload: unknown | null;
}

export interface AssistantSubmitResult {
  success: boolean;
  error?: string;
  sessionId?: string;
  turns?: ChatTurnDTO[];
}

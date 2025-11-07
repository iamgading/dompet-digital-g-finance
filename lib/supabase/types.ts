export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      Pocket: {
        Row: {
          id: string;
          name: string;
          icon: string | null;
          color: string | null;
          note: string | null;
          monthlyBudget: number;
          goalAmount: number;
          order: number;
          isActive: boolean;
          balance: number;
          profileId: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon?: string | null;
          color?: string | null;
          note?: string | null;
          monthlyBudget?: number;
          goalAmount?: number;
          order?: number;
          isActive?: boolean;
          balance?: number;
          profileId: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string | null;
          color?: string | null;
          note?: string | null;
          monthlyBudget?: number;
          goalAmount?: number;
          order?: number;
          isActive?: boolean;
          balance?: number;
          profileId?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "Pocket_profileId_fkey";
            columns: ["profileId"];
            referencedRelation: "Profile";
            referencedColumns: ["id"];
          },
        ];
      };
      Transaction: {
        Row: {
          id: string;
          type: string;
          amount: number;
          date: string;
          note: string | null;
          pocketId: string;
          source: string | null;
          externalRef: string | null;
          profileId: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          type: string;
          amount: number;
          date: string;
          note?: string | null;
          pocketId: string;
          source?: string | null;
          externalRef?: string | null;
          profileId: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          type?: string;
          amount?: number;
          date?: string;
          note?: string | null;
          pocketId?: string;
          source?: string | null;
          externalRef?: string | null;
          profileId?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "Transaction_pocketId_fkey";
            columns: ["pocketId"];
            referencedRelation: "Pocket";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Transaction_profileId_fkey";
            columns: ["profileId"];
            referencedRelation: "Profile";
            referencedColumns: ["id"];
          },
        ];
      };
      Recurring: {
        Row: {
          id: string;
          name: string;
          type: string;
          amount: number;
          schedule: string;
          pocketId: string;
          nextRunAt: string;
          lastRunAt: string | null;
          autoPost: boolean;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          amount: number;
          schedule: string;
          pocketId: string;
          nextRunAt: string;
          lastRunAt?: string | null;
          autoPost?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          amount?: number;
          schedule?: string;
          pocketId?: string;
          nextRunAt?: string;
          lastRunAt?: string | null;
          autoPost?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "Recurring_pocketId_fkey";
            columns: ["pocketId"];
            referencedRelation: "Pocket";
            referencedColumns: ["id"];
          },
        ];
      };
      UserPref: {
        Row: {
          id: string;
          currency: string;
          locale: string;
          theme: string;
          pinHash: string | null;
          biometricEnabled: boolean;
          passkeyCredentialId: string | null;
          passkeyPublicKey: string | null;
          passkeyCounter: number | null;
          passkeyTransports: string | null;
          passkeyCurrentChallenge: string | null;
          uiAnimationsEnabled: boolean;
          activeProfileId: string | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          currency?: string;
          locale?: string;
          theme?: string;
          pinHash?: string | null;
          biometricEnabled?: boolean;
          passkeyCredentialId?: string | null;
          passkeyPublicKey?: string | null;
          passkeyCounter?: number | null;
          passkeyTransports?: string | null;
          passkeyCurrentChallenge?: string | null;
          uiAnimationsEnabled?: boolean;
          activeProfileId?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          currency?: string;
          locale?: string;
          theme?: string;
          pinHash?: string | null;
          biometricEnabled?: boolean;
          passkeyCredentialId?: string | null;
          passkeyPublicKey?: string | null;
          passkeyCounter?: number | null;
          passkeyTransports?: string | null;
          passkeyCurrentChallenge?: string | null;
          uiAnimationsEnabled?: boolean;
          activeProfileId?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "UserPref_activeProfileId_fkey";
            columns: ["activeProfileId"];
            referencedRelation: "Profile";
            referencedColumns: ["id"];
          },
        ];
      };
      ChatTurn: {
        Row: {
          id: string;
          createdAt: string;
          role: Database["public"]["Enums"]["ChatRole"];
          text: string;
          payload: Json | null;
          sessionId: string | null;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          role: Database["public"]["Enums"]["ChatRole"];
          text: string;
          payload?: Json | null;
          sessionId?: string | null;
        };
        Update: {
          id?: string;
          createdAt?: string;
          role?: Database["public"]["Enums"]["ChatRole"];
          text?: string;
          payload?: Json | null;
          sessionId?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ChatTurn_sessionId_fkey";
            columns: ["sessionId"];
            referencedRelation: "ChatSession";
            referencedColumns: ["id"];
          },
        ];
      };
      ChatSession: {
        Row: {
          id: string;
          createdAt: string;
          lastActiveAt: string;
          state: Json;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          lastActiveAt?: string;
          state: Json;
        };
        Update: {
          id?: string;
          createdAt?: string;
          lastActiveAt?: string;
          state?: Json;
        };
        Relationships: [];
      };
      Profile: {
        Row: {
          id: string;
          name: string;
          desc: string | null;
          createdAt: string;
        };
        Insert: {
          id?: string;
          name: string;
          desc?: string | null;
          createdAt?: string;
        };
        Update: {
          id?: string;
          name?: string;
          desc?: string | null;
          createdAt?: string;
        };
        Relationships: [];
      };
      Journal: {
        Row: {
          id: string;
          createdAt: string;
          type: Database["public"]["Enums"]["JournalType"];
          payload: Json;
          affectedTxnIds: Json;
          undoToken: string;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          type: Database["public"]["Enums"]["JournalType"];
          payload: Json;
          affectedTxnIds: Json;
          undoToken: string;
        };
        Update: {
          id?: string;
          createdAt?: string;
          type?: Database["public"]["Enums"]["JournalType"];
          payload?: Json;
          affectedTxnIds?: Json;
          undoToken?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      ChatRole: "user" | "assistant";
      JournalType: "income" | "expense" | "transfer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};


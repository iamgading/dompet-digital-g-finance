export type UserPrefSettings = {
  id: string;
  currency: "IDR" | "USD";
  locale: "id-ID" | "en-US";
  theme: "light" | "dark" | "system";
  uiAnimationsEnabled: boolean;
  activeProfileId: string | null;
};

export const defaultUserPref: UserPrefSettings = {
  id: "unknown",
  currency: "IDR",
  locale: "id-ID",
  theme: "system",
  uiAnimationsEnabled: true,
  activeProfileId: null,
};

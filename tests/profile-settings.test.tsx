import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: vi.fn(),
  }),
}));

import { ProfileSettings } from "@/components/settings/profile-settings";
import { UserPrefProvider } from "@/components/providers/user-pref-provider";
import type { UserPrefSettings } from "@/lib/types/user-pref";

describe("ProfileSettings", () => {
  it("renders consistently", () => {
    const initialPref: UserPrefSettings = {
      id: "pref-1",
      currency: "USD",
      locale: "en-US",
      theme: "dark",
      uiAnimationsEnabled: false,
    };

    const { container } = render(
      <UserPrefProvider initialPref={initialPref}>
        <ProfileSettings initialPref={initialPref} />
      </UserPrefProvider>,
    );

    expect(container).toMatchSnapshot();
  });
});

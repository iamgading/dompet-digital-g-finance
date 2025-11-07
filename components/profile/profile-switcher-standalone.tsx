"use client";

import { useEffect, useState } from "react";

import type { ProfileInfo } from "@/lib/types/profile";
import { ProfileSwitcher } from "@/components/profile/profile-switcher";

interface ProfileSwitcherStandaloneProps {
  initialActiveProfile: ProfileInfo;
  initialProfiles: ProfileInfo[];
  onFeedback?: (feedback: { type: "success" | "error"; message: string }) => void;
}

export function ProfileSwitcherStandalone({ initialActiveProfile, initialProfiles, onFeedback }: ProfileSwitcherStandaloneProps) {
  const [activeProfile, setActiveProfile] = useState<ProfileInfo>(initialActiveProfile);
  const [profiles, setProfiles] = useState<ProfileInfo[]>(initialProfiles);

  useEffect(() => {
    setActiveProfile(initialActiveProfile);
  }, [initialActiveProfile]);

  useEffect(() => {
    setProfiles(initialProfiles);
  }, [initialProfiles]);

  return (
    <ProfileSwitcher
      activeProfile={activeProfile}
      profiles={profiles}
      onProfileChange={(profile) => {
        setActiveProfile(profile);
      }}
      onProfileCreated={(profile) => {
        setProfiles((prev) => {
          if (prev.some((item) => item.id === profile.id)) {
            return prev;
          }
          return [...prev, profile];
        });
      }}
      onFeedback={onFeedback}
    />
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { UserProfile } from "@/lib/types";
import { fetchUserProfile } from "@/lib/db";

function checkIsInviteOrRecovery() {
  if (typeof window === "undefined") return false;
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const type = hashParams.get("type");
  return type === "invite" || type === "recovery";
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInviteMode, setIsInviteMode] = useState<boolean>(() =>
    checkIsInviteOrRecovery(),
  );
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() =>
    checkIsInviteOrRecovery(),
  );

  const loadProfile = useCallback(async () => {
    const profile = await fetchUserProfile();
    if (profile) {
      setUserProfile(profile);
    }
  }, []);

  useEffect(() => {
    const isInviteOrRecovery = checkIsInviteOrRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setIsAuthenticated(true);
        await loadProfile();
      } else {
        setIsAuthenticated(false);
        setUserProfile(null);
        if (!isInviteOrRecovery) {
          setIsAuthModalOpen(true);
        }
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserProfile(null);
    setIsAuthModalOpen(true);
  };

  return {
    isAuthenticated,
    isAuthLoading,
    userProfile,
    isAuthModalOpen,
    isInviteMode,
    setIsAuthModalOpen,
    setIsInviteMode,
    loadProfile,
    handleLogout,
  };
}

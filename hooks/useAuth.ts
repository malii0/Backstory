'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/lib/types';
import { fetchUserProfile } from '@/lib/db';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isInviteMode, setIsInviteMode] = useState<boolean>(false);

  const loadProfile = useCallback(async () => {
    const profile = await fetchUserProfile();
    if (profile) {
      setUserProfile(profile);
    }
  }, []);

  useEffect(() => {
    let isInviteOrRecovery = false;
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      if (type === 'invite' || type === 'recovery') {
        isInviteOrRecovery = true;
        setIsInviteMode(true);
        setIsAuthModalOpen(true);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
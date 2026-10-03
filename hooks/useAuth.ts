"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

function checkIsInviteOrRecovery() {
  if (typeof window === "undefined") return false;
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const type = hashParams.get("type");
  return type === "invite" || type === "recovery";
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const initialInviteOrRecoveryRef = useRef<boolean>(checkIsInviteOrRecovery());

  const [isInviteMode, setIsInviteMode] = useState<boolean>(
    initialInviteOrRecoveryRef.current,
  );
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(
    initialInviteOrRecoveryRef.current,
  );
  const [isRecoveryFlow, setIsRecoveryFlow] = useState<boolean>(
    initialInviteOrRecoveryRef.current,
  );

  const isRecoveryFlowRef = useRef<boolean>(initialInviteOrRecoveryRef.current);

  const setRecoveryFlowState = useCallback((val: boolean) => {
    isRecoveryFlowRef.current = val;
    setIsRecoveryFlow(val);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryFlowState(true);
        setIsInviteMode(true);
        setIsAuthModalOpen(true);
        setIsAuthenticated(false);
        setIsAuthLoading(false);
        return;
      }

      if (session) {
        if (initialInviteOrRecoveryRef.current || isRecoveryFlowRef.current) {
          setRecoveryFlowState(true);
          setIsInviteMode(true);
          setIsAuthModalOpen(true);
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
        if (!initialInviteOrRecoveryRef.current && !isRecoveryFlowRef.current) {
          setIsAuthModalOpen(true);
        }
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setRecoveryFlowState]);

  const finishRecoveryFlow = useCallback(async () => {
    setRecoveryFlowState(false);
    setIsInviteMode(false);
    setIsAuthModalOpen(false);
    setIsAuthenticated(true);
  }, [setRecoveryFlowState]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setRecoveryFlowState(false);
    setIsInviteMode(false);
    setIsAuthModalOpen(true);
  };

  return {
    isAuthenticated,
    isAuthLoading,
    isAuthModalOpen,
    isInviteMode,
    isRecoveryFlow,
    setIsAuthModalOpen,
    setIsInviteMode,
    finishRecoveryFlow,
    handleLogout,
  };
}

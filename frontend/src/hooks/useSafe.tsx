import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useSafeApp } from "./useSafeApp";

interface SafeContextValue {
  safeAddress: string;
  setSafeAddress: (addr: string) => void;
  isInSafeApp: boolean;
  detectingSafeApp: boolean;
}

const SafeContext = createContext<SafeContextValue>({
  safeAddress: "",
  setSafeAddress: () => {},
  isInSafeApp: false,
  detectingSafeApp: false,
});

export function SafeProvider({ children }: { children: ReactNode }) {
  const { safeAppInfo, isInSafeApp, detecting } = useSafeApp();

  const [safeAddress, setSafeAddressState] = useState(() => {
    try {
      return localStorage.getItem("nox-safe-address") || "";
    } catch {
      return "";
    }
  });

  // Auto-populate from Safe App context when detected
  useEffect(() => {
    if (safeAppInfo?.safeAddress) {
      setSafeAddressState(safeAppInfo.safeAddress);
      try {
        localStorage.setItem("nox-safe-address", safeAppInfo.safeAddress);
      } catch {}
    }
  }, [safeAppInfo]);

  const setSafeAddress = (addr: string) => {
    setSafeAddressState(addr);
    try {
      localStorage.setItem("nox-safe-address", addr);
    } catch {}
  };

  return (
    <SafeContext.Provider
      value={{ safeAddress, setSafeAddress, isInSafeApp, detectingSafeApp: detecting }}
    >
      {children}
    </SafeContext.Provider>
  );
}

export function useSafe() {
  return useContext(SafeContext);
}

import { createContext, useContext, useState, type ReactNode } from "react";

interface SafeContextValue {
  safeAddress: string;
  setSafeAddress: (addr: string) => void;
}

const SafeContext = createContext<SafeContextValue>({
  safeAddress: "",
  setSafeAddress: () => {},
});

export function SafeProvider({ children }: { children: ReactNode }) {
  const [safeAddress, setSafeAddress] = useState(() => {
    try {
      return localStorage.getItem("nox-safe-address") || "";
    } catch {
      return "";
    }
  });

  const setAddress = (addr: string) => {
    setSafeAddress(addr);
    try {
      localStorage.setItem("nox-safe-address", addr);
    } catch {}
  };

  return (
    <SafeContext.Provider value={{ safeAddress, setSafeAddress: setAddress }}>
      {children}
    </SafeContext.Provider>
  );
}

export function useSafe() {
  return useContext(SafeContext);
}

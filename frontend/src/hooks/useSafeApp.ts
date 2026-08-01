import { useEffect, useState } from "react";
import SafeAppsSDK from "@safe-global/safe-apps-sdk";

export type SafeAppInfo = {
  safeAddress: string;
  chainId: number;
};

let _sdk: SafeAppsSDK | null = null;
function getSdk() {
  if (!_sdk) _sdk = new SafeAppsSDK({ allowedDomains: [/app\.safe\.global/] });
  return _sdk;
}

export function useSafeApp() {
  const [safeAppInfo, setSafeAppInfo] = useState<SafeAppInfo | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const sdk = getSdk();

    Promise.race([
      sdk.safe.getInfo(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("not in Safe")), 1500)
      ),
    ])
      .then((info) => {
        if (!cancelled && info?.safeAddress) {
          setSafeAppInfo({ safeAddress: info.safeAddress, chainId: info.chainId });
        }
      })
      .catch(() => {
        // Not inside Safe iframe — normal browser flow
      })
      .finally(() => {
        if (!cancelled) setDetecting(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { safeAppInfo, isInSafeApp: safeAppInfo !== null, detecting };
}

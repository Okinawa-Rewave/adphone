// hooks/useOnline.ts
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useOnline() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);

  return { isOnline };
}

// hooks/useOnline.ts
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

function connectivityOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  return !!state.isConnected && state.isInternetReachable !== false;
}

export function useOnline() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    let mounted = true;
    NetInfo.fetch().then((state) => {
      if (mounted) setIsOnline(connectivityOnline(state));
    });
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(connectivityOnline(state));
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { isOnline };
}

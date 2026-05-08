"use client";

import { useEffect, useState } from "react";

interface Props {
  onReconnect?: () => void;
}

export function ConnectionStatus({ onReconnect }: Props) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      onReconnect?.();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [onReconnect]);

  if (online) return null;

  return (
    <div className="sticky top-0 z-50 bg-yellow-500 px-4 py-2 text-center text-sm font-medium text-black">
      网络异常，正在重连…
    </div>
  );
}

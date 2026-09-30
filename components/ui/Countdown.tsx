"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function Countdown({
  targetIso,
  onExpire,
  className,
}: {
  targetIso: string;
  onExpire?: () => void;
  className?: string;
}) {
  const target = new Date(targetIso).getTime();
  // Lazy init: se calcula en el primer render del cliente. El posible desfase
  // de un instante frente al render del servidor es esperado en un reloj en
  // vivo, por eso el <span> usa suppressHydrationWarning.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (now >= target) onExpire?.();
  }, [now, target, onExpire]);

  return (
    <span className={className} suppressHydrationWarning>
      {formatRemaining(target - now)}
    </span>
  );
}

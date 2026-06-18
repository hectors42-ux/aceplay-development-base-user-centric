import { useEffect, useState } from "react";

export function OverlayClock({ className }: { className?: string }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");
  return <span className={className}>{hh}:{mm}</span>;
}
import { useEffect, useState } from 'react';

export const useNow = (intervalMilliseconds = 60_000): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, intervalMilliseconds);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMilliseconds]);
  return now;
};

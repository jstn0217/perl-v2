import { useEffect, useState } from 'react';

export const OfflineBanner = () => {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) {
    return null;
  }

  return (
    <div className="offline-banner" role="status">
      <span className="offline-banner__dot" aria-hidden="true" />
      You are offline. Live attendance data will resume once your connection returns.
    </div>
  );
};

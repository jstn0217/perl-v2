import { useState } from 'react';
import { SchoolMark } from '../components/SchoolMark';
import { InlineAlert } from '../components/InlineAlert';
import { AttendanceEventCard } from '../modules/AttendanceEventCard';
import { DeviceAuthError, connectDevice, scanCardWithDeviceKey, type KioskDevice } from '../lib/api';
import { useSchoolTheme } from '../providers/SchoolThemeContext';
import type { AttendanceScanResult } from '../types/attendance';

const STORAGE_KEY = 'perl-kiosk-device';

interface StoredKioskDevice extends KioskDevice {
  deviceKey: string;
}

const loadStoredDevice = (): StoredKioskDevice | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredKioskDevice) : null;
  } catch {
    return null;
  }
};

export const DeviceKioskPage = () => {
  const { school } = useSchoolTheme();
  const [boundDevice, setBoundDevice] = useState<StoredKioskDevice | null>(() => loadStoredDevice());

  const [deviceKeyInput, setDeviceKeyInput] = useState('');
  const [connectStatus, setConnectStatus] = useState<'idle' | 'connecting'>('idle');
  const [connectError, setConnectError] = useState<string | null>(null);

  const [cardUid, setCardUid] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'submitting'>('idle');
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AttendanceScanResult | null>(null);

  const disconnect = (message: string | null = null) => {
    window.localStorage.removeItem(STORAGE_KEY);
    setBoundDevice(null);
    setConnectError(message);
    setLastResult(null);
    setScanError(null);
  };

  const handleConnect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConnectStatus('connecting');
    setConnectError(null);

    try {
      const device = await connectDevice(deviceKeyInput);
      const stored: StoredKioskDevice = { ...device, deviceKey: deviceKeyInput };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setBoundDevice(stored);
      setDeviceKeyInput('');
      setLastResult(null);
      setScanError(null);
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Unable to connect this device.');
    } finally {
      setConnectStatus('idle');
    }
  };

  const handleScan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!boundDevice) return;

    setScanStatus('submitting');
    setScanError(null);

    try {
      const result = await scanCardWithDeviceKey(cardUid, boundDevice.deviceKey);
      setLastResult(result);
      setCardUid('');
    } catch (error) {
      if (error instanceof DeviceAuthError) {
        disconnect('This device was disconnected. Reconnect it with a new device key.');
        return;
      }
      setScanError(error instanceof Error ? error.message : 'Unable to send scan.');
    } finally {
      setScanStatus('idle');
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="hero-topline">
          <div className="brand-lockup">
            <SchoolMark name={school.name} logoUrl={school.logoUrl} />
            <div>
              <p className="eyebrow">AMoS attendance</p>
              <h1>Device kiosk</h1>
            </div>
          </div>
        </div>

        <div className="auth-grid">
          <div className="auth-copy">
            <p className="description">
              Bind this screen to a registered scanner, then submit card scans directly from this device.
            </p>

            <div className="preview-panel preview-panel--primary">
              <p className="panel-label">How it works</p>
              <ul className="promise-list promise-list--light">
                <li>Paste the one-time device key issued during registration.</li>
                <li>The binding is saved to this browser and survives a page reload.</li>
                <li>Every scan is attributed to this device and its school automatically.</li>
              </ul>
            </div>
          </div>

          {boundDevice ? (
            <div className="login-card">
              <div className="login-card__header">
                <p className="panel-label">Connected as</p>
                <h2>{boundDevice.name}</h2>
                <p className="login-card__hint">{boundDevice.location}</p>
              </div>

              <form className="stack-form" onSubmit={handleScan}>
                <label className="field">
                  <span>Card UID</span>
                  <input
                    type="text"
                    value={cardUid}
                    onChange={(changeEvent) => setCardUid(changeEvent.target.value)}
                    placeholder="Scan or paste the RFID card UID"
                    autoComplete="off"
                    required
                  />
                </label>

                {scanError ? (
                  <InlineAlert tone="error" message={scanError} />
                ) : (
                  <InlineAlert message="Each scan is recorded and attributed to this device's school." />
                )}

                <button className="primary-button" type="submit" disabled={scanStatus === 'submitting'}>
                  {scanStatus === 'submitting' ? 'Sending scan…' : 'Send scan'}
                </button>
              </form>

              {lastResult ? <AttendanceEventCard event={lastResult} /> : null}

              <button className="secondary-button" type="button" onClick={() => disconnect()}>
                Disconnect device
              </button>
            </div>
          ) : (
            <form className="login-card" onSubmit={handleConnect}>
              <div className="login-card__header">
                <p className="panel-label">Connect this kiosk</p>
                <h2>Bind a device</h2>
                <p className="login-card__hint">Use the device key shown once at registration.</p>
              </div>

              <label className="field">
                <span>Device key</span>
                <input
                  type="password"
                  value={deviceKeyInput}
                  onChange={(changeEvent) => setDeviceKeyInput(changeEvent.target.value)}
                  placeholder="Paste the device key"
                  autoComplete="off"
                  required
                />
              </label>

              {connectError ? (
                <InlineAlert tone="error" message={connectError} />
              ) : (
                <InlineAlert message="The device key is never shown again after registration — ask an admin to rotate it if lost." />
              )}

              <button className="primary-button" type="submit" disabled={connectStatus === 'connecting'}>
                {connectStatus === 'connecting' ? 'Connecting…' : 'Connect device'}
              </button>
            </form>
          )}
        </div>

        <footer className="app-footer">
          <img src="/brand/perl-mark-96.png" alt="" width="20" height="17" aria-hidden="true" />
          <span>Powered by AMoS</span>
        </footer>
      </section>
    </main>
  );
};

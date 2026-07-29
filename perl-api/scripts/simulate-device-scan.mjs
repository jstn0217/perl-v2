import process from 'node:process';

const args = process.argv.slice(2);

const readArg = (flag, fallback = undefined) => {
  const index = args.indexOf(flag);

  if (index === -1) {
    return fallback;
  }

  return args[index + 1] ?? fallback;
};

const baseUrl = readArg('--base-url', 'http://127.0.0.1:4000');
const deviceKey = readArg('--device-key');
const cardUid = readArg('--card-uid');

if (!deviceKey || !cardUid) {
  console.error('Usage: node perl-api/scripts/simulate-device-scan.mjs --device-key <key> --card-uid <uid> [--base-url <url>]');
  process.exit(1);
}

const response = await fetch(new URL('/api/device/scan', baseUrl), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Device-Key': deviceKey
  },
  body: JSON.stringify({
    cardUid
  })
});

const payload = await response.text();

process.stdout.write(`${response.status}\n${payload}\n`);

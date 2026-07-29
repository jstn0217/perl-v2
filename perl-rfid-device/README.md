# PERL RFID Device

This firmware targets a **NodeMCU 1.0 (ESP-12E / ESP8266)** connected to an
MFRC522 RFID reader. It replaces hardcoded Wi-Fi credentials with a temporary,
password-protected setup hotspot.

## Required Arduino components

- ESP8266 board package 3.1.2
- MFRC522 library
- The ESP8266 core-provided `DNSServer`, `ESP8266WebServer`,
  `ESP8266HTTPClient`, and `LittleFS` libraries

Recommended Arduino IDE board settings:

- Board: `NodeMCU 1.0 (ESP-12E Module)`
- Upload speed: `115200`
- Flash size: a layout with at least a small LittleFS partition

## First-time setup

1. Upload `perl_rfid.ino` and open Serial Monitor at `115200` baud.
2. The scanner prints a temporary network name such as
   `PERL-RFID-SETUP-12AB34`. Its temporary setup password is `dcla_2015`.
3. Connect a phone or computer to that temporary network.
4. Open `http://192.168.4.1` if the setup page does not open automatically.
5. Select the Wi-Fi network used by the phone or computer and enter its
   password.
6. Enter the PERL API base URL. Use a LAN-reachable address such as
   `http://192.168.1.20:4000`; `localhost` points back to the ESP8266 and will
   not work.
7. Enter the one-time device key generated from the school's Devices page.
8. Submit the form. The scanner stores the settings, restarts, and reconnects
   automatically on later boots.

[`device.conf.sample`](device.conf.sample) documents the three-line LittleFS
format written by the setup portal:

1. configuration format version (`1`)
2. LAN-reachable API base URL without a trailing slash
3. device key generated from the school's Devices page

Replace both placeholder values before using the sample. Never commit a real
device key.

The setup hotspot also appears when the saved Wi-Fi cannot be reached during
startup. The firmware currently uses the fixed `dcla_2015` setup password; this
temporary development credential must be replaced with per-device provisioning
before production deployment.

## Network and security notes

- Wi-Fi credentials are saved through the ESP8266 Wi-Fi stack instead of being
  committed to source.
- The API URL and device key are stored in LittleFS. ESP8266 flash storage is
  not hardware-encrypted, so physical access to the module must be controlled.
- The device key is sent in the `X-Device-Key` header, never in a query string.
- The current HTTP transport is intended for a trusted local network. A public
  deployment must add certificate-validated HTTPS before transmitting device
  keys over the internet.
- A scan unlocks the relay only when the API returns an `ADMITTED` verdict.

## Pin mapping

| Purpose | NodeMCU pin |
|---|---|
| MFRC522 reset | D3 |
| MFRC522 SDA/SS | D2 |
| Green/access signal | D1 |
| Connection indicator | D4 |
| Activity/denial indicator | D0 |
| Relay | D8 |

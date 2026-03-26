# Privasys Wallet

A mobile authenticator for the [Privasys](https://privasys.org) confidential computing platform. Authenticate to web applications using hardware-attested enclaves, FIDO2-grade cryptography, and on-device biometrics. No passwords.No trust assumptions.

## Repository Structure

| Directory | Description |
|-----------|-------------|
| `wallet/` | Expo / React Native mobile app (iOS & Android) |
| `sdk/` | `@privasys/auth` — TypeScript browser SDK for relying parties |
| `broker/` | Go WebSocket relay that pairs browser sessions with the wallet |

## Quick Start

### Wallet (mobile app)

```bash
cd wallet
bun install
bun start          # Expo dev server
```

### SDK

```bash
cd sdk
bun install
bun run build      # Compiles to dist/
```

### Broker

```bash
cd broker
go build -o auth-broker ./cmd/broker
./auth-broker      # Listens on :8090
```

## How It Works

1. A relying party embeds the `@privasys/auth` SDK.
2. The SDK generates a session and displays a QR code.
3. The user scans the QR with Privasys Wallet.
4. The wallet performs RA-TLS attestation against the platform's enclaves.
5. On success, the wallet signs a FIDO2 assertion using on-device biometrics.
6. The signed result is relayed back to the SDK through the broker.

All private keys stay on-device. The broker only relays opaque messages, it never sees credentials.

## Building

The wallet includes native Rust modules for RA-TLS verification. See [`.github/workflows/build-wallet.yaml`](.github/workflows/build-wallet.yaml) for the full CI/CD pipeline, including cross-compilation for iOS and Android.

## License

[GNU Affero General Public License v3.0](LICENSE)

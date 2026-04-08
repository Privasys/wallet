# Privasys Wallet

Mobile authenticator for the Privasys confidential computing platform. Verifies enclave attestation on-device using RA-TLS, then signs FIDO2 assertions with hardware-bound biometric keys.

## Architecture

| Module | Purpose |
|--------|---------|
| `src/routes/` | Expo Router screens — tabs, connect flow, settings, onboarding |
| `src/components/` | Shared UI — themed wrappers, splash animation |
| `src/stores/` | Zustand + SecureStore — auth state, trusted apps, settings |
| `src/services/` | Attestation, FIDO2 ceremonies, broker relay, security checks |
| `modules/native-ratls/` | Expo native module — Rust RA-TLS verification (Swift/Kotlin wrappers) |
| `modules/native-keys/` | Expo native module — Secure Enclave / StrongBox key management |
| `modules/app-attest/` | Expo native module — iOS App Attest / Android Play Integrity |
| `modules/passkey-provider/` | iOS ASCredentialProviderExtension for AutoFill passkeys |

## Development

```bash
bun install
bun start               # Expo dev server
npx jest                 # Run test suite
```

Native modules require a physical device (simulators lack Secure Enclave / StrongBox). Build with EAS:

```bash
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile development --platform android
```

## Key Screens

- **Home** — Registered services with attestation status
- **Scan** — QR scanner, parses `privasys.id/scp?p=<payload>` universal links
- **Connect** — Attestation verification → biometric prompt → FIDO2 ceremony → session relay
- **Settings** — Grace period config, registered credentials, clear data
- **About** — Version, build number, commit ID

## App Attestation

The wallet proves its binary integrity to the attestation server using platform-specific APIs:

- **iOS** — Apple App Attest (`DCAppAttestService`). Keys stored in Keychain.
- **Android** — Google Play Integrity API. Integrity tokens verified server-side.

The flow (`src/services/app-attest.ts`):

1. `GET /app-challenge` from the auth broker
2. Attest or assert using the native module
3. `POST /app-token` with the attestation/assertion → receives an ES256 JWT
4. Use the JWT as a bearer token for attestation server requests

The native module lives in `modules/app-attest/` with platform-specific implementations in `ios/AppAttestModule.swift` and `android/src/.../AppAttestModule.kt`.

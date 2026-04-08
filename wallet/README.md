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

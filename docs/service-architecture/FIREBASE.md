# Wafra's Firebase

*Part of the [service architecture](README.md). The projects, what Firebase holds, who writes to it, and how
to deploy the rules.*

Wafra owns a Firebase account, `rbigare@wafragreen.com`, with two projects:

| | Staging | Production |
|---|---|---|
| Project ID | `wafra-farm-staging` | `wafra-farm-production` |
| iOS bundle ID / Android package | `com.wafragreen.farm.staging` | `com.wafragreen.farm` |
| Firestore | `(default)`, Standard edition, `me-central2` (Dammam) | same |
| Sign-in | phone number + SMS code | phone number + SMS code |
| Test phone numbers | `+15555550101` to `+15555550103`, code `123456` | none |
| Billing | Spark (free). Blaze is needed for real SMS, Cloud Functions and RevenueCat's extension. | same |

**What Firebase is for.** Firebase holds **all client data**, so MMC can focus
on farms (its farm IDs, shapes, imagery, analytics and advice). MMC reads only
the `activeFarms` list in Firebase, which is all it needs. RevenueCat records
in-app purchases. Firebase holds:

- **Sign-in** (Firebase Auth, phone number). The UID is also the RevenueCat app
  user ID.
- **Push notifications** (Firebase Cloud Messaging).
- **Crash reports** (Crashlytics). They switch on when the native build first
  reports a crash.
- **Cloud Functions**: Wafra's only server code. They keep `activeFarms`
  right, send farms to MMC to be measured, redeem invitations, and send push,
  SMS and WhatsApp messages.
- **Firestore:**
  - people, farms, roles, invitations and contacts;
  - `activeFarms`: one record per paid farm, the centre of everything;
  - RevenueCat's copy of each buyer's purchases;
  - Wafra's price table and contracts;
  - feedback, and a log of every advice and who it was sent to.

**Who writes.** The app (through the rules), Wafra's Cloud Functions,
RevenueCat's extension, and Wafra staff. MMC only reads, and sends its events
through Wafra's `notify` function.

**Files, in [`firebase/`](firebase/)** (in this folder):

| File | What it is |
|---|---|
| `firestore.rules` | Security rules, deployed to both projects |
| `firestore.indexes.json` | Composite indexes, deployed to both projects |
| `firebase.json`, `.firebaserc` | Firebase CLI config; the aliases are `staging` and `production` |
| `package.json`, `seed/seed.js` | local emulators and their sample data (see [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md)) |

To deploy, sign in once with a Google account that owns the projects, then deploy. The deploy checks the
rules before it uploads them. The `firebase-adminsdk` service accounts cannot deploy rules: they can read and
write data only.

```bash
npx firebase-tools login
```

```bash
npx firebase-tools deploy --only firestore --project staging --config docs/service-architecture/firebase/firebase.json
```

Run it from the repository root. Deploy to staging first, then the same command with `--project production`.

**Keys.** Service-account keys and config files (`GoogleService-Info.plist`,
`google-services.json`) are **never committed**. Download them from Firebase
Project settings. Keep service-account keys in a secret store. The repository is
public.

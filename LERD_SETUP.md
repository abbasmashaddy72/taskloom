# Taskloom with Lerd on Arch / CachyOS (Fish shell)

## Requirements

- Working Lerd installation (and its rootless Podman runtime).
- Node.js 22 and npm, either managed by Lerd or already installed.
- MongoDB is provided by Lerd: **do not install the `mongodb` AUR package**.
- Docker / Docker Compose are **not required**.

Check the runtime:

```fish
lerd --version
lerd status
node --version
npm --version
podman --version
```

## One-time setup

From Taskloom's project directory (after extracting this ZIP):

```fish
cd ~/Documents/Project-Sites/Local/taskloom

# Install/start the Lerd-managed MongoDB database service
lerd service preset mongo
lerd service start mongo
lerd service list

# Next.js / seed both read .env.local; do not commit this file
cp .env.example .env.local

# Install app packages and confirm code checks
npm install
npm run typecheck
npm run lint
npm test

# Register Next.js as a host-proxy site behind Lerd HTTPS
lerd link
lerd secure
lerd status
lerd open
```

The expected address is **https://taskloom.test**.

Lerd supervises `npm run dev` (defined by `proxy` in `.lerd.yaml`). Do **not** run `npm run dev` again in another terminal while Lerd is supervising it. Lerd can choose a free port and provides `PORT` to the Next.js dev process. Next.js supports `PORT` when launching the dev server.

The first `lerd link` may ask for approval before running the project-defined command. Allow only if you trust the code.

## Connection string

Because **Next.js runs on the host** with `proxy.command: npm run dev` and `proxy.port: 3000`, it connects to the Lerd MongoDB *host* endpoint:

```dotenv
MONGODB_URI=mongodb://root:lerd@127.0.0.1:27017/taskloom?authSource=admin
MONGODB_DB=taskloom
```

`authSource=admin` is essential: Lerd's MongoDB preset provisions a root user in the `admin` database. The app stores project/task collections in the `taskloom` database.

**If you instead switch to a `Containerfile.lerd`** and run Next.js inside Lerd's container network, change the MongoDB URI host to `lerd-mongo` rather than `127.0.0.1`. Do not do this for the `proxy` configuration shipped here.

## Sample data / verification

```fish
npm run seed
npm run build
lerd status
```

**`npm run seed` is optional and writes sample projects.** Skip it if you want an empty workspace. It does not overwrite an existing workspace.

Open `https://taskloom.test` and exercise CRUD, markdown import/export, theme toggle, and app/database restart persistence. A successful `lerd status` alone does not verify CRUD functionality.

## Troubleshooting

- `ECONNREFUSED 127.0.0.1:27017`: run `lerd service start mongo` and check `lerd service list`.
- `Authentication failed`: check `.env.local` for the exact Lerd credentials and `?authSource=admin`. Existing MongoDB services provisioned with different passwords need their actual credentials.
- `port already in use`: stop a standalone MongoDB or old Docker Compose stack; do not run two MongoDB instances on host port 27017.
- `taskloom.test` not loading: check `lerd status`, `lerd link`, DNS/HTTPS, and Lerd's per-site logs. Never expose this unauthenticated app via `lerd share` or onto an untrusted network.
- If Lerd cannot identify the Node site, verify the installed Lerd release supports host-proxy sites (`proxy`) and run `lerd init` or `lerd link` interactively.
- If database changes do not appear, ensure Next.js is reading `.env.local`, not a stale Docker URI in `.env`.

## Data and security

- The app currently does **not** implement login or per-user authorization. It is intended for one trusted developer machine only.
- TLS for `taskloom.test` protects connections but **does not add authentication**. Do not use public sharing / tunnels or port forwarding for this app.
- The MongoDB service can be shared by other Lerd projects; **never** delete its volume as a cleanup step without backing up databases first.
- Do not commit `.env.local` and do not use Lerd's default dev MongoDB credentials outside local development.

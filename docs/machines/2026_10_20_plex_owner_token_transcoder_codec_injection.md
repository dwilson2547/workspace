# A stolen Plex owner token let attackers plant a codec `.so` through `TranscoderH264Options`, running a crypto miner and a residential proxy on Tower and destabilising the home network

**Date:** 2026-10-20  
**Component:** Tower (Unraid, 192.168.x.x). The Plex Media Server container, its appdata (`/config`), and the router's connection tracking  
**Severity:** High. Attackers ran their own code in the Plex container for at least four days, the whole LAN's connectivity degraded, and the scrapers and backups kept failing.

---

## Observed symptom

- For several days the internet was unreliable across the LAN. The router was restarting about every 5 minutes. The router's traffic graphs showed no more bandwidth than usual. Disabling the router's packet inspection helped a little but didn't fix it (user).
- Scraper runs and backups kept failing. The scraper failures were through the cluster's VPN proxy, not Tower itself (see [Effect on the scraper fleet](#effect-on-the-scraper-fleet)).
- `top` inside the Plex container showed `xmrig` (a crypto miner) and a process called `myawesomeproxy`. A dropped payload was in the container's `/tmp` (user).

---

## Root cause

### Owner token used from outside the network

The Plex Media Server logs (`Logs/Plex Media Server*.log`, Oct 11–20) record requests made with the **server owner's token** from four outside IPs, all over plain HTTP and never TLS:

| IP | First seen (server log time) | Last seen | Owner-token requests |
|---|---|---|---|
| `45.194.92.222` | Oct 17 00:59:50 | Oct 19 10:52:53 | 253 |
| `91.92.40.202` | Oct 17 08:04:01 | Oct 20 15:53:09 | 60 |
| `94.154.43.88` | Oct 18 09:37:26 | Oct 18 13:37:50 | 43 |
| `94.154.43.7` | Oct 18 14:27:04 | Oct 19 07:37:38 | 28 |

`94.154.43.60` also probed `GET /` (Oct 17–19) without a token. Apart from these, the owner token was only ever used from the LAN and from loopback, so every outside use of it was the attacker. The logs don't show how the token was obtained (`⚠ unverified`); they only go back to Oct 11.

### `TranscoderH264Options` turned the transcoder into a file-write primitive

Each attack cycle, repeated about 30 times:

1. `PUT /:/prefs?TranscoderH264Options=dump-yuv=<appdata>/Codecs/c75335c-a7cfb6836f3ed63280a7eb83-linux-x86_64/zz<random>.so:qp=0`. The x264 `dump-yuv` option makes the transcoder write its decoded output to a file path the attacker chooses. Here that path was a `.so` file inside Plex's own codec folder. They tried both `/config/...` and `/var/lib/plexmediaserver/...`, because the appdata path differs between Docker images.
2. `GET /video/:/transcode/universal/decision` + `start.m3u8`. Starting a transcode makes the transcoder load the codec folder, including the planted `.so`, which runs the attacker's code as the Plex user.
3. Within about 4 seconds, `PUT /:/prefs?TranscoderH264Options=` (blank), which cleared the setting so it wouldn't stay visible.

The code they ran dropped the miner and the proxy into the container's `/tmp`.

### Why the whole network suffered with no bandwidth spike

> **Not fully confirmed, but strongly supported.** The router stopped restarting as soon as Plex was shut down, and there have been no network problems since (user). Neither the router nor the attacker's processes were examined while the attack was running, so the mechanism below is still `⚠ unverified`.

`myawesomeproxy` appears to be residential-proxy software, which sells Tower's home IP as an exit point for other people's traffic. That kind of traffic is mostly many short connections to many different hosts, not large transfers. Each connection takes a slot in the router's connection table and, with packet inspection on, costs router CPU. So connectivity can fail for every device on the network while the bytes-per-second graph looks normal. Separately, the miner used Tower's CPU, which on its own explains failing backup runs on that box.

The proxy's traffic was added to a network that was already busy. The scraper fleet itself opens many short connections through the router. The user's assessment is that the proxy alone would probably have been fine on a normal home connection, but proxy traffic plus the scraper fleet was more than the router could handle, and it restarted every 5 minutes.

### Effect on the scraper fleet

Measured from the cluster on 2026-10-21. All times UTC.

The scrapers reach the parts sites through the `nordvpn-proxy` pod (namespace `vpn`, on k8s-main). It is a single replica, so each restart cut off every scraper at once.

| | Before Oct 17 | Oct 17–20 | After the Oct 20 cleanup |
|---|---|---|---|
| `nordvpn-proxy` restarts (`kube_pod_container_status_restarts_total`, per day) | 0–1 | 1, **7** (Oct 18–19), 1, 2 | none in the 21h measured |
| parts-direct runs that failed because the proxy was unreachable (`ERR_TUNNEL_CONNECTION_FAILED`, `no exit IP`) | 0 | 12 (Oct 18–20) | 0 |

- **The peak matches the attack.** The worst day for proxy restarts, Oct 18–19, was also the day all four attacker IPs were active.
- **The last proxy restart came just before the recreate.** It was at 21:04 on Oct 20, after DNS inside the tunnel stopped resolving (`Can not resolve api.ipify.org`). The Plex recreate was at 17:29 server log time.
- **Six jobs were suspended.** parts-direct acura, ford, gm, mazda, mopar and vw were suspended after 3 consecutive failed runs each, all `TempFail` (exit 75). The operator counts network failures toward suspension and doesn't lift it on its own. All six were resumed by hand on 2026-10-21 18:23; acura's test run got through the VPN check and started scraping.
- **Remaining failures are normal site timeouts.** After the cleanup, the only failures were navigation timeouts at session start (volvo, audi). They succeeded on retry and happened before the attack too.

---

## Troubleshooting steps taken

1. **btrfs pool errors on `/mnt/minio-pool`.** Checked first, because Tower was showing pool errors. A scrub on 2026-10-19 (459.40 GiB) found no errors. The counters showed only old `corruption_errs` (sdk 24, sdl 43) and no I/O errors. **Ruled out** as the cause of the network problems. The counters were reset.
2. **Media shares mounted into Plex (Music, Movies, TV Shows, Anime; about 22,500 files)** — the only files changed since Aug 1 are anime downloads made on Oct 14 and 19 (file change times agree). The first bytes of every file were checked: none are programs or scripts. 22,516 files have the right header for their extension. The other four are a 2017 macOS `._` metadata file, a mislabelled MPEG-PS file and an unfinished MakeMKV rip from 2022. **The media is clean.**
3. **Plex appdata dump (10.6 GB, 145,459 entries)** — the attacker's `c75335c-…` codec folder and every `zz*.so` file are **gone**. Plex replaced them with a fresh codec set (`a336ba9-…`) when the container was recreated. A full scan of the tarball contents found exactly 20 programs, all of them official codec libraries and `EasyAudioEncoder` downloaded at the recreate. `Plug-ins/` holds only Plex's own `Services.bundle`, unchanged since 2020. There are no custom scanners, no symlinks pointing outside the appdata folder, and no setuid files. `Preferences.xml` still contains `TranscoderH264Options=""`, which is empty and harmless.
4. **Plex logs** — no mentions of `xmrig`, the proxy, or `/tmp` downloads. The `dump-yuv` sequence above is the only suspicious use of server settings. The log written after the 17:29 recreate on Oct 20 shows no outside requests.
5. **Router connection count after cleanup** — 233 open connections, in the normal range (user).
6. **Router stability after shutting Plex down** — the router stopped restarting every 5 minutes as soon as Plex was shut down, and there have been no network problems since (user).

---

## Fix

### Plex container — rebuilt and updated

The container was destroyed and recreated by updating Plex to the latest version on 2026-10-20 at about 17:29 (server log time). That threw away the container's whole filesystem, including `/tmp` and the dropped payload. The recreate also downloaded a fresh codec set, which replaced the folder holding the planted `.so` files. After the rebuild the container's crontab was empty, and `xmrig` and `myawesomeproxy` were no longer running (user). Its CPU has stayed normal since (user).

### Plex account — tokens revoked

All existing Plex sessions and tokens were revoked (user), so the stolen owner token no longer works.

### Router — Plex port forward closed

The internet-facing Plex port was closed, so the server is no longer reachable from outside the network (user). Remote viewers now go through Plex Relay.

### Plex container — media mounts made read-only

The Music, Movies, TV Shows and Anime mounts are now read-only inside the container (user, 2026-10-20). Plex never needs to write to them, so a future compromise of the container can't touch the library.

---

## Files changed

- Tower: Plex container recreated (image updated); `appdata/<plex>/Library/Application Support/Plex Media Server/Codecs/` regenerated
- plex.tv account: all tokens/sessions revoked
- Router: Plex port forward removed
- Tower: Plex container media mounts set read-only

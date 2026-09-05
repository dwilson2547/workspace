# Vortex (Nexus Mods mod manager)

Vortex is Nexus Mods' official, open-source mod manager (published by Black Tree Gaming Ltd). It
handles downloading mods from Nexus, installing/enabling/disabling them, resolving load order, and
**deploying** them into a game's folder. It is *not* a mod loader — see
[MelonLoader](melonloader.md) for that layer.

## Where it is (the "always hard to find" answer)

On this machine (Windows, accessed from WSL under `/mnt`):

| Thing | Windows path | WSL path |
|---|---|---|
| Executable | `C:\Program Files\Black Tree Gaming Ltd\Vortex\Vortex.exe` | `/mnt/c/Program Files/Black Tree Gaming Ltd/Vortex/Vortex.exe` |
| Config / state | `C:\Users\dwils\AppData\Roaming\Vortex` | `/mnt/c/Users/dwils/AppData/Roaming/Vortex` |

It installs under **"Black Tree Gaming Ltd"**, not "Vortex" or "Nexus" — that's why it's hard to
find in the Start menu / Program Files. Search the Start menu for **Vortex**; if pinning helps,
pin it.

## Launching

- Normal use: Start menu → **Vortex**, or run the `.exe` above.
- From this WSL session (to open it on the Windows side):
  ```bash
  "/mnt/c/Program Files/Black Tree Gaming Ltd/Vortex/Vortex.exe" &
  ```

## Getting it (if reinstalling)

Download from Nexus Mods: https://www.nexusmods.com/site/mods/1 (direct API link:
https://api.nexusmods.com/vortex/download). Log in with the Nexus account so "Mod Manager Download"
buttons on mod pages hand off to Vortex.

## How it fits with the loader

Vortex manages the individual mods, but for most games those mods need a **mod loader** already
present or they won't load. For Unity games that's [MelonLoader](melonloader.md), installed as a
**separate step first**. Vortex leaves a `vortex.deployment.json` in the managed game's folder so
you can tell at a glance that Vortex is deploying there.

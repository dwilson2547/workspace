# Schedule I (Schedule 1)

Currently playing. Unity **IL2CPP** game, modded via [MelonLoader](../melonloader.md) with mods
managed by [Vortex](../vortex.md).

## Install paths (this machine)

| Thing | Windows path | WSL path |
|---|---|---|
| Game (Steam, D: library) | `D:\SteamLibrary\steamapps\common\Schedule I` | `/mnt/d/SteamLibrary/steamapps/common/Schedule I` |
| Executable | `…\Schedule I\Schedule I.exe` | `…/Schedule I/Schedule I.exe` |

Note the game folder is **"Schedule I"** (Roman numeral, with a space), not "Schedule 1".

## Engine / loader facts

- **IL2CPP** game — confirmed by `GameAssembly.dll` in the game root. This means:
  - Install the **Il2Cpp** MelonLoader variant.
  - The **.NET 6 Desktop Runtime** is required (an IL2CPP prerequisite). If the game crashes on
    startup, repair .NET 6 first.
- MelonLoader Nexus page for this game: https://www.nexusmods.com/schedule1/mods/1196 (v4.2.0).

## Current state (as documented)

The game folder already contains a working setup — no need to reinstall the loader unless it breaks:

- `MelonLoader/`, `version.dll` — MelonLoader is installed (`version.dll` is its proxy).
- `Mods/`, `Plugins/`, `UserData/` — MelonLoader's standard folders are present.
- `vortex.deployment.json` — Vortex is actively managing/deploying mods here.
- Also present: `bepinex/`, `doorstop_config.ini`, `winhttp.dll` — remnants of a BepInEx loader.
  MelonLoader is the active loader; leave BepInEx alone unless a specific mod calls for it, and
  don't run two loaders fighting over the same hooks if something misbehaves.

## Getting back into it (checklist)

1. Launch **Schedule I** once from Steam. Look for the **MelonLoader console** on startup — that
   confirms the loader is alive. If it doesn't appear, re-run the MelonLoader installer against the
   path above.
2. Open **[Vortex](../vortex.md)** (`Black Tree Gaming Ltd\Vortex\Vortex.exe`) → Schedule I profile
   → make sure mods are **enabled and deployed** (Vortex "Deploy Mods" if needed).
3. New mods: download via the mod's **"Mod Manager Download"** button on Nexus (hands off to
   Vortex), enable, deploy, relaunch.

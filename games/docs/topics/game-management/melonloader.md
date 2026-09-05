# MelonLoader (universal Unity mod loader)

MelonLoader is the runtime that loads mod code into a Unity game at launch. It is a **dedicated
install step, separate from Vortex** — Vortex manages mods, but the mods don't load unless
MelonLoader (or another loader) is already installed into the game. Do the loader **first**, then
add mods.

By LavaGang. Works across many Unity games and multiple launchers (Steam, etc.), on Windows and
Linux. It's the loader most of my modded games rely on, which is why it lives at the cross-game
level rather than in one game's notes.

- Wiki / installer home: https://melonwiki.xyz
- Nexus page (Schedule I mirror, v4.2.0, updated 14 Sep 2025): https://www.nexusmods.com/schedule1/mods/1196
- Discord: https://discord.gg/2Wn3N2P

## What it is

> "MelonLoader is the first universal mod loader for Unity games, supporting both **Il2Cpp** and
> **Mono**. It allows you to easily install and manage community-made mods and plugins across many
> games, with support for Windows, Linux, and multiple launchers."

The Il2Cpp vs Mono distinction matters: it decides which MelonLoader variant you install and which
runtime prerequisites you need. IL2CPP games additionally require the .NET 6 Desktop Runtime (see
Requirements).

## Installation (Automated – Recommended)

Verbatim from the mod page:

1. Download the **MelonLoader** Installer.
2. Launch the installer — it will automatically detect Unity games installed on your system.
3. Select your game, choose the appropriate version of **MelonLoader**, and click Install.
4. Launch your game — you'll now see **MelonLoader**'s startup console confirming installation.

That console window on launch is the confirmation the loader is working. Get the installer from the
[MelonLoader wiki](https://melonwiki.xyz) or the Nexus page above.

## Requirements

- **Microsoft Visual C++ 2015–2019 Redistributables** (x64 or x86, matching the game).
- **.NET Desktop Runtime 6.0** — required for **Il2Cpp** games.

## Mod management (folder layout)

Once installed, MelonLoader creates these folders in the game directory:

- **`Mods/`** — mods go here.
- **`Plugins/`** — plugins go here (inside the MelonLoader area).
- **`UserData/`** — configuration files are stored here.

When Vortex deploys a mod for a MelonLoader game, it's dropping files into `Mods/` (and sometimes
`UserData/`). Knowing this layout is useful for manually verifying a mod actually landed.

## Troubleshooting

- **Game not launching?** Ensure you installed the right **x64/x86** version.
- **Crashing on startup?** Install or repair the **.NET 6 Desktop Runtime**.
- **Il2Cpp mods on Linux?** Use **protontricks** to install .NET.
- **No MelonLoader console on launch?** The loader didn't install into that game — re-run the
  installer and point it at the correct game folder before blaming individual mods.

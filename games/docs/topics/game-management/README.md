# Game Management

How I mod and manage the games I **play**. This is the place to look when I'm getting back into a
modded game after a while and can't remember how the pieces fit together.

The modding stack for most of my games has three layers:

1. **Mod manager** — the app that downloads, installs, enables/disables, and deploys mods.
   I use **[Vortex](vortex.md)** (Nexus Mods' official manager). This is the app that's "always
   hard to find" — its exact launch path and where it stores things are documented in
   [vortex.md](vortex.md).
2. **Mod loader** — the runtime shim that actually loads mod code into the game at launch. Most of
   my games use **[MelonLoader](melonloader.md)**, a universal Unity mod loader. This is a
   **separate, dedicated install step** — Vortex does *not* set it up for you. Do the loader first,
   then let Vortex manage the individual mods.
3. **The mods themselves** — game-specific; managed by Vortex once the loader is in place.

> **General install order for a new modded game:** install the mod loader (MelonLoader) → confirm
> the game boots with the loader's console → then add Vortex-managed mods on top.

## Per-game notes

Each game gets its own file with its exact install paths, which loader/version it needs, and any
quirks:

- **[Schedule I / Schedule 1](games/schedule-1.md)** — currently playing. Unity **IL2CPP**,
  MelonLoader + Vortex. Already set up.

## Reference

- Nexus Mods: https://www.nexusmods.com
- Vortex download: https://www.nexusmods.com/site/mods/1 (or https://api.nexusmods.com/vortex/download)
- MelonLoader (LavaGang): https://melonwiki.xyz · Discord: https://discord.gg/2Wn3N2P

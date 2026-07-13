# WSL VDisk Size Management

## Context

WSL's `ext4.vhdx` grows dynamically but never shrinks on its own. After deleting bulk content inside
the distro, follow this procedure to reclaim the space on the Windows host.

> **Note:** Do not use `wsl --manage <distro> --set-sparse true`. Sparse VHD support is currently
> disabled by Microsoft due to potential data corruption, and forcing it with `--allow-unsafe` is
> not worth the risk. Use the diskpart compact method below instead.

## Steps

### 1. Trim the filesystem inside WSL

Marks deleted blocks as free so the compact step can actually reclaim them.

```bash
sudo fstrim -a
```

Optionally verify free space first with `df -h /` to confirm the cleanup took effect inside the
distro.

### 2. Shut down WSL

From PowerShell or CMD:

```powershell
wsl --shutdown
```

The VHDX must not be in use during compaction.

### 3. Locate the ext4.vhdx file

Search AppData if the path is unknown:

```powershell
Get-ChildItem $env:LOCALAPPDATA\Packages -Recurse -Filter ext4.vhdx -ErrorAction SilentlyContinue
```

(Alternatively, WinDirStat will surface it quickly as one of the largest files on the drive.)

Typical path:
`C:\Users\<user>\AppData\Local\Packages\<distro-package>\LocalState\ext4.vhdx`

### 4. Compact with diskpart

Run an elevated prompt, then:

```
diskpart
select vdisk file="C:\Users\<user>\AppData\Local\Packages\<distro-package>\LocalState\ext4.vhdx"
attach vdisk readonly
compact vdisk
detach vdisk
exit
```

Compaction can take a long time on large VHDX files (tens of minutes for hundreds of GB). Progress
is shown as a percentage.

### 5. Verify

Check the new file size in Explorer or:

```powershell
Get-Item "<path to ext4.vhdx>" | Select-Object Name, @{n='SizeGB';e={[math]::Round($_.Length/1GB,1)}}
```

## Maintenance Notes

- Repeat this procedure whenever the VHDX balloons again — it is a manual, one-time operation each
  run.
- Docker Desktop maintains its own separate VHDX (`docker-desktop-data`). If that's the culprit,
  run `docker system prune` inside first, then apply the same compact procedure to its vhdx.
- Alternative for systems with Hyper-V enabled: `Optimize-VHD -Path <path>\ext4.vhdx -Mode Full`
  (after `wsl --shutdown`) does the same thing as diskpart compact.

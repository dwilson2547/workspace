# Mounting exFAT Drives in WSL2

## Context

The Microsoft WSL2 custom kernel — even recent builds (6.6+) — does not include the exFAT kernel module despite mainline 6.6 having native exFAT support. `mount -t exfat` will fail. Do not waste time on this path.

## Working Method

### 1. Attach the disk (elevated PowerShell)

```powershell
wsl --mount \\.\PHYSICALDRIVEn --bare
```

Use `wmic diskdrive list brief` to find the disk number. `--bare` attaches without attempting to mount, which is necessary when the target filesystem isn't ext4.

### 2. Find the partition in WSL

```bash
lsblk
```

WD easystores have two partitions — a small recovery partition (1) and the data partition (2). Confirm by size.

### 3. Install exfat-fuse

```bash
sudo apt install exfat-fuse
```

### 4. Mount using the fuse binary directly

```bash
sudo mkdir -p /mnt/wd
sudo mount.exfat-fuse /dev/sde2 /mnt/wd
```

The key detail: use `mount.exfat-fuse` directly. Do **not** use `mount -t exfat` or `mount -t fuse.exfat` — both will fail.

### 5. Unmount and detach when done

```bash
sudo umount /mnt/wd
```

```powershell
wsl --unmount \\.\PHYSICALDRIVEn
```

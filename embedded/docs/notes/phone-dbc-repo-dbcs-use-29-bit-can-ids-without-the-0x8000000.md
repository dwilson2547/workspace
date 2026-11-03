---
title: phone-dbc-repo DBCs use 29-bit CAN ids without the 0x80000000 extended flag in BO_ lines
date: 2026-11-02
tags: dbc,cantools,can
---

cantools rejects these (even strict=False) with 'Standard frame id 0x... is more than 11 bits'. Fix when loading in Python: regex BO_ lines, set 0x80000000 on ids in (0x7FF, 0x80000000), load_string(strict=False), and key the message lookup by raw id (frame_id & 0x1FFFFFFF) so both STD and EXT dongle frames resolve. Verified against gm_global_a_lowspeed.dbc (DriverDoorStatus decodes). Working loader: robotics/robo-services/services/can_decode/app/main.py::load_dbc.

// Bench scan mode: works out the sensor map that currently exists only in the
// wiring loom, and prints it as a paste-ready SENSOR_MAP.
#pragma once

#include <stdint.h>

namespace scan {

// Walks every (mux, channel) pair, reports what is live, emits a config skeleton,
// then streams a live distance table so each sensor can be identified by waving a
// hand at it. Never returns.
void run();

}  // namespace scan

// PCA9548A discipline.
//
// Every VL53L1X answers to 0x29. If a channel is open on mux A *and* a channel is
// open on mux B at the same time, two sensors drive the bus on one address and
// every transaction is corrupt. select() therefore closes the other mux first,
// and this is the only place allowed to touch a mux control register.
#pragma once

#include <stdint.h>

namespace mux {

// Starts Wire and closes both muxes. Safe to call repeatedly.
void begin();

// Opens exactly one channel, closing the other mux first if needed.
// Returns false if the mux did not ACK (rail down, or wedged).
bool select(uint8_t addr, uint8_t channel);

// Closes both muxes. Call at init and after any I2C error.
void deselectAll();

// Does this mux ACK its own address? The control register sits upstream of the
// switches, so a mux is addressable whatever channel is open.
bool present(uint8_t addr);

// Upstream recovery: clock out a slave that is holding SDA low, then re-init the
// peripheral. Downstream faults do not need this -- closing the channel is
// enough -- but a wedged mux does.
void recoverBus();

}  // namespace mux

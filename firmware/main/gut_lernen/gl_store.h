#pragma once

#include "gl_core.h"

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* NVS persistence for the Gut lernen schedule. The whole gl_state_t is
 * stored as one blob (~1 KiB) under namespace "glernen". */

bool gl_store_load(gl_state_t *st);
bool gl_store_save(const gl_state_t *st);
void gl_store_reset(void);

#ifdef __cplusplus
}
#endif

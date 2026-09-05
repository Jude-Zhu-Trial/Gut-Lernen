#pragma once

#include "esp_lcd_types.h"

/* Hook the panel draw_bitmap to mirror the framebuffer, listen on the USB
 * serial port for "FAP_SCREENSHOT_V1" and dump an RGB565LE frame. */
void gl_screenshot_start(esp_lcd_panel_handle_t panel);

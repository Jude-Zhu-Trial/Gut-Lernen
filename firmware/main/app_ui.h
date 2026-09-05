#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "gut_lernen/gl_data.h"

struct _lv_display_t;

void app_ui_init(struct _lv_display_t *disp);
void app_ui_show_front(const gl_word_t *w, uint16_t idx);
void app_ui_show_back(const gl_word_t *w);
void app_ui_show_done(bool all_done, uint16_t n, uint16_t r, uint16_t f);
void app_ui_show_reset_confirm(void);
void app_ui_show_reset_done(void);
void app_ui_set_status(uint16_t n, uint16_t r, uint16_t f);

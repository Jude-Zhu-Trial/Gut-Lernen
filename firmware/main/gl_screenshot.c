#include "gl_screenshot.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "driver/usb_serial_jtag.h"
#include "esp_lcd_panel.h"
#include "esp_log.h"

#include "bsp_display.h"
#include "bsp_pins.h"
#include "lvgl.h"

#define SHOT_CMD        "FAP_SCREENSHOT_V1"
#define SHOT_TASK_STACK 4096
#define SHOT_TASK_PRIO  2

static esp_err_t (*s_orig_draw_bitmap)(esp_lcd_panel_handle_t panel,
                                       int x_start, int y_start,
                                       int x_end, int y_end,
                                       const void *color_data);
static volatile bool s_active;
static uint8_t *s_buf;

/* esp_lvgl_port flushes with swap_bytes=true: the bytes reaching the panel
 * are already big-endian swapped, so copy them back to little-endian here. */
static esp_err_t shot_draw_bitmap(esp_lcd_panel_handle_t panel, int x_start,
                                  int y_start, int x_end, int y_end,
                                  const void *color_data)
{
    if (s_active) {
        const uint8_t *src = (const uint8_t *)color_data;
        for (int y = y_start; y < y_end; y++) {
            for (int x = x_start; x < x_end; x++) {
                size_t dst = ((size_t)y * BSP_LCD_W + (size_t)x) * 2;
                size_t off = ((size_t)(y - y_start) * (size_t)(x_end - x_start)
                             + (size_t)(x - x_start)) * 2;
                s_buf[dst] = src[off + 1];
                s_buf[dst + 1] = src[off];
            }
        }
    }
    return s_orig_draw_bitmap(panel, x_start, y_start, x_end, y_end, color_data);
}

static void shot_send_all(const void *data, size_t len)
{
    const uint8_t *p = (const uint8_t *)data;
    while (len > 0) {
        int w = usb_serial_jtag_write_bytes(p, len, pdMS_TO_TICKS(1000));
        if (w <= 0) return;
        p += w;
        len -= (size_t)w;
    }
}

static void shot_capture(void)
{
    esp_log_level_set("*", ESP_LOG_NONE);

    s_buf = calloc((size_t)BSP_LCD_W * (size_t)BSP_LCD_H, 2);
    if (s_buf == NULL) {
        esp_log_level_set("*", ESP_LOG_INFO);
        return;
    }

    s_active = true;
    bool ok = bsp_lvgl_lock(3000);
    if (ok) {
        lv_obj_invalidate(lv_screen_active());
        lv_refr_now(NULL);
        bsp_lvgl_unlock();
    }
    s_active = false;
    if (!ok) {
        free(s_buf);
        s_buf = NULL;
        esp_log_level_set("*", ESP_LOG_INFO);
        return;
    }

    char hdr[64];
    int hl = snprintf(hdr, sizeof(hdr), "FAP_SCREENSHOT_V1 %d %d RGB565LE %d\n",
                      (int)BSP_LCD_W, (int)BSP_LCD_H,
                      (int)BSP_LCD_W * (int)BSP_LCD_H * 2);
    if (hl > 0) shot_send_all(hdr, (size_t)hl);
    shot_send_all(s_buf, (size_t)BSP_LCD_W * (size_t)BSP_LCD_H * 2);

    free(s_buf);
    s_buf = NULL;
    esp_log_level_set("*", ESP_LOG_INFO);
}

static void shot_task(void *arg)
{
    char line[32];
    size_t len = 0;
    for (;;) {
        uint8_t ch;
        int n = usb_serial_jtag_read_bytes(&ch, 1, pdMS_TO_TICKS(100));
        if (n <= 0) continue;
        if (ch == '\n' || ch == '\r') {
            if (len > 0) {
                line[len] = '\0';
                if (strcmp(line, SHOT_CMD) == 0) shot_capture();
                len = 0;
            }
        } else if (len + 1 < sizeof(line)) {
            line[len++] = (char)ch;
        } else {
            len = 0;
        }
    }
}

void gl_screenshot_start(esp_lcd_panel_handle_t panel)
{
    if (panel == NULL) return;
    s_orig_draw_bitmap = panel->draw_bitmap;
    panel->draw_bitmap = shot_draw_bitmap;

    const usb_serial_jtag_driver_config_t cfg = {
        .rx_buffer_size = 1024,
        .tx_buffer_size = 1024,
    };
    usb_serial_jtag_driver_install(&cfg);

    xTaskCreate(shot_task, "gl_shot", SHOT_TASK_STACK, NULL,
                SHOT_TASK_PRIO, NULL);
}

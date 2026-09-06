#include <stdbool.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

#include "esp_log.h"
#include "nvs.h"
#include "nvs_flash.h"

#include "bsp_button.h"
#include "bsp_display.h"

#include "app_ui.h"
#include "gl_screenshot.h"
#include "gut_lernen/gl_core.h"
#include "gut_lernen/gl_audio.h"
#include "gut_lernen/gl_data.h"
#include "gut_lernen/gl_store.h"

static const char *TAG = "main";

#define RESET_CONFIRM_WINDOW_MS 5000

typedef enum {
    ST_FRONT = 0,
    ST_BACK,
    ST_DONE,
    ST_RESET_CONFIRM,
    ST_RESET_DONE,
} app_state_t;

typedef struct {
    bsp_btn_t btn;
    bsp_btn_ev_t ev;
} btn_msg_t;

static QueueHandle_t s_btn_q;
static gl_state_t g_st;
static app_state_t g_state;
static app_state_t g_prev;
static bool g_done_all;
static uint16_t g_today;
static TickType_t g_reset_armed;

static void btn_cb(bsp_btn_t btn, bsp_btn_ev_t ev, void *user)
{
    btn_msg_t m = { .btn = btn, .ev = ev };
    xQueueSend((QueueHandle_t)user, &m, 0);
}

/* Each power-up counts as one day: read old value, +1, write back. */
static uint16_t bump_day(void)
{
    uint32_t day = 0;
    nvs_handle_t h;
    if (nvs_open("gl_day", NVS_READWRITE, &h) == ESP_OK) {
        nvs_get_u32(h, "day", &day);
        day += 1;
        nvs_set_u32(h, "day", day);
        nvs_commit(h);
        nvs_close(h);
    } else {
        day = 1;
    }
    return (uint16_t)day;
}

static const gl_word_t *word_at(uint16_t idx)
{
    if (idx < GL_LEVEL_A2_FIRST) {
        return &GL_LEVEL_TABLE[0][idx];
    }
    if (idx < GL_LEVEL_B1_FIRST) {
        return &GL_LEVEL_TABLE[1][idx - GL_LEVEL_A2_FIRST];
    }
    return &GL_LEVEL_TABLE[2][idx - GL_LEVEL_B1_FIRST];
}

static void update_status(void)
{
    app_ui_set_status(g_st.meta.new_today, g_st.meta.reviews_today,
                      g_st.meta.again_today);
}

static void enter_done(bool all_done)
{
    g_state = ST_DONE;
    g_done_all = all_done;
    app_ui_show_done(all_done, g_st.meta.new_today,
                     g_st.meta.reviews_today, g_st.meta.again_today);
    update_status();
}

static void start_card(uint16_t idx)
{
    gl_audio_stop();
    g_st.current = idx;
    g_state = ST_FRONT;
    app_ui_show_front(word_at(idx), idx);
    update_status();
}

static void start_study(void)
{
    int idx = gl_pick_next(&g_st, g_today);
    if (idx < 0) {
        enter_done(false);
        return;
    }
    start_card((uint16_t)idx);
}

static void restore_prev_view(void)
{
    if (g_prev == ST_DONE) {
        app_ui_show_done(g_done_all, g_st.meta.new_today,
                         g_st.meta.reviews_today, g_st.meta.again_today);
        return;
    }
    if (g_prev == ST_BACK) {
        app_ui_show_back(word_at(g_st.current));
        return;
    }
    app_ui_show_front(word_at(g_st.current), g_st.current);
}

static void cancel_reset(void)
{
    g_state = g_prev;
    restore_prev_view();
}

static void do_reset(void)
{
    gl_store_reset();
    gl_reset(&g_st, GL_WORD_TOTAL);
    gl_roll_day(&g_st, g_today);
    g_state = ST_RESET_DONE;
    app_ui_show_reset_done();
    update_status();
}

static void handle_ok_long(void)
{
    TickType_t now = xTaskGetTickCount();
    if (g_state == ST_RESET_CONFIRM
        && (now - g_reset_armed) <= pdMS_TO_TICKS(RESET_CONFIRM_WINDOW_MS)) {
        do_reset();
        return;
    }
    if (g_state != ST_RESET_CONFIRM) {
        g_prev = (g_state == ST_RESET_DONE) ? ST_DONE : g_state;
    }
    g_state = ST_RESET_CONFIRM;
    g_reset_armed = now;
    app_ui_show_reset_confirm();
}

static void handle_click(bsp_btn_t btn)
{
    switch (g_state) {
    case ST_FRONT:
        if (btn == BSP_BTN_OK) {
            g_state = ST_BACK;
            app_ui_show_back(word_at(g_st.current));
        } else if (btn == BSP_BTN_UP) {
            gl_audio_play(g_st.current);
        }
        break;
    case ST_BACK:
        if (btn == BSP_BTN_UP) {
            gl_apply_grade(&g_st, (int)g_st.current, GL_GRADE_AGAIN, g_today);
            gl_store_save(&g_st);
            start_study();
        } else if (btn == BSP_BTN_OK) {
            gl_apply_grade(&g_st, (int)g_st.current, GL_GRADE_GOOD, g_today);
            gl_store_save(&g_st);
            start_study();
        } else if (btn == BSP_BTN_DOWN) {
            gl_apply_grade(&g_st, (int)g_st.current, GL_GRADE_EASY, g_today);
            gl_store_save(&g_st);
            start_study();
        }
        break;
    case ST_DONE:
        if (btn == BSP_BTN_OK) {
            int idx = gl_pick_next(&g_st, g_today);
            if (idx < 0) {
                enter_done(true);
            } else {
                start_card((uint16_t)idx);
            }
        }
        break;
    case ST_RESET_DONE:
        if (btn == BSP_BTN_OK) {
            start_study();
        }
        break;
    case ST_RESET_CONFIRM:
        break;
    }
}

static void handle_event(const btn_msg_t *m)
{
    bool ok_long = (m->ev == BSP_BTN_LONG && m->btn == BSP_BTN_OK);
    if (!ok_long && g_state == ST_RESET_CONFIRM) {
        bool is_tap = (m->ev == BSP_BTN_CLICK || m->ev == BSP_BTN_DOUBLE);
        /* The confirming long-press starts with a PRESS event: ignore it.
         * A CLICK right after arming may be the tail of the arming press. */
        if (is_tap && (m->btn != BSP_BTN_OK
                       || (xTaskGetTickCount() - g_reset_armed)
                          > pdMS_TO_TICKS(600))) {
            cancel_reset();
        }
        return;
    }
    if (ok_long) {
        handle_ok_long();
        return;
    }
    if (m->ev != BSP_BTN_CLICK) return;

    /* 幻影按键防线:两次单击间隔小于 200ms 判为噪声丢弃(人手达不到这个速度)。
       避免 ADC 噪声风暴高频触发全屏重绘 + NVS 写入,拖垮堆/复位循环。 */
    static TickType_t last_click = 0;
    TickType_t now = xTaskGetTickCount();
    if (last_click != 0 && (now - last_click) < pdMS_TO_TICKS(200)) return;
    last_click = now;

    handle_click(m->btn);
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    g_today = bump_day();

    ESP_ERROR_CHECK(bsp_display_init());
    bsp_display_backlight(100);

    struct _lv_display_t *disp = bsp_lvgl_init();
    if (disp == NULL) {
        ESP_LOGE(TAG, "bsp_lvgl_init failed");
        return;
    }

    s_btn_q = xQueueCreate(16, sizeof(btn_msg_t));
    if (s_btn_q == NULL) {
        ESP_LOGE(TAG, "button queue create failed");
        return;
    }
    esp_err_t be = bsp_button_init(btn_cb, s_btn_q);
    if (be != ESP_OK) {
        ESP_LOGE(TAG, "bsp_button_init failed: %s —— 三键将无响应,接 USB 看日志",
                 esp_err_to_name(be));
    }

    gl_screenshot_start(bsp_display_panel());

    gl_audio_init();

    if (!bsp_lvgl_lock(3000)) {
        ESP_LOGE(TAG, "lvgl lock timeout at init");
        return;
    }
    app_ui_init(disp);
    if (!gl_store_load(&g_st)) {
        gl_reset(&g_st, GL_WORD_TOTAL);
    }
    gl_roll_day(&g_st, g_today);
    start_study();
    bsp_lvgl_unlock();

    for (;;) {
        btn_msg_t m;
        if (xQueueReceive(s_btn_q, &m, portMAX_DELAY) != pdTRUE) continue;
        if (!bsp_lvgl_lock(3000)) {
            ESP_LOGE(TAG, "lvgl lock timeout");
            continue;
        }
        handle_event(&m);
        bsp_lvgl_unlock();
    }
}

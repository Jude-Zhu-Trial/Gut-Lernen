#include "app_ui.h"

#include <stdio.h>

#include "lvgl.h"

#include "bsp_pins.h"
#include "fonts/gl_fonts.h"
#include "gut_lernen/gl_data.h"

#define UI_BG        0x0E1620
#define UI_FG        0xFFFFFF
#define UI_FG_DIM    0x9FB0BF
#define UI_BADGE_BG  0x37547A

#define UI_W BSP_LCD_W
#define UI_H BSP_LCD_H

static lv_font_t *s_head;
static lv_font_t *s_body;
static lv_font_t *s_ipa;

static lv_obj_t *s_status;
static lv_obj_t *s_badge;
static lv_obj_t *s_badge_txt;
static lv_obj_t *s_title;
static lv_obj_t *s_sub;
static lv_obj_t *s_msg;
static lv_obj_t *s_hint;
static lv_obj_t *s_foot;
static lv_obj_t *s_back;
static lv_obj_t *s_word_sm;
static lv_obj_t *s_phon;
static lv_obj_t *s_cn;
static lv_obj_t *s_ex;
static lv_obj_t *s_ex_cn;

static const char *level_name(uint16_t idx)
{
    if (idx < GL_LEVEL_A2_FIRST) return "A1";
    if (idx < GL_LEVEL_B1_FIRST) return "A2";
    return "B1";
}

static lv_obj_t *make_label(lv_obj_t *parent, const lv_font_t *font,
                            uint32_t color, lv_text_align_t align)
{
    lv_obj_t *l = lv_label_create(parent);
    lv_obj_set_style_text_font(l, font, 0);
    lv_obj_set_style_text_color(l, lv_color_hex(color), 0);
    lv_obj_set_style_text_align(l, align, 0);
    lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
    return l;
}

static void show(lv_obj_t *o, bool on)
{
    if (on) lv_obj_clear_flag(o, LV_OBJ_FLAG_HIDDEN);
    else lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN);
}

static void set_view_front(void)
{
    show(s_badge, true);
    show(s_title, true);
    show(s_sub, true);
    show(s_msg, false);
    show(s_back, false);
    show(s_hint, true);
    show(s_foot, true);
}

static void set_view_back(void)
{
    show(s_badge, false);
    show(s_title, false);
    show(s_sub, false);
    show(s_msg, false);
    show(s_back, true);
    show(s_hint, true);
    show(s_foot, false);
}

static void set_view_done(void)
{
    show(s_badge, false);
    show(s_title, true);
    show(s_sub, false);
    show(s_msg, true);
    show(s_back, false);
    show(s_hint, true);
    show(s_foot, false);
}

static void set_view_message(void)
{
    show(s_badge, false);
    show(s_title, true);
    show(s_sub, false);
    show(s_msg, false);
    show(s_back, false);
    show(s_hint, false);
    show(s_foot, false);
}

void app_ui_init(struct _lv_display_t *disp)
{
    lv_obj_t *scr = lv_display_get_screen_active(disp);

    s_head = lv_tiny_ttf_create_data(wqy_subset_ttf,
                                     (size_t)wqy_subset_ttf_len, 32);
    s_body = lv_tiny_ttf_create_data(wqy_subset_ttf,
                                     (size_t)wqy_subset_ttf_len, 20);
    s_ipa = lv_tiny_ttf_create_data(dejavu_ipa_ttf,
                                    (size_t)dejavu_ipa_ttf_len, 20);
    s_body->fallback = s_ipa;

    lv_obj_set_style_bg_color(scr, lv_color_hex(UI_BG), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);

    s_status = make_label(scr, s_body, UI_FG_DIM, LV_TEXT_ALIGN_CENTER);
    lv_obj_set_width(s_status, UI_W - 16);
    lv_obj_set_x(s_status, 8);
    lv_obj_set_y(s_status, 4);

    s_badge = lv_obj_create(scr);
    lv_obj_set_size(s_badge, 52, 28);
    lv_obj_set_pos(s_badge, 12, 30);
    lv_obj_set_style_bg_color(s_badge, lv_color_hex(UI_BADGE_BG), 0);
    lv_obj_set_style_bg_opa(s_badge, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(s_badge, 14, 0);
    lv_obj_set_style_border_width(s_badge, 0, 0);
    lv_obj_set_style_pad_all(s_badge, 0, 0);
    lv_obj_clear_flag(s_badge, LV_OBJ_FLAG_SCROLLABLE);
    s_badge_txt = make_label(s_badge, s_body, UI_FG, LV_TEXT_ALIGN_CENTER);
    lv_obj_center(s_badge_txt);

    s_sub = make_label(scr, s_body, UI_FG_DIM, LV_TEXT_ALIGN_CENTER);
    lv_obj_set_width(s_sub, UI_W - 24);
    lv_obj_set_x(s_sub, 12);
    lv_obj_set_y(s_sub, 90);
    lv_label_set_text(s_sub, "Gut lernen 词库");

    s_title = make_label(scr, s_head, UI_FG, LV_TEXT_ALIGN_CENTER);
    lv_obj_set_width(s_title, UI_W - 24);
    lv_obj_set_x(s_title, 12);
    lv_obj_set_y(s_title, 118);

    s_msg = make_label(scr, s_body, UI_FG, LV_TEXT_ALIGN_CENTER);
    lv_obj_set_width(s_msg, UI_W - 24);
    lv_obj_set_x(s_msg, 12);
    lv_obj_set_y(s_msg, 182);

    s_hint = make_label(scr, s_body, UI_FG, LV_TEXT_ALIGN_CENTER);
    lv_obj_set_width(s_hint, UI_W - 16);
    lv_obj_set_x(s_hint, 8);
    lv_obj_set_y(s_hint, 264);

    s_foot = make_label(scr, s_body, UI_FG_DIM, LV_TEXT_ALIGN_CENTER);
    lv_obj_set_width(s_foot, UI_W - 16);
    lv_obj_set_x(s_foot, 8);
    lv_obj_set_y(s_foot, 294);

    s_back = lv_obj_create(scr);
    lv_obj_set_pos(s_back, 8, 34);
    lv_obj_set_size(s_back, UI_W - 16, 224);
    lv_obj_set_style_bg_opa(s_back, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(s_back, 0, 0);
    lv_obj_set_style_pad_all(s_back, 2, 0);
    lv_obj_set_style_pad_row(s_back, 6, 0);
    lv_obj_set_flex_flow(s_back, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_scrollbar_mode(s_back, LV_SCROLLBAR_MODE_OFF);
    lv_obj_clear_flag(s_back, LV_OBJ_FLAG_SCROLLABLE);

    s_word_sm = make_label(s_back, s_body, UI_FG, LV_TEXT_ALIGN_LEFT);
    lv_obj_set_width(s_word_sm, UI_W - 24);
    s_phon = make_label(s_back, s_body, UI_FG_DIM, LV_TEXT_ALIGN_LEFT);
    lv_obj_set_width(s_phon, UI_W - 24);
    s_cn = make_label(s_back, s_body, UI_FG, LV_TEXT_ALIGN_LEFT);
    lv_obj_set_width(s_cn, UI_W - 24);
    s_ex = make_label(s_back, s_body, UI_FG_DIM, LV_TEXT_ALIGN_LEFT);
    lv_obj_set_width(s_ex, UI_W - 24);
    s_ex_cn = make_label(s_back, s_body, UI_FG, LV_TEXT_ALIGN_LEFT);
    lv_obj_set_width(s_ex_cn, UI_W - 24);
}

void app_ui_set_status(uint16_t n, uint16_t r, uint16_t f)
{
    char buf[48];
    snprintf(buf, sizeof(buf), "新 %d  复 %d  忘 %d",
             (int)n, (int)r, (int)f);
    lv_label_set_text(s_status, buf);
}

void app_ui_show_front(const gl_word_t *w, uint16_t idx)
{
    lv_label_set_text(s_badge_txt, level_name(idx));
    lv_label_set_text(s_title, w->german);
    lv_label_set_text(s_hint, "按 OK 翻面");
    lv_label_set_text(s_foot, "长按 OK 重置进度");
    set_view_front();
}

void app_ui_show_back(const gl_word_t *w)
{
    lv_label_set_text(s_word_sm, w->german);
    if (w->phonetic[0] == '\0') {
        lv_label_set_text(s_phon, "");
        show(s_phon, false);
    } else {
        lv_label_set_text(s_phon, w->phonetic);
        show(s_phon, true);
    }
    lv_label_set_text(s_cn, w->chinese);
    lv_label_set_text(s_ex, w->example);
    lv_label_set_text(s_ex_cn, w->example_cn);
    lv_label_set_text(s_hint, "UP 再来  OK 记得  DOWN 简单");
    set_view_back();
}

void app_ui_show_done(bool all_done, uint16_t n, uint16_t r, uint16_t f)
{
    char buf[48];
    snprintf(buf, sizeof(buf), "新 %d  复 %d  忘 %d",
             (int)n, (int)r, (int)f);
    lv_label_set_text(s_msg, buf);
    lv_label_set_text(s_title, all_done ? "全部学完了" : "今日完成！");
    lv_label_set_text(s_hint, "按 OK 继续");
    set_view_done();
}

void app_ui_show_reset_confirm(void)
{
    lv_label_set_text(s_title, "再长按一次确认");
    set_view_message();
}

void app_ui_show_reset_done(void)
{
    lv_label_set_text(s_title, "进度已重置");
    set_view_message();
}

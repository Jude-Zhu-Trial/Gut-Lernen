#include "gl_core.h"

#include <string.h>

#define GL_EASE_DEFAULT_X10 25
#define GL_EASE_MIN_X10 13
#define GL_EASE_MAX_X10 35
#define GL_INTERVAL_MAX_DAYS 60

static uint16_t clamp_u16(uint32_t v, uint16_t lo, uint16_t hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return (uint16_t)v;
}

static void init_word(gl_word_state_t *w)
{
    w->status = GL_STATUS_NEW;
    w->reps = 0;
    w->lapses = 0;
    w->ease_x10 = GL_EASE_DEFAULT_X10;
    w->interval_d = 0;
    w->due_day = 0;
}

void gl_reset(gl_state_t *st, uint16_t word_count)
{
    if (st == NULL || word_count > GL_MAX_WORDS) {
        word_count = (word_count > GL_MAX_WORDS) ? GL_MAX_WORDS : 0;
    }
    st->word_count = word_count;
    for (uint16_t i = 0; i < word_count; i++) {
        init_word(&st->words[i]);
    }
    memset(&st->meta, 0, sizeof(st->meta));
    st->meta.new_per_day = GL_NEW_PER_DAY_DEFAULT;
    st->current = 0;
}

bool gl_roll_day(gl_state_t *st, uint16_t today)
{
    if (st == NULL || st->meta.last_day == today) {
        return false;
    }
    st->meta.last_day = today;
    st->meta.new_today = 0;
    st->meta.reviews_today = 0;
    st->meta.again_today = 0;
    return true;
}

uint16_t gl_due_reviews(const gl_state_t *st, uint16_t today)
{
    uint16_t due = 0;
    for (uint16_t i = 0; i < st->word_count; i++) {
        const gl_word_state_t *w = &st->words[i];
        if (w->status == GL_STATUS_NEW) continue;
        if (w->due_day <= today) due++;
    }
    return due;
}

uint16_t gl_new_budget(const gl_state_t *st)
{
    uint16_t used = st->meta.new_today;
    if (used >= st->meta.new_per_day) return 0;
    return (uint16_t)(st->meta.new_per_day - used);
}

int gl_pick_next(gl_state_t *st, uint16_t today)
{
    /* 1) most-overdue learning/review word */
    int best = -1;
    uint16_t best_due = 0xFFFF;
    for (uint16_t i = 0; i < st->word_count; i++) {
        const gl_word_state_t *w = &st->words[i];
        if (w->status == GL_STATUS_NEW) continue;
        if (w->due_day <= today && w->due_day < best_due) {
            best_due = w->due_day;
            best = (int)i;
        }
    }
    if (best >= 0) return best;

    /* 2) a fresh new word while the budget lasts (round-robin from current) */
    if (gl_new_budget(st) == 0) return -1;
    for (uint16_t k = 0; k < st->word_count; k++) {
        uint16_t i = (uint16_t)((st->current + k) % st->word_count);
        if (st->words[i].status == GL_STATUS_NEW) {
            return (int)i;
        }
    }
    return -1;
}

static uint16_t next_interval(const gl_word_state_t *w, gl_grade_t grade)
{
    uint32_t itv;
    uint16_t ease_x10 = w->ease_x10;

    switch (w->status) {
    case GL_STATUS_NEW:
    case GL_STATUS_LEARNING:
    case GL_STATUS_RELEARNING:
        if (grade == GL_GRADE_AGAIN) return 0; /* same day */
        if (grade == GL_GRADE_EASY) return 2;
        return 1;
    default:
        break;
    }

    switch (grade) {
    case GL_GRADE_AGAIN:
        itv = 0;
        break;
    case GL_GRADE_GOOD:
        itv = ((uint32_t)w->interval_d * ease_x10 + 5) / 10;
        if (itv < 1) itv = 1;
        break;
    default: /* EASY */
        itv = ((uint32_t)w->interval_d * ease_x10 * 13 / 10 + 5) / 10;
        if (itv < 2) itv = 2;
        break;
    }
    return clamp_u16(itv, 0, GL_INTERVAL_MAX_DAYS);
}

void gl_apply_grade(gl_state_t *st, int idx, gl_grade_t grade, uint16_t today)
{
    if (st == NULL || idx < 0 || (uint16_t)idx >= st->word_count) return;

    gl_word_state_t *w = &st->words[idx];
    bool was_new = (w->status == GL_STATUS_NEW);

    if (grade == GL_GRADE_AGAIN) {
        w->lapses = (uint8_t)(w->lapses < 255 ? w->lapses + 1 : 255);
        w->ease_x10 = (uint8_t)(w->ease_x10 >= 2 ? w->ease_x10 - 2 : GL_EASE_MIN_X10);
        if (w->ease_x10 < GL_EASE_MIN_X10) w->ease_x10 = GL_EASE_MIN_X10;
        w->status = GL_STATUS_RELEARNING;
        w->reps = 0;
    } else {
        if (grade == GL_GRADE_EASY) {
            w->ease_x10 = (uint8_t)(w->ease_x10 + 1);
        }
        w->reps = (uint8_t)(w->reps < 255 ? w->reps + 1 : 255);
        w->status = GL_STATUS_REVIEW;
    }

    if (w->ease_x10 > GL_EASE_MAX_X10) w->ease_x10 = GL_EASE_MAX_X10;

    w->interval_d = next_interval(w, grade);
    w->due_day = (uint16_t)(today + w->interval_d);

    if (was_new) {
        st->meta.new_today++;
        st->current = (uint16_t)((idx + 1) % st->word_count);
    } else {
        st->meta.reviews_today++;
        if (grade == GL_GRADE_AGAIN) st->meta.again_today++;
    }
}

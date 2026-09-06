#pragma once

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Pure scheduling core for Gut lernen. No ESP-IDF / LVGL includes here. */

#define GL_MAX_WORDS 3400
#define GL_NEW_PER_DAY_DEFAULT 10

typedef enum {
    GL_STATUS_NEW = 0,
    GL_STATUS_LEARNING = 1,
    GL_STATUS_RELEARNING = 2,
    GL_STATUS_REVIEW = 3,
} gl_status_t;

typedef struct {
    uint8_t status;      /* gl_status_t */
    uint8_t reps;        /* successful review count */
    uint8_t lapses;      /* times the word was forgotten */
    uint8_t ease_x10;    /* SM-2 ease factor * 10, default 25 */
    uint16_t interval_d; /* current interval in whole days */
    uint16_t due_day;    /* epoch day when the word is due again */
} gl_word_state_t;

typedef enum {
    GL_GRADE_AGAIN = 0,
    GL_GRADE_GOOD = 1,
    GL_GRADE_EASY = 2,
} gl_grade_t;

typedef struct {
    uint16_t new_per_day;
    /* rolling daily counters (reset when day changes) */
    uint16_t new_today;
    uint16_t reviews_today;
    uint16_t again_today;
    uint16_t last_day; /* epoch day the counters belong to */
} gl_session_meta_t;

typedef struct {
    uint16_t word_count;
    gl_word_state_t words[GL_MAX_WORDS];
    gl_session_meta_t meta;
    uint16_t current; /* index of the word being studied */
} gl_state_t;

/* Reset to a pristine schedule. */
void gl_reset(gl_state_t *st, uint16_t word_count);

/* Roll daily counters when the calendar day changed. Returns true if rolled. */
bool gl_roll_day(gl_state_t *st, uint16_t today);

/* Pick the next word to study: due reviews first, then new words while the
 * daily new-word budget allows. Returns word index or -1 when done. */
int gl_pick_next(gl_state_t *st, uint16_t today);

/* Apply a grade to the word at idx for the given day. */
void gl_apply_grade(gl_state_t *st, int idx, gl_grade_t grade, uint16_t today);

/* Counters for display: due reviews today and remaining new-word budget. */
uint16_t gl_due_reviews(const gl_state_t *st, uint16_t today);
uint16_t gl_new_budget(const gl_state_t *st);

#ifdef __cplusplus
}
#endif

#pragma once

#include <stdint.h>

typedef struct {
    const char *german;
    const char *phonetic;
    const char *chinese;
    const char *example;
    const char *example_cn;
} gl_word_t;

extern const gl_word_t *const GL_LEVEL_TABLE[3];
extern const uint16_t GL_LEVEL_COUNTS[3];
extern const uint16_t GL_WORD_TOTAL;

/* Flat index helpers: 0 .. A1-1 | A1 .. A1+A2-1 | ... */
#define GL_LEVEL_A1_FIRST (0u)
#define GL_LEVEL_A2_FIRST (50u)
#define GL_LEVEL_B1_FIRST (86u)


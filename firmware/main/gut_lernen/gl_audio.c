#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_heap_caps.h"
#include "esp_log.h"

#include "bsp_audio.h"

#include "gut_lernen/gl_audio.h"

#define MINIMP3_ONLY_MP3
#define MINIMP3_NO_SIMD
#include "minimp3.h"

static const char *TAG = "gl_audio";

/* Blob embedded from main/audio_blob.bin via CMake EMBED_FILES. */
extern const uint8_t audio_blob_bin_start[] asm("_binary_audio_blob_bin_start");
extern const uint8_t audio_blob_bin_end[] asm("_binary_audio_blob_bin_end");

#define GL_AUDIO_HZ 22050
#define GL_AUDIO_VOLUME 85

static TaskHandle_t s_task;
static bool s_hw_ready;
static uint32_t s_hw_hz;

static bool lookup(uint16_t idx, uint32_t *off, uint32_t *len)
{
    for (uint32_t i = 0; i < GL_AUDIO_COUNT; ++i) {
        if (GL_AUDIO_INDEX[i].idx == idx) {
            *off = GL_AUDIO_INDEX[i].off;
            *len = GL_AUDIO_INDEX[i].len;
            return true;
        }
    }
    return false;
}

bool gl_audio_available(uint16_t word_idx)
{
    uint32_t off, len;
    return lookup(word_idx, &off, &len);
}

static bool ensure_hw(uint32_t hz)
{
    if (!s_hw_ready) {
        if (bsp_audio_init() != ESP_OK) {
            ESP_LOGE(TAG, "bsp_audio_init failed, audio disabled");
            return false;
        }
        s_hw_ready = true;
    }
    if (s_hw_hz != hz) {
        if (bsp_audio_set_format(hz, 16, 1) != ESP_OK) {
            ESP_LOGE(TAG, "set_format %lu Hz failed", (unsigned long)hz);
            return false;
        }
        bsp_audio_set_volume(GL_AUDIO_VOLUME);
        s_hw_hz = hz;
    }
    return true;
}

static void audio_task(void *arg)
{
    /* Decoder ~7KB + pcm 2*1152*2ch*2B ≈ 9.2KB + index walk: keep off stack. */
    mp3dec_t *dec = heap_caps_malloc(sizeof(mp3dec_t), MALLOC_CAP_INTERNAL);
    int16_t *pcm = heap_caps_malloc(
        MINIMP3_MAX_SAMPLES_PER_FRAME * 2 * sizeof(int16_t), MALLOC_CAP_INTERNAL);
    if (dec == NULL || pcm == NULL) {
        ESP_LOGE(TAG, "audio buffers alloc failed, audio disabled");
        vTaskDelete(NULL);
        return;
    }

    for (;;) {
        uint32_t v = ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        /* 0 never delivered by notify-take; 1 is the reserved stop signal. */
        if (v <= 1) {
            continue;
        }
        uint16_t idx = (uint16_t)(v - 1);
        uint32_t off, len;
        if (!lookup(idx, &off, &len)) {
            continue;
        }
        const size_t blob_size = (size_t)(audio_blob_bin_end - audio_blob_bin_start);
        if ((size_t)off >= blob_size || (size_t)off + len > blob_size) {
            ESP_LOGW(TAG, "audio index out of blob range");
            continue;
        }

        mp3dec_init(dec);
        const uint8_t *p = audio_blob_bin_start + off;
        size_t remaining = len;
        while (remaining > 0) {
            /* New request arriving interrupts current playback. */
            uint32_t pending = ulTaskNotifyTake(pdTRUE, 0);
            if (pending != 0) {
                if (pending == 1) { /* 0 + 1: explicit stop */
                    remaining = 0;
                    break;
                }
                xTaskNotify(s_task, pending, eSetValueWithOverwrite);
                remaining = 0;
                break;
            }

            mp3dec_frame_info_t info;
            int samples = mp3dec_decode_frame(dec, p, (int)remaining, pcm, &info);
            if (info.frame_bytes == 0) {
                break; /* corrupt / truncated stream */
            }
            p += info.frame_bytes;
            remaining -= info.frame_bytes;
            if (samples == 0) {
                continue; /* header frame */
            }
            if (!ensure_hw(info.hz == 0 ? GL_AUDIO_HZ : (uint32_t)info.hz)) {
                break;
            }
            int ch = info.channels == 2 ? 2 : 1;
            bsp_audio_write(pcm, (size_t)samples * (size_t)ch * sizeof(int16_t));
        }
    }
}

void gl_audio_init(void)
{
    if (s_task != NULL) {
        return;
    }
    if (GL_AUDIO_COUNT == 0) {
        ESP_LOGW(TAG, "no audio index (placeholder build), audio disabled");
        return;
    }
    if (xTaskCreate(audio_task, "gl_audio", 4096, NULL, 5, &s_task) != pdPASS) {
        ESP_LOGE(TAG, "audio task create failed");
        s_task = NULL;
    }
}

void gl_audio_play(uint16_t word_idx)
{
    if (s_task == NULL) {
        return;
    }
    /* value = idx + 1 so that raw 0 stays reserved for "stop". */
    xTaskNotify(s_task, (uint32_t)word_idx + 1, eSetValueWithOverwrite);
}

void gl_audio_stop(void)
{
    if (s_task == NULL) {
        return;
    }
    xTaskNotify(s_task, 1, eSetValueWithOverwrite); /* pending==1 means stop */
}

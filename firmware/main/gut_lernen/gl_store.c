#include "gl_store.h"

#include "esp_log.h"
#include "nvs.h"
#include "nvs_flash.h"

#include <string.h>

static const char *TAG = "gl_store";
static const char *NS = "glernen";
static const char *KEY = "state";
static const uint32_t MAGIC = 0x47554C31u; /* "GL01" */
static const uint32_t LAYOUT_VERSION = 1;

typedef struct {
    uint32_t magic;
    uint32_t layout_version;
    gl_state_t state;
} gl_blob_t;

static bool ensure_nvs_ready(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ESP_ERROR_CHECK(nvs_flash_init());
    } else if (err != ESP_OK) {
        ESP_LOGE(TAG, "nvs_flash_init failed: %s", esp_err_to_name(err));
        return false;
    }
    return true;
}

bool gl_store_load(gl_state_t *st)
{
    if (!ensure_nvs_ready()) return false;

    nvs_handle_t h;
    if (nvs_open(NS, NVS_READONLY, &h) != ESP_OK) {
        return false;
    }

    gl_blob_t blob;
    size_t len = sizeof(blob);
    esp_err_t err = nvs_get_blob(h, KEY, &blob, &len);
    nvs_close(h);
    if (err != ESP_OK || len != sizeof(blob) ||
        blob.magic != MAGIC || blob.layout_version != LAYOUT_VERSION ||
        blob.state.word_count != GL_WORD_TOTAL ||
        blob.state.meta.new_per_day == 0 || blob.state.meta.new_per_day > 100) {
        return false;
    }
    memcpy(st, &blob.state, sizeof(*st));
    return true;
}

bool gl_store_save(const gl_state_t *st)
{
    if (!ensure_nvs_ready()) return false;

    nvs_handle_t h;
    if (nvs_open(NS, NVS_READWRITE, &h) != ESP_OK) {
        ESP_LOGE(TAG, "nvs_open failed");
        return false;
    }

    gl_blob_t blob = {
        .magic = MAGIC,
        .layout_version = LAYOUT_VERSION,
    };
    memcpy(&blob.state, st, sizeof(*st));
    esp_err_t err = nvs_set_blob(h, KEY, &blob, sizeof(blob));
    if (err == ESP_OK) {
        err = nvs_commit(h);
    }
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nvs save failed: %s", esp_err_to_name(err));
        return false;
    }
    return true;
}

void gl_store_reset(void)
{
    if (!ensure_nvs_ready()) return;
    nvs_handle_t h;
    if (nvs_open(NS, NVS_READWRITE, &h) != ESP_OK) return;
    nvs_erase_key(h, KEY);
    nvs_commit(h);
    nvs_close(h);
}

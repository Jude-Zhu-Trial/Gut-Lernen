idf_component_register(
    SRCS "main.c" "app_ui.c" "gl_screenshot.c"
         "gut_lernen/gl_core.c" "gut_lernen/gl_data.c" "gut_lernen/gl_store.c"
         "fonts/wqy_font.c" "fonts/ipa_font.c"
    INCLUDE_DIRS "." "gut_lernen"
    PRIV_REQUIRES bsp lvgl nvs_flash esp_driver_usb_serial_jtag
)

#!/usr/bin/env python3
"""Synthesize word audio with Piper TTS and build the firmware audio blob.

Runs in GitHub Actions (piper-tts + ffmpeg pre-installed):
    python3 firmware/tools/gen_audio.py --voice voices/de.onnx

Outputs:
  firmware/main/audio_blob.bin                 (concatenated mp3 clips)
  firmware/main/gut_lernen/gl_audio_index.c    (index: flat word idx -> off/len)

Words are processed in manifest order (A1 first) until the byte budget is hit.
"""

import argparse
import io
import subprocess
import sys
import wave

from piper import PiperVoice

HERE = "firmware/main"
MANIFEST = f"{HERE}/gut_lernen/gl_words_manifest.txt"
BLOB_OUT = f"{HERE}/audio_blob.bin"
INDEX_OUT = f"{HERE}/gut_lernen/gl_audio_index.c"

FFMPEG_TRIM = (
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,"
    "areverse"
)


def synth_wav(voice, text):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        voice.synthesize(text, w)
    return buf.getvalue()


def to_mp3(wav_bytes, tmp_wav, tmp_mp3):
    with open(tmp_wav, "wb") as f:
        f.write(wav_bytes)
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-i", tmp_wav, "-af", FFMPEG_TRIM,
         "-ar", "22050", "-ac", "1",
         "-codec:a", "libmp3lame", "-b:a", "24k", tmp_mp3],
        check=True)
    with open(tmp_mp3, "rb") as f:
        return f.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True, help="piper de .onnx model")
    ap.add_argument("--budget-bytes", type=int, default=1150000)
    args = ap.parse_args()

    entries = []
    with open(MANIFEST, "r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            idx_s, _, text = line.partition("\t")
            entries.append((int(idx_s), text))

    voice = PiperVoice.load(args.voice)
    blob = bytearray()
    index = []

    for i, (idx, text) in enumerate(entries):
        if len(blob) >= args.budget_bytes:
            print(f"budget {args.budget_bytes} reached at word {i}, stopping")
            break
        try:
            wav = synth_wav(voice, text)
            mp3 = to_mp3(wav, "/tmp/gl_word.wav", "/tmp/gl_word.mp3")
        except Exception as e:  # noqa: BLE001
            print(f"skip word {idx} ({text!r}): {e}")
            continue
        index.append((idx, len(blob), len(mp3)))
        blob.extend(mp3)
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(entries)} words, blob {len(blob)} bytes")

    with open(BLOB_OUT, "wb") as f:
        f.write(bytes(blob))

    lines = ['#include "gl_audio.h"\n',
             "\n",
             "const gl_audio_entry_t GL_AUDIO_INDEX[] = {\n"]
    for idx, off, length in index:
        lines.append(f"    {{{idx}, {off}, {length}}},\n")
    lines.append("};\n")
    lines.append(f"\nconst uint32_t GL_AUDIO_COUNT = {len(index)};\n")
    with open(INDEX_OUT, "w", encoding="utf-8") as f:
        f.write("".join(lines))

    secs = len(blob) * 8 / 24000
    print(f"done: {len(index)}/{len(entries)} words, "
          f"blob {len(blob)} bytes (~{secs:.0f}s audio)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

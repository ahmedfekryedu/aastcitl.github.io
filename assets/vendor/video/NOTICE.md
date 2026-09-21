# Video conversion runtime

Unmodified, pinned distribution files from npm:

- `@ffmpeg/ffmpeg` 0.12.15: MIT. Source: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/ffmpeg
- `@ffmpeg/core` 0.12.10: GPL-2.0-or-later, with the licenses of FFmpeg and its linked libraries. Source and build configuration: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core
- FFmpeg source: https://github.com/ffmpegwasm/ffmpeg.wasm-core
- Build documentation: https://ffmpegwasm.netlify.app/docs/contribution/core/

License texts accompany this directory. Upstream source and build configuration identify the dependent libraries and their source versions. Preserve these notices and the relevant licenses when redistributing this runtime.

The site's own conversion integration is in `assets/tv-video-converter.js`. Reproduce the vendored files with `npm ci --ignore-scripts` and `node copy-runtime.cjs` in `tools/media-build`. The lockfile pins npm package integrity. No runtime file is fetched from a third-party CDN by the application.

The single-thread WASM core is loaded only when an administrator prepares a video. It is not in the essential pre-cache list and is never loaded by the TV player or for image uploads.

The original WASM binary is split losslessly into two `.bin` files, each below 25 MB, and reassembled in memory before loading. `copy-runtime.cjs` produces this split without changing the binary content.

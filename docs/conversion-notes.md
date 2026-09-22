# Conversion notes

Working notes behind the Convert plan ("Convert is a destination") and its
decisions: DEC-07 (the room), DEC-08 (perceptual default), DEC-09 (video,
proposed), DEC-10 (bundled codecs), DEC-11 (state every loss), DEC-12 (small
surface, deep as an ocean), DEC-13 (top-tier output, proven, within reason).

These are notes, not specs. The issues are the specs. Where a number appears
here it is a published or commonly reported figure, and the quality lab
(CONV-18) is what we believe once it exists. Anything we tell users comes from
the lab, not from this file.

---

## 1. What "the same picture" means

A file is a container around three things, and a conversion can quietly change
any of them:

| Layer | What it holds | How canvas re-encoding breaks it today |
|---|---|---|
| Pixels | Sample values, dimensions, alpha, bit depth, frames | Premultiplied alpha rounds low-alpha colours; 16-bit → 8-bit; animation → first frame |
| Colour | What the numbers *mean*: primaries, transfer curve, ICC/nclx | Profile dropped; Display P3 clipped into sRGB, so photos go dull |
| Metadata | EXIF (camera, date, orientation, GPS), XMP, IPTC | Stripped wholesale, GPS included, which is good by accident and silent |

Convert's contract (DEC-11) is that the first two survive unless the target
format physically cannot hold them. The third follows a policy (keep, but
remove GPS). Every exception shows on the row.

The cheapest way to keep everything is not to re-encode at all. When
source and target already agree, copy the bytes. When a JPEG stays a JPEG, work
on the DCT coefficients (§5.4) instead of the pixels.

---

## 2. Measuring "looks the same"

### 2.1 Why the quality number is meaningless across encoders

`q=80` is an input to one encoder's quantiser-table scaling, not a measure of
the output. libjpeg-turbo q80, mozjpeg q80, jpegli q80, libwebp q80 and an AVIF
cq-level are five different fidelities. Comparing formats "at q80" compares
five different pictures, and the smallest one is usually just the most damaged.
DEC-08 exists because of this.

### 2.2 Metrics

- **PSNR:** mean squared error in dB. Blind to *where* error goes. It scores
  blur generously and ringing harshly relative to eyes. Useful only as a sanity
  check.
- **SSIM / MS-SSIM:** compares local luminance, contrast and structure. Much
  better than PSNR, but classically run on luma only, or on gamma-encoded RGB,
  so chroma damage (exactly what 4:2:0 subsampling does) is under-counted.
- **SSIMULACRA2** (Cloudinary/JPEG XL project, BSD): converts to the XYB
  opponent colour space (built on LMS cone responses), computes SSIM-like
  structure terms plus separate terms for ringing/blocking ("artefacts added")
  and blur ("detail lost") over 6 scales, pools each error map with both a
  1-norm (average) and a 4-norm (worst regions), and combines them with weights
  fitted to large subjective datasets. The output is roughly on a 0-100 scale.
  Commonly cited anchors: about 90 = visually lossless at normal viewing
  distance, about 70 = high quality, about 50 = medium, about 30 = low. We
  calibrate our own band cut-offs in the lab and record them as constants
  (CONV-08).
- **Butteraugli** (Google): a psychovisual distance. About 1.0 is roughly the
  just-noticeable difference. Its max-norm is a good "no single region is
  broken" guard. It's slower. It belongs in the lab and as an optional final
  check, not in the inner search loop.

Rule of thumb: score in **linear light**, in a **perceptual colour space**,
and pool with a **high norm** as well as a mean, because people notice the worst
patch, not the average.

### 2.3 Estimating fast

Scoring a 12 MP pair repeatedly inside a quality search is expensive. The
estimate path scores a downsampled pair, with the downscale done in linear
light with Lanczos (`src/resample.ts`) so the resize adds no error of its own.

**Caveat:** downsampling *hides* artefacts, because blocking and ringing are
high-frequency. So estimates are optimistic, and the final pick must be
verified at full resolution. The search can bracket on the estimate and then
confirm or step up one notch at full res.

### 2.4 Comparing encoders fairly: BD-rate

For each encoder, plot bits-per-pixel against the quality score across a sweep
of settings (the rate-distortion curve). The **Bjøntegaard delta rate
(BD-rate)** is the average percentage bitrate difference between two curves over
their overlapping quality range. "−18% BD-rate vs canvas WebP" means 18% fewer
bytes on average for the same score. This is the number the lab reports and CI
guards (DEC-13). Always name the corpus, the metric and the quality range: a
BD-rate over "high quality only" can differ a lot from one over "all
qualities".

---

## 3. Colour, light and alpha

### 3.1 Linear light

Stored 8-bit values are gamma-encoded (sRGB's transfer curve is roughly a 2.2
power). Averaging encoded values (which is what naive resizing and naive
metrics do) darkens edges and mis-weights error. Resampling and scoring convert
to linear light first. CropASAP already does this for resizing (PERF-02).

### 3.2 Wide gamut

Modern iPhones and many Android phones shoot **Display P3**. If a P3 image is
decoded into an sRGB canvas, saturated colours outside sRGB are clipped and the
photo looks dull. Options, in order of preference:

1. Where `canvas.getContext('2d', { colorSpace: 'display-p3' })` is supported,
   decode, draw and encode in P3, and attach a P3 ICC profile to the output.
2. Otherwise, convert to sRGB properly (gamut-map, not clip), and tag the row
   "colour: converted to sRGB".

Never write P3 pixels without a P3 profile. Untagged pixels are assumed sRGB
and look *over*-saturated.

### 3.3 Premultiplied alpha

Canvas 2D stores colour premultiplied by alpha. A pixel `(200, 40, 40, a=3)`
becomes roughly `(2, 0, 0)` internally and comes back as a different colour.
For lossy targets this is noise. For **lossless** targets it breaks the "bit
identical" promise. So lossless paths decode straight into straight-alpha RGBA
(`createImageBitmap(..., { premultiplyAlpha: 'none' })` into a worker, or a
wasm decoder) and never touch a 2D canvas (CONV-12).

### 3.4 Matting

A format without alpha needs a background. White is the defensible default.
"Edge-average" is a nice option for logos going onto an unknown page. The tag
must say it happened.

### 3.5 Banding

Smooth gradients (skies, UI shadows) quantised to 8 bits, and then compressed,
show steps. Encoders make it worse by flattening low-contrast areas. Defences:
10-bit AVIF internally (then note the bit-depth tag), encoder settings that
protect flat areas (AQ, deltaq), or a very light blue-noise dither before
encoding, which costs bytes. The lab corpus needs gradient images to see this.

---

## 4. Chroma subsampling

Lossy codecs convert RGB → Y'CbCr and usually store colour at half resolution
in both directions (**4:2:0**), because eyes resolve brightness detail far better
than colour detail. That's right for photos and wrong for text and flat
graphics: thin red text on white smears into pink halos.

- JPEG, AVIF: can do 4:4:4. Choose per image: photos 4:2:0, graphics/text
  4:4:4 (a cheap classifier: unique colour count + edge sharpness statistics
  is enough to start).
- **WebP lossy (VP8) is always 4:2:0.** For text/graphics, WebP's answer is
  *lossless* or *near-lossless* mode, not lossy.
- **Sharp YUV** (libwebp): instead of averaging each 2×2 block's chroma, it
  iteratively solves for the chroma values that best reconstruct the original
  RGB after upsampling. It noticeably reduces colour bleeding on edges at
  little cost. We use it for WebP, and it's worth measuring as a preprocessing
  step for 4:2:0 JPEG/AVIF too.

---

## 5. JPEG

### 5.1 How it spends bits

8×8 blocks → DCT → each of 64 coefficients divided by a quantisation-table
entry and rounded → zig-zag → run-length + Huffman (or arithmetic, which is
rarely supported, so avoid it). Almost all loss is the rounding; almost all
size is the non-zero coefficients.

### 5.2 Encoders worth racing

- **mozjpeg:** *trellis quantisation* (rounding each coefficient not to the
  nearest value, but to whichever choice minimises rate + λ·distortion over
  the block, which is often zero when that's cheap in error), tuned quant
  tables, progressive scan-script optimisation, optimised Huffman tables.
  Typically a clear win over libjpeg-turbo at mid/low quality.
- **jpegli** (Google, in libjxl): higher-precision internal pipeline,
  *adaptive quantisation* (a per-block quality field driven by a psychovisual
  model, so bits go where eyes look), better default tables. Google reports up
  to ~35% smaller at high quality. Output is ordinary 8-bit JPEG. It has an
  optional XYB mode that needs ICC-aware decoders; we don't use it by default.
- Pick per quality range by BD-rate in the lab. Expect jpegli at high quality
  and possibly mozjpeg lower down.

Always: progressive (smaller for anything above tiny, and it renders earlier),
optimised Huffman, and no arithmetic coding.

### 5.3 Generation loss

Decoding a JPEG and re-encoding it quantises already-quantised data again with
different block alignment or tables. Error compounds, and the new encoder
spends bits faithfully reproducing the old artefacts. Hence §5.4 and §5.5.

### 5.4 JPEG → JPEG without touching pixels

Work in the coefficient domain (jpegtran-style):

- Re-optimise Huffman tables, rewrite as progressive, drop or keep metadata:
  usually 2-10% smaller, **bit-exact pixels**.
- Lossless rotation/flip is possible when dimensions are multiples of the MCU
  (8 or 16 px). Not planned, just noted.
- **DCT-domain requantisation** (divide existing coefficients by coarser
  tables) is a way to shrink without the decode/re-encode round trip's
  rounding. It's real, but gains over a good re-encode are modest and it needs
  care with table alignment. Not planned per DEC-13's proportionality rule;
  revisit if the lab shows a win.

### 5.5 Artefact-free decoding (CONV-27)

Each stored coefficient `c` says only that the true value lay in
`[(c − ½)·Q, (c + ½)·Q]` for its quant step `Q`. The standard decoder takes the
centre. A *constrained reconstruction* finds the smoothest image (minimising
total variation, or TGV which avoids staircasing) **subject to every DCT
coefficient staying inside its interval**, solved by alternating a smoothing
step with a projection back onto the interval box (projection onto convex
sets). The result is exactly consistent with the file's data, invents nothing,
and removes blocking and ringing. Prior art: jpeg2png, Google's Knusperli. The
benefit compounds, because the next encoder no longer spends bits on
artefacts.

---

## 6. PNG

### 6.1 What makes PNGs big

Per row, PNG applies one of five **filters** (None, Sub, Up, Average, Paeth)
that predict each byte from neighbours, then **deflate** (LZ77 + Huffman) the
residuals. Size depends on: the filter chosen per row (a heuristic; trying
several per row and keeping the best is the cheap big win), the deflate
effort, and whether the image is stored at more depth than it needs.

### 6.2 Lossless levers (CONV-19)

- **Reductions:** RGBA → RGB if fully opaque; → greyscale if R=G=B
  everywhere; → palette if ≤ 256 distinct colours (exact, still lossless); →
  lower bit depth (1/2/4-bit palettes for icons); a single transparent colour
  via `tRNS` instead of a full alpha channel.
- **Filter search** per row.
- **Zopfli:** an exhaustive deflate encoder that produces standard deflate
  streams typically ~3-8% smaller than zlib level 9, at 50-100× the time.
  Time-bound it; oxipng integrates it.
- Metadata: drop chunks that don't matter (`tEXt`, timestamps) per policy;
  keep `iCCP`/`sRGB`/`cICP`.

### 6.3 Palette quantisation, the "lossy PNG" (CONV-19)

We can't ship libimagequant/pngquant (GPL-3.0; DEC-10), so we write our own.
The ingredients, roughly in order of value:

1. **Work in OKLab** (a perceptual space where Euclidean distance tracks
   perceived difference far better than RGB), with alpha as a weighted fourth
   axis. Compare colours premultiplied, so fully transparent pixels of any
   colour count as the same.
2. **Initial palette:** Wu's algorithm (splits the colour box to minimise
   variance; fast, good) or median cut.
3. **Refine with k-means** for a few iterations. **Weight pixels by
   importance**: smooth gradients and faces need palette entries; noisy
   texture hides error. Weighting by local contrast (inverse of local
   variance) puts colours where banding would show.
4. **Dither selectively.** Error diffusion (Floyd–Steinberg) hides banding but
   adds noise that deflate hates and that ruins crisp UI edges. Dither only
   where the undithered result bands (measured), leave flat areas and hard
   edges clean, and consider **blue-noise** thresholds over pure error
   diffusion for fewer visible worm patterns.
5. **Search colour count** (256 → 16) for the smallest file that stays in the
   "looks identical" band.
6. **Order the palette** so similar colours are adjacent, which helps
   deflate slightly.

Palette mode wins on screenshots, logos and flat illustration, and must lose on
photos. The race decides by score, never by guess.

---

## 7. WebP

- **Lossy (VP8):** intra-frame video coding, 4:2:0 only, block prediction +
  transform + arithmetic coding, and a loop filter that smooths block edges. It
  beats baseline JPEG mostly at mid/low quality; at very high quality a good
  JPEG encoder can match or beat it. The lab will tell us.
- **Lossless (VP8L):** a different codec entirely: spatial predictors,
  "subtract green" colour decorrelation, a colour cache, LZ77 with 2D distance
  codes. Often ~20-30% smaller than optimised PNG on graphics.
- **Near-lossless:** pre-adjusts values by tiny amounts where it won't show, so
  VP8L compresses better. Good for screenshots.
- **Alpha** in lossy WebP is stored losslessly (or lightly quantised) as a
  separate plane.
- Canvas `toBlob('image/webp')` exposes one quality knob, and some browsers
  couldn't encode WebP at all (the canvas silently returns PNG, which
  `convertOne` already guards against). libwebp gives method 6, sharp YUV,
  filter tuning and lossless modes (CONV-20).

---

## 8. AVIF

- An AV1 intra frame in a HEIF (ISOBMFF) container. Supports 4:4:4, 10/12-bit,
  alpha (as a separate AV1 image), HDR, and film-grain synthesis.
- Usually the best compression of the "works everywhere" set (Chrome 85+,
  Firefox 93+, Safari 16+). Check the capability table, not this list.
- **Slow to encode.** libaom's speed setting trades time for size; speed 6-8 is
  the practical range for interactive use. Tiling allows multithreaded encode
  and decode at a tiny size cost.
- Grain synthesis (strip the noise, send parameters, and let the decoder
  re-synthesise it) can save a lot on noisy photos, but the decoded noise is
  *different* noise. That conflicts with DEC-11 unless tagged. Default off.
- Decoding very large AVIFs is memory-hungry in some browsers. Test 48 MP.

---

## 9. JPEG XL

- Two modes: VarDCT (lossy, variable block sizes 2×2…256×256, XYB colour) and
  Modular (lossless and near-lossless, with a learned-context MA tree).
- **Lossless JPEG transcoding**: stores the JPEG's coefficients more
  efficiently (typically ~20% smaller) and can reconstruct the **original JPEG
  file bit-exactly**. Unique among formats, and ideal for archiving photo
  libraries.
- Browser support is limited and has been shifting (Safari decodes it).
  Treat support as a runtime fact from the capability table, and keep JXL out
  of "Works everywhere" (CONV-26).

---

## 10. HEIC / HEIF (CONV-14)

- HEVC intra frames in a HEIF container. iPhone photos are usually **grid
  images**: a 4032×3024 picture stored as 512×512 tiles plus a `grid`
  derivation item that stitches them. Rotation/mirroring are `irot`/`imir`
  item properties, not EXIF. Colour is an `colr` box (ICC or nclx). Newer
  iPhones add HDR gain maps and depth as auxiliary images.
- Safari decodes HEIC natively. Chromium and Firefox generally don't on
  desktop.
- libheif + libde265 are LGPL-3.0: ship as a separately loaded, replaceable
  module with licence text and a source link. HEVC is patent-encumbered, so get
  a sign-off note before shipping the decoder (DEC-10). We don't encode HEIC.

---

## 11. Metadata by container (CONV-09)

| Container | EXIF | ICC | XMP | Notes |
|---|---|---|---|---|
| JPEG | APP1 `Exif\0\0` | APP2 `ICC_PROFILE`, split across segments ≤ 64 KB with sequence numbers | APP1 (XMP namespace URI) | Orientation in EXIF; after decode, pixels are upright, so write 1 or drop |
| PNG | `eXIf` | `iCCP` (zlib) or `sRGB`/`cICP` | `iTXt` (XML:com.adobe.xmp) | Chunks before `IDAT` for colour |
| WebP | RIFF `EXIF` | RIFF `ICCP` | RIFF `XMP ` | Requires the extended `VP8X` header with flags set |
| AVIF/HEIF | `Exif` item | `colr` property | `mime` item | Item references tie them to the primary image |

GPS lives in the EXIF GPS IFD, so "remove location" means deleting that IFD
and its pointer, then fixing offsets. Rewriting a TIFF-structured blob means
recomputing IFD offsets; don't byte-patch.

---

## 12. Searching for the right setting

- Size is *roughly* monotone in quality but not strictly. Small non-monotonic
  wiggles exist (mode decisions flip). The existing size-budget search
  (`src/application/size-budget.ts`) brackets and refines; the perceptual
  search has the same shape with a score target instead of a byte target.
- Score is also roughly monotone in quality, so bracket on both and verify the
  final pick.
- **Time budget per image**, with the best-so-far always shippable. A search
  that is 2% better but 10× slower loses under "Fast" in the philosophy.
- Race many formats in parallel across workers. Per format, search
  sequentially. Cancel on any input change (the panel's token pattern already
  does this for estimates).
- For batches: race on a sample spread across content classes, choose the
  format, then search each file's setting individually.

---

## 13. Engineering the codec engine (CONV-07)

- **Memory:** a 12 MP RGBA image is 48 MB; 48 MP is 192 MB. Two copies plus
  encoder state approaches wasm32's practical limits in some browsers. Stream
  where possible, transfer (not copy) buffers to workers, free promptly, and
  run fewer workers for huge images.
- **WASM SIMD** is broadly available and gives large speedups for codecs; build
  with it and keep a scalar fallback only if the capability table requires it.
- **Threads** (pthreads in wasm) need `SharedArrayBuffer`, which needs the page
  to be **cross-origin isolated** (`Cross-Origin-Opener-Policy: same-origin` +
  `Cross-Origin-Embedder-Policy: require-corp` or `credentialless`). That can
  break third-party popups/embeds (check Supabase auth flows) before turning it
  on. Worker-level parallelism (one image or format per worker) works without
  it and is most of the win.
- **Lazy loading:** each codec is its own chunk; the crop path loads none.
  The service worker (CONV-10) caches codecs after first use for offline.
- **Licence gate:** the build refuses a codec without an SPDX licence record.

### Licence sketch (verify at integration time)

| Component | Licence | OK under DEC-10? |
|---|---|---|
| libwebp | BSD-3-Clause | Yes |
| mozjpeg | IJG + BSD-3 + zlib | Yes |
| libjxl / jpegli | BSD-3-Clause | Yes |
| libavif | BSD-2-Clause | Yes |
| libaom | BSD-2-Clause + AOM patent licence | Yes |
| oxipng | MIT | Yes |
| zopfli | Apache-2.0 | Yes |
| SSIMULACRA2 (reference) | BSD | Yes |
| libheif, libde265 | LGPL-3.0 | With obligations; HEVC patent sign-off |
| libimagequant / pngquant | GPL-3.0 (or commercial) | **No** |
| ffmpeg.wasm | LGPL/GPL by build | Rejected (DEC-09) |

---

## 14. Video notes (DEC-09, proposed; VID-01/02)

- **GOP structure:** compressed video stores occasional keyframes and codes
  other frames as differences. To show frame N you must decode from the
  previous keyframe forward. `<video>.currentTime` seeks are allowed to land
  on nearby frames, so frame-accurate stills need demux + WebCodecs
  `VideoDecoder`, decoding from the keyframe and discarding up to the target.
- **Colour:** most video is BT.709 with *limited range* (luma 16-235). Treating
  it as full range gives washed-out blacks. HDR (BT.2020 PQ/HLG) needs tone
  mapping to SDR for a still, and a tag.
- **Resources:** every `VideoFrame` holds GPU/decoder memory and must be
  `close()`d promptly, or decoding stalls.
- **Output:** WebCodecs `VideoEncoder` (H.264 is the widely supported target;
  hardware encoders are fast) + a small MP4 muxer. Audio: copy the compressed
  packets when the cut allows, otherwise re-encode (AAC where the browser can
  encode it, Opus otherwise) and tag it.
- Scope guard: trim + static crop + export. No timeline, effects or
  keyframed motion.

---

## 15. Deliberately not doing (proportionality, DEC-13)

- ML "enhance"/super-resolution in Convert: it invents detail, which breaks
  the honesty contract.
- DCT-domain requantisation, butteraugli-guided per-block tuning of our own,
  custom entropy coders: real ideas, small measured wins, big complexity. Here
  as notes until the lab shows a reason.
- HEIC encoding, GIF output, TIFF output: low demand or better modern answers.

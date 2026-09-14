/**
 * The About & documentation content.
 *
 * Authored once as typed data against the dopedocs schema, which renders it
 * both as the in-app panel and as the crawlable pages at `/docs/<id>/`. This
 * file is the whole of CropASAP's documentation - the engine lives in the
 * `dopedocs` package.
 *
 * It is a user manual first. The sections near the end say, for the record and
 * for the crawlers, how the thing is actually built - because a claim like
 * "your images never leave the browser" is worth nothing unless the page that
 * makes it is the one an answer engine quotes.
 *
 * Every section carries a `question` and a self-contained `answer` (the part a
 * person or a model actually asks and quotes), and every claim a reader could
 * act on is declared once in `FACTS` and referenced as `{fact:key}`.
 */

import { defineDocs, defineFacts } from 'dopedocs';

export const FACTS = defineFacts({
  price: { value: 'Free', reviewed: '2026-09-10' },
  upload: { value: 'never uploaded - every pixel stays in this browser tab', reviewed: '2026-09-10' },
  formats: { value: 'PNG, JPEG and WebP', reviewed: '2026-09-10' },
  presets: { value: 'more than 400 named sizes across 60-odd platforms and print formats', reviewed: '2026-09-10' },
  scales: { value: '1×, 2× and 4×', reviewed: '2026-09-10' },
  adjustments: { value: '26 controls in five groups', reviewed: '2026-09-10' },
  persistence: { value: 'saved and pinned sizes only, in this browser', reviewed: '2026-09-10' },
  dependencies: { value: 'zero runtime dependencies and no third-party requests', reviewed: '2026-09-10' },
  resampler: { value: 'a separable Lanczos-3 filter, run in linear light', reviewed: '2026-09-10' },
  nudge: { value: '8 pixels, or 40 with Shift', reviewed: '2026-09-10' },
});

/** The crop mark, self-contained so the static pages draw it without the app's CSS. */
const MARK = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 2v14a2 2 0 0 0 2 2h14" />
  <path d="M18 22V8a2 2 0 0 0-2-2H2" />
</svg>`;

/** The Strange Systems glyph, for the maker card. */
const STRANGE_SYSTEMS = `<svg viewBox="0 0 505 474" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M0,0 L0,411.878 L216.914,411.878 L216.914,350.713 L62.937,350.713 L62.937,61.163 L216.914,61.163 L216.914,0 Z" />
  <path d="M216.914,153.657 L288.081,122.522 L288.081,319.256 L216.914,350.391 Z" />
  <path d="M505,61.503 L505,473.381 L288.081,473.381 L288.081,412.216 L442.058,412.216 L442.058,122.666 L288.081,122.666 L288.081,61.503 Z" />
</svg>`;

export const docsContent = defineDocs({
  entity: {
    name: 'CropASAP',
    // The fallback for a local build; the static build overrides this from the
    // Vercel environment in scripts/build-static.mjs.
    url: 'https://cropasap.vercel.app',
    legalName: 'Strange Systems',
    tagline: 'The right crop, in seconds. Drop an image, name its destination, and download.',
    notToBeConfusedWith: [],
    contactEmail: 'junovhs@gmail.com',
  },

  identity: {
    name: 'CropASAP',
    version: '1.0.0',
    maker: { name: 'Strange Systems', href: '#strange-systems' },
    mark: MARK,
  },

  basePath: '/docs',
  facts: FACTS,

  title: 'CropASAP',
  lead:
    'The right crop, in seconds. Drop an image, type where it is going — a Facebook cover, ' +
    'an Instagram story, or your own exact size — frame it, and download. {fact:price}. ' +
    'Your images are {fact:upload}. Have more to crop? Batch handles a whole folder.',

  sections: [
    {
      id: 'what-it-is',
      title: 'What this is',
      question: 'What is CropASAP?',
      answer:
        'CropASAP is a free browser tool that crops, resizes, adjusts and converts images to an ' +
        'exact output size.',
      keywords: ['image cropper', 'resize image online', 'crop to size', 'social media image sizes', 'browser image editor'],
      blocks: [
        {
          kind: 'p',
          text: 'You name the destination. The crop frame takes that shape, drawn at its real size when it fits and smaller when it does not. Move the frame over the picture, export. What is inside the frame is what gets written, at the size you named.',
        },
        {
          kind: 'steps',
          items: [
            { title: 'Drop', text: 'Anywhere on the page. Or paste with Ctrl/⌘ V, or click the stage to pick a file.' },
            { title: 'Type the size', text: 'Click the size chip. `instagram story`, `1200 x 630`, `16:9` - whatever you know.' },
            { title: 'Position', text: 'Drag to move, scroll to zoom, `0` to fill the frame again.' },
            { title: 'Export', text: 'PNG, JPEG or WebP. Downloads immediately.' },
          ],
        },
        {
          kind: 'callout',
          text: 'Drop several images and Batch opens on its own: one size, every image, one ZIP.',
        },
      ],
    },

    {
      id: 'sizes',
      title: 'Output sizes',
      question: 'How do I find the right image size for a platform in CropASAP?',
      answer:
        'Type it the way you would say it - `ig story`, `youtube thumbnail`, `1200 by 630`, `4:5` - ' +
        'and CropASAP matches it against {fact:presets}. Typos and abbreviations are fine. ' +
        'A size you type yourself can be saved and becomes searchable too.',
      keywords: ['image sizes', 'social media sizes', 'presets', 'aspect ratio', 'og image size', 'instagram story size'],
      blocks: [
        {
          kind: 'p',
          text: 'If it is a website you need an image for, the size is probably already here. Click the size chip and type.',
        },
        {
          kind: 'table',
          head: ['Type', 'Get'],
          rows: [
            ['`ig story` · `fb cover` · `yt thumb` · `og image`', 'The preset, by any name people call it'],
            ['`1200 x 630` · `1080×1350` · `800 by 600`', 'Exact pixels, plus any preset that matches'],
            ['`16:9` · `4:5` · `square` · `portrait`', 'Every size of that shape'],
            ['`a4` · `letter` · `business card`', 'Print sizes at production resolution'],
            ['`instagrm stroy`', 'Instagram story. Typos are handled.'],
          ],
        },
        {
          kind: 'details',
          summary: 'How matching works',
          text: 'Filler words are ignored ("crop my photo for…"). Each preset carries the names marketers, platforms and normal people use for it, plus its pixels spelled every common way. Tokens match by prefix, by abbreviation (`yt` → youtube) and by edit distance for typos. Ratios and dimensions are parsed as numbers, not text. Hot presets rank first on a tie.',
        },
        {
          kind: 'details',
          summary: 'Sizes it does not have',
          text: 'Type the pixels. Name it, save it - it now ranks like any preset. Pin it and it sits in the top bar. Saved and pinned sizes are the only things CropASAP remembers between visits: {fact:persistence}.',
        },
        {
          kind: 'details',
          summary: 'Before you choose a size',
          text: 'A fresh image is framed at its own pixels, nothing cut, and the size chip is dashed to say so. Choose a size and the frame morphs to it with the picture where you left it.',
        },
      ],
    },

    {
      id: 'framing',
      title: 'Framing',
      question: 'How do I move, zoom and position the crop in CropASAP?',
      answer:
        'Drag to move the frame over the image, scroll to zoom, arrow keys nudge by {fact:nudge}, 0 fills the frame. A quality readout warns when the crop has fewer pixels than the output needs.',
      keywords: ['move crop', 'zoom', 'nudge', 'fill frame', 'quality readout'],
      blocks: [
        {
          kind: 'table',
          head: ['To', 'Do'],
          rows: [
            ['Move', 'Drag. Arrow keys nudge by {fact:nudge}.'],
            ['Zoom', 'Scroll, drag the slider, − / +, or type a percentage.'],
            ['Fill the frame', '`0`, or double-click.'],
            ['See what is being cut', 'Hover outside the frame.'],
            ['Undo', 'Ctrl/⌘ Z. One drag is one step.'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: 'The quality readout compares the pixels in the crop with the pixels the output needs. Ask for more than the crop holds and it says the result will soften - before you export.',
        },
      ],
      children: [
        {
          id: 'frame-views',
          title: 'Frame views',
          question: 'What do True size, Smaller and Enlarged mean in CropASAP?',
          answer:
            'Frame views change how large the frame is drawn on screen and nothing else. True size is one screen pixel per output pixel; Smaller steps back when that does not fit; Enlarged gives a small output room to work in. Press F to cycle.',
          keywords: ['true size', 'actual pixels', 'frame view'],
          blocks: [
            {
              kind: 'list',
              items: [
                '**True size** - one screen pixel per output pixel. What the file will look like.',
                '**Smaller** - for when true size does not fit the stage.',
                '**Enlarged** - for small outputs like thumbnails and favicons.',
              ],
            },
            { kind: 'p', text: 'Views that would show the same picture are not offered. Switching never changes the export.' },
          ],
        },
        {
          id: 'freeform',
          title: 'Freeform',
          question: 'Can I crop without a fixed aspect ratio in CropASAP?',
          answer:
            'Yes. Freeform unlocks the aspect ratio; the crop rectangle itself becomes the output size. The preset is suspended, not forgotten - turn Freeform off and it comes back.',
          keywords: ['freeform crop', 'free aspect ratio'],
          blocks: [
            { kind: 'p', text: 'Drag any edge or corner. The pixel count on the chip is live and is the output size at 1:1. Tap the chip to turn those pixels into a named size.' },
            { kind: 'details', summary: 'Freeform and Batch', text: 'Freeform is single-image: a Batch needs one shared size, which Freeform does not have. Entering Freeform leaves Batch; the queue is kept.' },
          ],
        },
      ],
    },

    {
      id: 'adjust',
      title: 'Adjust',
      question: 'What image adjustments does CropASAP have?',
      answer:
        'CropASAP\'s Adjust room has {fact:adjustments}: Light, Tone, Color, Effects (clarity, sharpen, bloom, halation, vignette, colour fringe) and film Grain. Each image keeps its own values.',
      keywords: ['exposure', 'contrast', 'saturation', 'film grain', 'halation', 'bloom', 'vignette'],
      blocks: [
        {
          kind: 'table',
          head: ['Group', 'Controls'],
          rows: [
            ['Light', 'Exposure · Highlights · Shadows · Whites · Blacks'],
            ['Tone', 'Contrast · S-curve · Black lift · Highlight rolloff'],
            ['Color', 'Temperature · Tint · Vibrance · Saturation · Cool shadows · Warm highlights'],
            ['Effects', 'Clarity · Sharpen · Bloom · Halation · Vignette · Color fringe'],
            ['Grain', 'Amount · Size · Roughness · Color · Highlight protect'],
          ],
        },
        {
          kind: 'list',
          items: [
            'Tap a value to reset that control. **Reset all** returns to neutral.',
            'Values are per image. Switching images never carries them over.',
            'The preview is GPU-rendered. The export runs the same maths over every original pixel.',
          ],
        },
      ],
    },

    {
      id: 'batch',
      title: 'Batch',
      question: 'How do I crop many images to the same size at once in CropASAP?',
      answer:
        'Drop several images, choose one output size, keep or adjust each crop, export. Everything downloads as one ZIP.',
      keywords: ['bulk crop', 'batch resize', 'crop multiple images', 'ZIP'],
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Drop the stack', text: 'Or click Batch and pick files. More drops add to the queue.' },
            { title: 'One size', text: 'Every image is fitted to it, centred.' },
            { title: 'Keep or fix', text: 'Enter keeps the crop and moves to the next one that needs a decision. Drag first if it needs help.' },
            { title: 'Export', text: 'One ZIP.' },
          ],
        },
        {
          kind: 'checklist',
          items: [
            { text: 'Unreviewed images still export, using the centred crop', checked: true },
            { text: 'The Export panel says how many are still unreviewed', checked: true },
            { text: '**Frame the rest** accepts every remaining crop at once', checked: true },
          ],
        },
        { kind: 'details', summary: 'Changing the size mid-batch', text: 'Every crop follows the new shape. Untouched crops are re-centred; crops you positioned keep their centre and are refit around it.' },
        { kind: 'details', summary: 'Leaving Batch', text: 'The queue is kept. Outside Batch, Export writes the active image only.' },
      ],
    },

    {
      id: 'convert',
      title: 'Convert',
      question: 'How do I convert an image to WebP, PNG or JPEG without cropping it?',
      answer:
        'Convert re-encodes the file as WebP, PNG or JPEG without cropping or resizing. JPEG and WebP can also fit under a file-size limit by adjusting quality.',
      keywords: ['convert to webp', 'png to jpg', 'image converter'],
      blocks: [
        {
          kind: 'compare',
          before: { title: 'Export', text: 'A crop, written to a size.' },
          after: { title: 'Convert', text: 'The same image, in a different format.' },
        },
        { kind: 'p', text: 'JPEG and WebP show an estimated file size as you move the quality slider. Set Fit under in KB to search for the highest quality that meets your limit. The limit applies to each image, not the ZIP. Original dimensions stay unchanged; the quality setting becomes automatic. Leave it empty for manual quality. Several files convert into one ZIP.' },
        { kind: 'p', text: 'If a limit cannot be met within the available quality range, CropASAP reports the smallest result found and does not download an oversized file. You can remove the limit and use that quality explicitly. PNG is lossless and has no quality-based size limit.' },
        { kind: 'details', summary: 'When the format is not available', text: 'If the browser cannot write the format, Convert says so. It never hands you a PNG with the wrong extension.' },
      ],
    },

    {
      id: 'export',
      title: 'Export',
      question: 'What formats and sizes can CropASAP export?',
      answer:
        'CropASAP exports {fact:formats} at {fact:scales} the chosen size. Transparency is kept in PNG and WebP, and the panel warns before JPEG flattens it.',
      keywords: ['export', 'download', '2x', 'retina', 'transparency', 'PNG vs JPEG vs WebP'],
      blocks: [
        {
          kind: 'table',
          head: ['Format', 'Use for'],
          rows: [
            ['PNG', 'Logos, UI, screenshots, anything with transparency. Lossless.'],
            ['JPEG', 'Photos where size matters. No transparency.'],
            ['WebP', 'Web. Usually the smallest, keeps transparency.'],
          ],
        },
        { kind: 'p', text: '2× and 4× multiply the size for high-density screens. The pixel fields take any number. The quality readout says if the crop can back it up.' },
        { kind: 'p', text: 'On a phone, Export opens the share sheet so you can save straight to Photos. Several images share as images, not a ZIP.' },
        { kind: 'details', summary: 'Transparent images', text: 'Shown on a checkerboard - a darker one when the image is mostly light, so a white logo still reads. Drop one while JPEG is selected and the format switches to PNG. Choose JPEG anyway and you get a warning, not a silent white fill.' },
      ],
      children: [
        {
          id: 'naming',
          title: 'Filenames',
          question: 'How do I control the exported filenames in CropASAP?',
          answer:
            'Three checkboxes - keep the original name, add the size, number them - or a template using {name}, {w}, {h}, {label}, {n} and {date}. The result is previewed before export.',
          keywords: ['filename template', 'rename', 'batch naming'],
          blocks: [
            {
              kind: 'table',
              head: ['Token', 'Becomes'],
              rows: [
                ['`{name}`', 'Original filename, no extension'],
                ['`{w}` · `{h}`', 'Written width and height'],
                ['`{label}`', 'Preset name, e.g. `instagram-story`'],
                ['`{n}`', 'Running number'],
                ['`{date}`', 'YYYY-MM-DD'],
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'keyboard',
      title: 'Keyboard',
      question: 'What are the keyboard shortcuts in CropASAP?',
      answer:
        'Arrows nudge, Shift nudges more, + and − zoom, 0 fills, F cycles frame views, Enter keeps a Batch crop, brackets or J/K move through the queue, Ctrl/⌘ Z undoes, Esc closes.',
      keywords: ['shortcuts', 'hotkeys'],
      blocks: [
        {
          kind: 'keys',
          rows: [
            ['← ↑ → ↓', 'Nudge'],
            ['Shift + arrows', 'Nudge more'],
            ['+ / =  ·  −', 'Zoom in · out'],
            ['0', 'Fill the frame'],
            ['F', 'Cycle frame views'],
            ['Enter · Space', 'Keep this crop (Batch)'],
            ['[ · ]  ·  K · J', 'Previous · next image'],
            ['Ctrl/⌘ Z', 'Undo'],
            ['Ctrl/⌘ Shift Z', 'Redo'],
            ['Ctrl/⌘ V', 'Paste an image'],
            ['Esc', 'Close'],
          ],
        },
        { kind: 'p', text: 'Framing keys are off in Adjust and Convert, so an arrow key cannot re-crop by accident.' },
      ],
    },

    {
      id: 'privacy',
      title: 'Privacy',
      question: 'Does CropASAP upload my images?',
      answer:
        'No. Images are {fact:upload}. No server processing, no analytics; the page makes {fact:dependencies}.',
      keywords: ['privacy', 'no upload', 'local processing'],
      blocks: [
        {
          kind: 'facts',
          title: 'What persists, and where',
          rows: [
            ['Images, crops, adjustments', 'This tab. Reload clears them - export first.'],
            ['Saved and pinned sizes', 'This browser\'s local storage.'],
            ['On a server', 'Nothing. There is no server.'],
          ],
        },
        { kind: 'p', text: 'Check the network panel: after the page loads, nothing is requested.' },
      ],
    },

    {
      id: 'technology',
      title: 'How it is built',
      question: 'How does CropASAP work under the hood?',
      answer:
        'CropASAP is dependency-free TypeScript: a gamma-correct Lanczos resampler, a WebGL preview of the adjustment pipeline, and its own PNG and ZIP encoders, all running in the browser.',
      keywords: ['architecture', 'WebGL', 'Lanczos', 'linear light', 'client-side image processing'],
      blocks: [
        { kind: 'p', text: 'The parts that decide quality were written for this tool rather than borrowed.' },
        {
          kind: 'facts',
          title: 'The stack',
          rows: [
            ['Language', 'TypeScript, one ES module, no framework'],
            ['Resampling', 'Own - Lanczos-3 in linear light'],
            ['Adjustments', 'Own - WebGL 2 preview, JavaScript export'],
            ['PNG', 'Own writer, raced against the browser\'s'],
            ['ZIP', 'Own writer'],
            ['Runtime dependencies', 'None'],
            ['Hosting', 'Static files'],
          ],
        },
      ],
      children: [
        {
          id: 'resampling',
          title: 'Resampling',
          question: 'Why do CropASAP\'s resized images look sharper than other tools\'?',
          answer:
            'CropASAP downscales with {fact:resampler}. Pixels are converted from sRGB codes to actual light before averaging, so thin bright detail keeps its brightness and fine texture is filtered instead of aliased.',
          keywords: ['Lanczos', 'gamma-correct resize', 'linear light', 'sRGB'],
          blocks: [
            { kind: 'p', text: 'A pixel value is a code for light, not an amount of it. Averaging codes - what canvas `drawImage` does - gets the wrong answer: mid-grey between black and white comes out at 128 instead of 188. Thin bright lines, checkerboards and starfields darken as they shrink.' },
            { kind: 'p', text: 'So: decode to light, resample there, re-encode. The Lanczos-3 support widens with the reduction, which is a low-pass filter before pixels are discarded - the reason a proper resize keeps detail a box average smears.' },
            {
              kind: 'compare',
              before: { title: 'Canvas drawImage', text: 'Averages sRGB codes. Bright detail darkens, texture aliases.' },
              after: { title: 'CropASAP', text: 'Lanczos-3 in linear light. Brightness preserved, aliasing removed.' },
            },
          ],
        },
        {
          id: 'gpu-preview',
          title: 'GPU preview',
          question: 'How does CropASAP render adjustments in real time?',
          answer:
            'The adjustment pipeline exists twice from one set of uniforms: a WebGL fragment shader for the live preview and a per-pixel JavaScript loop for the export. The preview never writes a file.',
          keywords: ['WebGL', 'fragment shader', 'real-time preview'],
          blocks: [
            {
              kind: 'list',
              items: [
                'Bloom and halation are a real bright-pass and blur, at a quarter of the preview size.',
                'Grain is a hashed noise field mirrored exactly between shader and CPU. The export matches the preview grain for grain.',
                'No WebGL: the same pipeline runs on the CPU, reduced while you drag, full quality when you stop.',
              ],
            },
            { kind: 'callout', text: 'A missing extension can cost a smooth slider. It can never cost the picture - every export goes through the CPU pipeline at full resolution.' },
          ],
        },
        {
          id: 'png-encoder',
          title: 'PNG encoder',
          question: 'Why are CropASAP\'s PNG files smaller than the browser\'s?',
          answer:
            'Every PNG is encoded twice - by the browser and by CropASAP\'s own writer, which picks the cheapest colour type and filter for the image - and the smaller one is kept. The pixels are identical.',
          keywords: ['PNG optimisation', 'palette PNG', 'smaller PNG'],
          blocks: [
            { kind: 'p', text: 'The browser always writes 32 bits per pixel. A screenshot has a handful of colours; a photo has no alpha. The format has been able to say so since 1996. Deflate comes from the platform\'s `CompressionStream`, so this stays dependency-free.' },
          ],
        },
        {
          id: 'no-dependencies',
          title: 'No dependencies',
          question: 'What does CropASAP depend on?',
          answer:
            'At runtime, nothing. CropASAP makes {fact:dependencies}. Fonts are vendored, encoders are in-house, and the documentation is rendered from typed data.',
          keywords: ['no dependencies', 'vanilla TypeScript', 'privacy by architecture'],
          blocks: [
            { kind: 'p', text: 'Every third-party script is another party with access to the page. Zero is the only number that makes the privacy claim checkable.' },
          ],
        },
      ],
    },

    {
      id: 'strange-systems',
      title: 'Who makes this',
      question: 'Who makes CropASAP?',
      answer:
        'CropASAP is made by Strange Systems, a one-person indie software studio in Eugene, Oregon, run by Spencer Nunamaker.',
      keywords: ['Strange Systems', 'Spencer Nunamaker', 'Eugene Oregon'],
      blocks: [
        {
          kind: 'facts',
          title: 'Strange Systems',
          mark: STRANGE_SYSTEMS,
          rows: [
            ['Based in', 'Eugene, Oregon'],
            ['Size', 'One person'],
            ['That person', 'Spencer Nunamaker - UI/UX designer, musician, artist'],
            ['Also made', 'No Ceremony, a day organiser · Tip Top Brushes, for Procreate'],
          ],
        },
        { kind: 'p', text: '{fact:price} to use.' },
      ],
    },
  ],
});

export default docsContent;

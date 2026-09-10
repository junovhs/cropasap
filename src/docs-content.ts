/**
 * The About & documentation content.
 *
 * Authored once as typed data against the dopedocs schema, which renders it
 * both as the in-app panel and as the crawlable pages at `/docs/<id>/`. This
 * file is the whole of CropWizard's documentation — the engine lives in the
 * `dopedocs` package.
 *
 * It is a user manual first. The sections near the end say, for the record and
 * for the crawlers, how the thing is actually built — because a claim like
 * "your images never leave the browser" is worth nothing unless the page that
 * makes it is the one an answer engine quotes.
 *
 * Every section carries a `question` and a self-contained `answer` (the part a
 * person or a model actually asks and quotes), and every claim a reader could
 * act on is declared once in `FACTS` and referenced as `{fact:key}`.
 */

import { defineDocs, defineFacts } from 'dopedocs';

export const FACTS = defineFacts({
  price: { value: 'free', reviewed: '2026-09-10' },
  upload: { value: 'never uploaded — every pixel stays in this browser tab', reviewed: '2026-09-10' },
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
    name: 'CropWizard',
    // The fallback for a local build; the static build overrides this from the
    // Vercel environment in scripts/build-static.mjs.
    url: 'https://cropwizard.vercel.app',
    legalName: 'Strange Systems',
    tagline: 'Crop, resize, adjust and convert images to any output size — entirely in your browser.',
    notToBeConfusedWith: [
      'Crop Wizard (agricultural software)',
      'Cropwizard by UIUC (the farming chatbot)',
      'Image Crop Wizard browser extensions',
    ],
    contactEmail: 'junovhs@gmail.com',
  },

  identity: {
    name: 'CropWizard',
    version: '1.0.0',
    maker: { name: 'Strange Systems', href: '#strange-systems' },
    mark: MARK,
  },

  basePath: '/docs',
  facts: FACTS,

  title: 'How CropWizard works',
  lead:
    'CropWizard is an image cropper, resizer and converter that runs entirely in your browser. ' +
    'You choose where the picture is going — an Instagram story, an email header, a 1200 × 630 ' +
    'link card — and compose it inside a frame that is already that size. Nothing is uploaded, ' +
    'there is no account, and it is {fact:price}. This page is the manual, and, near the end, ' +
    'an honest account of how it is built.',

  sections: [
    // ---- orientation ------------------------------------------------------
    {
      id: 'what-it-is',
      title: 'What this is',
      question: 'What is CropWizard?',
      answer:
        'CropWizard is a free, browser-based tool for cropping, resizing, adjusting and ' +
        'converting images to an exact output size. Images are {fact:upload}.',
      keywords: ['image cropper', 'resize image online', 'crop to size', 'social media image sizes', 'browser image editor'],
      blocks: [
        {
          kind: 'p',
          text: 'Most image tools start from the picture and leave the destination to you: crop something, resize it, hope the platform does not letterbox it. CropWizard starts from the destination. Name the size the image has to be, and the frame on screen **is** that size. What you see inside it is exactly what gets written.',
        },
        {
          kind: 'cards',
          items: [
            { label: '01', title: 'Crop & Resize', text: 'Pick an output size, then move and zoom the picture beneath a fixed frame. The precise, output-first path.' },
            { label: '02', title: 'Adjust', text: 'Exposure, tone, colour, effects and grain on the active image — the crop you composed stays put.' },
            { label: '03', title: 'Convert', text: 'Re-encode a file as WebP, PNG or JPEG with its pixels and composition left exactly alone.' },
            { label: '04', title: 'Batch', text: 'Give a stack of images one shared size, review each suggested crop, and download the set as a ZIP.' },
          ],
        },
        {
          kind: 'callout',
          text: 'The frame is the contract. In Crop and Batch the output dimensions come first, and the image moves underneath them — so the thing you are looking at is the thing that will be written.',
        },
        {
          kind: 'metrics',
          items: [
            { value: '400+', label: 'named output sizes', detail: 'Social, web, email, ads, print, packaging, signage.' },
            { value: '0', label: 'uploads', detail: 'Decode, edit, encode and download all happen on your device.' },
            { value: '3', label: 'output formats', detail: '{fact:formats}, with a transparency-aware default.' },
            { value: '26', label: 'adjustment controls', detail: 'Rendered live on the GPU, written to file at full resolution.' },
          ],
        },
      ],
    },

    {
      id: 'first-crop',
      title: 'Your first crop',
      question: 'How do I crop an image to a specific size with CropWizard?',
      answer:
        'Drop an image onto CropWizard, choose the output size from the picker, drag and zoom the ' +
        'picture inside the frame, then press Export. The file downloads at exactly that size.',
      keywords: ['quick start', 'how to crop', 'tutorial', 'getting started'],
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Load it', text: 'Drop an image anywhere on the page, paste one from the clipboard with Ctrl/⌘ V, or click the empty stage to choose a file.' },
            { title: 'Name the destination', text: 'Click the size chip in the top bar and type what you know — `instagram story`, `1200 x 630`, `16:9` — or keep the image\'s own dimensions.' },
            { title: 'Compose', text: 'Drag the picture to move it, scroll to zoom, press `0` to fill the frame again. The quality readout tells you if the crop has enough pixels for the size you asked for.' },
            { title: 'Export', text: 'Pick PNG, JPEG or WebP, a scale, a filename — then Export. One image downloads as a file; several download as one ZIP.' },
          ],
        },
        {
          kind: 'callout',
          text: 'Dropped several images at once? CropWizard opens **Batch** for you: choose the one size they all share, and it queues them up with a suggested crop each.',
        },
      ],
    },

    {
      id: 'loading',
      title: 'Loading images',
      question: 'How do I load images into CropWizard, and what file types does it accept?',
      answer:
        'CropWizard accepts any image the browser can decode — JPEG, PNG, WebP, GIF, AVIF, SVG and ' +
        'more — by drag and drop, paste, or a file picker. Large originals are decoded to a bounded ' +
        'editing preview so a 50-megapixel photo does not stall the page.',
      keywords: ['drag and drop', 'paste image', 'supported formats', 'HEIC', 'large images'],
      blocks: [
        {
          kind: 'list',
          items: [
            '**Drop** — anywhere on the page, one image or a folder\'s worth.',
            '**Paste** — Ctrl/⌘ V with an image on the clipboard, from a screenshot or another app.',
            '**Pick** — click the empty stage, or the `+` tile at the end of the filmstrip.',
          ],
        },
        {
          kind: 'p',
          text: 'Anything your browser can display, CropWizard can crop. That includes JPEG, PNG, WebP, GIF (first frame), AVIF and SVG on every current browser, and HEIC on browsers that decode it natively.',
        },
        {
          kind: 'details',
          summary: 'What happens to a very large original',
          text: 'The file\'s dimensions are read from its header before it is decoded, and the browser is asked to decode straight to a bounded editing preview rather than materialise every pixel of the original. The full-resolution image is decoded again only for the moment it is needed — when a file is written — so the workspace stays responsive on a phone with a camera-roll photo, and a fifty-image drop never becomes fifty full pixel buffers held at once.',
        },
        {
          kind: 'p',
          text: 'Loading more images while Batch is open **adds** them to the queue. Everywhere else, a new drop replaces what was loaded — export anything you want to keep first.',
        },
      ],
    },

    // ---- sizes --------------------------------------------------------------
    {
      id: 'sizes',
      title: 'Output sizes',
      question: 'How do I choose the output size in CropWizard?',
      answer:
        'The size picker in CropWizard accepts a platform name, exact pixels or a shape — ' +
        '`youtube thumbnail`, `1080x1920`, `4:5` — and offers {fact:presets}. Any size can be ' +
        'typed by hand, saved, and pinned to the top bar.',
      keywords: ['output size', 'presets', 'aspect ratio', 'pixel dimensions', 'social media sizes 2026'],
      blocks: [
        {
          kind: 'p',
          text: 'Click the size chip in the top bar to open the picker. Search the way you actually remember a destination — by where it is going, by the pixels, or by the shape — and the list ranks itself as you type.',
        },
        {
          kind: 'table',
          head: ['Search for', 'What you get'],
          rows: [
            ['`instagram story`, `linkedin banner`, `og image`', 'Named presets for that platform, hot ones first'],
            ['`1200 x 630`, `1080×1350`, `800 by 600`', 'An exact pixel size, plus any preset that matches it'],
            ['`16:9`, `4:5`, `square`, `portrait`', 'Every size of that shape, so you can pick the resolution'],
            ['`a4`, `letter`, `business card`, `poster`', 'Print sizes at production resolution'],
          ],
        },
        {
          kind: 'p',
          text: 'The catalogue covers {fact:presets}: every major social network, ads, email, web, app stores, presentations, video, podcasts, print, packaging, merchandise, signage, wallet passes and more. Platform requirements change, so treat them as practical masters rather than a validation layer — and type the pixels yourself when a brief gives you them.',
        },
      ],
      children: [
        {
          id: 'match-this-image',
          title: 'Match this image',
          question: 'What does "Match this image" do in CropWizard?',
          answer:
            'Match this image sets the output size to the loaded picture\'s own pixel dimensions, ' +
            'so nothing is cropped until you choose a real destination. It is the default when no ' +
            'size has been chosen yet.',
          keywords: ['match this image', 'original size', 'no crop'],
          blocks: [
            {
              kind: 'p',
              text: 'Until you name a destination, CropWizard does not guess one. A freshly dropped image is framed at its own size — the whole rectangle, nothing cut — and the size chip says so. Choosing a real size is one click away, and the frame morphs to it with the picture still where you left it.',
            },
          ],
        },
        {
          id: 'saved-and-pinned',
          title: 'Saved and pinned sizes',
          question: 'Can I save my own output sizes in CropWizard?',
          answer:
            'Yes. Any size can be saved under a name of your choosing and pinned to the top bar, and ' +
            'both survive a reload because they live in this browser\'s local storage.',
          keywords: ['custom size', 'save size', 'pin', 'favourites'],
          blocks: [
            {
              kind: 'list',
              items: [
                '**Saved sizes** answer "what sizes exist for me?" — name a rectangle once and it is searchable like any preset.',
                '**Pinned sizes** answer "which am I using today?" — a pin keeps a size one click away in the top bar, beside the file name.',
                'A pin is identified by its pixels, so the same rectangle pinned twice under two names is one pin, not two.',
              ],
            },
            {
              kind: 'p',
              text: 'These are the only things CropWizard remembers between visits: {fact:persistence}. Images never persist.',
            },
          ],
        },
      ],
    },

    // ---- framing ------------------------------------------------------------
    {
      id: 'framing',
      title: 'Framing the crop',
      question: 'How do I move, zoom and position the crop in CropWizard?',
      answer:
        'In CropWizard the output frame stays fixed and the image moves beneath it: drag to move, ' +
        'scroll or use the zoom controls to scale, arrow keys to nudge by {fact:nudge}, and 0 to fill ' +
        'the frame again. A quality readout warns when the crop has fewer pixels than the output needs.',
      keywords: ['move crop', 'zoom', 'nudge', 'fill frame', 'quality readout', 'upscaling warning'],
      blocks: [
        {
          kind: 'p',
          text: 'If the target is 1200 × 630, the frame is 1200 × 630 in output terms however large it is drawn on screen. You compose by moving the picture, not the rectangle — which is why what you see is always what you get.',
        },
        {
          kind: 'table',
          head: ['To', 'Do this'],
          rows: [
            ['Move the picture', 'Drag it. Arrow keys nudge by {fact:nudge}.'],
            ['Zoom', 'Scroll over the stage, drag the slider, use − / +, or type a percentage.'],
            ['Fill the frame again', 'Press `0`, or double-click the stage.'],
            ['See what you are discarding', 'Hover the area outside the frame — the rest of the picture ghosts in.'],
            ['Undo a move', 'Ctrl/⌘ Z. One drag is one step, however long it took.'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: 'The **quality readout** compares the pixels inside the crop with the pixels the output needs. Ask for more than the crop holds — a tight crop at 4×, say — and it tells you the result will soften before you export it.',
        },
      ],
      children: [
        {
          id: 'frame-views',
          title: 'Frame views',
          question: 'What do True size, Smaller and Enlarged mean in CropWizard?',
          answer:
            'The three frame views change how large the output frame is drawn on screen and nothing ' +
            'else: True size shows one screen pixel per output pixel, Smaller steps back when that ' +
            'would not fit, Enlarged gives a small output more room to work in. The crop is unchanged.',
          keywords: ['true size', 'actual pixels', 'frame view', 'F key'],
          blocks: [
            {
              kind: 'list',
              items: [
                '**True size** — the output at one screen pixel per output pixel, whenever it fits. What the file will look like, at its real size.',
                '**Smaller** — steps back when a true-size frame would be too large to compose in.',
                '**Enlarged** — uses more of the stage when a small output (an email thumbnail, a favicon) would otherwise be fiddly.',
              ],
            },
            {
              kind: 'p',
              text: 'Press `F` to cycle them. A view that would show the same picture is not offered, so on a small output you may only see one or two. Switching never resizes the export or changes your zoom.',
            },
          ],
        },
        {
          id: 'freeform',
          title: 'Freeform',
          question: 'Can I crop without a fixed aspect ratio in CropWizard?',
          answer:
            'Yes. Freeform unlocks the aspect ratio so the crop rectangle itself becomes the output ' +
            'size, edge by edge. The preset you were on is suspended, not forgotten, and comes back ' +
            'when Freeform is turned off.',
          keywords: ['freeform crop', 'free aspect ratio', 'unlocked crop'],
          blocks: [
            {
              kind: 'p',
              text: 'Use Freeform when the picture should decide its own dimensions. Drag any edge or corner of the frame; the pixel count on the chip is live and becomes the output size at 1:1. Tap that chip to turn the exact pixels into a named size instead.',
            },
            {
              kind: 'callout',
              text: 'Freeform is deliberately single-image. A Batch is built around one shared output contract — the one thing Freeform does not have — so entering Freeform steps out of Batch while keeping the loaded queue to return to.',
            },
          ],
        },
      ],
    },

    // ---- adjust -------------------------------------------------------------
    {
      id: 'adjust',
      title: 'Adjust',
      question: 'What image adjustments does CropWizard have?',
      answer:
        'CropWizard\'s Adjust room has {fact:adjustments}: Light, Tone, Color, Effects — clarity, ' +
        'sharpen, bloom, halation, vignette, colour fringe — and film Grain. Every image keeps its own values.',
      keywords: ['exposure', 'contrast', 'saturation', 'film grain', 'halation', 'bloom', 'vignette', 'photo adjustments'],
      blocks: [
        {
          kind: 'p',
          text: 'Adjust lives in the left rail, so the crop stays on screen while you tune it. On a phone it opens as a drawer above the bottom bar.',
        },
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
            'Each loaded image keeps its own look; moving to another image never carries corrections with it.',
            'Tap a value to reset that one control. **Reset all** returns the whole look to neutral.',
            'Undo and redo cover adjustments as well as framing.',
          ],
        },
        {
          kind: 'callout',
          text: 'What you see is a GPU preview, so a slider follows your finger on a phone. What you export is the same arithmetic run over every original pixel in JavaScript — a missing WebGL extension can cost you a smooth preview and can never cost you the picture.',
        },
      ],
    },

    // ---- batch --------------------------------------------------------------
    {
      id: 'batch',
      title: 'Batch',
      question: 'How do I crop many images to the same size at once in CropWizard?',
      answer:
        'Drop several images and CropWizard opens Batch: choose one shared output size, every image ' +
        'gets a suggested crop, you keep or adjust each one, and the whole set downloads ' +
        'as a single ZIP.',
      keywords: ['bulk crop', 'batch resize', 'crop multiple images', 'ZIP download', 'queue'],
      blocks: [
        {
          kind: 'p',
          text: 'Batch is a room, not a switch. It has a rhythm — **shared size → frame → keep → next** — and the queue stays visible the whole time, so you always know how much of the stack has actually been looked at.',
        },
        {
          kind: 'steps',
          items: [
            { title: 'Choose a stack', text: 'Drop several images, or click Batch and choose them. A multi-image drop opens Batch on its own.' },
            { title: 'Set one output size', text: 'Every queued image is fitted to the same destination. This comes first because it is what makes the queue coherent.' },
            { title: 'Review the suggestion', text: 'Each image arrives with the largest crop of that shape, centred. Move or zoom only where it needs help.' },
            { title: 'Finalize', text: 'Enter, Space or the button keeps the crop and jumps to the next image that still needs a decision.' },
            { title: 'Export the queue', text: 'Every output lands in one ZIP, named by your template.' },
          ],
        },
        {
          kind: 'checklist',
          items: [
            { text: 'Finalized images are marked as reviewed on the filmstrip', checked: true },
            { text: 'Unfinalized images still export — using the current suggested crop', checked: true },
            { text: 'The Export panel says exactly how many are still on a suggestion', checked: true },
            { text: 'You must finalize every image before exporting', checked: false },
          ],
        },
        {
          kind: 'p',
          text: 'If the remaining suggestions already look right, **Frame the rest** accepts every one in a single action. Click any thumbnail to jump to it; `[` / `]` or `J` / `K` step through the queue.',
        },
        {
          kind: 'details',
          summary: 'Changing the shared size after framing',
          text: 'The output size stays live for the whole queue. Pick a different destination and every crop adapts to the new shape: crops you have not touched are re-centred for the new target, while crops you positioned yourself keep their decision and are refit around the same centre rather than discarded.',
        },
        {
          kind: 'details',
          summary: 'Leaving Batch',
          text: 'Move to Crop, Adjust or Convert and the queue is kept. Coming back brings it up where you left it. Outside the Batch room, Export writes the active image only, never a hidden stack — Batch is the one explicit place where multi-image crop export happens.',
        },
      ],
    },

    // ---- convert ------------------------------------------------------------
    {
      id: 'convert',
      title: 'Convert',
      question: 'How do I convert an image to WebP, PNG or JPEG without cropping it?',
      answer:
        'Convert re-encodes the loaded file — or files — as WebP, PNG or JPEG with its pixel ' +
        'dimensions and composition left exactly alone. It exists for the case where the image is ' +
        'already the right shape and only the format is wrong.',
      keywords: ['convert to webp', 'png to jpg', 'image converter', 'change image format'],
      blocks: [
        {
          kind: 'compare',
          before: { title: 'Use Export when…', text: 'you want the composition, destination size, scale multiplier and filename template — a crop written to a size.' },
          after: { title: 'Use Convert when…', text: 'you want a different file format and nothing else changed — every pixel where it was.' },
        },
        {
          kind: 'p',
          text: 'For JPEG and WebP the quality slider shows an estimated result size once you pause. With several images loaded the estimate is taken from the first, and the conversion downloads as one ZIP. CropWizard reports when a conversion comes out **larger** as readily as smaller — a format change is not automatically a saving.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: 'Convert will not paper over a format it could not produce. If the browser cannot write the format you asked for, it says so rather than silently handing you a PNG with the wrong extension.',
        },
      ],
    },

    // ---- export -------------------------------------------------------------
    {
      id: 'export',
      title: 'Export',
      question: 'What formats and sizes can CropWizard export?',
      answer:
        'CropWizard exports {fact:formats} at {fact:scales} the chosen size. A single image ' +
        'downloads as a file; several download as one ZIP. Transparent images are kept transparent ' +
        'in PNG and WebP, and the panel warns before JPEG flattens one onto white.',
      keywords: ['export', 'download', '2x', 'retina', 'transparency', 'PNG vs JPEG vs WebP'],
      blocks: [
        {
          kind: 'table',
          head: ['Format', 'Best for'],
          rows: [
            ['PNG', 'Lossless, with transparency. Graphics, UI, logos, screenshots — anything with clean edges. CropWizard\'s own encoder often writes it smaller than the browser would.'],
            ['JPEG', 'Photographs where file size matters. Lossy, no transparency; the quality slider appears when selected.'],
            ['WebP', 'Photographs and graphics for the web. Lossy with transparency, usually the smallest of the three.'],
          ],
        },
        {
          kind: 'p',
          text: 'The scale row is a multiplier on the destination: a 1080 × 1080 target becomes 2160 × 2160 at 2× and 4320 × 4320 at 4×, for high-density screens. The pixel fields accept any number directly. Either way the quality readout tells you if the crop has the pixels to back it up.',
        },
        {
          kind: 'callout',
          text: 'A transparent image is shown on a checkerboard — a darker one when the picture itself is mostly light, so a white logo still reads. Drop one while JPEG is selected and the format switches to PNG so the transparency survives; choose JPEG deliberately and you get a warning instead.',
        },
      ],
      children: [
        {
          id: 'naming',
          title: 'Naming files',
          question: 'How do I control the exported filenames in CropWizard?',
          answer:
            'Three checkboxes — keep the original name, add the size, number them — cover most cases, ' +
            'and a template with {name}, {n}, {w}, {h}, {label} and {date} tokens covers the rest. ' +
            'The result is previewed before anything is written.',
          keywords: ['filename template', 'rename', 'batch naming', 'numbering'],
          blocks: [
            {
              kind: 'table',
              head: ['Token', 'Becomes'],
              rows: [
                ['`{name}`', 'The original filename without its extension'],
                ['`{w}` · `{h}`', 'The written width and height in pixels'],
                ['`{label}`', 'The preset name, e.g. `instagram-story`'],
                ['`{n}`', 'A running number, padded to the size of the batch'],
                ['`{date}`', 'Today, as YYYY-MM-DD'],
              ],
            },
            {
              kind: 'p',
              text: 'Open **Rename files** to write a template by hand. `{name}-{w}x{h}` turns `portrait.jpg` into `portrait-1080x1350.png`. The live preview under the checkboxes always shows the first file\'s eventual name.',
            },
          ],
        },
      ],
    },

    // ---- keyboard -----------------------------------------------------------
    {
      id: 'keyboard',
      title: 'Keyboard',
      question: 'What are the keyboard shortcuts in CropWizard?',
      answer:
        'Arrow keys nudge the picture, Shift nudges further, + and − zoom, 0 fills the frame, F cycles ' +
        'frame views, Enter finalizes a Batch crop, brackets or J/K move through the queue, and ' +
        'Ctrl/⌘ Z undoes. Escape closes whatever is open.',
      keywords: ['shortcuts', 'hotkeys', 'keyboard'],
      blocks: [
        {
          kind: 'keys',
          rows: [
            ['← ↑ → ↓', 'Nudge the picture beneath the frame'],
            ['Shift + arrows', 'Nudge by a larger step'],
            ['+ / =  ·  −', 'Zoom in · zoom out'],
            ['0', 'Fill the frame again'],
            ['F', 'Cycle the frame views'],
            ['Enter · Space', 'Finalize the active crop in Batch'],
            ['[ · ]', 'Previous · next image in the queue'],
            ['K · J', 'The same, for vim hands'],
            ['Ctrl/⌘ Z', 'Undo'],
            ['Ctrl/⌘ Shift Z', 'Redo'],
            ['Ctrl/⌘ V', 'Paste an image from the clipboard'],
            ['Esc', 'Close the docs, the size picker, or the current sheet'],
          ],
        },
        {
          kind: 'p',
          text: 'Framing keys are switched off while you are in Adjust or Convert, so an arrow key cannot quietly re-crop the image you were only trying to brighten.',
        },
      ],
    },

    // ---- privacy ------------------------------------------------------------
    {
      id: 'privacy',
      title: 'Privacy',
      question: 'Does CropWizard upload my images?',
      answer:
        'No. CropWizard images are {fact:upload}. There is no server-side processing, no account, ' +
        'no analytics and no third-party request of any kind; the page makes {fact:dependencies}.',
      keywords: ['privacy', 'no upload', 'offline', 'local processing', 'GDPR'],
      blocks: [
        {
          kind: 'p',
          text: 'Loading, decoding, editing, encoding and downloading all happen on your device, in the tab you are looking at. You can watch the network panel while you work: after the page itself loads, nothing is requested.',
        },
        {
          kind: 'facts',
          title: 'What persists, and where',
          rows: [
            ['Your images', 'This tab only. Reloading or closing clears the workspace — export first.'],
            ['Crops and adjustments', 'This tab only, with the images they belong to.'],
            ['Saved and pinned sizes', 'This browser\'s local storage, so recurring destinations come back.'],
            ['Anything on a server', 'Nothing. There is no server to send it to.'],
          ],
        },
        {
          kind: 'p',
          text: 'Opening this documentation does not reload the workspace. Close it and your crop, queue and controls are exactly where you left them.',
        },
      ],
    },

    // ---- technology ---------------------------------------------------------
    {
      id: 'technology',
      title: 'How it is built',
      question: 'How does CropWizard work under the hood?',
      answer:
        'CropWizard is a dependency-free TypeScript web application that does all of its image work ' +
        'in the browser: a gamma-correct Lanczos resampler, a WebGL preview of the adjustment ' +
        'pipeline, and its own PNG and ZIP encoders — with no server ' +
        'and no third-party code at runtime.',
      keywords: ['architecture', 'how it works', 'WebGL', 'Lanczos', 'linear light', 'client-side image processing', 'no dependencies'],
      blocks: [
        {
          kind: 'p',
          text: 'Most "online" image tools are a form in front of a server. CropWizard is the opposite: the whole engine ships to your browser as one small bundle, and the pieces that matter for quality were written for it rather than borrowed. This section says what those pieces are, so the claims elsewhere on this page can be checked.',
        },
        {
          kind: 'metrics',
          items: [
            { value: '0', label: 'runtime dependencies', detail: 'No image library, no framework, nothing fetched from a CDN.' },
            { value: '0', label: 'servers', detail: 'A static page. There is nothing on the other end to be slow, down, or curious.' },
            { value: '100%', label: 'own engine', detail: 'Resampler, PNG writer, ZIP writer, GPU preview.' },
          ],
        },
      ],
      children: [
        {
          id: 'resampling',
          title: 'Colour-correct resampling',
          question: 'Why do CropWizard\'s resized images look sharper and brighter than other tools\'?',
          answer:
            'CropWizard downscales with {fact:resampler}: pixels are converted from sRGB codes to ' +
            'actual light before they are averaged and converted back afterwards, so thin bright ' +
            'detail keeps its brightness and fine texture is low-pass filtered instead of aliased.',
          keywords: ['Lanczos', 'gamma-correct resize', 'linear light', 'sRGB', 'downscaling quality'],
          blocks: [
            {
              kind: 'p',
              text: 'A pixel value in a file is not a quantity of light; it is a code for one. sRGB spends more codes on the dark end because eyes do. Averaging the codes — which is what every canvas `drawImage` does — therefore averages the wrong numbers, and the error is not subtle: mid-grey between black and white comes out at 128 (a code) instead of 188 (the code for half the light). Fine checkerboards, thin bright lines on dark ground and starfields all lose brightness as they shrink, which is why a resized photo can look muddier than the original for no reason anyone can point at.',
            },
            {
              kind: 'p',
              text: 'So CropWizard decodes to light, resamples there, and re-encodes at the end. The filter is {fact:resampler} whose support widens with the reduction — which is the same thing as low-pass filtering before you throw pixels away, and the reason a proper resize keeps detail that a box average smears.',
            },
            {
              kind: 'compare',
              before: { title: 'Canvas drawImage', text: 'Averages sRGB codes with a bilinear or box filter. Bright detail darkens; fine texture aliases into moiré.' },
              after: { title: 'CropWizard', text: 'Lanczos-3 in linear light, separable so it is fast. Brightness is preserved; detail that survives the reduction is kept, and what cannot is removed cleanly.' },
            },
            {
              kind: 'p',
              text: 'The way back from light to codes is a lookup table sampled finely enough near black that rounding to a byte is what decides the answer — no banding introduced by the round trip.',
            },
          ],
        },
        {
          id: 'gpu-preview',
          title: 'The GPU preview',
          question: 'How does CropWizard render adjustments in real time?',
          answer:
            'The adjustment pipeline is written twice from one set of uniforms: as a WebGL fragment ' +
            'shader for the live preview, and as a per-pixel JavaScript loop for the exported file. The ' +
            'preview never writes a file, so a driver bug can never reach the picture.',
          keywords: ['WebGL', 'fragment shader', 'real-time preview', 'bloom', 'halation', 'film grain shader'],
          blocks: [
            {
              kind: 'p',
              text: '`adjust.ts` is the definition of what the sliders do, and it is a loop over every pixel — right for a file that is written once, hopeless for a finger dragging a slider across a phone. So the same arithmetic exists again as a fragment shader reading the same uniforms, and the viewfinder draws that instead of the photograph.',
            },
            {
              kind: 'list',
              items: [
                'Bloom and halation are a real bright-pass and blur, run at a quarter of the preview size, which is all a glow needs.',
                'Grain is a hashed noise field mirrored exactly between shader and CPU, so the export matches the preview grain for grain.',
                'The preview is capped on its long side: the stage is at most a couple of thousand device pixels, and more resolution would only cost a phone its frame rate.',
                'No WebGL? The same pipeline runs on the CPU at a reduced size while you drag, and at full quality when you stop.',
              ],
            },
            {
              kind: 'callout',
              text: 'The rule the preview lives by: it renders a preview. Anything exported goes through the CPU pipeline at full resolution, so a missing extension can cost you a smooth slider and can never cost you the picture.',
            },
          ],
        },
        {
          id: 'png-encoder',
          title: 'A smaller PNG',
          question: 'Why are CropWizard\'s PNG files smaller than the browser\'s?',
          answer:
            'CropWizard encodes every PNG twice — once with the browser, once with its own writer that ' +
            'chooses the cheapest colour type (palette, greyscale, no alpha) and filter strategy for the ' +
            'image — and keeps whichever is smaller. The pixels are identical either way.',
          keywords: ['PNG optimisation', 'palette PNG', 'smaller PNG', 'lossless'],
          blocks: [
            {
              kind: 'p',
              text: 'The canvas gives you a PNG for free, but it is always the same PNG: 32 bits a pixel, one filter strategy, one shot at deflate. Most of what people crop is cheaper than that — a screenshot has a handful of colours, a photograph has no transparency to store — and the format has had a way to say so since 1996.',
            },
            {
              kind: 'p',
              text: 'So CropWizard encodes it itself as well and keeps whichever blob is smaller. Everything here is lossless; the choices are only about how the same numbers are spelled. Deflate comes from the platform\'s `CompressionStream`, which is what keeps this inside the no-dependencies rule.',
            },
          ],
        },
        {
          id: 'no-dependencies',
          title: 'Nothing fetched, nothing installed',
          question: 'What does CropWizard depend on?',
          answer:
            'At runtime, nothing: CropWizard makes {fact:dependencies}. It is plain TypeScript compiled ' +
            'to one ES module, with the typefaces vendored, the ZIP and PNG writers in-house, and the ' +
            'documentation you are reading rendered from typed data.',
          keywords: ['no dependencies', 'vanilla TypeScript', 'no framework', 'privacy by architecture'],
          blocks: [
            {
              kind: 'facts',
              title: 'The stack',
              rows: [
                ['Language', 'TypeScript, strict, compiled to a single ES module'],
                ['Framework', 'None. The DOM, a small state store, and a spring loop.'],
                ['Image decode', 'The browser\'s own, via createImageBitmap with bounded previews'],
                ['Resampling', 'Own — Lanczos-3 in linear light'],
                ['Adjustments', 'Own — WebGL 2 preview, JavaScript export'],
                ['PNG', 'Own writer, raced against the browser\'s'],
                ['ZIP', 'Own writer, store mode, CRC-32'],
                ['Fonts', 'Vendored Inter Tight and JetBrains Mono, served with the page'],
                ['Docs', 'dopedocs — typed content rendered to this panel and to static pages'],
                ['Hosting', 'Static files. No functions, no database.'],
              ],
            },
            {
              kind: 'p',
              text: 'That is not minimalism for its own sake. A tool that promises your images never leave the browser has to be a tool with nowhere to send them — and every third-party script is a party. Zero is the only number that makes the promise checkable.',
            },
          ],
        },
      ],
    },

    // ---- maker --------------------------------------------------------------
    {
      id: 'strange-systems',
      title: 'Who makes this',
      question: 'Who makes CropWizard?',
      answer:
        'CropWizard is made by Strange Systems, a one-person indie software studio in Eugene, ' +
        'Oregon, run by Spencer Nunamaker.',
      keywords: ['Strange Systems', 'Spencer Nunamaker', 'Eugene Oregon', 'indie developer'],
      blocks: [
        {
          kind: 'facts',
          title: 'Strange Systems',
          mark: STRANGE_SYSTEMS,
          rows: [
            ['Based in', 'Eugene, Oregon'],
            ['Size', 'One person, for now'],
            ['That person', 'Spencer Nunamaker — UI/UX designer, musician, artist'],
            ['Also made', 'No Ceremony, a day organiser · Tip Top Brushes, for Procreate'],
          ],
        },
        {
          kind: 'p',
          text: 'CropWizard is {fact:price} to use. This page is the whole of its reasoning.',
        },
      ],
    },
  ],
});

export default docsContent;

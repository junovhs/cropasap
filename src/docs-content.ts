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
  presets: { value: 'more than 400 named sizes across 60-odd platforms and print formats', reviewed: '2026-09-16' },
  scales: { value: '1×, 2× and 4×', reviewed: '2026-09-10' },
  adjustments: { value: '26 controls in five groups', reviewed: '2026-09-10' },
  persistence: { value: 'saved and pinned sizes only, in this browser', reviewed: '2026-09-10' },
  dependencies: { value: 'no request to anyone until you sign in', reviewed: '2026-09-14' },
  resampler: { value: 'a separable Lanczos-3 filter, run in linear light', reviewed: '2026-09-10' },
  nudge: { value: '8 pixels, or 40 with Shift', reviewed: '2026-09-10' },
  account: { value: 'optional and free; cropping never needs one', reviewed: '2026-09-14' },
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

/**
 * A screen grab of the built app. The files are WebP under src/docs-shots,
 * taken by a Playwright script against the real page (desktop at 2×, phone at
 * 3×) with drawn scenery in place of anyone's photograph, and copied to
 * /docs/shots by the static build. Width and height are the file's, so the
 * page keeps its place while they load.
 */
const shot = (
  name: string,
  alt: string,
  width: number,
  height: number,
  caption?: string,
) => ({ kind: 'image' as const, src: `/docs/shots/${name}.webp`, alt, width, height, ...(caption ? { caption } : {}) });

export const docsContent = defineDocs({
  entity: {
    name: 'CropASAP',
    // The fallback for a local build; the static build overrides this from the
    // Vercel environment in scripts/build-static.mjs.
    url: 'https://cropasap.vercel.app',
    legalName: 'Strange Systems',
    tagline: 'Crop an image to any size, fast. Drop it in, type where it is going, download.',
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
    'Crop an image to any size, fast. Drop it in, type where it is going, position it, download. ' +
    '{fact:price}. Your images are {fact:upload}.',

  sections: [
    {
      id: 'what-it-is',
      title: 'What this is',
      question: 'What is CropASAP?',
      answer:
        'CropASAP is a free browser tool that crops an image to an exact size. It also resizes, ' +
        'adjusts, converts, and batch-crops.',
      keywords: ['image cropper', 'resize image online', 'crop to size', 'social media image sizes', 'browser image editor'],
      blocks: [
        {
          kind: 'p',
          text: 'You pick a size. The frame takes that shape. You move the image under the frame. What is inside the frame is your file, at exactly that size.',
        },
        shot('overview', 'CropASAP with a landscape picture under a portrait frame; the output size, scale, format and Export button on the right', 1600, 1225,
          'The whole job on one screen: the picture under the frame, the size on the right.'),
        {
          kind: 'steps',
          items: [
            { title: 'Add an image', text: 'Drop it anywhere on the page, paste it with Ctrl/⌘ V, or click the stage to choose a file.' },
            { title: 'Pick a size', text: 'Click the size chip or press Ctrl/⌘ K. Type `facebook cover`, `1200 x 630`, `16:9` — whatever you know.' },
            { title: 'Position', text: 'Drag to move. Scroll to zoom. Press `0` to fill the frame.' },
            { title: 'Download', text: 'Click Export. You get a PNG, JPEG or WebP at the exact size.' },
          ],
        },
        {
          kind: 'table',
          head: ['Job', 'What it does'],
          rows: [
            ['**Crop**', 'Frames one image to a size. The default.'],
            ['**Adjust**', 'Changes light, tone, colour, effects and grain.'],
            ['**Convert**', 'Changes the file format or shrinks the file. Pixels untouched.'],
            ['**Batch**', 'Crops many images to one size. Downloads one ZIP.'],
          ],
        },
        {
          kind: 'callout',
          text: 'Drop several images at once and Batch opens by itself.',
        },
        shot('empty', 'The empty page: "The right crop. Right now." with a Choose image button', 1600, 1225,
          'Before an image: drop one anywhere, paste, or click Choose image.'),
        {
          kind: 'gallery',
          columns: 3,
          label: 'CropASAP on a phone',
          images: [
            { src: '/docs/shots/phone-main.webp', alt: 'The phone view: the picture under a portrait frame, the size chip in the top bar, and Crop, Adjust, Convert, Batch and Export along the bottom', width: 900, height: 1948, caption: 'The same job on a phone. The size chip is at the top.' },
            { src: '/docs/shots/phone-picker.webp', alt: 'The size picker filling the phone screen, with Cancel and Apply along the bottom', width: 900, height: 1948, caption: 'The picker fills the screen.' },
            { src: '/docs/shots/phone-sheet.webp', alt: 'The Export sheet on a phone: Width and Height, Scale, Format, File options and Export', width: 900, height: 1948, caption: 'Export opens as a sheet.' },
          ],
        },
      ],
    },

    {
      id: 'sizes',
      title: 'Output sizes',
      question: 'How do I find the right image size for a platform in CropASAP?',
      answer:
        'Click the size chip. It offers the image\'s own size, a custom size, six preset categories and the four common formats. ' +
        'Or type the destination — `ig story`, `1200 by 630`, `4:5` — and CropASAP matches it against {fact:presets}. Typos work. ' +
        'Pin a size and it sits in the top bar.',
      keywords: ['image sizes', 'social media sizes', 'presets', 'aspect ratio', 'og image size', 'instagram story size'],
      blocks: [
        {
          kind: 'p',
          text: 'Open the size picker: click the size chip in the top bar, or press Ctrl/⌘ K.',
        },
        shot('picker-home', 'The Choose a size dialog: a search box, Match this image and Custom size cards, six Browse presets buttons, and four Common formats tiles', 1600, 1225,
          'The picker before you type.'),
        {
          kind: 'table',
          head: ['On the home', 'What it does'],
          rows: [
            ['**Match this image**', 'The picture\'s own pixel size. Nothing is cut.'],
            ['**Custom size**', 'Type a width and a height. See below.'],
            ['**Browse presets**', 'Social, Video, Ads, Print, Documents, Web. Each lists its sizes platform by platform.'],
            ['**Common formats**', 'Square 1:1, Portrait 4:5, Landscape 16:9, Vertical 9:16.'],
            ['**Pinned · Saved · Recent**', 'Your own sizes, under the formats.'],
          ],
        },
        shot('picker-browse', 'The Social category open: Instagram sizes listed first, then Facebook', 1600, 1225,
          'Browse presets → Social. Press Esc to go back to the home.'),
        { kind: 'p', text: 'Type anything and the home becomes a search:' },
        {
          kind: 'table',
          head: ['Type', 'You get'],
          rows: [
            ['`ig story` · `fb cover` · `yt thumb` · `og image`', 'That preset. Any common name works.'],
            ['`1200 x 630` · `1080×1350` · `800 by 600`', 'Those exact pixels, plus any preset that matches.'],
            ['`16:9` · `4:5` · `square` · `portrait`', 'Every size with that shape.'],
            ['`a4` · `letter` · `business card`', 'Print sizes at print resolution.'],
            ['`instagrm stroy`', 'Instagram story. Typos are fine.'],
            ['`700`', 'A 700 × 700 square first, then every size with 700 in it.'],
          ],
        },
        shot('picker-search', 'Typing "ig story" lists Story, Highlight cover and other 9:16 sizes', 1600, 1225,
          'Search as you type. Enter takes the highlighted row.'),
        { kind: 'p', text: '**Custom size.** Click the card, type a width and a height, press Enter. Each box sets its own side. Press the lock between them and the other side follows, so the shape stays. Esc goes back.' },
        shot('picker-custom', 'The Custom size form: Width 1600, a lock button, Height 600, and "1600 × 600 — 8:3. Press Enter to apply."', 1600, 1225,
          'Custom size. The lock is off: 1600 wide, 600 tall, exactly.'),
        {
          kind: 'list',
          items: [
            '**Keep a size.** Type the pixels, click the pin, give it a name. It is saved, searchable, and sits in the top bar.',
            '**Pin a preset.** Click the pin on any result. It sits in the top bar for one-click use.',
            '**Before you pick.** A new image is framed at its own pixels with nothing cut. The size chip is dashed until you choose.',
            '**Change your mind.** Pick another size. The frame changes shape; the image stays where you put it.',
          ],
        },
        shot('topbar-pins', 'The top bar with Square and Portrait pinned as chips beside the filename', 1600, 114,
          'Pinned sizes are chips in the top bar. Click one to use it; the × unpins it.'),
        {
          kind: 'details',
          summary: 'How matching works',
          text: 'Filler words are ignored ("crop my photo for…" works). Every preset carries the names people use for it and its pixels written every common way. Matching is by prefix, by abbreviation (`yt` → YouTube) and by typo distance. Ratios and dimensions are read as numbers. Popular presets rank first on a tie.',
        },
        {
          kind: 'details',
          summary: 'What is remembered',
          text: 'Only saved and pinned sizes, in this browser: {fact:persistence}. Images and crops are gone when you close the tab.',
        },
      ],
    },

    {
      id: 'framing',
      title: 'Framing',
      question: 'How do I move, zoom and position the crop in CropASAP?',
      answer:
        'Drag to move. Scroll to zoom. Arrow keys nudge by {fact:nudge}. Press 0 to fill the frame. A quality readout warns when the crop has fewer pixels than the output needs.',
      keywords: ['move crop', 'zoom', 'nudge', 'fill frame', 'quality readout'],
      blocks: [
        shot('framing', 'A portrait frame over a landscape picture at 121% zoom; the parts outside the frame are dimmed', 1380, 1766,
          'What is inside the frame is the file. Outside is dimmed, not gone — drag to bring it in.'),
        {
          kind: 'table',
          head: ['To', 'Do this'],
          rows: [
            ['Move the image', 'Drag it. Arrow keys nudge by {fact:nudge}.'],
            ['Zoom', 'Scroll, drag the slider, click − / +, or type a percentage.'],
            ['Fill the frame', 'Press `0` or double-click.'],
            ['See what is cut off', 'Hover outside the frame.'],
            ['Undo', 'Ctrl/⌘ Z. Each drag is one step. Ctrl/⌘ Shift Z redoes.'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: 'Quality readout: if the crop has fewer pixels than the output size, it tells you before you export. Zoom out to fix it.',
        },
      ],
      children: [
        {
          id: 'frame-views',
          title: 'Frame views',
          question: 'What do True size, Smaller and Enlarged mean in CropASAP?',
          answer:
            'Frame views only change how big the frame is drawn on screen. True size is one screen pixel per output pixel. Smaller fits it on screen. Enlarged makes a small output easier to work on. Press F to cycle. The export never changes.',
          keywords: ['true size', 'actual pixels', 'frame view'],
          blocks: [
            {
              kind: 'table',
              head: ['View', 'Use it when'],
              rows: [
                ['**True size**', 'You want to see exactly what the file will look like. One screen pixel per output pixel.'],
                ['**Smaller**', 'True size does not fit on screen.'],
                ['**Enlarged**', 'The output is small — a thumbnail or favicon.'],
              ],
            },
            shot('frame-views', 'The Freeform, Small and 1:1 buttons above the stage', 404, 112,
              'The view switch. 1:1 is true size; Small fits the frame on screen.'),
            { kind: 'p', text: 'Press `F` to cycle. Views that would look identical are hidden. Switching views never changes the export.' },
          ],
        },
        {
          id: 'freeform',
          title: 'Freeform',
          question: 'Can I crop without a fixed aspect ratio in CropASAP?',
          answer:
            'Yes. Turn on Freeform and drag any edge or corner. The crop rectangle becomes the output size. Turn Freeform off and your preset comes back.',
          keywords: ['freeform crop', 'free aspect ratio'],
          blocks: [
            shot('freeform', 'Freeform on: the frame has handles on every edge and corner and the chip reads Output 900 × 1600', 1380, 1766,
              'Freeform. Drag any handle; the chip shows the pixels you would get.'),
            {
              kind: 'list',
              items: [
                'Click **Freeform**. Drag any edge or corner of the frame.',
                'The chip shows the live pixel count. That is the output size at 1×.',
                'Click the chip to turn those pixels into a named size.',
                'Turn Freeform off to get your preset back.',
              ],
            },
            { kind: 'details', summary: 'Freeform and Batch', text: 'Freeform is for one image. Batch needs one shared size. Turning on Freeform leaves Batch; your queue is kept.' },
          ],
        },
      ],
    },

    {
      id: 'adjust',
      title: 'Adjust',
      question: 'What image adjustments does CropASAP have?',
      answer:
        'Adjust has {fact:adjustments}: Light, Tone, Color, Effects and Grain. Each image keeps its own settings.',
      keywords: ['exposure', 'contrast', 'saturation', 'film grain', 'halation', 'bloom', 'vignette'],
      blocks: [
        { kind: 'p', text: 'Click **Adjust** in the rail. Drag a slider. The preview updates live.' },
        shot('adjust', 'The Adjust panel in the rail with the Light group open: Highlights at +35 and Shadows at −20, the picture updated behind it', 1600, 1225,
          'Adjust. Groups open one at a time; a changed value shows beside its slider.'),
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
            'Click a value to reset that one control. **Reset all** clears everything.',
            'Settings are per image. Switching images does not carry them over.',
            'On a phone, Adjust is one row: pick a control, drag, back out.',
            'The export applies the same maths to every original pixel, so the file matches the preview.',
          ],
        },
      ],
    },

    {
      id: 'batch',
      title: 'Batch',
      question: 'How do I crop many images to the same size at once in CropASAP?',
      answer:
        'Drop several images. Pick one size. Check each crop, or accept them all. Export. You get one ZIP.',
      keywords: ['bulk crop', 'batch resize', 'crop multiple images', 'ZIP'],
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Add images', text: 'Drop a stack, or click Batch and choose files. Drop more to add to the queue.' },
            { title: 'Pick one size', text: 'Every image is fitted to it and centred.' },
            { title: 'Check each crop', text: 'Press Enter to keep a crop and move to the next. Drag first if it needs fixing.' },
            { title: 'Export', text: 'One ZIP with every image.' },
          ],
        },
        shot('batch-coach', 'Three images dropped: a card titled "3 images — one crop at a time" asks for the output size before anything else', 1600, 1225,
          'Drop a stack and Batch asks for the one size they will share.'),
        shot('batch', 'Batch with the first of three images framed square; a Finalize this crop button on the picture and a filmstrip of the queue below', 1600, 1225,
          'Frame each image, press Enter, and the next one comes up. Export writes the lot as one ZIP.'),
        {
          kind: 'table',
          head: ['Question', 'Answer'],
          rows: [
            ['Do I have to check every crop?', 'No. Unchecked crops export centred. **Frame the rest** accepts all remaining at once.'],
            ['How do I know what is left?', 'The Export panel counts unchecked crops.'],
            ['Can I change the size mid-batch?', 'Yes. Untouched crops re-centre. Crops you positioned keep their centre.'],
            ['What if I leave Batch?', 'The queue is kept. Outside Batch, Export writes only the active image.'],
            ['How do I move between images?', '`[` and `]`, or `J` and `K`, or click the filmstrip.'],
          ],
        },
        shot('batch-strip', 'The filmstrip: three thumbnails numbered 1 to 3, the first ticked, with "1 / 3 framed" and a Frame the rest button', 1396, 270,
          'The filmstrip counts what is framed. Frame the rest accepts everything left.'),
      ],
    },

    {
      id: 'convert',
      title: 'Convert',
      question: 'How do I convert an image to WebP, PNG or JPEG without cropping it?',
      answer:
        'Click Convert. Choose WebP, PNG or JPEG. Set quality, or type a file-size limit in KB. Click Convert. The pixels and dimensions are unchanged.',
      keywords: ['convert to webp', 'png to jpg', 'image converter', 'compress image', 'reduce file size'],
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Open Convert', text: 'Click **Convert** in the rail.' },
            { title: 'Choose a format', text: 'PNG, JPEG or WebP.' },
            { title: 'Set quality or a size limit', text: 'Drag the quality slider and watch the estimated size. Or type a number in **Fit under** to get the best quality under that many KB.' },
            { title: 'Convert', text: 'One file downloads. Several files download as one ZIP.' },
          ],
        },
        shot('convert-full', 'Convert: WebP selected, the quality slider on Auto and Fit under set to 200 KB', 1600, 1225,
          'Convert. Fit under 200 KB picks the best quality that lands under the limit.'),
        {
          kind: 'table',
          head: ['Fit under', 'What happens'],
          rows: [
            ['Set to `200`', 'CropASAP finds the highest JPEG or WebP quality that lands under 200 KB. Dimensions stay the same.'],
            ['Several files', 'The limit applies to each file, not the ZIP.'],
            ['Limit cannot be met', 'It shows the smallest result it found and does not download an oversized file. Clear the limit to use that quality manually.'],
            ['PNG', 'PNG is lossless. It has no quality setting and no size limit.'],
          ],
        },
        {
          kind: 'compare',
          before: { title: 'Export', text: 'Crops and resizes to a size.' },
          after: { title: 'Convert', text: 'Same pixels, different file.' },
        },
        { kind: 'details', summary: 'Format not available', text: 'If the browser cannot write a format, Convert says so. It never gives you a PNG with a different extension.' },
      ],
    },

    {
      id: 'export',
      title: 'Export',
      question: 'What formats and sizes can CropASAP export?',
      answer:
        'CropASAP exports {fact:formats} at {fact:scales} the chosen size. PNG and WebP keep transparency. JPEG does not, and the panel warns you first.',
      keywords: ['export', 'download', '2x', 'retina', 'transparency', 'PNG vs JPEG vs WebP'],
      blocks: [
        shot('export-panel', 'The Export panel: Output size 1280 × 640, Width and Height boxes with a lock between them, Scale 1× 2× 4×, Format PNG JPEG WebP, File options and the Export button', 692, 1766,
          'The Export panel. Everything about the file, top to bottom.'),
        {
          kind: 'table',
          head: ['Format', 'Use it for'],
          rows: [
            ['PNG', 'Logos, UI, screenshots, anything transparent. Lossless.'],
            ['JPEG', 'Photos where file size matters. No transparency.'],
            ['WebP', 'Web. Usually the smallest. Keeps transparency.'],
          ],
        },
        {
          kind: 'table',
          head: ['Option', 'What it does'],
          rows: [
            ['1× · 2× · 4×', 'Multiplies the output size for high-density screens. `1080×1080` at 2× writes `2160×2160`.'],
            ['Width · Height', 'Type the exact pixels you want; only that side changes. Press the lock between them and the other side follows, so the shape stays.'],
            ['Quality', 'JPEG and WebP only. Higher is larger.'],
            ['Quality readout', 'Warns if the crop has fewer pixels than the output needs.'],
          ],
        },
        { kind: 'p', text: 'On a phone, Export opens the share sheet so you can save straight to Photos. Several images share as separate images, not a ZIP.' },
        { kind: 'details', summary: 'Transparent images', text: 'Shown on a checkerboard. Drop a transparent image while JPEG is selected and the format switches to PNG. Choose JPEG anyway and you get a warning before the background turns white.' },
      ],
      children: [
        {
          id: 'naming',
          title: 'Filenames',
          question: 'How do I control the exported filenames in CropASAP?',
          answer:
            'Tick the boxes: keep the original name, add the size, number them. Or open Rename files and write a template with {name}, {w}, {h}, {label}, {n} and {date}. The result is previewed before you export.',
          keywords: ['filename template', 'rename', 'batch naming'],
          blocks: [
            {
              kind: 'table',
              head: ['Option', 'Result'],
              rows: [
                ['Keep original name', '`photo.jpg` → `photo.png`'],
                ['Add size to filename', '`photo.png` → `photo-1200x630.png`'],
                ['Number them', '`photo-1.png`, `photo-2.png`, …'],
              ],
            },
            { kind: 'p', text: 'Need something else? Open **Rename files** and write a template. Tokens:' },
            {
              kind: 'table',
              head: ['Token', 'Becomes'],
              rows: [
                ['`{name}`', 'Original filename without extension'],
                ['`{w}` · `{h}`', 'Output width and height in pixels'],
                ['`{label}`', 'Preset name, e.g. `instagram-story`'],
                ['`{n}`', 'Running number'],
                ['`{date}`', 'Today, as YYYY-MM-DD'],
              ],
            },
            { kind: 'p', text: 'Two files that would get the same name are numbered so nothing is overwritten in the ZIP.' },
            shot('naming', 'File options with Rename files open: the template {name}-{label}-{date} and the preview harbour-evening-GitHub-social-preview-2026…', 692, 1766,
              'Rename files. The preview above the box shows the name you will get.'),
          ],
        },
      ],
    },

    {
      id: 'keyboard',
      title: 'Keyboard',
      question: 'What are the keyboard shortcuts in CropASAP?',
      answer:
        'Arrows nudge. Shift nudges more. + and − zoom. 0 fills. F cycles frame views. Enter keeps a Batch crop. Brackets or J/K move through the queue. Ctrl/⌘ K opens the size picker. Ctrl/⌘ Z undoes. Esc closes.',
      keywords: ['shortcuts', 'hotkeys'],
      blocks: [
        {
          kind: 'keys',
          rows: [
            ['← ↑ → ↓', 'Nudge the image'],
            ['Shift + arrows', 'Nudge further'],
            ['+ / =  ·  −', 'Zoom in · out'],
            ['0', 'Fill the frame'],
            ['F', 'Cycle frame views'],
            ['Enter · Space', 'Keep this crop (Batch)'],
            ['[ · ]  ·  K · J', 'Previous · next image'],
            ['Ctrl/⌘ K', 'Open the size picker'],
            ['Ctrl/⌘ Z', 'Undo'],
            ['Ctrl/⌘ Shift Z', 'Redo'],
            ['Ctrl/⌘ V', 'Paste an image'],
            ['Esc', 'Close'],
          ],
        },
        { kind: 'p', text: 'Framing keys are off in Adjust and Convert, so an arrow key cannot move your crop by accident.' },
      ],
    },

    {
      id: 'account',
      title: 'Account',
      question: 'Do I need an account to use CropASAP?',
      answer:
        'No. An account is {fact:account}. It keeps your saved and pinned sizes on every device you sign in on. It is the same login as other Strange Systems apps.',
      keywords: ['account', 'sign in', 'sync sizes', 'mailing list'],
      blocks: [
        {
          kind: 'table',
          head: ['To', 'Do this'],
          rows: [
            ['Create one', 'Click **Sign in** in the top bar, then **Create a free account**. Confirm the email it sends you.'],
            ['Sign in', 'Click **Sign in**. Your sizes arrive with you.'],
            ['Reset a password', 'Click **Forgot password?** and follow the emailed link.'],
            ['Join the mailing list', 'Tick the box when you create the account, or later from **Your account**. It is unticked by default.'],
            ['Leave the mailing list', 'Untick the box in **Your account**, or use the link in any email.'],
            ['Sign out', 'Click your name, then **Sign out**.'],
          ],
        },
        { kind: 'p', text: 'The mailing list and the account are separate. Creating an account never subscribes you to anything.' },
        {
          kind: 'gallery',
          columns: 2,
          label: 'The sign-in and create-account forms',
          images: [
            { src: '/docs/shots/account-signin.webp', alt: 'The Sign in form: email, password, Forgot password? and Create a free account', width: 896, height: 826, caption: 'Sign in.' },
            { src: '/docs/shots/account-create.webp', alt: 'The Create a free account form with the mailing-list box unticked', width: 896, height: 966, caption: 'Create a free account. The mailing-list box starts unticked.' },
          ],
        },
      ],
    },

    {
      id: 'privacy',
      title: 'Privacy',
      question: 'Does CropASAP upload my images?',
      answer:
        'No. Images are {fact:upload}. There is no server processing and no analytics. The page makes {fact:dependencies}, and an account only ever sends your email, password and saved sizes.',
      keywords: ['privacy', 'no upload', 'local processing'],
      blocks: [
        {
          kind: 'facts',
          title: 'What is stored, and where',
          rows: [
            ['Images, crops, adjustments', 'This tab only. Closing or reloading clears them. Export first.'],
            ['Saved and pinned sizes', 'This browser\'s local storage. With an account, also your account.'],
            ['On a server', 'Nothing, unless you sign in. Then: your email, password hash, saved sizes and whether you ticked the mailing-list box. Never an image.'],
          ],
        },
        { kind: 'p', text: 'To check: open the browser\'s network panel. After the page loads, nothing else is requested until you click Sign in.' },
      ],
    },

    {
      id: 'technology',
      title: 'How it is built',
      question: 'How does CropASAP work under the hood?',
      answer:
        'CropASAP is TypeScript running in the browser with no library behind the image work: a gamma-correct Lanczos resampler, a WebGL preview of the adjustment pipeline, and its own PNG and ZIP encoders.',
      keywords: ['architecture', 'WebGL', 'Lanczos', 'linear light', 'client-side image processing'],
      blocks: [
        {
          kind: 'facts',
          title: 'The stack',
          rows: [
            ['Language', 'TypeScript, one ES module, no framework'],
            ['Resampling', 'Own Lanczos-3 in linear light'],
            ['Adjustments', 'Own WebGL 2 preview, JavaScript export'],
            ['PNG', 'Own writer, raced against the browser\'s'],
            ['ZIP', 'Own writer'],
            ['Runtime dependencies', 'None for cropping. The account service loads only after Sign in.'],
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
            'CropASAP downscales with {fact:resampler}. Pixels are converted from sRGB values to linear light before averaging, so bright detail keeps its brightness and fine texture is filtered instead of aliased.',
          keywords: ['Lanczos', 'gamma-correct resize', 'linear light', 'sRGB'],
          blocks: [
            { kind: 'p', text: 'A pixel value is a code for light, not an amount of it. Averaging the codes — what canvas `drawImage` does — gets the wrong answer: mid-grey between black and white comes out at 128 instead of 188. Thin bright lines and fine textures darken as they shrink.' },
            { kind: 'p', text: 'CropASAP decodes to light, resamples there, and re-encodes. The Lanczos-3 filter widens with the reduction, which removes detail that cannot survive the shrink instead of aliasing it.' },
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
            'The adjustment pipeline exists twice from one set of parameters: a WebGL fragment shader for the live preview and a per-pixel JavaScript loop for the export. The preview never writes a file.',
          keywords: ['WebGL', 'fragment shader', 'real-time preview'],
          blocks: [
            {
              kind: 'list',
              items: [
                'Bloom and halation are a real bright-pass and blur at a quarter of the preview size.',
                'Grain is a hashed noise field mirrored exactly between shader and CPU. Export matches preview grain for grain.',
                'Without WebGL the same pipeline runs on the CPU: reduced while you drag, full quality when you stop.',
              ],
            },
            { kind: 'callout', text: 'A missing GPU feature can cost a smooth slider. It never costs the picture: every export runs through the CPU pipeline at full resolution.' },
          ],
        },
        {
          id: 'png-encoder',
          title: 'PNG encoder',
          question: 'Why are CropASAP\'s PNG files smaller than the browser\'s?',
          answer:
            'Every PNG is encoded twice — by the browser and by CropASAP\'s own writer, which picks the cheapest colour type and filter for the image — and the smaller file is kept. The pixels are identical.',
          keywords: ['PNG optimisation', 'palette PNG', 'smaller PNG'],
          blocks: [
            { kind: 'p', text: 'The browser always writes 32 bits per pixel. A screenshot has a few colours; a photo has no alpha. CropASAP\'s writer uses the cheaper encoding when it applies. Deflate comes from the platform\'s `CompressionStream`, so this stays dependency-free.' },
          ],
        },
        {
          id: 'no-dependencies',
          title: 'No dependencies',
          question: 'What does CropASAP depend on?',
          answer:
            'For cropping, nothing. CropASAP makes {fact:dependencies}. Fonts are bundled, encoders are in-house, and the documentation is rendered from typed data. The optional account talks to Supabase, and that code is only downloaded when you click Sign in.',
          keywords: ['no dependencies', 'vanilla TypeScript', 'privacy by architecture'],
          blocks: [
            { kind: 'p', text: 'Every third-party script is another party with access to the page. Zero is the only number that makes the privacy claim checkable, so the account client is kept out of the page until you ask for it.' },
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
            ['That person', 'Spencer Nunamaker — UI/UX designer, musician, artist'],
            ['Also made', 'No Ceremony, a day organiser · Tip Top Brushes, for Procreate'],
          ],
        },
        { kind: 'p', text: 'CropASAP is {fact:price} to use.' },
      ],
    },
  ],
});

export default docsContent;

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
      ],
    },

    {
      id: 'sizes',
      title: 'Output sizes',
      question: 'How do I find the right image size for a platform in CropASAP?',
      answer:
        'Click the size chip and type the destination — `ig story`, `youtube thumbnail`, `1200 by 630`, `4:5`. ' +
        'CropASAP matches it against {fact:presets}. Typos and abbreviations work. ' +
        'Pin a size you typed and it is saved for next time.',
      keywords: ['image sizes', 'social media sizes', 'presets', 'aspect ratio', 'og image size', 'instagram story size'],
      blocks: [
        {
          kind: 'p',
          text: 'Open the size picker: click the size chip in the top bar, or press Ctrl/⌘ K. Type. Pick a result.',
        },
        {
          kind: 'table',
          head: ['Type', 'You get'],
          rows: [
            ['`ig story` · `fb cover` · `yt thumb` · `og image`', 'That preset. Any common name works.'],
            ['`1200 x 630` · `1080×1350` · `800 by 600`', 'Those exact pixels, plus any preset that matches.'],
            ['`16:9` · `4:5` · `square` · `portrait`', 'Every size with that shape.'],
            ['`a4` · `letter` · `business card`', 'Print sizes at print resolution.'],
            ['`instagrm stroy`', 'Instagram story. Typos are fine.'],
          ],
        },
        {
          kind: 'list',
          items: [
            '**Keep a size.** Type the pixels, click the pin, give it a name. It is saved, searchable, and sits in the top bar.',
            '**Pin a preset.** Click the pin on any result. It sits in the top bar for one-click use.',
            '**Before you pick.** A new image is framed at its own pixels with nothing cut. The size chip is dashed until you choose.',
            '**Change your mind.** Pick another size. The frame changes shape; the image stays where you put it.',
          ],
        },
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
            ['Max width · Max height', 'Type a pixel limit. The other side follows, so the shape never changes.'],
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

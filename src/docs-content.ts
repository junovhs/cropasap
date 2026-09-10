import { defineDocs } from 'dopedocs';

export const docsContent = defineDocs({
  "entity": {
    "name": "CropWizard",
    "url": window.location.origin,
    "notToBeConfusedWith": []
  },
  "identity": {
    "name": "CropWizard",
    "version": "1.0.0",
    "maker": {
      "name": "Strange Systems"
    }
  },
  "title": "CropWizard, from first drop to final ZIP",
  "lead": "Local image tools, without the detour.",
  "facts": {},
  "sections": [
    {
      "id": "overview",
      "title": "One workspace, four different jobs",
      "question": "How does CropWizard handle one workspace, four different jobs?",
      "answer": "You do not have to build a project or import into a library first. Load an image, choose the job, and work directly on the result. The same loaded images can move between rooms without being thrown away.",
      "blocks": [
        {
          "kind": "p",
          "text": "The mental model"
        },
        {
          "kind": "p",
          "text": "One workspace, four different jobs"
        },
        {
          "kind": "p",
          "text": "You do not have to build a project or import into a library first. Load an image, choose the job, and work directly on the result. The same loaded images can move between rooms without being thrown away."
        },
        {
          "kind": "p",
          "text": "01"
        },
        {
          "kind": "p",
          "text": "Crop & Resize"
        },
        {
          "kind": "p",
          "text": "Choose the destination size, then position the image beneath a fixed output frame. This is the precise, output-first path."
        },
        {
          "kind": "p",
          "text": "02"
        },
        {
          "kind": "p",
          "text": "Adjust"
        },
        {
          "kind": "p",
          "text": "Change exposure, contrast, and saturation for the active image without changing the crop you already composed."
        },
        {
          "kind": "p",
          "text": "03"
        },
        {
          "kind": "p",
          "text": "Convert"
        },
        {
          "kind": "p",
          "text": "Re-encode the loaded file or files as WebP, PNG, or JPEG while leaving their pixel dimensions and composition alone."
        },
        {
          "kind": "p",
          "text": "04"
        },
        {
          "kind": "p",
          "text": "Batch"
        },
        {
          "kind": "p",
          "text": "Give a stack one shared output size, review each suggested crop, keep the ones that matter, then download the set as a ZIP."
        },
        {
          "kind": "p",
          "text": "The frame is the contract. In Crop and Batch, the output dimensions define the frame first. You move and zoom the image underneath it, so the thing you are looking at is the thing that will be written."
        }
      ]
    },
    {
      "id": "start",
      "title": "Quick start",
      "question": "How does CropWizard handle quick start?",
      "answer": "1 Load it. Drop an image anywhere, paste an image from the clipboard, or choose a file.",
      "blocks": [
        {
          "kind": "p",
          "text": "Start here"
        },
        {
          "kind": "p",
          "text": "Quick start"
        },
        {
          "kind": "p",
          "text": "One image"
        },
        {
          "kind": "p",
          "text": "Drop, frame, export"
        },
        {
          "kind": "p",
          "text": "1"
        },
        {
          "kind": "p",
          "text": "Load it. Drop an image anywhere, paste an image from the clipboard, or choose a file."
        },
        {
          "kind": "p",
          "text": "2"
        },
        {
          "kind": "p",
          "text": "Name the destination. Pick a preset, search exact pixels, or use the image's own dimensions."
        },
        {
          "kind": "p",
          "text": "3"
        },
        {
          "kind": "p",
          "text": "Compose the crop. Drag to move, scroll or use the zoom controls, and watch the quality readout."
        },
        {
          "kind": "p",
          "text": "4"
        },
        {
          "kind": "p",
          "text": "Export. Pick a format, scale, and filename pattern, then download the image."
        },
        {
          "kind": "p",
          "text": "A stack"
        },
        {
          "kind": "p",
          "text": "Drop once, Batch takes over"
        },
        {
          "kind": "p",
          "text": "1"
        },
        {
          "kind": "p",
          "text": "Load several images together. A multi-image drop automatically opens the Batch flow."
        },
        {
          "kind": "p",
          "text": "2"
        },
        {
          "kind": "p",
          "text": "Choose one shared output size. Cropwizard prepares the queue and fits every image to that shape."
        },
        {
          "kind": "p",
          "text": "3"
        },
        {
          "kind": "p",
          "text": "Keep or tweak each crop. Finalizing advances to the next image automatically."
        },
        {
          "kind": "p",
          "text": "4"
        },
        {
          "kind": "p",
          "text": "Export the lot. Multiple outputs download together as one ZIP."
        },
        {
          "kind": "p",
          "text": "Also useful"
        },
        {
          "kind": "p",
          "text": "Clicking Batch directly starts a deliberate batch flow: choose the images first, then choose the size they should all share. While already in Batch, loading more images appends them to the existing queue instead of replacing it."
        }
      ]
    },
    {
      "id": "frame",
      "title": "Crop & resize",
      "question": "How does CropWizard handle crop & resize?",
      "answer": "The output frame stays fixed while the image moves underneath it. That makes the destination explicit: if the target is 1200 × 630, the frame is 1200 × 630 in output terms no matter how large it is drawn on screen.",
      "blocks": [
        {
          "kind": "p",
          "text": "Precise framing"
        },
        {
          "kind": "p",
          "text": "Crop & resize"
        },
        {
          "kind": "p",
          "text": "The output frame stays fixed while the image moves underneath it. That makes the destination explicit: if the target is 1200 × 630, the frame is 1200 × 630 in output terms no matter how large it is drawn on screen."
        },
        {
          "kind": "p",
          "text": "Move"
        },
        {
          "kind": "p",
          "text": "Drag the image to reposition it. Arrow keys nudge the image for fine alignment, and holding Shift makes a larger nudge."
        },
        {
          "kind": "p",
          "text": "Zoom"
        },
        {
          "kind": "p",
          "text": "Scroll over the stage, use the − / + buttons, drag the zoom slider, or type a percentage when you know the exact scale you want."
        },
        {
          "kind": "p",
          "text": "Fill"
        },
        {
          "kind": "p",
          "text": "Press 0 to fill the frame again. This is a fast way back to a clean edge-to-edge starting point after experimenting."
        },
        {
          "kind": "p",
          "text": "Quality"
        },
        {
          "kind": "p",
          "text": "The quality chip reacts to the crop and requested export scale. If you ask for more pixels than the crop contains, Cropwizard warns that the result will soften."
        },
        {
          "kind": "p",
          "text": "The three frame views do not change the crop"
        },
        {
          "kind": "p",
          "text": "True size Shows the output at one screen pixel per output pixel when it fits."
        },
        {
          "kind": "p",
          "text": "Smaller Steps back when the true-size frame would be too large for useful composition."
        },
        {
          "kind": "p",
          "text": "Enlarged for editing Uses more of the stage when a small output would otherwise be fiddly to work on."
        },
        {
          "kind": "p",
          "text": "These are viewing choices only. Switching between them does not resize the export or alter your image zoom."
        },
        {
          "kind": "p",
          "text": "Freeform"
        },
        {
          "kind": "p",
          "text": "Use Freeform when the crop itself should decide the output dimensions. The aspect ratio unlocks, the crop rectangle becomes the size, and the previous preset is suspended rather than forgotten. Turn Freeform off—or pick a named size—to return to a fixed output shape."
        },
        {
          "kind": "p",
          "text": "Freeform is intentionally single-image. A batch is built around one shared output contract, so entering Freeform leaves the Batch room while keeping the loaded queue available to return to later."
        }
      ]
    },
    {
      "id": "adjust",
      "title": "Adjust",
      "question": "How does CropWizard handle adjust?",
      "answer": "Adjust lives in the left sidebar beneath the main controls, so the crop stays visible while you tune the active image. On a phone, Adjust opens a touch-sized drawer above the bottom bar.",
      "blocks": [
        {
          "kind": "p",
          "text": "Appearance"
        },
        {
          "kind": "p",
          "text": "Adjust"
        },
        {
          "kind": "p",
          "text": "Adjust lives in the left sidebar beneath the main controls, so the crop stays visible while you tune the active image. On a phone, Adjust opens a touch-sized drawer above the bottom bar."
        },
        {
          "kind": "p",
          "text": "Exposure"
        },
        {
          "kind": "p",
          "text": "Brighten or darken the active image."
        },
        {
          "kind": "p",
          "text": "Contrast"
        },
        {
          "kind": "p",
          "text": "Increase or reduce separation between tones."
        },
        {
          "kind": "p",
          "text": "Saturation"
        },
        {
          "kind": "p",
          "text": "Push color intensity up or pull it back."
        },
        {
          "kind": "p",
          "text": "Five collapsible groups cover Light, Tone, Color, Effects, and Grain. Each loaded image keeps its own values, so moving to another image never carries corrections with it. Tap a value to reset one control, or use Reset all to return the complete look to neutral."
        },
        {
          "kind": "p",
          "text": "Undo and redo cover workspace edits, so you can experiment with framing and adjustments without having to remember every previous value."
        }
      ]
    },
    {
      "id": "convert",
      "title": "Convert without recropping",
      "question": "How does CropWizard handle convert without recropping?",
      "answer": "Convert is for the times when the image is already the right shape and size and you only need a different file format. It re-encodes the original pixels instead of applying the Crop room's output frame.",
      "blocks": [
        {
          "kind": "p",
          "text": "Format only"
        },
        {
          "kind": "p",
          "text": "Convert without recropping"
        },
        {
          "kind": "p",
          "text": "Convert is for the times when the image is already the right shape and size and you only need a different file format. It re-encodes the original pixels instead of applying the Crop room's output frame."
        },
        {
          "kind": "p",
          "text": "Use Export when… you want the Cropwizard composition, destination dimensions, scale multiplier, and filename controls."
        },
        {
          "kind": "p",
          "text": "Use Convert when… you want WebP, PNG, or JPEG but want the loaded image dimensions and composition left alone."
        },
        {
          "kind": "p",
          "text": "For JPEG and WebP, the quality slider updates an estimated result size after you pause. If several images are loaded, the estimate is based on the first image and the conversion downloads as one ZIP. Cropwizard reports when the converted sample gets bigger as well as when it gets smaller."
        }
      ]
    },
    {
      "id": "batch",
      "title": "Batch is a room, not a switch",
      "question": "How does CropWizard handle batch is a room, not a switch?",
      "answer": "Batch is designed around a rhythm: shared size → frame → keep → next . The queue stays visible, each image keeps its own framing and adjustments, and the app always shows how much of the stack is actually reviewed.",
      "blocks": [
        {
          "kind": "p",
          "text": "The queue workflow"
        },
        {
          "kind": "p",
          "text": "Batch is a room, not a switch"
        },
        {
          "kind": "p",
          "text": "Batch is designed around a rhythm: shared size → frame → keep → next . The queue stays visible, each image keeps its own framing and adjustments, and the app always shows how much of the stack is actually reviewed."
        },
        {
          "kind": "p",
          "text": "1 Choose a stack Drop several images, or enter Batch and choose them."
        },
        {
          "kind": "p",
          "text": "2 Set one output size Every queued image is fitted to the same destination shape."
        },
        {
          "kind": "p",
          "text": "3 Review the suggestion Move or zoom only when the automatic crop needs help."
        },
        {
          "kind": "p",
          "text": "4 Finalize Keep the crop and jump to the next image that still needs review."
        },
        {
          "kind": "p",
          "text": "5 Export the queue All batch outputs download together as a ZIP."
        },
        {
          "kind": "p",
          "text": "What the filmstrip is telling you"
        },
        {
          "kind": "p",
          "text": "Progress"
        },
        {
          "kind": "p",
          "text": "The counter shows how many images have been framed out of the total queue."
        },
        {
          "kind": "p",
          "text": "Active image"
        },
        {
          "kind": "p",
          "text": "Click any thumbnail to jump straight to it. You are never locked into a one-way wizard."
        },
        {
          "kind": "p",
          "text": "Framed state"
        },
        {
          "kind": "p",
          "text": "Finalized images are marked as reviewed. Unfinalized images continue to use Cropwizard's current suggested crop."
        },
        {
          "kind": "p",
          "text": "Add more"
        },
        {
          "kind": "p",
          "text": "Load additional images while Batch is active and they join the existing queue instead of replacing it."
        },
        {
          "kind": "p",
          "text": "Finalize only the images that need judgment"
        },
        {
          "kind": "p",
          "text": "Finalize this crop (or Enter / Space ) keeps the active crop and moves to the next unframed image. Use the filmstrip, [ / ] , or J / K whenever you want to move around manually."
        },
        {
          "kind": "p",
          "text": "If the remaining automatic crops already look right, choose Frame the rest . Cropwizard accepts every unframed suggestion in one action and makes the queue ready to export."
        },
        {
          "kind": "p",
          "text": "You do not have to finalize everything"
        },
        {
          "kind": "p",
          "text": "Batch export is still available while some images are unframed. Those files use the current suggested crop, and the Export panel tells you exactly how many are still relying on suggestions before you download."
        },
        {
          "kind": "p",
          "text": "Changing the shared size"
        },
        {
          "kind": "p",
          "text": "The output size remains live for the whole queue. Pick a different destination and every queued crop is adapted to the new shape. Automatic crops are suggested again for that target; crops you already positioned keep their decision and are refit around it rather than simply discarded."
        },
        {
          "kind": "p",
          "text": "Leaving Batch does not delete the queue"
        },
        {
          "kind": "p",
          "text": "Move to Crop, Adjust, or Convert and the loaded images remain available. Returning to Batch brings the queue back. Outside the Batch room, regular Export writes the active image rather than silently exporting the hidden stack; Batch is the explicit place where multi-image crop export happens."
        },
        {
          "kind": "p",
          "text": "Why the size comes first: one shared destination is what makes the queue coherent. Freeform therefore belongs to single-image Crop, while Batch keeps every image on the same output contract."
        }
      ]
    },
    {
      "id": "size",
      "title": "Output sizes",
      "question": "How does CropWizard handle output sizes?",
      "answer": "The size picker accepts the way people actually remember destinations: by platform name, pixel dimensions, or shape. Search for something like instagram story , 1200 × 630 , or 16:9 .",
      "blocks": [
        {
          "kind": "p",
          "text": "Destination first"
        },
        {
          "kind": "p",
          "text": "Output sizes"
        },
        {
          "kind": "p",
          "text": "The size picker accepts the way people actually remember destinations: by platform name, pixel dimensions, or shape. Search for something like instagram story , 1200 × 630 , or 16:9 ."
        },
        {
          "kind": "p",
          "text": "Presets"
        },
        {
          "kind": "p",
          "text": "Choose a named destination and Cropwizard locks the frame to its aspect ratio and pixel dimensions."
        },
        {
          "kind": "p",
          "text": "Exact pixels"
        },
        {
          "kind": "p",
          "text": "Type dimensions directly when the destination is custom or comes from another system."
        },
        {
          "kind": "p",
          "text": "From this image"
        },
        {
          "kind": "p",
          "text": "Match the loaded image's own pixel size when you want the whole source dimensions as the output."
        },
        {
          "kind": "p",
          "text": "Pinned sizes"
        },
        {
          "kind": "p",
          "text": "Keep recurring targets close to the current file so the destinations you use most are one click away."
        },
        {
          "kind": "p",
          "text": "1×, 2×, and 4× are export multipliers"
        },
        {
          "kind": "p",
          "text": "The Quick export choices increase the written dimensions without changing the composition. A 1080 × 1080 target becomes 2160 × 2160 at 2× and 4320 × 4320 at 4×. The scale note and quality indicator warn when the active crop does not contain enough source pixels for the requested result."
        }
      ]
    },
    {
      "id": "export",
      "title": "Export & naming",
      "question": "How does CropWizard handle export & naming?",
      "answer": "Lossless output and transparency support. Good for graphics, UI, and images that need clean edges.",
      "blocks": [
        {
          "kind": "p",
          "text": "Files on disk"
        },
        {
          "kind": "p",
          "text": "Export & naming"
        },
        {
          "kind": "p",
          "text": "PNG"
        },
        {
          "kind": "p",
          "text": "Lossless output and transparency support. Good for graphics, UI, and images that need clean edges."
        },
        {
          "kind": "p",
          "text": "JPEG"
        },
        {
          "kind": "p",
          "text": "Widely compatible lossy output for photographs. The quality control appears when selected."
        },
        {
          "kind": "p",
          "text": "WebP"
        },
        {
          "kind": "p",
          "text": "Modern lossy output that can produce smaller files. The quality control appears when selected."
        },
        {
          "kind": "p",
          "text": "Single-image exports download as a normal image file. A Batch export downloads as one ZIP so the browser does not have to prompt you for every file separately."
        },
        {
          "kind": "p",
          "text": "Filename controls"
        },
        {
          "kind": "p",
          "text": "The simple checkboxes can keep the original name, append the output size, and add numbering. The live preview shows the result before anything is written."
        },
        {
          "kind": "p",
          "text": "Open Rename files when you need a custom template. Available tokens are:"
        },
        {
          "kind": "p",
          "text": "{name} {n} {w} {h} {label} {date}"
        },
        {
          "kind": "p",
          "text": "Example {name}-{w}x{h}"
        },
        {
          "kind": "p",
          "text": "turns a file such as portrait.jpg into a name based on the original filename and the dimensions being exported."
        }
      ]
    },
    {
      "id": "shortcuts",
      "title": "Keyboard shortcuts",
      "question": "How does CropWizard handle keyboard shortcuts?",
      "answer": "Nudge the image beneath the frame.",
      "blocks": [
        {
          "kind": "p",
          "text": "Work faster"
        },
        {
          "kind": "p",
          "text": "Keyboard shortcuts"
        },
        {
          "kind": "p",
          "text": "Arrow keys"
        },
        {
          "kind": "p",
          "text": "Nudge the image beneath the frame."
        },
        {
          "kind": "p",
          "text": "Shift + Arrow keys"
        },
        {
          "kind": "p",
          "text": "Nudge by a larger step."
        },
        {
          "kind": "p",
          "text": "+ / = / −"
        },
        {
          "kind": "p",
          "text": "Zoom in or out."
        },
        {
          "kind": "p",
          "text": "0"
        },
        {
          "kind": "p",
          "text": "Fill the frame."
        },
        {
          "kind": "p",
          "text": "F"
        },
        {
          "kind": "p",
          "text": "Cycle the available frame views."
        },
        {
          "kind": "p",
          "text": "Enter or Space"
        },
        {
          "kind": "p",
          "text": "Finalize the active crop in Batch."
        },
        {
          "kind": "p",
          "text": "[ / ]"
        },
        {
          "kind": "p",
          "text": "Move backward or forward through the Batch queue."
        },
        {
          "kind": "p",
          "text": "K / J"
        },
        {
          "kind": "p",
          "text": "Alternative previous / next Batch navigation."
        },
        {
          "kind": "p",
          "text": "Ctrl/⌘ Z"
        },
        {
          "kind": "p",
          "text": "Undo the last workspace change."
        },
        {
          "kind": "p",
          "text": "Ctrl/⌘ Shift Z"
        },
        {
          "kind": "p",
          "text": "Redo."
        },
        {
          "kind": "p",
          "text": "Esc"
        },
        {
          "kind": "p",
          "text": "Close Documentation or the active picker when that surface owns focus."
        },
        {
          "kind": "p",
          "text": "Framing shortcuts are disabled while you are in Adjust or Convert, so an arrow key cannot accidentally change a crop while you are working on a different job."
        }
      ]
    },
    {
      "id": "privacy",
      "title": "Privacy & what persists",
      "question": "How does CropWizard handle privacy & what persists?",
      "answer": "Your image files stay in this browser tab. Cropwizard has no image upload step, account requirement, analytics request, or server-side image processor. Loading, editing, conversion, and export happen on your device.",
      "blocks": [
        {
          "kind": "p",
          "text": "Local by design"
        },
        {
          "kind": "p",
          "text": "Privacy & what persists"
        },
        {
          "kind": "p",
          "text": "Your image files stay in this browser tab. Cropwizard has no image upload step, account requirement, analytics request, or server-side image processor. Loading, editing, conversion, and export happen on your device."
        },
        {
          "kind": "p",
          "text": "Your current image work"
        },
        {
          "kind": "p",
          "text": "The loaded image data and active queue belong to the current page session. Reloading or closing the tab clears that workspace, so export anything you want to keep first."
        },
        {
          "kind": "p",
          "text": "Your reusable size choices"
        },
        {
          "kind": "p",
          "text": "Pinned and saved size preferences can live locally in the browser so recurring output targets can be available again without uploading image data."
        },
        {
          "kind": "p",
          "text": "Documentation is part of the app view. Opening these docs does not reload the workspace. Close them and your crop, queue, and current controls are still where you left them."
        }
      ]
    }
  ]
});

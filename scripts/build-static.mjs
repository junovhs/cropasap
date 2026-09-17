// Copies the non-TypeScript assets into dist/, bundles the app, and renders
// the documentation to static pages. Node-only so it behaves the same on
// Windows (npm runs scripts through cmd.exe) as it does on a shell.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { build } from 'esbuild';
import { buildStatic, InvalidDocumentError } from 'dopedocs';
import { writeIcon } from './raster-icon.mjs';

/**
 * Which build this is, stamped into the page.
 *
 * Not vanity: a deploy takes a minute to reach a phone, and a page that looks
 * identical to the last one is indistinguishable from a change that did not
 * work. Three separate bug reports have turned out to be a browser holding the
 * previous build. Now the page says which one it is, and the question is
 * answerable in a glance instead of by disproving it.
 */
function buildId() {
  // Vercel hands the commit to the build; a local build asks git itself.
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

mkdirSync('dist/src', { recursive: true });

const page = readFileSync('index.html', 'utf8')
  .replaceAll('{{build}}', buildId());
writeFileSync('dist/index.html', page);

cpSync('src/styles.css', 'dist/src/styles.css');
cpSync('src/favicon.svg', 'dist/src/favicon.svg');

// The tab icon is the SVG above; these are for the places that will not take
// one — a 32px square for browsers with no SVG-favicon support, and the 180px
// square iOS puts on a home screen, which never uses the SVG.
writeIcon('dist/favicon.png', 32);
writeIcon('dist/src/apple-touch-icon.png', 180);
// Vendored typefaces (DEC-01: no third-party requests at runtime). The licence
// travels with them, so the whole directory is copied rather than the woff2s.
cpSync('src/fonts', 'dist/src/fonts', { recursive: true });

// Bundle the browser entry so the dopedocs package import resolves in production.
// Splitting keeps the account service (supabase-js) in a chunk that a guest
// never fetches. The optional SUPABASE_* variables let a deployment point at a
// different project than the shared one in src/supabase.ts.
await build({
  entryPoints: ['src/main.ts'],
  outdir: 'dist/src',
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  chunkNames: 'chunks/[name]-[hash]',
  define: {
    __SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL ?? ''),
    __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY ?? ''),
  },
});

// ---- documentation ---------------------------------------------------------
// The same content module renders the in-app panel and a real page per section
// at /docs/<id>/, plus the entity graph, sitemap, robots and llms.txt — so a
// crawler and a reader find the same document at the same address.
mkdirSync('dist/docs', { recursive: true });
cpSync('node_modules/dopedocs/styles/dopedocs.css', 'dist/docs/dopedocs.css');
cpSync('src/docs-theme.css', 'dist/docs/docs-theme.css');
cpSync('src/docs-narrow.css', 'dist/docs/docs-narrow.css');
// The manual's screen grabs, taken from the built app and checked in as WebP.
cpSync('src/docs-shots', 'dist/docs/shots', { recursive: true });

// The content module is TypeScript that imports a package; bundle it for Node
// once, import it, and throw the bundle away.
const contentBundle = 'dist/.docs-content.mjs';
await build({ entryPoints: ['src/docs-content.ts'], outfile: contentBundle, bundle: true, format: 'esm', platform: 'node', target: 'node20' });
const { docsContent } = await import(pathToFileURL(join(process.cwd(), contentBundle)).href);
rmSync(contentBundle);

// Where this build is served. Vercel sets the production host on every build;
// a local build falls back to the document's own address.
const deployedHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const siteUrl = deployedHost ? `https://${deployedHost}` : docsContent.entity.url;

let tree;
try {
  tree = buildStatic(
    { ...docsContent, entity: { ...docsContent.entity, url: siteUrl } },
    { entityType: 'SoftwareApplication', stylesheet: ['/docs/dopedocs.css', '/docs/docs-theme.css', '/docs/docs-narrow.css'] },
  );
} catch (error) {
  if (error instanceof InvalidDocumentError) throw new Error(`[dopedocs] ${error.message}`);
  throw error;
}
for (const [path, contents] of Object.entries(tree)) {
  const out = join('dist', path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, contents);
}
console.log(`docs: ${Object.keys(tree).length} files`);

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Clean dist folder before build (keep only extension.js)
function cleanDist() {
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    for (const file of files) {
      if (file !== 'extension.js') {
        const filePath = path.join(distDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        console.log('Cleaned:', file);
      }
    }
  }
}

async function main() {
  // Clean old TypeScript output files
  cleanDist();
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'], // vscode is provided by VS Code runtime
    logLevel: 'info',
    plugins: [
      {
        name: 'node-fetch-polyfill',
        setup(build) {
          // Handle node-fetch - bundle it inline
          build.onResolve({ filter: /^node-fetch$/ }, args => {
            return { path: require.resolve('node-fetch'), external: false };
          });
        }
      }
    ],
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete!');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');

function copyCssFiles() {
    const views = ['sidebar', 'search'];
    for (const view of views) {
        const srcDir = path.join(__dirname, 'src', 'webviews', view);
        const outDir = path.join(__dirname, 'out', 'webviews', view);
        if (!fs.existsSync(srcDir)) {
            continue;
        }
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.css'));
        for (const file of files) {
            fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
        }
    }
}

function copyMigrations() {
    const srcDir = path.join(__dirname, 'src', 'db', 'migrations');
    const outDir = path.join(__dirname, 'out', 'migrations');
    if (!fs.existsSync(srcDir)) {
        return;
    }
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.sql'));
    for (const file of files) {
        fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
    }
}

/** @type {import('esbuild').BuildOptions} */
const options = {
    entryPoints: [
        path.join(__dirname, 'src', 'extension.ts'),
        path.join(__dirname, 'src', 'webviews', 'sidebar', 'sidebar.ts'),
        path.join(__dirname, 'src', 'webviews', 'search', 'search.ts'),
    ],
    bundle: true,
    outdir: path.join(__dirname, 'out'),
    external: ['vscode', 'sql.js'],
    format: 'cjs',
    platform: 'node',
    target: 'es2022',
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
};

async function run() {
    if (production) {
        await esbuild.build(options);
    } else {
        const ctx = await esbuild.context(options);
        await ctx.watch();
    }
    copyCssFiles();
    copyMigrations();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});

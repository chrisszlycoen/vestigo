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
const common = {
    bundle: true,
    outdir: path.join(__dirname, 'out'),
    outbase: path.join(__dirname, 'src'),
    target: 'es2022',
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
};

const builds = [
    {
        ...common,
        entryPoints: ['src/extension.ts', 'src/agent/server.ts'],
        external: ['vscode', 'sql.js'],
        format: 'cjs',
        platform: 'node',
    },
    {
        ...common,
        entryPoints: ['src/webviews/sidebar/sidebar.ts', 'src/webviews/search/search.ts'],
        format: 'iife',
        platform: 'browser',
    },
];

async function run() {
    if (production) {
        await Promise.all(builds.map((options) => esbuild.build(options)));
    } else {
        const contexts = await Promise.all(builds.map((options) => esbuild.context(options)));
        await Promise.all(contexts.map((ctx) => ctx.watch()));
    }
    copyCssFiles();
    copyMigrations();
    if (!production) {
        fs.watch(path.join(__dirname, 'src', 'webviews', 'sidebar'), (_event, file) => {
            if (file?.endsWith('.css')) { copyCssFiles(); }
        });
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});

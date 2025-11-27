/**
 * Font Setup Script for PDF Generation
 * Downloads Noto Sans JP font and places it in public/fonts directory
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Font URLs from Google Fonts
const FONTS = [
    {
        name: 'NotoSansJP-Regular.ttf',
        url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansJP-Regular.otf',
    },
    {
        name: 'NotoSansJP-Bold.ttf',
        url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansJP-Bold.otf',
    },
];

const FONTS_DIR = path.join(__dirname, 'public', 'fonts');

// Create fonts directory if it doesn't exist
if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
    console.log('✓ Created public/fonts directory');
}

// Download font files
function downloadFont(fontUrl, fontPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading ${path.basename(fontPath)}...`);

        const file = fs.createWriteStream(fontPath);

        https.get(fontUrl, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`✓ Downloaded ${path.basename(fontPath)}`);
                        resolve();
                    });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✓ Downloaded ${path.basename(fontPath)}`);
                    resolve();
                });
            }
        }).on('error', (err) => {
            fs.unlink(fontPath, () => { }); // Delete partial file
            reject(err);
        });
    });
}

// Main setup function
async function setupFonts() {
    console.log('Setting up Japanese fonts for PDF generation...\n');

    try {
        for (const font of FONTS) {
            const fontPath = path.join(FONTS_DIR, font.name);

            // Skip if font already exists
            if (fs.existsSync(fontPath)) {
                console.log(`✓ ${font.name} already exists, skipping...`);
                continue;
            }

            await downloadFont(font.url, fontPath);
        }

        console.log('\n✅ Font setup complete!');
        console.log('\nNext steps:');
        console.log('1. Restart your dev server: npm run dev');
        console.log('2. The PDF will now display Japanese text correctly');

    } catch (error) {
        console.error('\n❌ Error downloading fonts:', error.message);
        console.log('\n📝 Manual setup instructions:');
        console.log('1. Download fonts from: https://fonts.google.com/noto/specimen/Noto+Sans+JP');
        console.log('2. Extract the ZIP file');
        console.log('3. Copy NotoSansJP-Regular.ttf to public/fonts/');
        console.log('4. Copy NotoSansJP-Bold.ttf to public/fonts/');
    }
}

setupFonts();


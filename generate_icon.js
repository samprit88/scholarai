const fs = require('fs');
const { createCanvas } = require('canvas');
const path = require('path');

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    const s = size / 512; // Scale factor

    // Background: deep plum (#2D1B4E) rounded square
    ctx.fillStyle = '#2D1B4E';
    ctx.beginPath();
    const radius = 64 * s;
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();

    // Small star/constellation dots in light lavender (#9B8AAA) above the book
    ctx.fillStyle = '#9B8AAA';
    const stars = [
        { x: 180, y: 150, r: 6 },
        { x: 256, y: 100, r: 8 },
        { x: 332, y: 140, r: 5 },
        { x: 220, y: 180, r: 4 },
        { x: 290, y: 170, r: 4 }
    ];
    
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x * s, star.y * s, star.r * s, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Constellation lines
    ctx.strokeStyle = 'rgba(155, 138, 170, 0.4)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(stars[0].x * s, stars[0].y * s);
    ctx.lineTo(stars[3].x * s, stars[3].y * s);
    ctx.lineTo(stars[1].x * s, stars[1].y * s);
    ctx.lineTo(stars[4].x * s, stars[4].y * s);
    ctx.lineTo(stars[2].x * s, stars[2].y * s);
    ctx.stroke();

    // Open book in warm gold (#C4853A)
    ctx.fillStyle = '#C4853A';
    ctx.beginPath();
    ctx.moveTo(256 * s, 400 * s); // Bottom center
    ctx.quadraticCurveTo(200 * s, 420 * s, 120 * s, 380 * s); // Left bottom
    ctx.lineTo(120 * s, 220 * s); // Left top
    ctx.quadraticCurveTo(200 * s, 260 * s, 246 * s, 240 * s); // Left inner
    ctx.lineTo(256 * s, 240 * s); // Spine top
    ctx.lineTo(266 * s, 240 * s); // Right inner
    ctx.quadraticCurveTo(312 * s, 260 * s, 392 * s, 220 * s); // Right top
    ctx.lineTo(392 * s, 380 * s); // Right bottom
    ctx.quadraticCurveTo(312 * s, 420 * s, 256 * s, 400 * s); // Right bottom center
    ctx.fill();
    
    // Pages inside (cream/parchment)
    ctx.fillStyle = '#FAF3E8';
    ctx.beginPath();
    ctx.moveTo(256 * s, 380 * s); 
    ctx.quadraticCurveTo(200 * s, 400 * s, 130 * s, 365 * s); 
    ctx.lineTo(130 * s, 230 * s); 
    ctx.quadraticCurveTo(200 * s, 265 * s, 250 * s, 250 * s); 
    ctx.lineTo(262 * s, 250 * s); 
    ctx.quadraticCurveTo(312 * s, 265 * s, 382 * s, 230 * s); 
    ctx.lineTo(382 * s, 365 * s); 
    ctx.quadraticCurveTo(312 * s, 400 * s, 256 * s, 380 * s); 
    ctx.fill();

    // 'S' monogram in Playfair Display in cream (#FAF3E8) subtly on the book cover
    // Actually, drawing on the book. Since the pages are cream, let's draw 'S' on the right page?
    // Or just in the center of the book? Let's do it in the center.
    ctx.fillStyle = '#C4853A';
    ctx.font = `italic bold ${100 * s}px "Playfair Display", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', 256 * s, 320 * s);

    // Save to file
    const buffer = canvas.toBuffer('image/png');
    const outPath = path.join(__dirname, `icons`, `icon-${size}.png`);
    
    // Ensure dir exists
    if (!fs.existsSync(path.join(__dirname, 'icons'))) {
        fs.mkdirSync(path.join(__dirname, 'icons'));
    }
    
    fs.writeFileSync(outPath, buffer);
    console.log(`Generated icon-${size}.png`);
}

generateIcon(192);
generateIcon(512);

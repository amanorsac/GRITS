/* eslint-disable */
// Generates the Grit & Grace brand assets (gold crown on maroon) into ./assets.
//
// Usage (from apps/mobile):
//   npm i --no-save @resvg/resvg-js
//   node scripts/generate-icons.cjs
//
// Outputs:
//   assets/icon.png                     1024x1024, opaque maroon (iOS forbids transparency)
//   assets/splash-icon.png              1024x1024, gold crown on transparent (splash bg is maroon)
//   assets/android-icon-foreground.png  1024x1024, crown inside the adaptive-icon safe zone
//   assets/android-icon-background.png  1024x1024, solid maroon
//   assets/android-icon-monochrome.png  1024x1024, white crown on transparent (themed icons)
//   assets/favicon.png                  48x48
//   assets/crown.svg                    the source mark

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const MAROON = '#6E1028';
const MAROON_DEEP = '#45091A';
const GOLD = '#C9A227';
const GOLD_LIGHT = '#E2C25A';

const OUT = path.join(__dirname, '..', 'assets');

// The crown, drawn on a 1024 canvas, centred on (512, 512).
function crown(fill, jewel, highlight) {
  return `
    <g>
      <path d="M232 640 L262 372 L392 510 L512 316 L632 510 L762 372 L792 640 Z" fill="${fill}"/>
      ${highlight ? `<path d="M512 316 L632 510 L512 470 L392 510 Z" fill="${highlight}" opacity="0.55"/>` : ''}
      <circle cx="262" cy="350" r="34" fill="${fill}"/>
      <circle cx="512" cy="290" r="40" fill="${fill}"/>
      <circle cx="762" cy="350" r="34" fill="${fill}"/>
      <rect x="222" y="660" width="580" height="82" rx="16" fill="${fill}"/>
      ${jewel ? `<circle cx="512" cy="701" r="20" fill="${jewel}"/>
      <circle cx="382" cy="701" r="13" fill="${jewel}"/>
      <circle cx="642" cy="701" r="13" fill="${jewel}"/>` : ''}
    </g>`;
}

function svg({ background, scale = 1, fill = GOLD, jewel = MAROON_DEEP, highlight = GOLD_LIGHT, size = 1024 }) {
  const t = `translate(512 512) scale(${scale}) translate(-512 -516)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}
  <g transform="${t}">${crown(fill, jewel, highlight)}</g>
</svg>`;
}

function render(name, source, width = 1024) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: width } }).render().asPng();
  fs.writeFileSync(path.join(OUT, name), png);
  console.log('wrote', name, png.length, 'bytes');
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'crown.svg'), svg({ background: MAROON }));

render('icon.png', svg({ background: MAROON, scale: 0.95 }));
render('splash-icon.png', svg({ scale: 1 }));
// Android adaptive icons are masked to the centre ~61%; keep the crown inside it.
render('android-icon-foreground.png', svg({ scale: 0.62 }));
render('android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${MAROON}"/></svg>`);
render('android-icon-monochrome.png', svg({ scale: 0.62, fill: '#FFFFFF', jewel: null, highlight: null }));
render('favicon.png', svg({ background: MAROON, scale: 0.95 }), 48);

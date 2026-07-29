/**
 * The "Bluebird" SVG wordmark. Title-case is ruled. Vector (scales crisply from
 * 24px to 200px). Uses `currentColor`, so a container sets the color — `--ink`
 * in headers (navy in light, white in dark; literal `--navy` would vanish on the
 * dark surface, so `--ink` is used for AA — noted in RUN-BRAND-SUMMARY.md).
 *
 * The glyphs are the platform bold sans (system-ui). `textLength` locks the
 * rendered width so it never clips and stays consistent across devices; a fully
 * outlined custom-glyph wordmark matching the board's exact type is a follow-up.
 */
const SVGNS = 'http://www.w3.org/2000/svg';

export const WORDMARK_MARKUP =
  '<svg class="wordmark" viewBox="0 0 300 72" role="img" aria-label="Bluebird" xmlns="http://www.w3.org/2000/svg">' +
  '<text x="2" y="56" fill="currentColor" font-family="system-ui,-apple-system,&quot;Segoe UI&quot;,Roboto,sans-serif" ' +
  'font-weight="800" font-size="60" textLength="292" lengthAdjust="spacingAndGlyphs">Bluebird</text></svg>';

/** Build the wordmark as an SVG element for JS-rendered surfaces. */
export function wordmark(): SVGSVGElement {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'wordmark');
  svg.setAttribute('viewBox', '0 0 300 72');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Bluebird');
  const text = document.createElementNS(SVGNS, 'text');
  text.setAttribute('x', '2');
  text.setAttribute('y', '56');
  text.setAttribute('fill', 'currentColor');
  text.setAttribute('font-family', 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif');
  text.setAttribute('font-weight', '800');
  text.setAttribute('font-size', '60');
  text.setAttribute('textLength', '292');
  text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  text.textContent = 'Bluebird';
  svg.appendChild(text);
  return svg;
}

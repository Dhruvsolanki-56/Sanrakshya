/* ==========================================================================
   Sanrakshya — the child's room.

   The toys stand in a real room, photographed the way a quiet nursery is: a
   chalky painted wall, a painted skirting, pale oak boards, and one object on
   the wall, a painted wooden growth chart with a child's pencil marks on it.
   Nothing else. The window light does the rest.
   ========================================================================== */
import * as THREE from 'three';
import { canvasTex } from './studio.js';

let seed = 91;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* pale oak boards: 14 cm wide, staggered joints, fine grain and a little
   variation from board to board, running away from the camera */
function oakBoards() {
  const W = 1024, H = 2048, BOARDS = 6;                       // the tile covers 6 boards x 2.4 m
  const color = canvasTex(W, H, (g) => {
    g.fillStyle = '#d6b890'; g.fillRect(0, 0, W, H);
    const bw = W / BOARDS;
    for (let b = 0; b < BOARDS; b++) {
      const x0 = b * bw, joint = (0.2 + ((b * 0.37) % 0.6)) * H;
      for (const [y0, y1] of [[0, joint], [joint, H]]) {
        const tone = 0.9 + rnd() * 0.16, warm = rnd() * 10;
        g.fillStyle = `rgb(${Math.round(214 * tone + warm)}, ${Math.round(184 * tone + warm * .5)}, ${Math.round(144 * tone)})`;
        g.fillRect(x0, y0, bw, y1 - y0);
        // grain: long, slightly wandering lines, darker in the late wood
        for (let k = 0; k < 46; k++) {
          const gx = x0 + rnd() * bw, amp = 1 + rnd() * 4, f = 0.002 + rnd() * 0.004, ph = rnd() * 6;
          g.strokeStyle = `rgba(${120 + rnd() * 30}, ${80 + rnd() * 20}, 45, ${0.05 + rnd() * 0.12})`;
          g.lineWidth = 0.6 + rnd() * 1.6;
          g.beginPath();
          for (let y = y0; y <= y1; y += 16) { const x = gx + Math.sin(y * f + ph) * amp; y === y0 ? g.moveTo(x, y) : g.lineTo(x, y); }
          g.stroke();
        }
        // a knot, now and then
        if (rnd() < 0.25) {
          const kx = x0 + bw * (0.3 + rnd() * 0.4), ky = y0 + (y1 - y0) * (0.2 + rnd() * 0.6);
          const gr = g.createRadialGradient(kx, ky, 0, kx, ky, 14);
          gr.addColorStop(0, 'rgba(110, 70, 35, .35)'); gr.addColorStop(1, 'rgba(110, 70, 35, 0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, 9, 22, 0, 0, Math.PI * 2); g.fill();
        }
        // the seam at the end of a board
        g.fillStyle = 'rgba(90, 60, 30, .45)'; g.fillRect(x0, y1 - 1.5, bw, 3);
      }
      // the gap between boards
      g.fillStyle = 'rgba(80, 52, 28, .55)'; g.fillRect(x0, 0, 2, H);
      g.fillStyle = 'rgba(255, 244, 225, .18)'; g.fillRect(x0 + 2, 0, 1.5, H);
    }
  }, { repeat: true });
  // roughness: the seams are rougher; the grain barely changes the sheen of an oiled floor
  const rough = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, w, h);
    for (let b = 0; b < 6; b++) { g.fillStyle = 'rgb(235,235,235)'; g.fillRect(b * w / 6, 0, 2, h); }
    for (let i = 0; i < 1600; i++) { const v = 130 + rnd() * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * w, rnd() * h, 1, 3 + rnd() * 8); }
  }, { srgb: false, repeat: true });
  return { color, rough, size: [6 * 0.14, 2.4] };
}

/* chalky wall paint: very fine, soft variation, like a real rolled matt finish */
function plaster() {
  return canvasTex(512, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const n = (rnd() + rnd() + rnd()) / 3, v = 150 + (n - 0.5) * 40;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false, repeat: true });
}

/* the growth chart: a painted wooden board, a ruler printed down one edge, and a
   child's marks in pencil, each with an age and the family's own handwriting */
function growthChartTexture() {
  const W = 256, H = 2432;                                  // 0.13 m x 1.25 m, from 10 cm to 135 cm
  const cmPx = H / 125, top = 135;
  return canvasTex(W, H, (g) => {
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, '#f3ece0'); gr.addColorStop(1, '#efe6d7');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // a faint wood grain under the paint
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(150, 120, 80, ${0.03 + rnd() * 0.04})`; g.lineWidth = 1 + rnd() * 2;
      const x = rnd() * W; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 8, H * .3, x - 8, H * .6, x + 4, H); g.stroke();
    }
    // the ruler: every centimetre, longer every five, numbered every ten
    g.fillStyle = '#3d3a36';
    g.font = '500 30px "Geist Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
    for (let cm = 10; cm <= top; cm++) {
      const y = (top - cm) * cmPx, len = cm % 10 === 0 ? 70 : cm % 5 === 0 ? 46 : 26;
      g.fillRect(0, y - 1.2, len, 2.4);
      if (cm % 10 === 0 && cm < top) g.fillText(String(cm), 82, y);
    }
    // a small painted crown at the top: the chart belongs to someone
    g.fillStyle = '#d4481e';
    g.beginPath(); g.moveTo(150, 90); g.lineTo(165, 50); g.lineTo(185, 78); g.lineTo(205, 44); g.lineTo(225, 78); g.lineTo(240, 50); g.lineTo(240, 90); g.closePath(); g.fill();
    // the child's marks, in pencil, with their ages, climbing over the years
    const marks = [[62, '9 mo'], [76, '1½'], [86, '2'], [95, '3'], [103, '4']];
    g.lineCap = 'round';
    marks.forEach(([cm, age], i) => {
      const y = (top - cm) * cmPx + (i % 2 ? 2 : -2);
      g.strokeStyle = 'rgba(60, 58, 54, .75)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(120, y + 1); g.lineTo(158, y - 1); g.lineTo(206, y + 2); g.lineTo(250, y); g.stroke();
      g.fillStyle = 'rgba(60, 58, 54, .8)';
      g.font = '400 44px "Reenie Beanie", "Caveat", cursive';
      g.save(); g.translate(150, y - 26); g.rotate(-0.05 + (i % 3) * 0.03); g.fillText(age, 0, 0); g.restore();
    });
  });
}

/* a child's drawing, in crayon: the family under a big sun. Wax is laid as many short,
   slightly wandering passes, then the paper's tooth is punched through it. */
function drawingTexture() {
  const W = 720, H = 560;
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, W, H);
    const crayon = (pts, color, width, passes = 3) => {
      g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
      for (let p = 0; p < passes; p++) {
        g.globalAlpha = 0.55 + rnd() * 0.3; g.lineWidth = width * (0.7 + rnd() * 0.5);
        g.beginPath();
        pts.forEach(([x, y], i) => { const jx = x + (rnd() - 0.5) * width * 0.6, jy = y + (rnd() - 0.5) * width * 0.6; i ? g.lineTo(jx, jy) : g.moveTo(jx, jy); });
        g.stroke();
      }
      g.globalAlpha = 1;
    };
    const circle = (cx, cy, r, n = 26) => Array.from({ length: n + 3 }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * r * (1 + (rnd() - 0.5) * 0.08), cy + Math.sin(a) * r * (1 + (rnd() - 0.5) * 0.08)]; });
    // the sun, with its rays, in the corner where every child puts it
    crayon(circle(590, 110, 52), '#e8a91f', 14, 4);
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.2; crayon([[590 + Math.cos(a) * 72, 110 + Math.sin(a) * 72], [590 + Math.cos(a) * 108, 110 + Math.sin(a) * 108]], '#e8a91f', 10, 2); }
    // the grass
    const grass = []; for (let x = 20; x <= 700; x += 24) grass.push([x, 470 + Math.sin(x * 0.05) * 6]);
    crayon(grass, '#3f9a55', 18, 4);
    // three people: tall, tall, and small, holding hands
    const person = (x, h, color) => {
      const top = 468 - h, hr = h * 0.13;
      crayon(circle(x, top + hr, hr, 18), color, 9, 3);
      crayon([[x, top + hr * 2], [x, top + h * 0.62]], color, 9, 2);
      crayon([[x - h * 0.16, 468], [x, top + h * 0.62], [x + h * 0.16, 468]], color, 9, 2);
      crayon([[x - h * 0.2, top + h * 0.5], [x, top + h * 0.36], [x + h * 0.2, top + h * 0.5]], color, 9, 2);
      return [x, top + h * 0.5, h];
    };
    const a = person(180, 250, '#2c6be0'), b = person(330, 230, '#d4481e'), c = person(455, 140, '#8a6bb8');
    crayon([[a[0] + a[2] * 0.2, a[1]], [b[0] - b[2] * 0.2, b[1]]], '#555', 6, 1);
    crayon([[b[0] + b[2] * 0.2, b[1]], [c[0] - c[2] * 0.2, c[1] + 10]], '#555', 6, 1);
    // a heart, over the small one
    crayon([[455, 300], [438, 282], [440, 266], [455, 272], [470, 266], [472, 282], [455, 300]], '#e0506e', 8, 3);
    // the paper's tooth: tiny gaps where the wax skipped
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.5})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1); }
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, W, H);
  });
}

export function nursery({ span = [-3, 6], wallZ = -1.3, chartX = 0.66, drawingX = 1.8 } = {}) {
  const room = new THREE.Group();
  const L = span[1] - span[0], cx = (span[0] + span[1]) / 2;

  // the floor
  const oak = oakBoards();
  const floorGeo = new THREE.PlaneGeometry(L, 6); floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({ map: oak.color, roughnessMap: oak.rough, roughness: 0.62, metalness: 0 });
  for (const t of [oak.color, oak.rough]) t.repeat.set(L / oak.size[0], 6 / oak.size[1]);
  const floor = new THREE.Mesh(floorGeo, floorMat); floor.position.set(cx, 0, wallZ + 3); floor.receiveShadow = true; room.add(floor);

  // the wall
  const paintBump = plaster(); paintBump.repeat.set(L * 1.4, 4 * 1.4);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xece3d6, roughness: 0.93, roughnessMap: paintBump, bumpMap: paintBump, bumpScale: 0.35 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(L, 4), wallMat); wall.position.set(cx, 2, wallZ); wall.receiveShadow = true; room.add(wall);

  // the skirting: painted timber, a rounded top edge catching the light
  const paint = new THREE.MeshStandardMaterial({ color: 0xe6ddd0, roughness: 0.5 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.014), paint); board.position.set(cx, 0.035, wallZ + 0.007);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, L, 12), paint); lip.rotation.z = Math.PI / 2; lip.position.set(cx, 0.07, wallZ + 0.007);
  for (const m of [board, lip]) { m.castShadow = true; m.receiveShadow = true; room.add(m); }

  // the growth chart, hung beside the giraffe; its lower edge is 10 cm off the floor
  const chartTex = growthChartTexture();
  const chartFace = new THREE.MeshStandardMaterial({ map: chartTex, roughness: 0.6 });
  const chartEdge = new THREE.MeshStandardMaterial({ color: 0xe9dfcf, roughness: 0.6 });
  const chart = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.25, 0.014),
    [chartEdge, chartEdge, chartEdge, chartEdge, chartFace, chartEdge]);
  chart.position.set(chartX, 0.1 + 0.625, wallZ + 0.007 + 0.002); chart.rotation.z = -0.006;
  chart.castShadow = true; chart.receiveShadow = true; room.add(chart);
  // the child's drawing, in a pale oak frame with a white mount, beside the rabbit
  const oakFrame = new THREE.MeshStandardMaterial({ color: 0xcaa57a, roughness: 0.55 });
  const frame = new THREE.Group(); frame.position.set(drawingX, 0.4, wallZ + 0.012); frame.rotation.z = 0.012; frame.scale.setScalar(0.82); room.add(frame);
  const FW = 0.34, FH = 0.28, FB = 0.018, FD = 0.022;
  for (const [w, h, x, y] of [[FW, FB, 0, (FH - FB) / 2], [FW, FB, 0, -(FH - FB) / 2], [FB, FH - FB * 2, (FW - FB) / 2, 0], [FB, FH - FB * 2, -(FW - FB) / 2, 0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, FD), oakFrame); m.position.set(x, y, 0); m.castShadow = m.receiveShadow = true; frame.add(m);
  }
  const mount = new THREE.Mesh(new THREE.PlaneGeometry(FW - FB * 2, FH - FB * 2), new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.85 }));
  mount.position.z = -0.004; mount.receiveShadow = true; frame.add(mount);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.171), new THREE.MeshStandardMaterial({ map: drawingTexture(), roughness: 0.9 }));
  art.position.z = -0.003; art.receiveShadow = true; frame.add(art);

  // the handwriting font may arrive after the room is built: redraw the marks once it has
  document.fonts?.ready.then(() => { const t = growthChartTexture(); chartFace.map = t; chartTex.dispose(); });

  return room;
}

"use client";

/**
 * ClayMeshFallback
 *
 * Pure SVG/CSS fallback for TanzaniaGlobe when WebGL is unavailable.
 * A deterministic geodesic mesh (icosahedron, one subdivision) is projected
 * orthographically, lit per-facet and rendered as soft clay plates with
 * rounded rim light and a grounded shadow. No canvas, no filters, no loops.
 */

type Vec3 = readonly [number, number, number];

interface ClayFace {
  d: string;
  light: number;
  depth: number;
}

interface ClayEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

interface ClayNode {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

interface Palette {
  lit: string;
  shade: string;
  edgeColor: string;
  edgeShadow: string;
  edgeAlpha: number;
  nodeColor: string;
  glow: string;
  ground: string;
  specular: string;
  haze: string;
}

const THEMES: Record<"light" | "dark", Palette> = {
  light: {
    lit: "#EAF2FF",
    shade: "#6E97DD",
    edgeColor: "#FFFFFF",
    edgeShadow: "rgba(16, 57, 185, 0.35)",
    edgeAlpha: 0.62,
    nodeColor: "#FFFFFF",
    glow: "rgba(37, 99, 235, 0.14)",
    ground: "rgba(16, 57, 185, 0.26)",
    specular: "rgba(255, 255, 255, 0.8)",
    haze: "radial-gradient(circle at 42% 34%, rgba(255,255,255,0.85) 0%, rgba(164,199,247,0.42) 48%, rgba(164,199,247,0) 74%)",
  },
  dark: {
    lit: "#5A7099",
    shade: "#162033",
    edgeColor: "#BFDBFE",
    edgeShadow: "rgba(0, 0, 0, 0.6)",
    edgeAlpha: 0.44,
    nodeColor: "#DBEAFE",
    glow: "rgba(56, 189, 248, 0.1)",
    ground: "rgba(2, 6, 23, 0.7)",
    specular: "rgba(255, 255, 255, 0.18)",
    haze: "radial-gradient(circle at 42% 34%, rgba(90,112,153,0.42) 0%, rgba(30,41,59,0.28) 48%, rgba(15,23,42,0) 74%)",
  },
};

const VIEW = 200;
const CENTER = VIEW / 2;
const RADIUS = 92;
const BLEED_MASK = "radial-gradient(circle closest-side at 50% 49%, #000 74%, transparent 102%)";

const LIGHT = normalize([-0.55, 0.62, 0.66]);

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

const BASE_VERTICES: Vec3[] = (
  [
    [-1, 1.618033988749895, 0],
    [1, 1.618033988749895, 0],
    [-1, -1.618033988749895, 0],
    [1, -1.618033988749895, 0],
    [0, -1, 1.618033988749895],
    [0, 1, 1.618033988749895],
    [0, -1, -1.618033988749895],
    [0, 1, -1.618033988749895],
    [1.618033988749895, 0, -1],
    [1.618033988749895, 0, 1],
    [-1.618033988749895, 0, -1],
    [-1.618033988749895, 0, 1],
  ] as Vec3[]
).map(normalize);

const BASE_FACES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

function subdivide(
  vertices: Vec3[],
  faces: ReadonlyArray<readonly [number, number, number]>,
  levels: number
): { vertices: Vec3[]; faces: Array<[number, number, number]> } {
  let currentVertices = vertices.slice();
  let currentFaces = faces.map((face) => [face[0], face[1], face[2]] as [number, number, number]);

  for (let level = 0; level < levels; level += 1) {
    const midpointCache = new Map<string, number>();
    const nextVertices = currentVertices.slice();

    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const cached = midpointCache.get(key);
      if (cached !== undefined) return cached;

      const va = nextVertices[a];
      const vb = nextVertices[b];
      const index =
        nextVertices.push(
          normalize([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2])
        ) - 1;
      midpointCache.set(key, index);
      return index;
    };

    const nextFaces: Array<[number, number, number]> = [];
    for (const [a, b, c] of currentFaces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      nextFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }

    currentVertices = nextVertices;
    currentFaces = nextFaces;
  }

  return { vertices: currentVertices, faces: currentFaces };
}

function rotate([x, y, z]: Vec3, rx: number, ry: number, rz: number): Vec3 {
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x1 = x * cosY + z * sinY;
  const z1 = -x * sinY + z * cosY;

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y1 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;

  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const x2 = x1 * cosZ - y1 * sinZ;
  const y2 = x1 * sinZ + y1 * cosZ;

  return [x2, y2, z2];
}

function buildMesh() {
  const { vertices, faces } = subdivide(BASE_VERTICES, BASE_FACES, 1);
  const rotated = vertices.map((vertex) => rotate(vertex, 0.26, 0.62, -0.32));
  const projected = rotated.map(([x, y, z]) => ({
    x: CENTER + x * RADIUS,
    y: CENTER - y * RADIUS,
    z,
  }));

  const clayFaces: ClayFace[] = [];
  const edgeMap = new Map<string, { a: number; b: number; depth: number }>();
  const nodeIndices = new Set<number>();

  for (const [a, b, c] of faces) {
    const pa = projected[a];
    const pb = projected[b];
    const pc = projected[c];
    const depth = (pa.z + pb.z + pc.z) / 3;

    nodeIndices.add(a);
    nodeIndices.add(b);
    nodeIndices.add(c);

    for (const [i, j] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          a: i,
          b: j,
          depth: (projected[i].z + projected[j].z) / 2,
        });
      }
    }

    if (depth <= 0.02) continue;

    const normal = normalize([
      (rotated[a][0] + rotated[b][0] + rotated[c][0]) / 3,
      (rotated[a][1] + rotated[b][1] + rotated[c][1]) / 3,
      (rotated[a][2] + rotated[b][2] + rotated[c][2]) / 3,
    ]);
    const light = Math.max(
      0,
      normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]
    );

    clayFaces.push({
      d: `M${pa.x.toFixed(2)} ${pa.y.toFixed(2)}L${pb.x.toFixed(2)} ${pb.y.toFixed(
        2
      )}L${pc.x.toFixed(2)} ${pc.y.toFixed(2)}Z`,
      light,
      depth,
    });
  }

  const toEdge = (edge: { a: number; b: number; depth: number }): ClayEdge => ({
    x1: projected[edge.a].x,
    y1: projected[edge.a].y,
    x2: projected[edge.b].x,
    y2: projected[edge.b].y,
    opacity: Math.min(1, 0.22 + Math.max(0, edge.depth) * 0.9),
  });

  const frontEdges: ClayEdge[] = [];
  const backEdges: ClayEdge[] = [];
  for (const edge of edgeMap.values()) {
    if (edge.depth >= 0) frontEdges.push(toEdge(edge));
    else backEdges.push(toEdge(edge));
  }
  frontEdges.sort((left, right) => left.opacity - right.opacity);
  backEdges.sort((left, right) => left.opacity - right.opacity);

  const nodes: ClayNode[] = [...nodeIndices]
    .map((index) => {
      const point = projected[index];
      return {
        x: point.x,
        y: point.y,
        r: 1.1 + Math.max(0, point.z) * 1.45,
        opacity: 0.3 + Math.max(0, point.z) * 0.7,
      };
    })
    .sort((left, right) => left.opacity - right.opacity);

  clayFaces.sort((left, right) => left.depth - right.depth);

  return { faces: clayFaces, frontEdges, backEdges, nodes };
}

const MESH = buildMesh();

function mixHex(from: string, to: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const start = (a >> shift) & 255;
    const end = (b >> shift) & 255;
    return Math.round(start + (end - start) * t);
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

export default function ClayMeshFallback({ invertTheme = false }: { invertTheme?: boolean }) {
  const palette = invertTheme ? THEMES.dark : THEMES.light;

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      aria-label="Tanzania Mesh Globe"
      role="img"
    >
      <div className="animate-globe-appear relative h-[380px] w-[380px] opacity-95 sm:h-[600px] sm:w-[600px]">
        {/* Ambient clay glow */}
        <div
          aria-hidden
          className="absolute -inset-12 rounded-full blur-3xl"
          style={{ background: palette.glow }}
        />

        {/* Soft clay haze — no rim, just body light */}
        <div
          aria-hidden
          className="absolute inset-[5%] rounded-full blur-2xl"
          style={{ background: palette.haze }}
        />

        {/* Grounded shadow */}
        <div
          aria-hidden
          className="absolute inset-x-[22%] bottom-[1%] h-10 rounded-[50%] blur-2xl"
          style={{ background: palette.ground }}
        />

        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden
          focusable="false"
          shapeRendering="geometricPrecision"
          style={{ maskImage: BLEED_MASK, WebkitMaskImage: BLEED_MASK }}
        >
          {/* Hidden-side wireframe, barely visible through the clay */}
          <g fill="none" stroke={palette.edgeColor} strokeOpacity={palette.edgeAlpha * 0.09} strokeWidth={0.5}>
            {MESH.backEdges.map((edge, index) => (
              <line
                key={`back-${index}`}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
              />
            ))}
          </g>

          {/* Clay plates */}
          <g>
            {MESH.faces.map((face, index) => {
              const fill = mixHex(palette.shade, palette.lit, face.light);
              return (
                <path
                  key={`face-${index}`}
                  d={face.d}
                  fill={fill}
                  fillOpacity={0.94 + Math.min(0.06, face.depth * 0.06)}
                  stroke={fill}
                  strokeOpacity={0.92}
                  strokeWidth={1.15}
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* Plate shadows — a soft under-edge gives each facet its clay lift */}
          <g fill="none" stroke={palette.edgeShadow} strokeWidth={1.15} strokeLinecap="round">
            {MESH.frontEdges.map((edge, index) => (
              <line
                key={`edge-shadow-${index}`}
                x1={edge.x1 + 0.4}
                y1={edge.y1 + 0.8}
                x2={edge.x2 + 0.4}
                y2={edge.y2 + 0.8}
                strokeOpacity={edge.opacity * palette.edgeAlpha * 0.55}
              />
            ))}
          </g>

          {/* Mesh edges */}
          <g fill="none" stroke={palette.edgeColor} strokeWidth={0.75} strokeLinecap="round">
            {MESH.frontEdges.map((edge, index) => (
              <line
                key={`edge-${index}`}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                strokeOpacity={edge.opacity * palette.edgeAlpha}
              />
            ))}
          </g>

          {/* Mesh nodes — faint emissive flicker, a few emerald live pings */}
          <g>
            {MESH.nodes.map((node, index) => {
              const accent = index % 7 === 3;
              const color = accent
                ? invertTheme
                  ? "#34D399"
                  : "#10B981"
                : palette.nodeColor;
              return (
                <g
                  key={`node-${index}`}
                  className="clay-node-flicker"
                  style={{
                    animationDelay: `${((index * 0.73) % 4.6).toFixed(2)}s`,
                    animationDuration: `${4.8 + (index % 5) * 0.65}s`,
                  }}
                >
                  <circle
                    className="clay-node-halo"
                    cx={node.x}
                    cy={node.y}
                    r={node.r * (accent ? 2.6 : 2.1)}
                    fill={color}
                    opacity={accent ? 0.3 : 0.16}
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r}
                    fill={color}
                    fillOpacity={node.opacity * 0.85}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Specular highlight — soft clay sheen, no edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[17%] top-[9%] h-[30%] w-[34%] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle at 32% 30%, ${palette.specular}, transparent 72%)`,
          }}
        />
      </div>
    </div>
  );
}

import numpy as np
from PIL import Image
from collections import defaultdict
import math

# Load logo.png
im = Image.open('E:/Repo/mine/orgs/Cervos-Pharma/cervos/public/logo.png').convert('L')
arr = np.array(im, dtype=float)

# Invert so dark pixels are positive
val = 255.0 - arr - 128.0
h, w = val.shape

segments = []
for y in range(h - 1):
    for x in range(w - 1):
        tl = val[y, x] > 0
        tr = val[y, x+1] > 0
        br = val[y+1, x+1] > 0
        bl = val[y+1, x] > 0
        case = (tl << 3) | (tr << 2) | (br << 1) | bl
        if case == 0 or case == 15:
            continue
        
        def interp_top():
            t = val[y, x] / (val[y, x] - val[y, x+1])
            return (round(x + t, 2), float(y))
        def interp_bottom():
            t = val[y+1, x] / (val[y+1, x] - val[y+1, x+1])
            return (round(x + t, 2), float(y + 1))
        def interp_left():
            t = val[y, x] / (val[y, x] - val[y+1, x])
            return (float(x), round(y + t, 2))
        def interp_right():
            t = val[y, x+1] / (val[y, x+1] - val[y+1, x+1])
            return (float(x + 1), round(y + t, 2))

        if case in [1, 14]:
            segments.append((interp_bottom(), interp_left()))
        elif case in [2, 13]:
            segments.append((interp_right(), interp_bottom()))
        elif case in [3, 12]:
            segments.append((interp_right(), interp_left()))
        elif case in [4, 11]:
            segments.append((interp_top(), interp_right()))
        elif case in [5, 10]:
            segments.append((interp_top(), interp_left()))
            segments.append((interp_right(), interp_bottom()))
        elif case in [6, 9]:
            segments.append((interp_top(), interp_bottom()))
        elif case in [7, 8]:
            segments.append((interp_top(), interp_left()))

print(f"Computed {len(segments)} segments")

# Build adjacency graph to chain segments into closed loops
# Round to 1 decimal place to handle floating tolerances
def pt_key(pt):
    return (round(pt[0], 1), round(pt[1], 1))

adj = defaultdict(list)
for p1, p2 in segments:
    k1, k2 = pt_key(p1), pt_key(p2)
    if k1 != k2:
        adj[k1].append(p2)
        adj[k2].append(p1)

visited = set()
loops = []

for start_k in list(adj.keys()):
    if start_k in visited:
        continue
    
    # Trace loop
    loop = [start_k]
    visited.add(start_k)
    curr = start_k
    
    while True:
        next_candidates = [pt_key(n) for n in adj[curr] if pt_key(n) not in visited]
        if next_candidates:
            nxt = next_candidates[0]
            visited.add(nxt)
            loop.append(nxt)
            curr = nxt
        else:
            # Check if close to start
            break
            
    if len(loop) > 15:
        # Check if start and end are close
        d = math.hypot(loop[0][0] - loop[-1][0], loop[0][1] - loop[-1][1])
        loops.append((loop, d))

print(f"Extracted {len(loops)} loops")
for idx, (lp, d) in enumerate(loops):
    print(f"  Loop {idx}: {len(lp)} points, closure dist={d:.2f}")

# Ramer-Douglas-Peucker simplification
def rdp(points, epsilon):
    if len(points) < 3:
        return points
    dmax = 0.0
    index = 0
    p1, p2 = points[0], points[-1]
    denom = math.hypot(p2[1] - p1[1], p2[0] - p1[0])
    for i in range(1, len(points) - 1):
        p = points[i]
        if denom > 0:
            d = abs((p2[1] - p1[1]) * p[0] - (p2[0] - p1[0]) * p[1] + p2[0] * p1[1] - p2[1] * p1[0]) / denom
        else:
            d = math.hypot(p[0] - p1[0], p[1] - p1[1])
        if d > dmax:
            index = i
            dmax = d
    if dmax > epsilon:
        r1 = rdp(points[:index+1], epsilon)
        r2 = rdp(points[index:], epsilon)
        return r1[:-1] + r2
    else:
        return [points[0], points[-1]]

simplified_loops = []
for lp, _ in loops:
    s = rdp(lp, epsilon=1.2)
    simplified_loops.append(s)
    print(f"  Simplified from {len(lp)} to {len(s)} points")

# Write SVG paths
svg_paths = []
for s in simplified_loops:
    d = "M " + " L ".join(f"{pt[0]:.1f},{pt[1]:.1f}" for pt in s) + " Z"
    svg_paths.append(d)

print("Generated SVG paths successfully")
with open("E:/Repo/mine/orgs/Cervos-Pharma/cervos/scratch/raw_logo_paths.txt", "w") as f:
    for idx, path_d in enumerate(svg_paths):
        f.write(f"<!-- Path {idx} -->\n<path d=\"{path_d}\" />\n")

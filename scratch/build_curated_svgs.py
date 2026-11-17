import re
import math

# Load raw traced paths
with open("E:/Repo/mine/orgs/Cervos-Pharma/cervos/scratch/raw_logo_paths.txt") as f:
    raw_text = f.read()

# Extract paths
raw_paths = re.findall(r'<path d="([^"]+)" />', raw_text)
print(f"Loaded {len(raw_paths)} paths")

# Extract all coordinates to compute bounding box
all_coords = re.findall(r'([0-9\.]+),([0-9\.]+)', raw_text)
xs = [float(c[0]) for c in all_coords]
ys = [float(c[1]) for c in all_coords]

min_x, max_x = min(xs), max(xs)
min_y, max_y = min(ys), max(ys)
width = max_x - min_x
height = max_y - min_y
cx = (min_x + max_x) / 2
cy = (min_y + max_y) / 2

print(f"Bounds: X=[{min_x:.1f}, {max_x:.1f}], Y=[{min_y:.1f}, {max_y:.1f}]")
print(f"Center: ({cx:.1f}, {cy:.1f}), Dim: {width:.1f} x {height:.1f}")

# Target viewBox: 0 0 512 512
# Desired mark size inside circle: width/height ~ 320 to 360 px (leaving comfortable circular padding)
target_size = 350.0
scale = target_size / max(width, height)
target_cx, target_cy = 256.0, 256.0

def transform_path(d_str, s, off_x, off_y):
    def repl(m):
        x = float(m.group(1))
        y = float(m.group(2))
        nx = (x - cx) * s + off_x
        ny = (y - cy) * s + off_y
        return f"{nx:.1f},{ny:.1f}"
    return re.sub(r'([0-9\.]+),([0-9\.]+)', repl, d_str)

company_paths = [transform_path(p, scale, target_cx, target_cy) for p in raw_paths]

# 1. Company Logo - Transparent
svg_company_trans = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <!-- Cervos Company Mark (Transparent Vector) -->
  <g fill="#0F172A">
''' + "\n".join(f'    <path d="{p}" />' for p in company_paths) + '''
  </g>
</svg>'''

with open("E:/Repo/mine/orgs/Cervos-Pharma/cervos/public/cervos-company-logo-transparent.svg", "w") as f:
    f.write(svg_company_trans)

# 2. Company Logo - Circular Contained (Light)
svg_company_circ_light = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <filter id="cv-co-shadow" x="-8%" y="-8%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#0F172A" flood-opacity="0.08"/>
    </filter>
  </defs>

  <!-- Circular Container -->
  <circle cx="256" cy="256" r="240" fill="#FFFFFF" filter="url(#cv-co-shadow)"/>
  <circle cx="256" cy="256" r="236" stroke="#E2E8F0" stroke-width="4"/>

  <!-- Cervos Company Mark -->
  <g fill="#0F172A">
''' + "\n".join(f'    <path d="{p}" />' for p in company_paths) + '''
  </g>
</svg>'''

with open("E:/Repo/mine/orgs/Cervos-Pharma/cervos/public/cervos-company-logo-circular.svg", "w") as f:
    f.write(svg_company_circ_light)

# 3. Company Logo - Circular Contained (Dark / Inverted)
svg_company_circ_dark = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <!-- Dark Circular Container -->
  <circle cx="256" cy="256" r="240" fill="#0B0F19"/>
  <circle cx="256" cy="256" r="236" stroke="rgba(255,255,255,0.12)" stroke-width="4"/>

  <!-- Cervos Company Mark in Crisp White -->
  <g fill="#FFFFFF">
''' + "\n".join(f'    <path d="{p}" />' for p in company_paths) + '''
  </g>
</svg>'''

with open("E:/Repo/mine/orgs/Cervos-Pharma/cervos/public/cervos-company-logo-circular-dark.svg", "w") as f:
    f.write(svg_company_circ_dark)

print("Generated Company Logo SVGs")

# 4. Product Logo - Sampled from Company Mark:
# The company mark is composed of:
# - Path 2: Primary sweeping 'C' arc
# - Path 1: Horizontal bridge
# - Path 3, 4, 5, 6: Concentric iris / core node
# In the product logo, we sample the iconic 'C' arc (Path 2) embracing the concentric iris node (Paths 3, 5, 6),
# and complement it with the clinical horizontal stabilizer from Path 1!
# Let us scale and center this sampled segment into an iconic 512x512 product mark!

# Coordinates for paths 1, 2, 3, 4, 5, 6
prod_raw_paths = [raw_paths[1], raw_paths[2], raw_paths[3], raw_paths[5], raw_paths[6]]
prod_coords = []
for p in prod_raw_paths:
    prod_coords.extend(re.findall(r'([0-9\.]+),([0-9\.]+)', p))
pxs = [float(c[0]) for c in prod_coords]
pys = [float(c[1]) for c in prod_coords]
pcx = (min(pxs) + max(pxs)) / 2
pcy = (min(pys) + max(pys)) / 2
p_width = max(pxs) - min(pxs)
p_height = max(pys) - min(pys)

prod_target_size = 360.0
prod_scale = prod_target_size / max(p_width, p_height)

def transform_prod_path(d_str):
    def repl(m):
        x = float(m.group(1))
        y = float(m.group(2))
        nx = (x - pcx) * prod_scale + 256.0
        ny = (y - pcy) * prod_scale + 256.0
        return f"{nx:.1f},{ny:.1f}"
    return re.sub(r'([0-9\.]+),([0-9\.]+)', repl, d_str)

prod_path_bridge = transform_prod_path(raw_paths[1])
prod_path_arc = transform_prod_path(raw_paths[2])
prod_path_node_ring1 = transform_prod_path(raw_paths[3])
prod_path_node_core = transform_prod_path(raw_paths[5])
prod_path_node_ring2 = transform_prod_path(raw_paths[6])

# 4. Product Logo - Transparent
svg_product_trans = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <!-- Cervos Product Mark (Sampled from Company Logo) -->
  <g fill="#1F5F5B">
    <!-- Sweeping C Arc from Company Mark -->
    <path d="{prod_path_arc}" />
    <!-- Horizontal Clinical Stabilizer Bridge -->
    <path d="{prod_path_bridge}" />
  </g>
  <!-- Concentric Node Sampled from Company Focal Core -->
  <g fill="#10B981">
    <path d="{prod_path_node_ring1}" />
    <path d="{prod_path_node_ring2}" />
    <path d="{prod_path_node_core}" />
  </g>
</svg>'''

with open("E:/Repo/mine/orgs/Cervos-Pharma/cervos/public/cervos-product-logo-transparent.svg", "w") as f:
    f.write(svg_product_trans)

# 5. Product Logo - Circular Contained
svg_product_circ = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <filter id="cv-prod-shadow" x="-8%" y="-8%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#1F5F5B" flood-opacity="0.10"/>
    </filter>
    <linearGradient id="cv-prod-teal" x1="100" y1="100" x2="400" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1F5F5B"/>
      <stop offset="100%" stop-color="#14423F"/>
    </linearGradient>
    <linearGradient id="cv-prod-emerald" x1="200" y1="200" x2="350" y2="350" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>

  <!-- Circular Container -->
  <circle cx="256" cy="256" r="240" fill="#FFFFFF" filter="url(#cv-prod-shadow)"/>
  <circle cx="256" cy="256" r="236" stroke="#E2E8F0" stroke-width="4"/>

  <!-- Sweeping C Arc & Bridge (Deep Clinical Teal) -->
  <g fill="url(#cv-prod-teal)">
    <path d="{prod_path_arc}" />
    <path d="{prod_path_bridge}" />
  </g>

  <!-- Concentric Core Focal Node (Vibrant Emerald) -->
  <g fill="url(#cv-prod-emerald)">
    <path d="{prod_path_node_ring1}" />
    <path d="{prod_path_node_ring2}" />
    <path d="{prod_path_node_core}" />
  </g>
</svg>'''

with open("E:/Repo/mine/orgs/Cervos-Pharma/cervos/public/cervos-product-logo-circular.svg", "w") as f:
    f.write(svg_product_circ)

print("Generated Product Logo SVGs successfully")

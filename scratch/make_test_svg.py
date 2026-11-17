with open('E:/Repo/mine/orgs/Cervos-Pharma/cervos/scratch/raw_logo_paths.txt') as f:
    paths = f.read()

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <rect width="100%" height="100%" fill="#FFFFFF" />
  <g fill="#111111">
    {paths}
  </g>
</svg>'''

with open('E:/Repo/mine/orgs/Cervos-Pharma/cervos/scratch/test_traced.svg', 'w') as f:
    f.write(svg)

print("Wrote scratch/test_traced.svg")

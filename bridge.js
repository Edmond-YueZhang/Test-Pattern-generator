(function(root){
  'use strict';
  // Only this small bridge uses Designer's bundled Python 2.7. Rendering stays in Canvas.
  function payload(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str);}
  function script(data,body){return `import os, json, base64, hashlib, struct\np = json.loads(base64.b64decode('${payload(data)}').decode('utf-8'))\n`+body;}
  const resolveRoot=`root = os.path.realpath(os.getcwdu())
if not os.path.isdir(os.path.join(root, 'objects')) or not any(n.lower().endswith('.d3') for n in os.listdir(root)):
    raise Exception('Current working directory is not a Designer project')
`;
  const guard=resolveRoot+`if os.path.normcase(root) != os.path.normcase(p['root']):
    raise Exception('Designer project changed. Please import again.')
folder = os.path.realpath(os.path.join(root, 'objects', 'VideoFile'))
if not os.path.normcase(folder).startswith(os.path.normcase(root + os.sep)):
    raise Exception('VideoFile directory points outside the project')
if not os.path.isdir(folder):
    os.makedirs(folder)
if not p['token'].isalnum():
    raise Exception('Invalid transfer token')
temp = os.path.join(folder, '.ledtest_' + p['token'] + '.part')
`;
  class DesignerBridge{
    constructor(endpoint){const raw=endpoint||new URLSearchParams(location.search).get('director')||location.host||'localhost';this.base=new URL(/^https?:\/\//i.test(raw)?raw:'http://'+raw);if(!['http:','https:'].includes(this.base.protocol))throw Error('无效的 Designer 地址');}
    async execute(code){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{const response=await fetch(new URL('/api/session/python/execute',this.base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({script:code}),signal:controller.signal});if(!response.ok)throw Error(`Designer HTTP ${response.status}`);const data=await response.json();if(data.status?.code!==0)throw Error(data.status?.message||data.pythonLog||'Designer 执行失败');return typeof data.returnValue==='string'?JSON.parse(data.returnValue):data.returnValue;}catch(e){if(e.name==='AbortError')throw Error('Designer 响应超时；请先检查输出目录再重试。');throw e;}finally{clearTimeout(timer);}}
    async project(){return this.execute(script({},resolveRoot+"return {'root': root}\n"));}
    async screens(){return this.execute(script({},resolveRoot+`
import math
def physical_dimensions(screen):
    # world already includes the screen scale and ancestor transforms.
    mesh = screen.mesh
    lo, hi = mesh.extent
    ext = [float(hi.x-lo.x), float(hi.y-lo.y), float(hi.z-lo.z)]
    if any(math.isnan(v) or math.isinf(v) or v < 0 for v in ext):
        raise Exception('Invalid mesh extent')
    tolerance = max(0.000001, max(ext)*0.000001)
    depth = ext[2] > tolerance
    axes = [i for i in range(3) if ext[i] > tolerance]
    if len(axes) < 2:
        return {'hasZDepth':depth, 'dimensionKind':'unavailable'}
    # XY for volumetric meshes; XZ / YZ for axis-aligned floor / side planes.
    width_axis, height_axis = axes[:2]
    world = screen.world
    lengths = []
    for i in [width_axis, height_axis]:
        axis_scale = math.sqrt(sum(float(getattr(world, 'm%d%d' % (i,j)))**2 for j in range(3)))
        lengths.append(ext[i]*axis_scale)
    if any(math.isnan(v) or math.isinf(v) or v <= 0 for v in lengths):
        return {'hasZDepth':depth, 'dimensionKind':'unavailable'}
    return {'widthM':round(lengths[0],6), 'heightM':round(lengths[1],6), 'hasZDepth':depth,
            'dimensionKind':'estimated' if depth else 'calculated'}
items = []
for cls, kind in [(LedScreen, 'led'), (Screen2, 'projection')]:
    for screen in resourceManager.allResources(cls):
        item = {'uid': str(screen.uid), 'kind': kind, 'name': screen.description, 'path': str(screen.path), 'widthM': None, 'heightM': None, 'cabinet': None, 'warnings': []}
        try:
            item['width'] = float(screen.resolution.x)
            item['height'] = float(screen.resolution.y)
            if not all(math.isfinite(v) if hasattr(math, 'isfinite') else not (math.isnan(v) or math.isinf(v)) for v in [item['width'], item['height']]):
                raise Exception('Invalid resolution')
            try:
                item.update(physical_dimensions(screen))
            except Exception:
                item['dimensionKind'] = 'unavailable'
            if kind == 'led' and screen.product:
                product = screen.product
                if isinstance(product, LedProduct):
                    tw, th, pitch = float(product.tileRes.x), float(product.tileRes.y), float(product.dotPitchMM)
                    if tw > 0 and th > 0 and pitch > 0 and tw.is_integer() and th.is_integer():
                        cols, rows = item['width']/tw, item['height']/th
                        if cols > 0 and rows > 0 and abs(cols-round(cols)) < 0.000001 and abs(rows-round(rows)) < 0.000001:
                            cw, ch = tw*pitch, th*pitch
                            if not item.get('hasZDepth') and item['widthM'] and item['heightM'] and abs(cw*cols/1000-item['widthM']) < 0.001 and abs(ch*rows/1000-item['heightM']) < 0.001:
                                item['cabinet'] = {'pxW':int(tw), 'pxH':int(th), 'mmW':cw, 'mmH':ch, 'cols':int(round(cols)), 'rows':int(round(rows))}
            if not item['widthM'] or not item['heightM']:
                item['widthM'], item['heightM'] = None, None
                item['warnings'].append('模型无法可靠换算矩形宽高，请手动填写尺寸。')
            if kind == 'led' and not item['cabinet']:
                item['warnings'].append('未确认规则箱体布局，使用整屏分辨率与自定义测试网格。')
        except Exception:
            item['warnings'].append('部分属性无法读取，请手动确认参数。')
        for key in ['width', 'height', 'widthM', 'heightM']:
            value = item.get(key)
            if value is not None and (math.isnan(value) or math.isinf(value) or value <= 0):
                item[key] = None
        items.append(item)
items.sort(key=lambda item: (item['kind'], item['name'], item['uid']))
return {'root':root, 'screens':items}
`));}
    async importPNG(blob,name,onProgress=()=>{},expectedRoot=null){
      const project=await this.project();
      if(expectedRoot&&project.root.toLowerCase()!==expectedRoot.toLowerCase())throw Error('Designer 项目已切换，请刷新屏幕来源后重新选择。');
      const bytes=new Uint8Array(await blob.arrayBuffer());
      if(bytes.length>64*1024*1024)throw Error('PNG 超过 64 MB，请减小尺寸或简化背景。');
      const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
      const p={root:project.root,token,name,size:bytes.length};
      try{
        for(let offset=0;offset<bytes.length;offset+=98304){const chunk=bytes.subarray(offset,offset+98304);let raw='';for(const b of chunk)raw+=String.fromCharCode(b);
          await this.execute(script({...p,offset,chunk:btoa(raw)},guard+`if p['offset'] == 0:
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_BINARY)
    os.close(fd)
if os.path.getsize(temp) != p['offset']:
    raise Exception('Transfer offset mismatch')
with open(temp, 'ab') as f:
    f.write(base64.b64decode(p['chunk']))
return True
`));onProgress(Math.min(1,(offset+chunk.length)/bytes.length));}
        return await this.execute(script(p,guard+`if os.path.basename(p['name']) != p['name'] or not p['name'].lower().endswith('.png'):
    raise Exception('Invalid PNG filename')
if os.path.getsize(temp) != p['size']:
    raise Exception('Incomplete PNG transfer')
with open(temp, 'rb') as f:
    if f.read(8) != base64.b64decode('iVBORw0KGgo='):
        raise Exception('Invalid PNG signature')
stem = os.path.splitext(p['name'])[0]
dest = os.path.join(folder, p['name'])
i = 2
while os.path.exists(dest):
    dest = os.path.join(folder, stem + '_' + str(i) + '.png')
    i += 1
os.rename(temp, dest)
return {'path': dest, 'filename': os.path.basename(dest)}
`));
      }catch(error){try{await this.execute(script(p,guard+"if os.path.isfile(temp):\n    os.remove(temp)\nreturn True\n"));}catch(_){}throw error;}
    }
  }
  root.DesignerBridge=DesignerBridge;
})(typeof window!=='undefined'?window:globalThis);

(function(){
  'use strict';
  const $=id=>document.getElementById(id), assets={background:null,logo:null};
  let colors=['#ef476f','#ffd166','#06d6a0','#118ab2'],busy=false,valid=false,frame=0;
  const numbers=['mmW','mmH','pxW','pxH','cols','rows','logoSize','textSize','totalWidth','totalHeight','screenWidthM','screenHeightM'];
  const checks=['largeResolution','coordinates','title','showResolution','showDimensions','titleBackground','grid','reverse','logoTL','logoBR'];
  const values=['name','mode','colorA','colorB','direction','arrangement','imageScope','imageFit','titlePosition','parameterMode'];
  let screenList=[],sourceProject=null,layoutKey='';
  function setText(id,text){const el=$(id);if(el.textContent!==text)el.textContent=text;}
  function parseNumber(input){const raw=input.value.trim();if(raw==='')return 0;if(input.dataset.numeric&&!/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(raw))return NaN;return Number(raw);}
  function sourceStatus(message,error=false){$('sourceStatus').textContent=message;$('sourceStatus').classList.toggle('error',error);}
  function showPanel(id){document.querySelectorAll('[data-panel]').forEach(b=>{const active=b.dataset.panel===id;$(b.dataset.panel).hidden=!active;b.setAttribute('aria-pressed',String(active));});}
  document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
  function applyScreen(){
    const screen=screenList.find(s=>s.uid===$('screenSource').value);
    if(!screen){sourceStatus('无（自定义）：可自由填写尺寸和分辨率。');return;}
    $('name').value=screen.name;
    $('totalWidth').value=screen.width??'';$('totalHeight').value=screen.height??'';
    $('screenWidthM').value=screen.widthM??'';$('screenHeightM').value=screen.heightM??'';
    const complete=screen.cabinet;
    $('parameterMode').value=complete?'cabinet':'total';
    if(complete){for(const k of ['pxW','pxH','mmW','mmH','cols','rows'])$(k).value=complete[k];}
    else{
      for(const k of ['pxW','pxH','mmW','mmH'])$(k).value='';
      $('cols').value=Math.min(10,Math.max(1,Math.floor(screen.width||1)));
      $('rows').value=Math.min(6,Math.max(1,Math.floor(screen.height||1)));
    }
    if(!screen.widthM||!screen.heightM)$('showDimensions').checked=false;
    sourceStatus(`已读取 ${{led:'LED screen',projection:'Projection surface',dmx:'DMX screen'}[screen.kind]||screen.kind}: ${screen.name}`);
    showPanel('screenPanel');update();
  }
  $('screenSource').onchange=applyScreen;
  async function refreshScreens(){
    const previous=$('screenSource').value,previousRoot=sourceProject;
    $('refreshScreens').disabled=true;sourceStatus('正在读取 Designer 屏幕…');
    try{
      const data=await new DesignerBridge().screens();
      screenList=data.screens;sourceProject=data.root;
      $('screenSource').replaceChildren(new Option('无（自定义）',''));
      for(const [kind,label]of [['led','LED Screen'],['projection','Projection Surface']]){
        const group=document.createElement('optgroup');group.label=label;
        screenList.filter(s=>s.kind===kind).forEach(s=>group.append(new Option(`${s.name} · ${s.width??'?'}×${s.height??'?'} · ${s.uid.slice(-6)}`,s.uid)));
        if(group.children.length)$('screenSource').append(group);
      }
      // A refresh never silently replaces the user's edited values.
      if(previousRoot===data.root&&screenList.some(s=>s.uid===previous))$('screenSource').value=previous;
      sourceStatus(`已读取 ${screenList.length} 个屏幕。选择屏幕以填入参数；刷新列表不会覆盖已编辑的数值。${previous&&$('screenSource').value!==previous?'原屏幕已不可用，已转为无（自定义）。':''}`);
    }catch(e){screenList=[];sourceProject=null;$('screenSource').replaceChildren(new Option('无（自定义）',''));sourceStatus(`无法读取 Designer：${e.message}。仍可使用无（自定义）。`,true);}
    finally{$('refreshScreens').disabled=false;}
  }
  $('refreshScreens').onclick=refreshScreens;
  function read(){const s={palette:colors.slice()};for(const k of numbers)s[k]=parseNumber($(k));for(const k of checks)s[k]=$(k).checked;for(const k of values)s[k]=$(k).value;return s;}
  function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
  function buttons(){$('download').disabled=busy||!valid;$('import').disabled=busy||!valid;}
  function palette(){$('palette').replaceChildren();colors.forEach((color,i)=>{const wrap=document.createElement('div');wrap.className='swatch';const input=document.createElement('input');input.type='color';input.value=color;input.setAttribute('aria-label',`颜色 ${i+1}`);input.oninput=()=>{colors[i]=input.value;schedule();};const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title=`删除颜色 ${i+1}`;remove.disabled=colors.length<=2;remove.onclick=()=>{colors.splice(i,1);palette();schedule();};wrap.append(input,remove);$('palette').append(wrap);});$('addColor').disabled=colors.length>=12;}
  function update(){frame=0;const s=read();const total=s.parameterMode==='total';
    // Only change control visibility when the mode changes, never per keystroke.
    const nextLayout=`${s.parameterMode}:${s.mode}`;
    if(nextLayout!==layoutKey){
      layoutKey=nextLayout;
      $('totalFields').hidden=!total;$('cabinetFields').hidden=total;
      setText('gridHeading',total?'测试网格':'箱体数量');setText('countLabel',total?'测试网格':'箱体数量');$('gridNote').hidden=!total;
      $('twoColors').hidden=['image','multi'].includes(s.mode);$('gradientOptions').hidden=!['global','cell'].includes(s.mode);$('reverseLabel').hidden=s.mode!=='cell';$('multiOptions').hidden=s.mode!=='multi';$('imageOptions').hidden=s.mode!=='image';
      setText('modeName',$('mode').selectedOptions[0].textContent);
    }
    setText('textSizeValue',`${s.textSize}%`);
    try{const d=LEDCore.render($('preview'),s,assets,true);$('resolution').textContent=`${d.w} × ${d.h} px`;$('physical').textContent=d.mmW&&d.mmH?`${+(d.mmW/1000).toFixed(6)} × ${+(d.mmH/1000).toFixed(6)} m`:'待填写';$('count').textContent=`${s.cols} × ${s.rows} / ${d.count} ${total?'格':'块'}`;$('filename').textContent=LEDCore.filename(s);if(s.mode==='image'&&!assets.background)throw Error('请选择一张背景图片。');valid=true;try{localStorage.setItem('led-test-pattern-v1',JSON.stringify(s));}catch(_){}if(!busy)status('输出到 objects/VideoFile；同名文件自动添加序号。');}catch(e){valid=false;status(e.message,true);}buttons();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  async function loadImage(file,pngOnly){if(!file)return null;if(file.size>32*1024*1024)throw Error('上传图片不能超过 32 MB。');if(pngOnly){const h=new Uint8Array(await file.slice(0,8).arrayBuffer());if(h.join(',')!=='137,80,78,71,13,10,26,10')throw Error('Logo 必须为 PNG 图片。');}return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);if(img.width*img.height>67108864)reject(Error('上传图片不能超过 64MP。'));else resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('无法读取图片，请选择 PNG、JPEG 或 WebP。'));};img.src=url;});}
  for(const key of ['logo','background']){let revision=0;$(key).addEventListener('change',async()=>{const current=++revision;assets[key]=null;valid=false;buttons();try{const img=await loadImage($(key).files[0],key==='logo');if(current!==revision)return;assets[key]=img;update();}catch(e){if(current!==revision)return;$(key).value='';update();status(e.message,true);}});}
  $('clearLogo').onclick=()=>{$('logo').value='';assets.logo=null;update();};
  $('addColor').onclick=()=>{if(colors.length<12)colors.push('#ffffff');palette();update();};
  $('settings').addEventListener('submit',e=>e.preventDefault());$('settings').addEventListener('input',e=>{if(e.target.type!=='file'&&!e.isComposing)schedule();});
  $('settings').addEventListener('compositionend',schedule);
  async function output(importToDesigner){if(busy)return;update();if(!valid)return;const s=read(),expectedRoot=$('screenSource').value?sourceProject:null,canvas=document.createElement('canvas');busy=true;buttons();status('正在生成完整分辨率 PNG…');try{LEDCore.render(canvas,s,assets);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG 编码失败，请减小图片尺寸。')),'image/png'));const name=LEDCore.filename(s);if(importToDesigner){const bridge=new DesignerBridge();const result=await bridge.importPNG(blob,name,p=>status(`正在导入 Designer… ${Math.round(p*100)}%`),expectedRoot);status(`已写入：${result.path}。Designer 将自动扫描媒体文件。`);}else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);status(`已生成 PNG：${name}`);}}catch(e){status(`操作失败：${e.message}`,true);}finally{canvas.width=canvas.height=1;busy=false;buttons();}}
  $('download').onclick=()=>output(false);$('import').onclick=()=>output(true);
  try{const saved=JSON.parse(localStorage.getItem('led-test-pattern-v1'));if(saved&&typeof saved==='object'){if(!saved.parameterMode)saved.parameterMode='cabinet';for(const k of ['showResolution','showDimensions'])if(typeof saved[k]!=='boolean')saved[k]=saved.title!==false;for(const k of [...numbers,...values])if(saved[k]!==undefined)$(k).value=saved[k];for(const k of checks)if(typeof saved[k]==='boolean')$(k).checked=saved[k];if(Array.isArray(saved.palette)&&saved.palette.length>=2&&saved.palette.length<=12&&saved.palette.every(c=>/^#[\da-f]{6}$/i.test(c)))colors=saved.palette;}}catch(_){}
  $('aboutButton').onclick=()=>{if(!$('aboutDialog').open)$('aboutDialog').showModal();};
  $('aboutClose').onclick=()=>$('aboutDialog').close();
  palette();update();
  if(location.protocol!=='file:')refreshScreens();
})();

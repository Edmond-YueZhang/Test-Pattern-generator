(function (root) {
  'use strict';
  function dimensions(s) {
    const total=s.parameterMode==='total';
    for (const k of (total?['totalWidth','totalHeight','cols','rows']:['pxW','pxH','cols','rows'])) if (!Number.isSafeInteger(s[k]) || s[k]<1) throw Error('分辨率和行列数必须为正整数。');
    if(total&&['screenWidthM','screenHeightM'].some(k=>!Number.isFinite(s[k])||s[k]<0))throw Error('屏幕尺寸请输入有效数字；未知尺寸可留空。');
    if (!s.name.trim()) throw Error('请填写屏幕名称。');
    const w=total?s.totalWidth:s.pxW*s.cols,h=total?s.totalHeight:s.pxH*s.rows;
    const mmW=total?(s.screenWidthM>0?s.screenWidthM*1000:null):s.mmW*s.cols;
    const mmH=total?(s.screenHeightM>0?s.screenHeightM*1000:null):s.mmH*s.rows;
    if ((!total||s.showDimensions)&&(!mmW||!mmH)) throw Error('请填写有效的屏幕尺寸，或关闭屏幕尺寸文字。');
    if ((mmW!==null&&!Number.isFinite(mmW))||(mmH!==null&&!Number.isFinite(mmH))||(!total&&(s.mmW<=0||s.mmH<=0))) throw Error('屏幕物理尺寸必须为有限正数。');
    if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||!Number.isSafeInteger(w*h)||!Number.isSafeInteger(s.cols*s.rows))throw Error('输入数值超出可精确计算的范围。');
    if (!s.largeResolution&&(w>16384||h>16384||w*h>33554432||s.cols*s.rows>20000)) throw Error('当前分辨率超过常规上限（单边 16384 px、总计 32MP、20000 个网格），可开启“大尺寸分辨率”继续。');
    if(s.cols>w||s.rows>h)throw Error('网格行列不能超过输出像素宽高。');
    return {w,h,mmW,mmH,count:s.cols*s.rows};
  }
  function filename(s) {
    const d=dimensions(s);
    let name=s.name.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').trim().slice(0,80) || 'LED';
    if (/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(name)) name='LED_'+name;
    return `${name}_${d.w}x${d.h}.png`;
  }
  function paletteIndex(x,y,s) {return (s.arrangement==='columns'?x:s.arrangement==='rows'?y:x+y)%s.palette.length;}
  function drawImage(ctx,img,x,y,w,h,fit) {
    if(fit==='stretch') {ctx.drawImage(img,x,y,w,h);return;}
    const ratio=(fit==='contain'?Math.min:Math.max)(w/img.width,h/img.height), dw=img.width*ratio,dh=img.height*ratio;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);ctx.restore();
  }
  function render(canvas,s,assets,preview=false) {
    const d=dimensions(s); s={...s,pxW:d.w/s.cols,pxH:d.h/s.rows}; const scale=preview?Math.min(1,1600/d.w,1000/d.h):1;
    canvas.width=Math.max(1,Math.round(d.w*scale));canvas.height=Math.max(1,Math.round(d.h*scale));
    const c=canvas.getContext('2d');if(!c)throw Error('无法创建绘图画布。');
    c.scale(canvas.width/d.w,canvas.height/d.h);c.fillStyle='#000';c.fillRect(0,0,d.w,d.h);
    try{if(c.getImageData(0,0,1,1).data[3]!==255)throw Error();}catch(_){throw Error('当前运行环境无法创建该尺寸的画布，请减小分辨率。');}
    const gradient=(x,y,w,h,reverse)=>{const g=c.createLinearGradient(x,y,x+(s.direction==='vertical'?0:w),y+(s.direction==='horizontal'?0:h));g.addColorStop(0,reverse?s.colorB:s.colorA);g.addColorStop(1,reverse?s.colorA:s.colorB);return g;};
    if(s.mode==='global'){c.fillStyle=gradient(0,0,d.w,d.h,false);c.fillRect(0,0,d.w,d.h);}
    if(s.mode==='image'&&assets.background&&s.imageScope==='screen')drawImage(c,assets.background,0,0,d.w,d.h,s.imageFit);
    for(let y=0;y<s.rows;y++)for(let x=0;x<s.cols;x++){
      const left=Math.round(x*s.pxW),top=Math.round(y*s.pxH),cw=Math.round((x+1)*s.pxW)-left,ch=Math.round((y+1)*s.pxH)-top;
      if(s.mode==='checker'||s.mode==='multi'||s.mode==='cell'){
        c.fillStyle=s.mode==='checker'?((x+y)%2?s.colorB:s.colorA):s.mode==='multi'?s.palette[paletteIndex(x,y,s)]:gradient(left,top,cw,ch,s.reverse&&(x+y)%2);
        c.fillRect(left,top,cw,ch);
      }
      if(s.mode==='image'&&assets.background&&s.imageScope==='tile')drawImage(c,assets.background,left,top,cw,ch,s.imageFit);
    }
    if(s.grid){c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1;c.beginPath();for(let x=0;x<=s.cols;x++){const p=Math.min(d.w-.5,x*s.pxW+.5);c.moveTo(p,0);c.lineTo(p,d.h);}for(let y=0;y<=s.rows;y++){const p=Math.min(d.h-.5,y*s.pxH+.5);c.moveTo(0,p);c.lineTo(d.w,p);}c.stroke();}
    function text(str,x,y,size,maxWidth){c.font=`600 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.strokeStyle='#000';c.lineWidth=Math.max(1,size*.12);c.strokeText(str,x,y,maxWidth);c.fillStyle='#fff';c.fillText(str,x,y,maxWidth);}
    if(s.coordinates)for(let y=0;y<s.rows;y++)for(let x=0;x<s.cols;x++)text(`${x+1}.${y+1}`,(x+.5)*s.pxW,(y+.5)*s.pxH,Math.max(1,Math.min(s.pxW,s.pxH)*.17),s.pxW*.8);
    const lines=[];
    if(s.title)lines.push(s.name);
    if(s.showResolution)lines.push(`${d.w} × ${d.h} px`);
    if(s.showDimensions)lines.push(`${Number((d.mmW/1000).toFixed(6))} × ${Number((d.mmH/1000).toFixed(6))} m`);
    if(lines.length){
      const margin=Math.min(d.w,d.h)*.02;
      let size=Math.max(1,Math.min(d.w*.035,s.pxH*.14))*(s.textSize||100)/100;
      c.font=`600 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;
      const maxWidth=Math.max(...lines.map(line=>c.measureText(line).width));
      // Fit the entire group uniformly; do not squeeze individual lines.
      size*=Math.min(1,d.w*.85/Math.max(1,maxWidth),(d.h-2*margin)/(size*(lines.length*1.25+.5)));
      const height=size*(lines.length*1.25+.5);
      const cy=s.titlePosition==='center'?d.h/2:s.titlePosition==='bottom'?d.h-margin-height/2:margin+height/2;
      if(s.titleBackground!==false){c.fillStyle='#080e1bcc';c.fillRect(d.w*.05,cy-height/2,d.w*.9,height);}
      lines.forEach((line,i)=>text(line,d.w/2,cy+(i-(lines.length-1)/2)*size*1.25,size,d.w*.85));
    }
    if(assets.logo){
      const gap=Math.min(d.w*.02,s.pxH*.04);
      // Scale after fitting to the screen: a fixed cabinet-height cap made
      // most slider positions produce the same logo size.
      const fit=Math.min((d.w-2*gap)/assets.logo.width,(d.h-2*gap)/assets.logo.height);
      const r=fit*s.logoSize/100,w=assets.logo.width*r,h=assets.logo.height*r;
      if(s.logoTL)c.drawImage(assets.logo,gap,gap,w,h);
      if(s.logoBR)c.drawImage(assets.logo,d.w-gap-w,d.h-gap-h,w,h);
    }
    return d;
  }
  const api={dimensions,filename,paletteIndex,render};root.LEDCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

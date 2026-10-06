/**
 * Cầu nối cho bản tĩnh (GitHub Pages).
 *
 * Trên GitHub Pages không có server — `/api/...` của chính trang không tồn tại.
 * Thay vì sửa từng chỗ gọi API (hàng chục chỗ, cộng thêm các URL `/api/stream?u=…`
 * mà server nhét sẵn trong JSON), đoạn script này chạy ĐẦU TIÊN trong <head> và
 * chuyển hướng mọi URL cùng origin có đường dẫn `/api/...` sang server vitube đã
 * cấu hình:
 *
 *   fetch, XMLHttpRequest, EventSource, navigator.sendBeacon
 *   thuộc tính src / href / poster (React đặt bằng setAttribute, code tự viết thì
 *   gán thẳng `video.src = …` — cả hai đều được bắt)
 *
 * Địa chỉ server lấy theo thứ tự: Cài đặt (localStorage `vitube.apiUrl`) → giá trị
 * nhúng lúc build (`NEXT_PUBLIC_VITUBE_API_URL`). Chưa có gì thì không đổi gì cả,
 * và banner `ServerBanner` nhắc người dùng vào Cài đặt.
 *
 * Chỉ được nhúng khi build với VITUBE_STATIC=1. Bản có server thì không cần.
 */
export function remoteShimScript(): string {
  const def = JSON.stringify(process.env.NEXT_PUBLIC_VITUBE_API_URL ?? '');
  const bp = JSON.stringify(process.env.NEXT_PUBLIC_BASE_PATH ?? '');
  return `(function(){
var KEY='vitube.apiUrl',DEF=${def},BP=${bp},HERE=location.origin;
function base(){var v='';try{v=localStorage.getItem(KEY)||'';}catch(e){}return (v||DEF||'').trim().replace(/\\/+$/,'');}
function map(u){
  if(u==null)return null;
  var b=base();if(!b)return null;
  var x;try{x=new URL(typeof u==='string'?u:String(u.url||u.href||u),location.href);}catch(e){return null;}
  if(x.origin!==HERE)return null;
  var p=x.pathname;
  if(BP&&p.indexOf(BP+'/api/')===0)p=p.slice(BP.length);
  if(p.indexOf('/api/')!==0)return null;
  return b+p+x.search+x.hash;
}
window.__vitubeMapApi=map;
var F=window.fetch;
window.fetch=function(input,init){
  try{
    var m=map(input instanceof Request?input.url:input);
    if(m){
      init=Object.assign({},init);
      if(!init.credentials)init.credentials='include';
      input=input instanceof Request?new Request(m,input):m;
    }
  }catch(e){}
  return F.call(this,input,init);
};
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url){
  var m=map(url);
  if(m){arguments[1]=m;try{this.withCredentials=true;}catch(e){}}
  return XO.apply(this,arguments);
};
if(window.EventSource){
  var ES=window.EventSource;
  var P=function(url,conf){var m=map(url);return m?new ES(m,Object.assign({withCredentials:true},conf)):new ES(url,conf);};
  P.prototype=ES.prototype;P.CONNECTING=0;P.OPEN=1;P.CLOSED=2;
  window.EventSource=P;
}
if(navigator.sendBeacon){
  var SB=navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon=function(url,data){return SB(map(url)||url,data);};
}
var SA=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(name,value){
  if(name==='src'||name==='href'||name==='poster'){var m=map(String(value));if(m)value=m;}
  return SA.call(this,name,value);
};
function hook(C,prop){
  if(!C)return;var d=Object.getOwnPropertyDescriptor(C.prototype,prop);
  if(!d||!d.set)return;
  Object.defineProperty(C.prototype,prop,{configurable:true,enumerable:d.enumerable,get:d.get,
    set:function(v){var m=map(String(v));return d.set.call(this,m||v);}});
}
hook(window.HTMLMediaElement,'src');hook(window.HTMLImageElement,'src');
hook(window.HTMLSourceElement,'src');hook(window.HTMLTrackElement,'src');
hook(window.HTMLVideoElement,'poster');hook(window.HTMLAnchorElement,'href');
})();`;
}

// 语言切换:记住选择,默认跟随浏览器语言。data-lang 已在 <head> 内联脚本里
// 先设好,避免首屏闪烁;这里只负责按钮高亮和点击切换。
function eonSetLang(l){
  document.documentElement.setAttribute('data-lang', l);
  try { localStorage.setItem('eon-lang', l); } catch (e) {}
  document.querySelectorAll('.langtoggle button').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-l') === l);
  });
}
document.addEventListener('DOMContentLoaded', function(){
  var l = document.documentElement.getAttribute('data-lang') || 'en';
  document.querySelectorAll('.langtoggle button').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-l') === l);
  });
});

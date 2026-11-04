const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const core=require('../../assets/site-core.js');
const source=fs.readFileSync(process.env.LUCCIOLA_MENU_SCRIPT || path.join(__dirname,'../menu.js'),'utf8');
function setup(pathname='/menu-bozza/'){
 const node=()=>({innerHTML:'',textContent:'',value:'',hidden:false,style:{},dataset:{},attributes:{},addEventListener(){},setAttribute(n,v){this.attributes[n]=v;},classList:{contains:()=>false,add(){},remove(){},toggle(){}},getAttribute(n){return this.attributes[n];}});
 const els={};let active='calde';
 const buttons=core.categories.map(cat=>({...node(),dataset:{cat},classList:{contains:()=>active===cat,add(){active=cat},remove(){}}}));
 const ctx={console,Date,Intl,URL,URLSearchParams,document:{body:node(),getElementById:id=>id==='seasonal-theme'?(els[id]||null):(els[id]??=node()),querySelector:s=>s==='.tab-btn.active'?buttons.find(b=>b.dataset.cat===active):null,querySelectorAll:s=>s.includes('tab-btn')?buttons:[],createElement:node,head:{appendChild(el){els[el.id]=el;el.remove=()=>delete els[el.id]}},addEventListener(){}},window:{LucciolaSite:core,location:{search:'',pathname,href:'https://example.test'+pathname},addEventListener(){},scrollTo(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return{ctx,els,buttons,run:s=>vm.runInContext(s,ctx)};
}
test('preview renders a complete menu chapter, prices and allergens safely',()=>{
 const {run,els}=setup();
 run(`transformCsvToMenu([{categoria:'Caffetteria',nome:'Caffè <img src=x onerror=alert(1)>',descrizione:'<script>unsafe</script>',prezzo:'1,20',allergeni:'latte',disponibile:'SOLDOUT'},{categoria:'Caffetteria',nome:'Senza prezzo',prezzo:''}]);showCategory('calde',null)`);
 const html=els['menu-container'].innerHTML;
 assert.match(html,/<h2>Caffetteria/);assert.match(html,/01<small> \/ 06/);assert.match(html,/<article/);assert.match(html,/€ 1,20/);assert.match(html,/Prezzo da verificare/);assert.match(html,/Terminato/);assert.match(html,/Latte/);assert.doesNotMatch(html,/<img|<script>/);
});
test('selection keeps exactly one accessible tab, arrows stop at category ends',()=>{
 const {run,buttons,els}=setup();
 run("showCategory('dolci',null)");
 assert.equal(buttons.filter(b=>b.attributes['aria-selected']==='true').length,1);assert.equal(buttons.at(-1).tabIndex,0);assert.equal(els['category-next'].disabled,true);
 run('scrollCategories(1)');assert.equal(buttons.at(-1).attributes['aria-selected'],'true');
 run("showCategory('calde',null)");assert.equal(els['category-prev'].disabled,true);assert.equal(buttons[0].tabIndex,0);
});
test('search spans categories and clearing restores selection without stale products',()=>{
 const {run,els}=setup();run("transformCsvToMenu([{categoria:'Caffetteria',nome:'Caffè',prezzo:'1'},{categoria:'Dolci',nome:'Cornetto',prezzo:'2'}]);showCategory('dolci',null)");
 els['menu-search'].value='Caffè';run('searchMenu()');assert.match(els['menu-container'].innerHTML,/Risultati ricerca/);assert.match(els['menu-container'].innerHTML,/Caffè/);assert.doesNotMatch(els['menu-container'].innerHTML,/Cornetto/);
 els['menu-search'].value='';run('searchMenu()');assert.match(els['menu-container'].innerHTML,/Cornetto/);assert.doesNotMatch(els['menu-container'].innerHTML,/Caffè/);
});
test('Christmas schedule updates presentation and resets outside its dates',()=>{
 const {run,ctx,els}=setup();run("transformCsvToMenu([{categoria:'IMPOSTAZIONE',nome:'tema',descrizione:'natale',data_inizio:'01/12/2026',data_fine:'31/12/2026'}]);applyScheduledContent('2026-12-15')");assert.equal(ctx.document.body.dataset.season,'natale');assert.equal(els['bar-logo'].src,'../assets/logo-natale-256.webp');assert.ok(els['seasonal-theme']);run("applyScheduledContent('2027-01-01')");assert.equal(ctx.document.body.dataset.season,'normale');assert.equal(els['seasonal-theme'],undefined);
});

test('explicit normal and essential previews override stored preference without leaking between designs',()=>{
 const init=fs.readFileSync(path.join(__dirname,'../view-init.js'),'utf8');
 for(const [search,saved,expected] of [['?vista=normale','true',false],['?vista=essenziale','false',true],['','true',true],['','false',false]]){
  let actual;let key;
  vm.runInNewContext(init,{URLSearchParams,location:{search,pathname:'/menu-banco/'},localStorage:{getItem(k){key=k;return saved}},document:{body:{classList:{toggle(_,state){actual=state}}}}});
  assert.equal(actual,expected);assert.equal(key,'lucciola:preview:lite:/menu-banco/');
 }
 let fallback;
 vm.runInNewContext(init,{URLSearchParams,location:{search:'?vista=essenziale',pathname:'/menu-carta/'},localStorage:{getItem(){throw Error('blocked')}},document:{body:{classList:{toggle(_,state){fallback=state}}}}});assert.equal(fallback,true);
});
test('view toggle preserves category and theme and only writes the current preview preference',()=>{
 const {ctx,run,els}=setup('/menu-bosco/');let lite=false;const writes=[];let nextUrl='';
 ctx.document.body.classList.toggle=()=>lite=!lite;
 ctx.localStorage.setItem=(k,v)=>writes.push([k,v]);
 ctx.window.location.href='https://example.test/menu-bosco/?categoria=dolci&tema=natale';
 ctx.window.history={replaceState(_,__,u){nextUrl=u}};
 run('toggleLiteMode()');assert.equal(els['lite-switch'].attributes['aria-pressed'],'true');assert.deepEqual(writes,[['lucciola:preview:lite:/menu-bosco/','true']]);assert.match(nextUrl,/categoria=dolci/);assert.match(nextUrl,/tema=natale/);assert.match(nextUrl,/vista=essenziale/);
});

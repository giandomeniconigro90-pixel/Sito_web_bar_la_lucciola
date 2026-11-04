const test = require('node:test');
const assert = require('node:assert/strict');
const site = require('./site-core.js');
const fullRows = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'].map(day => ({day,start:'07:00',end:'21:00'}));
const result = data => ({meta:{fields:['day','start','end']},data,errors:[]});
test('category links allow only the known menu categories', () => {
  assert.equal(site.categoryFromSearch('?categoria=dolci'),'dolci');
  assert.equal(site.categoryFromSearch('?categoria=aperitivi&tema=natale'),'aperitivi');
  for (const value of ['?categoria=<img>','?categoria=other','']) assert.equal(site.categoryFromSearch(value),null);
});
test('hours require all seven days and reject malformed, conflicting or unsafe values', () => {
  assert.equal(site.validHoursResults(result(fullRows)),true);
  assert.equal(site.validHoursResults(result(fullRows.slice(1))),false);
  for (const bad of [{start:'24:00',end:'02:00'},{start:'29:20',end:'21:00'},{start:'07:00',end:'07:00'},{start:'<img>',end:'21:00'}]) assert.equal(site.validHoursResults(result([{...fullRows[0],...bad},...fullRows.slice(1)])),false);
  assert.equal(site.validHoursResults(result([...fullRows,{day:'Lun',start:'CHIUSO',end:''}])),false);
  assert.equal(site.validHoursResults({...result(fullRows),errors:[{message:'bad CSV'}]}),false);
});
test('closed days and split opening periods are parsed correctly', () => {
  const rows=[{day:'Lun',start:'07:00',end:'12:00'},{day:'Lun',start:'16:00',end:'21:00'},{day:'Mar',start:'CHIUSO',end:''}];
  const schedule=site.parseHoursCsv(rows);
  assert.equal(site.formatDaySlots(schedule[1]),'07:00–12:00 / 16:00–21:00');
  assert.equal(site.formatDaySlots(schedule[2]),'Chiuso');
  assert.equal(site.isOpenNow(schedule,new Date(2026,10,2,13,0)),false);
  assert.equal(site.isOpenNow(schedule,new Date(2026,10,2,17,0)),true);
});
test('opening boundaries, midnight and Rome daylight saving are correct', () => {
  const schedule=site.parseHoursCsv([{day:'Lun',start:'22:00',end:'02:00'}]);
  assert.equal(site.isOpenNow(schedule,new Date(2026,10,2,21,59)),false);
  assert.equal(site.isOpenNow(schedule,new Date(2026,10,2,22,0)),true);
  assert.equal(site.isOpenNow(schedule,new Date(2026,10,3,1,59)),true);
  assert.equal(site.isOpenNow(schedule,new Date(2026,10,3,2,0)),false);
  assert.equal(site.isOpenNow(null),null);
  assert.equal(site.venueNow(new Date('2026-07-01T12:00:00Z')).getHours(),14);
  assert.equal(site.venueNow(new Date('2026-12-01T12:00:00Z')).getHours(),13);
});
test('live data is cached, failures use only validated recent cache', async () => {
  const memory=new Map();const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const live=await site.loadHours({parse:(_,options)=>options.complete(result(fullRows))},storage);
  assert.equal(live.source,'live');
  const cached=await site.loadHours({parse:(_,options)=>options.error()},storage);
  assert.equal(cached.source,'cache');assert.deepEqual(cached.schedule,live.schedule);
  const key=[...memory.keys()][0];memory.set(key,JSON.stringify({schedule:live.schedule,updatedAt:Date.now()-8*86400000}));
  assert.equal((await site.loadHours(null,storage)).source,'unavailable');
  memory.set(key,JSON.stringify({schedule:{0:[]},updatedAt:Date.now()}));
  assert.equal((await site.loadHours(null,storage)).schedule,null);
});
test('blocked storage and malformed CSV never claim live opening status', async () => {
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.equal((await site.loadHours({parse:(_,o)=>o.complete(result(fullRows))},blocked)).source,'live');
  const failure=await site.loadHours({parse:(_,o)=>o.complete(result([{day:'Lun',start:'07:00',end:'21:00'}]))},blocked);
  assert.equal(failure.source,'unavailable');assert.equal(failure.schedule,null);
});

// Loop-drive timing engine. Moved out of the v0 planner (v0.html, between ==LOGIC== markers)
// with the logic unchanged; the data now comes from the trip content pack (trips/<slug>/*.json).
// tests/engine-parity.test.js runs this module and the v0 block side by side and fails on any
// difference in stops, times, meals or alerts.
//
// Deliberate changes from v0, from the Reef Atlas change list:
//   6. CHamoru names lead, so alert copy says Litekyan where v0 said Ritidian.

export const DINNER_MIN = 75;
export const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dowOf(date){ const [y,m,d]=date.split("-").map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay(); }
export function fmt(min){ min=Math.round(min); let h=Math.floor(min/60)%24, m=min%60; const ap=h>=12?"p.m.":"a.m."; h=h%12||12; return `${h}:${String(m).padStart(2,"0")} ${ap}`; }
export function fmtS(min){ min=Math.round(min); let h=Math.floor(min/60)%24, m=min%60; h=h%12||12; return `${h}:${String(m).padStart(2,"0")}`; }
export function ap(min){ return (Math.floor(Math.round(min)/60)%24)>=12?"pm":"am"; }
export function dur(min){ min=Math.round(min); const h=Math.floor(min/60), m=min%60; return h? (m? `${h} hr ${m} min`:`${h} hr`) : `${m} min`; }
export function parseHM(s){ const [h,m]=s.split(":").map(Number); return h*60+m; }

// NOAA approximation of sunset for Guam (UTC+10, no daylight saving)
export function sunTimes(date, lat=13.45, lon=144.75, tz=10){
  const [y,mo,d]=date.split("-").map(Number);
  const start=Date.UTC(y,0,1), N=Math.round((Date.UTC(y,mo-1,d)-start)/864e5)+1;
  const g=2*Math.PI/365*(N-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const r=Math.PI/180, la=lat*r;
  const ha=Math.acos(Math.cos(90.833*r)/(Math.cos(la)*Math.cos(dec))-Math.tan(la)*Math.tan(dec))/r;
  return { sunrise:720-4*(lon+ha)-eq+tz*60, sunset:720-4*(lon-ha)-eq+tz*60 };
}

// pack: { stops, restaurants, road, profiles, calendar }
export function createEngine(pack){
  const L = pack.road.loopMinutes;
  const HOME = pack.road.home;
  const NODES = pack.road.nodes;
  const SHORT = pack.road.chords[0];
  const STOPS = pack.stops;
  const RESTAURANTS = pack.restaurants;
  const PROFILES = pack.profiles.profiles;
  const FED_HOLIDAYS = new Set(pack.calendar.federalHolidays);

  function ritidianStatus(date, cond){
    const dw=dowOf(date);
    if(FED_HOLIDAYS.has(date)) return {open:false,why:"a federal holiday",code:"holiday"};
    if(dw===1||dw===2) return {open:false,why:`a ${DOW[dw]}`,code:"weekday"};
    if(cond.surf) return {open:false,why: cond.surfFromLive ? "a rough-surf day in the forecast, when the refuge often closes (check its status page before you go)" : "a high surf day (the refuge closes during hazardous ocean conditions)",code:"surf"};
    if(cond.ritClosedLive && cond.ritClosedLive===date) return {open:false,why:"a day Fish & Wildlife lists the refuge as closed",code:"fws"};
    return {open:true};
  }

  // Shortest driving minutes on the loop plus the Route 4 cross-island link
  function ring(a,b){ const d=((b-a)%L+L)%L; return d<=L-d ? {d,cw:true} : {d:L-d,cw:false}; }
  function legMinutes(A,B){
    if(A.id===B.id) return {min:0,short:false,type:"ring"};
    const a=A.loop, b=B.loop;
    let best={min:ring(a,b).d,type:"ring"};
    const c1=ring(a,SHORT.a).d+SHORT.cost+ring(SHORT.b,b).d;
    const c2=ring(a,SHORT.b).d+SHORT.cost+ring(SHORT.a,b).d;
    if(c1<best.min) best={min:c1,type:"a2b"};
    if(c2<best.min) best={min:c2,type:"b2a"};
    return {min:Math.round(best.min+(A.spur||0)+(B.spur||0)), short:best.type!=="ring", type:best.type};
  }

  function dwellFor(s, profile, cond){
    const [lo,hi]=s.dur;
    if(s.swim && cond.water) return 15;
    const f={express:0.25,full:0.5,explorer:0.7}[profile];
    return Math.round((lo+(hi-lo)*f)/5)*5;
  }

  function orderKey(s,dir,lateTL){
    // With nothing else in the north on the plan, Two Lovers moves to the evening in clockwise order
    if(lateTL && s.id==="two-lovers" && dir==="cw") return L+s.loop;
    return dir==="cw" ? s.loop : ((L-s.loop)%L);
  }
  function dinnerId(st){ return st.dinnerForced ? st.dinner : (st.dir==="cw" ? "marina" : "fishermans"); }

  function hoursFor(s, dow){
    const h=s.hours; if(!h) return null;
    if(h.byDay) return h.byDay[dow] ? {open:h.byDay[dow][0],close:h.byDay[dow][1]} : {closed:true};
    if(h.days && !h.days.includes(dow)) return {closed:true};
    return {open:h.open,close:h.close};
  }

  function isIncluded(s, st){
    if(s.kind==="meal") return false;
    const ov=st.overrides[s.id];
    if(st.trip && st.trip.status[s.id]==="skip") return false;
    if(ov!==undefined) return ov;
    return s.profiles.includes(st.profile);
  }

  // Build the plan. st = state; now = Guam minutes (for day-of mode) or null
  function buildPlan(st, now){
    const dw=dowOf(st.date), sun=sunTimes(st.date), prof=PROFILES[st.profile];
    const rit=ritidianStatus(st.date, st.cond);
    const alerts=[];
    let chosen=STOPS.filter(s=>isIncluded(s,st));
    const ritWanted = chosen.some(s=>s.id==="ritidian");
    if(!rit.open){
      chosen=chosen.filter(s=>s.id!=="ritidian");
      if(ritWanted || STOPS.find(s=>s.id==="ritidian").profiles.includes(st.profile))
        alerts.push({lvl:"warn",id:"rit-closed",title:"Litekyan is off today's plan",text:`${new Date(st.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} is ${rit.why}, so the refuge is closed. Pick a Wednesday to Sunday date to include it.`});
    }
    const northIds=new Set(["ritidian","spmp"]);
    const lateTL = !chosen.some(x=>northIds.has(x.id));
    const key=x=>orderKey(x,st.dir,lateTL);
    chosen.sort((a,b)=>key(a)-key(b));

    const trip=st.trip||{on:false,status:{},doneAt:{},extra:{}};
    const done = trip.on ? chosen.filter(s=>trip.status[s.id]==="done") : [];

    function simulate(list, startMin, from){
      const items=[]; let t=startMin, pos=from, drive=0;
      for(const s of list){
        const leg=legMinutes(pos,s);
        drive+=leg.min; t+=leg.min;
        const dwell=(s._meal? s._mealDwell : dwellFor(s,st.profile,st.cond)) + ((trip.extra||{})[s.id]||0);
        items.push({s,leg,arrive:t,depart:t+dwell,dwell}); t+=dwell; pos=s;
      }
      return {items,t,pos,drive};
    }

    const startMin=parseHM(st.start);
    const remaining=chosen.filter(s=>!(trip.on && trip.status[s.id]==="done"));
    let fromPos=HOME, t0=startMin;
    if(trip.on){
      const last=trip.last? (STOPS.find(s=>s.id===trip.last)||RESTAURANTS.find(r=>r.id===trip.last)) : null;
      if(last) fromPos=last;
      if(now!=null) t0=Math.max(now, startMin);
    }
    const order=list=>rotateFrom([...list].sort((a,b)=>key(a)-key(b)), fromPos, key);

    // dinner wanted?
    let dId=dinnerId(st);
    const wantDinner = dId!=="none" && (prof.dinner || st.dinnerForced) && !(trip.on && trip.dinnerDone);

    // lunch: pick the candidate that lands nearest 12:15
    const lunchCands=[STOPS.find(s=>s.id==="jeffs"), RESTAURANTS.find(r=>r.id==="marina")];
    let lunch=null, lunchArr=null;
    if(!(trip.on && trip.lunchDone)){
      const scored=lunchCands.map(c=>{
        const m=Object.assign({},c,{_meal:true,_mealDwell:prof.meal,cats:["seafood"],kind:"meal"});
        const sim=simulate(order([...remaining,m]), t0, fromPos);
        const it=sim.items.find(i=>i.s===m);
        const late=it.arrive>14*60+30, early=it.arrive<10*60+45;
        return {m,arrive:it.arrive,score:Math.abs(it.arrive-(12*60+15))+(early?120:0)+(late?120:0)};
      }).sort((x,y)=>x.score-y.score);
      let pick=scored[0];
      if(wantDinner && pick.m.id===dId){
        const alt=scored.find(x=>x.m.id!==dId && x.arrive>=10*60+45 && x.arrive<=14*60+30);
        if(alt) pick=alt;
        else if(!st.dinnerForced){
          const fall=(st.dir==="cw"?["crab","beachin","fishermans"]:["fishermans","beachin","crab"]).find(x=>x!==pick.m.id);
          alerts.push({lvl:"info",id:"dinner-moved",title:`Dinner moved to ${RESTAURANTS.find(r=>r.id===fall).name}`,text:`Lunch works out best at ${pick.m.name} today, so dinner goes somewhere else. Change it under Eat.`});
          dId=fall;
        } else alerts.push({lvl:"info",id:"same-place",title:"Lunch and dinner at the same place",text:`Both meals land at ${pick.m.name}. Pick another dinner under Eat if you want variety.`});
      }
      // past mid-afternoon in day-of mode, skip lunch
      if(!(trip.on && t0>14*60)) { lunch=pick.m; lunchArr=pick.arrive; }
    }
    const sim=simulate(order(lunch?[...remaining,lunch]:remaining), t0, fromPos);

    let dinner=null, dinnerItem=null, homeLeg, endT=sim.t, drive=sim.drive;
    if(wantDinner){
      const r=RESTAURANTS.find(x=>x.id===dId)||RESTAURANTS[0];
      const leg=legMinutes(sim.pos,r);
      const raw=sim.t+leg.min;
      const floor=Math.max(17*60+30, r.hours? r.hours.open : 0);
      const arrive=Math.max(raw,floor);
      dinner=r; dinnerItem={s:r,leg,arrive,depart:arrive+DINNER_MIN,dwell:DINNER_MIN,spare:arrive-raw,spareAt:sim.t};
      drive+=leg.min; endT=arrive+DINNER_MIN;
      homeLeg=legMinutes(r,HOME);
    }
    if(!homeLeg) homeLeg=legMinutes(sim.pos,HOME);
    drive+=homeLeg.min; const homeT=endT+homeLeg.min;

    // per-item warnings
    for(const it of sim.items){
      it.flags=[];
      const s=it.s;
      if(s.id==="ritidian"){
        if(it.arrive>15*60+30) it.flags.push({lvl:"crit",t:`Arrives ${fmt(it.arrive)}. The gate closes at 4:00 p.m., so this would be a very short visit at best.`});
        else if(it.depart>16*60) it.flags.push({lvl:"warn",t:`The gate closes at 4:00 p.m., leaving about ${dur(16*60-it.arrive)} here.`});
        if(s.status) it.flags.push({lvl:"info",t:s.status});
      }
      if(s.id==="two-lovers" && it.arrive<600) it.flags.push({lvl:"info",t:`Arrives ${fmt(it.arrive)}. The lookout may not be open yet (listings say 7 or 10 a.m.). The grounds are still worth a look, or come back at sunset.`});
      if(s.id==="inalahan-village"){
        if(it.arrive>=720) it.flags.push({lvl:"info",t:`Gef Pa'go demonstrations end at noon; you arrive about ${fmt(it.arrive)}. Walk the village instead, or plan a southern morning another day.`});
        else it.flags.push({lvl:"info",t:`You arrive before noon, in time for Gef Pa'go's 9 a.m. to noon demonstrations.`});
      }
      if(s.swim && st.cond.water) it.flags.push({lvl:"warn",t:"Water-quality advisory set. Treat this as a scenic stop and stay out of the water."});
      if(s.swim && st.cond.surf) it.flags.push({lvl:"warn",t:"High surf: watch for surge over the rocks before going in."});
      if(s.checkSameDay) it.flags.push({lvl:"info",t:"Check same-day availability, ticketing and operating conditions."});
      const h=s.hours? hoursFor(s,dw):null;
      if(h && h.closed && s.id!=="ritidian") it.flags.push({lvl:"warn",t:`Reported closed on ${DOW[dw]}s.`});
      if(h && !h.closed && s.id!=="inalahan-village" && s.id!=="two-lovers" && s.id!=="ritidian" && (it.arrive<h.open||it.arrive>h.close-20)) it.flags.push({lvl:"warn",t:`Arrives ${fmt(it.arrive)}, outside reported hours (${fmt(h.open)} to ${fmt(h.close)}).`});
      if(!s._meal && s.cats.includes("viewpoint") && it.arrive>sun.sunset-10) it.flags.push({lvl:"warn",t:`Arrives after sunset (${fmt(sun.sunset)}). The view will be gone.`});
    }
    if(dinnerItem){
      dinnerItem.flags=[];
      const h=dinner.hours;
      if(h && dinnerItem.arrive<h.open) dinnerItem.flags.push({lvl:"info",t:`You would arrive ${fmt(dinnerItem.arrive)}; dinner service is reported to start at ${fmt(h.open)}.`});
      if(h && dinnerItem.arrive>h.close-45) dinnerItem.flags.push({lvl:"warn",t:`Arrives ${fmt(dinnerItem.arrive)}, close to the reported closing time.`});
      if(!h) dinnerItem.flags.push({lvl:"info",t:dinner.hoursNote});
    }

    // plan-level alerts
    const ritItem=sim.items.find(i=>i.s.id==="ritidian");
    if(ritItem && ritItem.arrive>14*60+50) alerts.push({lvl:"crit",id:"rit-late",title:"Litekyan comes too late in this direction",text:`You would reach the refuge at ${fmt(ritItem.arrive)}, and it closes at 4:00 p.m. Drive clockwise to arrive in the morning, or save Litekyan for a north-coast day.`,action:st.dir==="ccw"?{label:"Switch to clockwise",fn:"setDir",arg:"cw"}:null});
    const late=sim.items.filter(i=>!i.s._meal && i.arrive>sun.sunset-10 && i.s.cats.some(c=>c==="viewpoint"||c==="swimming"));
    if(late.length) alerts.push({lvl:"warn",id:"dark",title:trip.on?"Prioritize the south today":"Not enough daylight for every stop",text:`${late.map(i=>i.s.short_name||i.s.name).join(", ")} would come after sunset (${fmt(sun.sunset)}). Trim optional stops to keep the essentials in daylight.`,action:{label:"Trim to essentials",fn:"trim"}});
    if(homeT>21*60) alerts.push({lvl:"warn",id:"long",title:"A long day",text:`Projected return is ${fmt(homeT)}. Consider Scenic Express or skipping a stop.`});
    if(st.cond.rain) alerts.push({lvl:"info",id:"rain",title:st.cond.rainFromLive?"Rain likely this afternoon (forecast)":"Rain likely this afternoon",text:"Prioritize overlooks and historic sites before any swimming stop. Pools turn murky after heavy runoff, and Cetti Bay loses its view in cloud."});
    if(st.cond.water) alerts.push({lvl:"warn",id:"water",title:"Water-quality advisory",text:"Keep Inalåhan as a scenic stop, but do not plan to enter the water. The plan shortens that stop to 15 minutes."});
    if(st.cond.surf) alerts.push({lvl:"warn",id:"surf",title:st.cond.surfFromLive?"Rough surf in the forecast":"High surf advisory",text:"Litekyan closes in hazardous ocean conditions, so it is off the plan. Skip pier jumping at Malesso' and watch for surge at the pools."});
    if(dw===3) alerts.push({lvl:"ok",id:"wed",title:"It's a Wednesday",text:"Chamorro Village in Hagåtña holds its night market from 5:30 to 9:30 p.m., with barbecue, local produce, crafts and dancing. It is 10 minutes from Oceanview Drive if you want to end the day there."});

    return {items:sim.items, dinnerItem, dinnerId:dinner?dinner.id:null, homeLeg, homeT, endT, drive, sun, rit, alerts, lunch, t0, fromPos, done, lateTL};
  }

  // Rotate a sorted list so the first element is the next stop after `from` in travel order
  function rotateFrom(list, from, key){
    if(!from || from.id==="home") return list;
    const inList=list.some(s=>s.id===from.id);
    const k = inList ? key(list.find(s=>s.id===from.id)) : key(from);
    const after=list.filter(s=>key(s)>k && s.id!==from.id), before=list.filter(s=>key(s)<=k && s.id!==from.id);
    return [...after,...before];
  }

  // Restaurant ranking for the Eat tab
  function rankDinner(st, plan){
    const mood=st.mood;
    const lastPos = plan.items.length? plan.items[plan.items.length-1].s : HOME;
    const directHome = legMinutes(lastPos,HOME).min;
    return RESTAURANTS.map(r=>{
      const toR=legMinutes(lastPos,r).min, toHome=legMinutes(r,HOME).min;
      let score=0;
      if(r.moods.includes(mood)) score+=10;
      if(mood==="grilled"){ score+= (r.fits.grilled?4:0)+(r.fits.lowCarb?2:0)+(r.fits.sashimi?1:0); }
      if(mood==="quick") score+= Math.max(0,30-toHome);
      if(mood==="refined" && r.price==="$$$$") score+=5;
      score += Math.max(0, 12-(toR+toHome-directHome)/3);
      return {r,toR,toHome,extra:toR+toHome-directHome,score};
    }).sort((a,b)=>b.score-a.score);
  }

  // Map geometry helpers (from the v0 map view)
  function loopPoint(m){
    m=((m%L)+L)%L;
    for(let i=0;i<NODES.length-1;i++){ const a=NODES[i],b=NODES[i+1]; if(m>=a[0]&&m<=b[0]){ const t=(m-a[0])/((b[0]-a[0])||1); return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; } }
    return [NODES[0][1],NODES[0][2]];
  }
  function legPath(A,B,leg){
    const pts=[[A.lat,A.lon]];
    const walk=(from,to)=>{ const r=ring(from,to); for(let k=2;k<r.d;k+=2) pts.push(loopPoint(r.cw?from+k:from-k)); pts.push(loopPoint(to)); };
    pts.push(loopPoint(A.loop));
    if(leg.type==="a2b"){ walk(A.loop,SHORT.a); SHORT.via.forEach(v=>pts.push(v)); walk(SHORT.b,B.loop); }
    else if(leg.type==="b2a"){ walk(A.loop,SHORT.b); [...SHORT.via].reverse().forEach(v=>pts.push(v)); walk(SHORT.a,B.loop); }
    else walk(A.loop,B.loop);
    pts.push([B.lat,B.lon]);
    return pts;
  }

  return { L, HOME, STOPS, RESTAURANTS, PROFILES, MOODS: pack.profiles.dinnerMoods,
    ritidianStatus, legMinutes, dwellFor, orderKey, dinnerId, hoursFor, isIncluded, buildPlan, rankDinner, loopPoint, legPath };
}

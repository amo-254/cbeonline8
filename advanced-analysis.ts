import type { RawScore } from './merit';
import { cbeLevel, cbePoints, LEARNING_AREAS } from './grading';

export type LearnerSnapshot = { learnerId:number; admissionNo:string; learnerName:string; grade:string; stream:string; areas:Record<string,number>; average:number };
export type AnalysisSnapshot = { learners:LearnerSnapshot[]; overall:number; areas:Array<{rank:number;area:string;average:number;previousAverage:number|null;deviation:number|null;level:string;points:number;count:number;levels:Record<string,number>}>; streams:Array<{rank:number;stream:string;learners:number;average:number}>; topLearners:Array<LearnerSnapshot & {rank:number;level:string;points:number}>; bestByArea:Array<{area:string;learner:LearnerSnapshot;score:number}>; improvements:Array<{rank:number;learner:LearnerSnapshot;previous:number;current:number;deviation:number}>; areaImprovements:Array<{area:string;learner:LearnerSnapshot;previous:number;current:number;deviation:number}> };

function snapshot(scores:RawScore[]):LearnerSnapshot[] {
 const map=new Map<number,LearnerSnapshot>();
 for(const s of scores){ if(s.score===null||s.maxScore===null||s.maxScore<=0) continue;
  let l=map.get(s.learnerId); if(!l){l={learnerId:s.learnerId,admissionNo:s.admissionNo,learnerName:s.learnerName,grade:s.grade??'',stream:s.stream??'Unassigned',areas:{},average:0};map.set(s.learnerId,l)}
  l.areas[s.learningArea]=Number(s.score)*100/Number(s.maxScore);
 }
 for(const l of map.values()){const values=Object.values(l.areas);l.average=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
 return [...map.values()];
}

/** Ports V67 _analysis_snapshot and analysis_pdf_report calculations. */
export function buildAdvancedAnalysis(currentScores:RawScore[], previousScores:RawScore[]|null, topN=10):AnalysisSnapshot {
 const learners=snapshot(currentScores), previous=snapshot(previousScores??[]), prevById=new Map(previous.map(x=>[x.learnerId,x]));
 const overall=learners.length?learners.reduce((a,x)=>a+x.average,0)/learners.length:0;
 const areaCurrent=new Map<string,number[]>(),areaPrevious=new Map<string,number[]>();
 for(const l of learners)for(const [a,p] of Object.entries(l.areas)){const v=areaCurrent.get(a)??[];v.push(p);areaCurrent.set(a,v)}
 for(const l of previous)for(const [a,p] of Object.entries(l.areas)){const v=areaPrevious.get(a)??[];v.push(p);areaPrevious.set(a,v)}
 const areas=[...areaCurrent.entries()].map(([area,values])=>{const average=values.reduce((a,b)=>a+b,0)/values.length;const pv=areaPrevious.get(area);const previousAverage=pv?.length?pv.reduce((a,b)=>a+b,0)/pv.length:null;const levels:Record<string,number>={EE1:0,EE2:0,ME1:0,ME2:0,AE1:0,AE2:0,BE1:0,BE2:0};for(const p of values)levels[cbeLevel(p).level]++;return {rank:0,area,average,previousAverage,deviation:previousAverage===null?null:average-previousAverage,level:cbeLevel(average).level,points:cbePoints(average),count:values.length,levels};}).sort((a,b)=>b.average-a.average||a.area.localeCompare(b.area));
 areas.forEach((a,i)=>a.rank=i+1);
 const streamMap=new Map<string,number[]>();for(const l of learners){const v=streamMap.get(l.stream)||[];v.push(l.average);streamMap.set(l.stream,v)}
 const streams=[...streamMap.entries()].map(([stream,v])=>({rank:0,stream,learners:v.length,average:v.reduce((a,b)=>a+b,0)/v.length})).sort((a,b)=>b.average-a.average);streams.forEach((s,i)=>s.rank=i+1);
 const topLearners=[...learners].sort((a,b)=>b.average-a.average||a.learnerName.localeCompare(b.learnerName)).slice(0,topN).map((l,i)=>({...l,rank:i+1,level:cbeLevel(l.average).level,points:cbePoints(l.average)}));
 const bestByArea=LEARNING_AREAS.flatMap(area=>{const candidates=learners.filter(l=>l.areas[area]!==undefined).sort((a,b)=>b.areas[area]-a.areas[area]);return candidates.length?[{area,learner:candidates[0],score:candidates[0].areas[area]}]:[]});
 const improvements=learners.flatMap(l=>{const p=prevById.get(l.learnerId);return p?[{rank:0,learner:l,previous:p.average,current:l.average,deviation:l.average-p.average}]:[]}).sort((a,b)=>b.deviation-a.deviation||a.learner.learnerName.localeCompare(b.learner.learnerName)).slice(0,topN);improvements.forEach((x,i)=>x.rank=i+1);
 const areaImprovements=LEARNING_AREAS.flatMap(area=>{const candidates=learners.flatMap(l=>{const p=prevById.get(l.learnerId);return p&&l.areas[area]!==undefined&&p.areas[area]!==undefined?[{area,learner:l,previous:p.areas[area],current:l.areas[area],deviation:l.areas[area]-p.areas[area]}]:[]}).sort((a,b)=>b.deviation-a.deviation);return candidates.slice(0,1)});
 return {learners,overall,areas,streams,topLearners,bestByArea,improvements,areaImprovements};
}

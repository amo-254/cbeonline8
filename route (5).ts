import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const typeOrder:Record<string,number>={"Opener Assessment":1,"Continuous Assessment":2,"Mid-Term Assessment":3,"End Term Assessment":4,"End Year Assessment":5};
const preferred:Record<string,string[]>={"Mid-Term Assessment":["Opener Assessment"],"End Term Assessment":["Mid-Term Assessment","Opener Assessment"],"End Year Assessment":["Mid-Term Assessment","End Term Assessment","Opener Assessment"],"Continuous Assessment":["Mid-Term Assessment","Opener Assessment"]};
function termNo(term:string){const m=String(term??"").match(/(\d+)/);return m?Number(m[1]):0;}
function previousAssessment(current:{id:number;grade:string;term:string;year:number;assessmentType:string}, candidates:Array<{id:number;grade:string;term:string;year:number;assessmentType:string}>){
 const same=candidates.filter(x=>x.id!==current.id&&x.grade===current.grade&&x.year===current.year&&x.term===current.term);
 for(const type of preferred[current.assessmentType]??[]){const found=same.find(x=>x.assessmentType===type);if(found)return found;}
 return candidates.filter(x=>x.id!==current.id&&x.grade===current.grade&&(x.year<current.year||(x.year===current.year&&(termNo(x.term)<termNo(current.term)||(termNo(x.term)===termNo(current.term)&&(typeOrder[x.assessmentType]??0)<(typeOrder[current.assessmentType]??99)))))).sort((a,b)=>b.year-a.year||termNo(b.term)-termNo(a.term)||(typeOrder[b.assessmentType]??0)-(typeOrder[a.assessmentType]??0))[0]??null;
}
function teacherFilter<T extends {learningArea:string;gradeAtAssessment:string|null;streamAtAssessment:string|null;learner:{className:string|null;stream:string|null}}>(scores:T[],assignments:Array<{learningArea:string;className:string;stream:string}>){
 const allowed=new Set(assignments.map(a=>`${a.learningArea}|${a.className}|${a.stream}`));
 return scores.filter(x=>allowed.has(`${x.learningArea}|${x.gradeAtAssessment??x.learner.className}|${x.streamAtAssessment??x.learner.stream}`));
}
function shape(scores:Array<any>){return scores.map(x=>({learnerId:x.learnerId,admissionNo:x.learner.admissionNo,learnerName:x.learner.name,grade:x.gradeAtAssessment??x.learner.className,stream:x.streamAtAssessment??x.learner.stream,learningArea:x.learningArea,score:x.score,maxScore:x.maxScore}));}
export async function GET(req:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 const id=Number(new URL(req.url).searchParams.get("assessmentId"));if(!Number.isInteger(id)||id<1)return NextResponse.json({error:"Select an assessment."},{status:400});
 const assessment=await prisma.assessment.findFirst({where:{id,deleted:false}});if(!assessment)return NextResponse.json({error:"Assessment not found."},{status:404});
 const candidates=await prisma.assessment.findMany({where:{deleted:false},select:{id:true,grade:true,term:true,year:true,assessmentType:true}});
 const previous=previousAssessment(assessment,candidates);
 const include={learner:true};
 const [currentRows,previousRows]=await Promise.all([
  prisma.score.findMany({where:{assessmentId:id},include,orderBy:[{learner:{name:"asc"}},{learningArea:"asc"}],take:20000}),
  previous?prisma.score.findMany({where:{assessmentId:previous.id},include,orderBy:[{learner:{name:"asc"}},{learningArea:"asc"}],take:20000}):Promise.resolve([]),
 ]);
 let current=currentRows, prior=previousRows;
 if(session.role==="Teacher"){
  const teacher=await prisma.teacher.findUnique({where:{username:session.username},include:{assignments:true}});
  if(!teacher)return NextResponse.json({error:"Teacher account not linked."},{status:403});
  current=teacherFilter(currentRows,teacher.assignments);prior=teacherFilter(previousRows,teacher.assignments);
 }
 return NextResponse.json({assessment,previousAssessment:previous,scores:shape(current),previousScores:shape(prior)});
}

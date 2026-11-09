import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
export async function GET(){
 const s=await getSession(); if(!s)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(s.role==="Administrator")return NextResponse.json({assignments:[],classAssignments:[]});
 const teacher=await prisma.teacher.findUnique({where:{username:s.username},include:{assignments:true,classAssignments:true}});
 return NextResponse.json({assignments:teacher?.assignments??[],classAssignments:teacher?.classAssignments??[]});
}

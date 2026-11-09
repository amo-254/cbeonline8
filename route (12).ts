import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

export async function POST(req:Request){
 try{
  const body=await req.json();const username=String(body.username||"").trim();const password=String(body.password||"");
  if(!username||!password)return NextResponse.json({error:"Enter your username and password."},{status:400});
  const user=await prisma.user.findUnique({where:{username}});
  if(!user)return NextResponse.json({error:"Invalid username or password."},{status:401});
  let valid=false;
  if(user.passwordHash.startsWith("$2")) valid=await bcrypt.compare(password,user.passwordHash);
  else valid=createHash("sha256").update(password).digest("hex")===user.passwordHash;
  if(!valid)return NextResponse.json({error:"Invalid username or password."},{status:401});
  if(user.role!=="Administrator"&&user.role!=="Teacher")return NextResponse.json({error:"This account has an unsupported role."},{status:403});
  if(!user.passwordHash.startsWith("$2")){
   const upgraded=await bcrypt.hash(password,12);
   await prisma.user.update({where:{id:user.id},data:{passwordHash:upgraded,passwordDisplay:null}});
  }
  await createSession({id:user.id,username:user.username,role:user.role});
  return NextResponse.json({ok:true,role:user.role});
 }catch(e){console.error(e);return NextResponse.json({error:"Sign-in service is not configured. Check the database and session settings."},{status:500});}
}

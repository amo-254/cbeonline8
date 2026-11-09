import {PrismaClient} from "@prisma/client";
import {createHash} from "crypto";
const prisma=new PrismaClient();
async function main(){
 const count=await prisma.user.count();
 if(count===0){
  // Temporary development accounts only. Change both passwords immediately after first login.
  await prisma.user.createMany({data:[
   {username:"admin",passwordHash:createHash("sha256").update("admin123").digest("hex"),role:"Administrator"},
   {username:"teacher",passwordHash:createHash("sha256").update("teacher123").digest("hex"),role:"Teacher"}
  ]});
  await prisma.teacher.create({data:{name:"Default Teacher",username:"teacher"}});
 }
 await prisma.setting.upsert({where:{key:"school_name"},create:{key:"school_name",value:"CBE PMS"},update:{}});
}
main().finally(()=>prisma.$disconnect());

import "reflect-metadata";
import {NestFactory} from "@nestjs/core";
import {Module,Controller,Get,Post,Param,Req,Res,HttpException,HttpStatus} from "@nestjs/common";
import type {Request,Response} from "express";
import {decodeCode,verifyDevnet} from "@orionx/core";
import multer from "multer";
@Controller("api/v1")
class ApiController {
 @Get("health/live") live(){return {status:"ok",service:"orionx-api"}}
 @Get("health/ready") ready(){return {status:"degraded",chain:process.env.SOLANA_PROGRAM_ID?"configured":"unconfigured",database:process.env.DATABASE_URL?"configured":"unconfigured",source:process.env.GOOGLE_SHEET_ID?"configured":"unconfigured"}}
 @Get("verify/:code") async verify(@Param("code") code:string){try{decodeCode(code);return await verifyDevnet(code)}catch(e){throw new HttpException({message:e instanceof Error?e.message:"Verification unavailable"},HttpStatus.BAD_REQUEST)}}
 @Post("verify/file") async verifyFile(@Req() req:Request,@Res() res:Response){
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:1}}).single("file");
  upload(req,res,async err=>{
   if(err){res.status(413).json({message:"Upload exceeds size or multipart limits."});return}
   try{
    const code=String(req.body?.code||"");decodeCode(code);
    const pdf=req.file;
    if(!pdf||pdf.mimetype!=="application/pdf"||pdf.buffer.subarray(0,5).toString()!=="%PDF-"){res.status(400).json({message:"A valid PDF file is required."});return}
    const result=await verifyDevnet(code,pdf.buffer);
    res.json(result);
   }catch(e){res.status(400).json({message:e instanceof Error?e.message:"Unable to verify document."})}
  });
 }
}
@Module({controllers:[ApiController]})class AppModule{}
async function main(){const app=await NestFactory.create(AppModule);app.enableCors({origin:process.env.WEB_ORIGIN||"http://localhost:3000",methods:["GET","POST"]});await app.listen(Number(process.env.PORT||4000),"0.0.0.0")}
main().catch(e=>{console.error(e);process.exit(1)});

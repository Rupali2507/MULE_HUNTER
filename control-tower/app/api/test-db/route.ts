import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { NextResponse } from "next/server";

export async function GET(){
    try{
        await dbConnect();
        const users = await User.find({});
        
        return NextResponse.json({
            status:"Connected via Mongoose!",
            userCount: users.length,
            data :users
        });
    }catch(e : any){
        return NextResponse.json({ status: "Error", error: e.message }, { status: 500 });
    }
}
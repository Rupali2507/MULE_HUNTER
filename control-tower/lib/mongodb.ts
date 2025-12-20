import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI;

if(!MONGODB_URI){
    throw new Error("Please define MONGODB_URI env variable inside .env.local");
}

async function dbConnect(){
    if(mongoose.connection.readyState >=1){
        return;
    }

    try{
        await mongoose.connect(MONGODB_URI!);
        console.log("MongoDB connected successfully!")
    }catch(err){
        console.error("MongoDB Connection Error:", err);
        throw err;
    }
}

export default dbConnect;
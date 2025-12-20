import mongoose, { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
    name : {type:String, required:true},
    email : {type: String, required : true, unique : true},
    password : {type:String, required : true},
    role : {
        type: String, 
        enum : ["admin", "investigator", "viewer"],
        default : "viewer"
    }, 
    createdAt : {type:Date, default : Date.now},
});

const User = model("User", UserSchema);
export default User;
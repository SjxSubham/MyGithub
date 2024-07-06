import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        default: ""
    },
    profileUrl:{
        type: String,
        required: true,
    },
    avatarUrl:{
        type:String,
    },
    likedProfiles:{
        type:[String],
        defaulr:[],
    },
    likedBy:[
        {
            username: {
                type: String,
            required:true,
            },
            avatarUrl:{
                type: String,
            },
            likedDate:{
                type:Date,
                default:Date.new
            }
        }
    ]
    
},{timestamps: true});

const User =  mongoose.model("User", userSchema);
export default User;
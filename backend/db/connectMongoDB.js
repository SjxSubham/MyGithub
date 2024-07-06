import mongoose from "mongoose";

export default async function connectMongoDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("MOngo DB connected successfully");
    } catch (error) {
        console.log("eRROR cONNECING TO mONGO dB: ", error.message);
    }
}